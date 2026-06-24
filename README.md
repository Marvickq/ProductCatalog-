# Product Catalog Backend

Scalable product catalog API serving ~200,000 products with cursor-based pagination, category filtering, and snapshot consistency.

## Architecture Overview

```
src/
  index.ts              - Express app entry point
  routes/product.ts     - Route definitions
  controllers/product.ts - Request handling & validation
  services/product.ts   - Business logic & database queries
  validators/product.ts - Zod schemas
  utils/cursor.ts       - Base64url cursor encode/decode
  utils/format.ts       - Response formatting
  utils/errorHandler.ts - Global error middleware
  database/client.ts    - Prisma singleton
prisma/
  schema.prisma         - Database schema & indexes
scripts/
  seed.ts               - 200k product data generator
```

Layered architecture: Routes -> Controllers (validation) -> Services (queries) -> Database (Prisma/PostgreSQL).

## Database Schema

```sql
CREATE TABLE products (
  id         BIGSERIAL    PRIMARY KEY,
  name       TEXT         NOT NULL,
  category   TEXT         NOT NULL,
  price      NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP    NOT NULL
);

CREATE INDEX idx_updated_at_id_desc ON products (updated_at DESC, id DESC);
CREATE INDEX idx_category ON products (category);
CREATE INDEX idx_category_updated_at_id_desc ON products (category, updated_at DESC, id DESC);
```

### Index Rationale

| Index                                  | Purpose                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `(updated_at DESC, id DESC)`           | Supports the default sorted query without filters. The composite index on both columns avoids a sort operation and handles the tiebreaker.                                     |
| `(category)`                           | Supports the category filter when used alone (count queries, admin lookups). B-tree enables fast equality lookups.                                                             |
| `(category, updated_at DESC, id DESC)` | Supports filtered queries with cursor pagination. The leading column handles the equality filter, and the trailing columns handle the sort order, enabling an index-only scan. |

## Pagination Strategy

### Cursor-Based (Keyset) Pagination

The API uses cursor-based pagination, not OFFSET.

**How it works:**

1. Each page returns a `nextCursor` — a base64url-encoded JSON object containing `{ updatedAt, id }`.
2. The client sends this cursor back on the next request.
3. The server decodes it and adds a `WHERE` clause using the tuple `(updated_at, id)`:
   ```sql
   WHERE (updated_at < :cursor.updatedAt)
      OR (updated_at = :cursor.updatedAt AND id < :cursor.id)
   ```
4. Combined with `ORDER BY updated_at DESC, id DESC` and `LIMIT N+1`, this produces a stable window.

**Why this was chosen over OFFSET:**

- OFFSET pagination causes **duplicate rows** when a new row is inserted before the current page (rows shift forward).
- It causes **missing rows** when a row is deleted (rows shift backward).
- OFFSET performance degrades as the offset grows because PostgreSQL still scans all skipped rows.
- Cursor pagination is **O(log n)** per page via index seeks, while OFFSET is O(n) for large offsets.

**Why OFFSET was rejected:**

OFFSET pagination is fundamentally unstable under concurrent writes. In a catalog with frequent updates, users will see products jump between pages, see duplicates, or miss products entirely. Cursor pagination eliminates all these issues.

### Snapshot Consistency

When a client requests the first page, the server generates a `snapshotTimestamp` (ISO 8601). This timestamp is returned in the response, and the client includes it on every subsequent page request.

All queries filter with `updated_at <= snapshotTimestamp`. This creates a **stable read view**: products updated during the browsing session are excluded from results, preventing:

- Duplicate products appearing across pages
- Products being skipped
- Reordering mid-session

The snapshot timestamp approach is lightweight (no database snapshots, no `SERIALIZABLE` isolation) and works with any PostgreSQL transaction isolation level.

## API Endpoints

### GET /api/products

List products with cursor-based pagination.

**Query Parameters:**

| Param               | Type   | Default | Description                   |
| ------------------- | ------ | ------- | ----------------------------- |
| `category`          | enum   | —       | Filter by category            |
| `cursor`            | string | —       | Cursor from previous response |
| `limit`             | number | 20      | Page size (max 100)           |
| `snapshotTimestamp` | string | —       | Stable browsing timestamp     |

**Response:**

```json
{
  "data": [
    {
      "id": "1",
      "name": "Premium Laptop #1",
      "category": "Electronics",
      "price": "999.99",
      "createdAt": "2026-06-01T12:00:00.000Z",
      "updatedAt": "2026-06-20T12:00:00.000Z"
    }
  ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI2LTA2LTIwVDEyOjAwOjAwWiIsImlkIjoiMSJ9",
  "snapshotTimestamp": "2026-06-24T12:00:00.000Z",
  "hasMore": true
}
```

### POST /api/products

Create a new product.

```json
{
  "name": "New Product",
  "category": "Electronics",
  "price": 49.99
}
```

### PATCH /api/products/:id

Update an existing product. Only sends fields that change.

## Time Complexity

| Operation                           | Complexity | Notes                                                |
| ----------------------------------- | ---------- | ---------------------------------------------------- |
| First page (no filter)              | O(log n)   | Index seek on `(updated_at DESC, id DESC)`           |
| Subsequent page (no filter)         | O(log n)   | Index seek using cursor                              |
| First page (with category)          | O(log n)   | Index seek on `(category, updated_at DESC, id DESC)` |
| Subsequent page (with category)     | O(log n)   | Index seek using cursor + category                   |
| Product creation                    | O(log n)   | B-tree index insert                                  |
| Product update (touches updated_at) | O(log n)   | Index update on two composite indexes                |

All queries use index-only scans where possible. The `LIMIT N+1` technique avoids a separate count query.

## Consistency Guarantees

- **Read stability**: Snapshot timestamp ensures a consistent view within a browsing session.
- **Cursor monotonicity**: The `(updated_at, id)` tuple is strictly decreasing, so the cursor always moves forward.
- **No phantom reads**: The snapshot timestamp prevents newly updated rows from appearing mid-session.
- **No lost updates**: Prisma's `findUnique` + `update` pattern prevents blind writes.

## Handling Concurrent Updates

- If a product is updated during a session, its `updated_at` changes. The snapshot timestamp filter hides it from the current session, maintaining consistency.
- If a product is created during a session, it gets an `updated_at` >= creation time, which the snapshot filter handles naturally.
- The cursor's `id` tiebreaker ensures deterministic ordering even when multiple rows share the same `updated_at`.

## Cursor Design Decisions

1. **Composite cursor**: Uses both `updated_at` and `id` because `updated_at` alone may have duplicates (multiple products updated in the same transaction).
2. **Base64url encoding**: URL-safe, no special character escaping needed, reversible.
3. **Cursor contains raw values**: Not hashed or encrypted — the cursor is an opaque token, but encoding is reversible for debugging.
4. **No cursor expiry**: The snapshot timestamp provides session-level isolation; stale cursors return empty results gracefully.

## Scalability Considerations

- **Beyond 200k products**: The composite indexes support efficient range scans for millions of rows. The B-tree depth grows logarithmically with table size.
- **Read replicas**: The service is stateless; add a read replica pool and point Prisma at it for read queries.
- **Connection pooling**: Use PgBouncer or Supabase's built-in pooler for high concurrency.
- **Horizontal scaling**: The Express app is stateless; deploy behind a load balancer.
- **Caching**: Add Redis for hot categories or frequently-accessed pages. Cache keys should include the snapshot timestamp.

## Tradeoffs

| Decision                           | Tradeoff                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot timestamp vs. DB snapshot | Snapshot timestamps may return slightly stale data within a session. True database snapshots require `SERIALIZABLE` isolation or PostgreSQL's `pg_export_snapshot()`, which adds complexity. |
| Cursor vs. OFFSET                  | Cursor prevents duplicates but requires the client to manage cursor state. Users cannot "jump" to arbitrary pages without first collecting all cursors.                                      |
| `LIMIT N+1` vs. count query        | `LIMIT N+1` avoids a potentially expensive count on 200k rows but returns one extra row that must be sliced.                                                                                 |
| Prisma vs. raw SQL                 | Prisma adds some overhead but provides type safety and migrations. For cursor pagination, the generated SQL is efficient due to composite index usage.                                       |

## Future Improvements

- Add GraphQL or tRPC endpoints for flexible querying
- Implement Redis caching for top-level pages
- Add full-text search (PostgreSQL `tsvector`)
- Add batch GET endpoint (`GET /api/products?ids=1,2,3`)
- Implement rate limiting
- Add request logging with correlation IDs
- Add OpenAPI/Swagger documentation
- Add integration tests with testcontainers
- Implement cursor-based pagination for admin endpoints (no snapshot filter)
- Add soft-delete support



### Supabase

1. Create a Supabase project.
2. Copy the connection string (with password) from Project Settings > Database.
3. Set as `DATABASE_URL` environment variable.
4. Run `npx prisma migrate deploy` to apply migrations.
5. Run `npm run seed` to insert 200k products.

### Docker

```bash
docker build -t product-catalog-backend .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." product-catalog-backend
```

## Local Development

```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection string
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

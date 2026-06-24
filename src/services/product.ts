import { Prisma } from "@prisma/client";
import { prisma } from "../database/client";
import { formatProduct } from "../utils/format";
import { decodeCursor, encodeCursor } from "../utils/cursor";
import { Cursor, PaginatedResponse, ProductResponse } from "../types";

const DEFAULT_LIMIT = 20;

export async function getProducts(
  options: {
    category?: string;
    cursor?: string;
    limit?: number;
    snapshotTimestamp?: string;
  } = {}
): Promise<PaginatedResponse<ProductResponse>> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const snapshotTimestamp = options.snapshotTimestamp ?? new Date().toISOString();

  const where: Prisma.ProductWhereInput = {
    updatedAt: { lte: new Date(snapshotTimestamp) },
  };

  if (options.category) {
    where.category = options.category;
  }

  let cursorCondition: Prisma.ProductWhereInput | undefined;

  if (options.cursor) {
    const decoded: Cursor = decodeCursor(options.cursor);
    cursorCondition = {
      OR: [
        { updatedAt: { lt: new Date(decoded.updatedAt) } },
        {
          updatedAt: { equals: new Date(decoded.updatedAt) },
          id: { lt: BigInt(decoded.id) },
        },
      ],
    };
  }

  const finalWhere: Prisma.ProductWhereInput = cursorCondition
    ? { AND: [where, cursorCondition] }
    : where;

  const products = await prisma.product.findMany({
    where: finalWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = products.length > limit;
  const items = hasMore ? products.slice(0, limit) : products;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({
      updatedAt: lastItem.updatedAt.toISOString(),
      id: lastItem.id.toString(),
    });
  }

  return {
    data: items.map(formatProduct),
    nextCursor,
    snapshotTimestamp,
    hasMore,
  };
}

export async function getProductById(id: bigint): Promise<ProductResponse | null> {
  const product = await prisma.product.findUnique({ where: { id } });
  return product ? formatProduct(product) : null;
}

export async function createProduct(data: {
  name: string;
  category: string;
  price: number;
}): Promise<ProductResponse> {
  const product = await prisma.product.create({
    data: {
      name: data.name,
      category: data.category,
      price: data.price,
    },
  });
  return formatProduct(product);
}

export async function updateProduct(
  id: bigint,
  data: { name?: string; category?: string; price?: number }
): Promise<ProductResponse | null> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return null;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.price !== undefined && { price: data.price }),
    },
  });
  return formatProduct(product);
}

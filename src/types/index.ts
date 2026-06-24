export interface Product {
  id: bigint;
  name: string;
  category: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductResponse {
  id: string;
  name: string;
  category: string;
  price: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cursor {
  updatedAt: string;
  id: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  snapshotTimestamp: string;
  hasMore: boolean;
}

export interface GetProductsQuery {
  category?: string;
  cursor?: string;
  limit?: number;
  snapshotTimestamp?: string;
}

export interface CreateProductBody {
  name: string;
  category: string;
  price: number;
}

export interface UpdateProductBody {
  name?: string;
  category?: string;
  price?: number;
}

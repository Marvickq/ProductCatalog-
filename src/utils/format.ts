import { Product } from "@prisma/client";
import { ProductResponse } from "../types";

export function formatProduct(product: Product): ProductResponse {
  return {
    id: product.id.toString(),
    name: product.name,
    category: product.category,
    price: product.price.toString(),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

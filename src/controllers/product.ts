import { Request, Response } from "express";
import * as productService from "../services/product";
import {
  getProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
} from "../validators/product";

export async function listProducts(req: Request, res: Response): Promise<void> {
  const parsed = getProductsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const result = await productService.getProducts({
    category: parsed.data.category,
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
    snapshotTimestamp: parsed.data.snapshotTimestamp,
  });

  res.json(result);
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const product = await productService.createProduct(parsed.data);
  res.status(201).json(product);
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const id = BigInt(req.params.id as string);

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const product = await productService.updateProduct(id, parsed.data);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(product);
}

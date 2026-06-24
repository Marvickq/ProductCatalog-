import { z } from "zod";

const categories = [
  "Electronics",
  "Books",
  "Fashion",
  "Sports",
  "Home",
  "Beauty",
  "Toys",
  "Automotive",
] as const;

export const getProductsQuerySchema = z.object({
  category: z.enum(categories).optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 20;
      const n = parseInt(val, 10);
      if (isNaN(n) || n < 1) return 20;
      return Math.min(n, 100);
    }),
  snapshotTimestamp: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.enum(categories, {
    errorMap: () => ({ message: `Category must be one of: ${categories.join(", ")}` }),
  }),
  price: z.number().positive("Price must be positive").max(99999999.99),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z
    .enum(categories, {
      errorMap: () => ({ message: `Category must be one of: ${categories.join(", ")}` }),
    })
    .optional(),
  price: z.number().positive("Price must be positive").max(99999999.99).optional(),
});

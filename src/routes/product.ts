import { Router } from "express";
import * as productController from "../controllers/product";

const router = Router();

router.get("/", productController.listProducts);
router.post("/", productController.createProduct);
router.patch("/:id", productController.updateProduct);

export default router;

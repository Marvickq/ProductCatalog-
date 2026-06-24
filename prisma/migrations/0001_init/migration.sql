-- CreateTable
CREATE TABLE "products" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: supports ORDER BY updated_at DESC, id DESC (default sort)
CREATE INDEX "idx_updated_at_id_desc" ON "products"("updated_at" DESC, "id" DESC);

-- CreateIndex: supports filtering by category alone
CREATE INDEX "idx_category" ON "products"("category");

-- CreateIndex: supports filtering by category + ORDER BY updated_at DESC, id DESC
CREATE INDEX "idx_category_updated_at_id_desc" ON "products"("category", "updated_at" DESC, "id" DESC);

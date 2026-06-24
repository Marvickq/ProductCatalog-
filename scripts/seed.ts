import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  "Electronics",
  "Books",
  "Fashion",
  "Sports",
  "Home",
  "Beauty",
  "Toys",
  "Automotive",
];

const ADJECTIVES = [
  "Premium", "Ultra", "Classic", "Modern", "Pro", "Elite", "Smart", "Essential",
  "Deluxe", "Advanced", "Compact", "Portable", "Professional", "Eco", "Smart",
  "Lightweight", "Ergonomic", "Digital", "Wireless", "Rechargeable", "Solar",
  "Multi-purpose", "High-performance", "Slim", "Rugged",
];

const NOUNS: Record<string, string[]> = {
  Electronics: ["Laptop", "Phone", "Tablet", "Camera", "Speaker", "Monitor", "Keyboard", "Mouse", "Headphones", "Charger"],
  Books: ["Novel", "Guide", "Manual", "Cookbook", "Biography", "Anthology", "Dictionary", "Encyclopedia"],
  Fashion: ["Shirt", "Jacket", "Dress", "Shoes", "Hat", "Scarf", "Belt", "Watch", "Bag", "Sunglasses"],
  Sports: ["Ball", "Racket", "Shoes", "Gloves", "Helmet", "Mat", "Bottle", "Bag", "Towel", "Watch"],
  Home: ["Lamp", "Rug", "Pillow", "Vase", "Frame", "Clock", "Mirror", "Basket", "Candle", "Plant"],
  Beauty: ["Cream", "Oil", "Brush", "Mask", "Serum", "Lipstick", "Perfume", "Soap", "Shampoo", "Lotion"],
  Toys: ["Puzzle", "Game", "Figure", "Robot", "Blocks", "Car", "Doll", "Kite", "Drone", "Kit"],
  Automotive: ["Cover", "Mat", "Light", "Charger", "Cleaner", "Organizer", "Camera", "Sensor", "Tool", "Holder"],
};

const PRODUCT_COUNT = 200_000;
const BATCH_SIZE = 5_000;

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice(): number {
  return Math.round((Math.random() * 2000 + 1.99) * 100) / 100;
}

function generateProduct(index: number) {
  const category = CATEGORIES[index % CATEGORIES.length];
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = randomItem(NOUNS[category]);
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 90);
  const secondsAgo = Math.floor(Math.random() * 86400);
  const createdAt = new Date(now.getTime() - daysAgo * 86400000 - secondsAgo * 1000);
  const updatedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 86400000));

  return {
    name: `${adj} ${noun} #${index + 1}`,
    category,
    price: randomPrice(),
    createdAt,
    updatedAt,
  };
}

async function main() {
  console.log(`Seeding ${PRODUCT_COUNT.toLocaleString()} products...`);

  let inserted = 0;

  while (inserted < PRODUCT_COUNT) {
    const batchSize = Math.min(BATCH_SIZE, PRODUCT_COUNT - inserted);
    const batch = Array.from({ length: batchSize }, (_, i) =>
      generateProduct(inserted + i)
    );

    await prisma.product.createMany({ data: batch });
    inserted += batchSize;
    console.log(`Inserted ${inserted.toLocaleString()} / ${PRODUCT_COUNT.toLocaleString()}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

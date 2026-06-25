import fs from "fs";
import path from "path";
import type { Product } from "@orderpilot/shared";

// In-memory catalog cache
const catalogCache = new Map<string, Product[]>();

/**
 * Load the product catalog for a given business.
 * Reads from datasets/catalog/<business_id>_catalog.json.
 * Falls back to an empty array if the file is missing.
 */
export async function getCatalog(businessId: string): Promise<Product[]> {
  if (catalogCache.has(businessId)) {
    return catalogCache.get(businessId)!;
  }

  const filePath = path.resolve(
    __dirname,
    "../../../../datasets/catalog",
    `${businessId}_catalog.json`
  );

  if (!fs.existsSync(filePath)) {
    console.warn(`[CatalogService] No catalog found for ${businessId}, using empty catalog`);
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const products: Product[] = JSON.parse(raw);
  catalogCache.set(businessId, products);
  return products;
}

/**
 * Find a product by name (fuzzy, case-insensitive).
 */
export function findProduct(catalog: Product[], query: string): Product | undefined {
  const q = query.toLowerCase();
  return catalog.find((p) => p.name.toLowerCase().includes(q));
}

/**
 * Format catalog for display in a WhatsApp message.
 */
export function formatCatalogForMessage(catalog: Product[]): string {
  if (catalog.length === 0) return "No products available.";
  return catalog
    .filter((p) => p.available)
    .map((p) => `• ${p.name} — £${p.price_gbp.toFixed(2)}\n  ${p.description}`)
    .join("\n");
}

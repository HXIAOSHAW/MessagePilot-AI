import fs from "fs";
import path from "path";
import type { Product } from "@orderpilot/shared";
import { getSupabaseClient, isSupabaseMode } from "../db/supabase";

// In-memory cache — populated from Supabase or local JSON, never both
const catalogCache = new Map<string, Product[]>();

/**
 * Load the product catalog for a given business.
 *
 * DATA_MODE=supabase: fetches from
 *   GET /rest/v1/products?business_id=eq.<id>&select=*
 *
 * Default (mock): reads from
 *   datasets/catalog/<business_id>_catalog.json
 *
 * Results are cached in memory for the lifetime of the process.
 */
export async function getCatalog(businessId: string): Promise<Product[]> {
  if (catalogCache.has(businessId)) {
    return catalogCache.get(businessId)!;
  }

  const products = isSupabaseMode()
    ? await fetchCatalogFromSupabase(businessId)
    : loadCatalogFromFile(businessId);

  catalogCache.set(businessId, products);
  return products;
}

// ─── Supabase path ─────────────────────────────────────────────────────────────

async function fetchCatalogFromSupabase(businessId: string): Promise<Product[]> {
  const client = getSupabaseClient()!;

  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("business_id", businessId);

  if (error) {
    console.error(`[CatalogService] Supabase error for ${businessId}:`, error.message);
    console.warn("[CatalogService] Falling back to local JSON catalog");
    return loadCatalogFromFile(businessId);
  }

  if (!data || data.length === 0) {
    console.warn(`[CatalogService] No products in Supabase for ${businessId} — falling back to local JSON`);
    return loadCatalogFromFile(businessId);
  }

  console.info(`[CatalogService] Loaded ${data.length} products from Supabase for ${businessId}`);
  return data as Product[];
}

// ─── File path ────────────────────────────────────────────────────────────────

function loadCatalogFromFile(businessId: string): Product[] {
  const filePath = path.resolve(
    __dirname,
    "../../../../datasets/catalog",
    `${businessId}_catalog.json`
  );

  if (!fs.existsSync(filePath)) {
    console.warn(`[CatalogService] No catalog file found for ${businessId}`);
    return [];
  }

  const products: Product[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.info(`[CatalogService] Loaded ${products.length} products from file for ${businessId}`);
  return products;
}

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────

export function findProduct(catalog: Product[], query: string): Product | undefined {
  const q = query.toLowerCase();
  return catalog.find((p) => p.name.toLowerCase().includes(q));
}

export function formatCatalogForMessage(catalog: Product[]): string {
  if (catalog.length === 0) return "No products available.";
  return catalog
    .filter((p) => p.available)
    .map((p) => `• ${p.name} — £${p.price_gbp.toFixed(2)}\n  ${p.description}`)
    .join("\n");
}

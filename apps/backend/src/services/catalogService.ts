import fs from "fs";
import path from "path";
import type { Product } from "@orderpilot/shared";
import { getSupabaseClient, isSupabaseMode } from "../db/supabase";

// In-memory cache — populated from Supabase or local JSON, never both
const catalogCache = new Map<string, CatalogResult>();

export interface CatalogResult {
  products: Product[];
  /** Where the catalog data actually came from this request. */
  source: "memory" | "supabase" | "fallback";
  /** True when Supabase was attempted but local JSON was used instead. */
  fallback_used: boolean;
}

/**
 * Load the product catalog for a given business.
 *
 * DATA_MODE=supabase  → fetches from
 *   GET /rest/v1/products?business_id=eq.<id>&select=*
 *
 * SUPABASE_STRICT=true + DATA_MODE=supabase
 *   → throws if products cannot be loaded from Supabase (no silent fallback).
 *     Use this to verify the teammate dataset is in place.
 *
 * Default (mock / fallback)  → reads from
 *   datasets/catalog/<business_id>_catalog.json
 *
 * Results are cached for the process lifetime.
 */
export async function getCatalog(businessId: string): Promise<CatalogResult> {
  if (catalogCache.has(businessId)) {
    return catalogCache.get(businessId)!;
  }

  const result = isSupabaseMode()
    ? await fetchCatalogFromSupabase(businessId)
    : { products: loadCatalogFromFile(businessId), source: "memory" as const, fallback_used: false };

  catalogCache.set(businessId, result);
  return result;
}

/** Invalidate cache for a business (useful when products are updated). */
export function clearCatalogCache(businessId?: string): void {
  if (businessId) {
    catalogCache.delete(businessId);
  } else {
    catalogCache.clear();
  }
}

// ─── Supabase path ─────────────────────────────────────────────────────────────

async function fetchCatalogFromSupabase(businessId: string): Promise<CatalogResult> {
  const client = getSupabaseClient()!;
  const strict = process.env.SUPABASE_STRICT === "true";

  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("business_id", businessId);

  if (error) {
    console.error(`[CatalogService] Supabase error for ${businessId}:`, error.message);
    if (strict) {
      throw new Error(
        `Supabase strict mode is enabled but products could not be loaded: ${error.message}`
      );
    }
    console.warn("[CatalogService] Falling back to local JSON catalog");
    return { products: loadCatalogFromFile(businessId), source: "fallback", fallback_used: true };
  }

  if (!data || data.length === 0) {
    console.warn(`[CatalogService] No products in Supabase for ${businessId}`);
    if (strict) {
      throw new Error(
        `Supabase strict mode is enabled but products could not be loaded: table is empty for business_id=${businessId}`
      );
    }
    console.warn("[CatalogService] Falling back to local JSON catalog");
    return { products: loadCatalogFromFile(businessId), source: "fallback", fallback_used: true };
  }

  console.info(`[CatalogService] Loaded ${data.length} products from Supabase for ${businessId}`);
  return { products: data as Product[], source: "supabase", fallback_used: false };
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

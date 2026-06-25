/**
 * Supabase client initialisation.
 *
 * Active when ALL three conditions are met:
 *   DATA_MODE=supabase
 *   SUPABASE_URL is set
 *   SUPABASE_SERVICE_ROLE_KEY is set
 *
 * Otherwise the in-memory mock store is used — safe for demo without credentials.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { DraftOrder, ComplaintCase, OwnerTask } from "@orderpilot/shared";

export type MockStore = {
  messages: Record<string, unknown>[];
  orders: DraftOrder[];
  complaints: ComplaintCase[];
  ownerTasks: OwnerTask[];
  logs: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

export const mockStore: MockStore = {
  messages: [],
  orders: [],
  complaints: [],
  ownerTasks: [],
  logs: [],
  events: [],
};

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;
let _initialised = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (_initialised) return _client;
  _initialised = true;

  const mode = process.env.DATA_MODE;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (mode !== "supabase") {
    console.info("[Supabase] DATA_MODE is not 'supabase' — using in-memory mock store");
    return null;
  }

  if (!url || !key) {
    console.warn("[Supabase] DATA_MODE=supabase but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — falling back to mock store");
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.info(`[Supabase] Connected to ${url}`);
  return _client;
}

export function isSupabaseMode(): boolean {
  return getSupabaseClient() !== null;
}

/** @deprecated Use isSupabaseMode() — kept for backward compat with existing callers */
export function isUsingMockStore(): boolean {
  return !isSupabaseMode();
}

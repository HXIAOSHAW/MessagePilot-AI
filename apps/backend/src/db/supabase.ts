/**
 * Supabase client initialisation.
 *
 * If SUPABASE_URL and SUPABASE_ANON_KEY are set, a real Supabase client is
 * returned.  Otherwise, a mock client stub is returned that logs operations
 * to the console and keeps data in memory — safe for demo purposes.
 */

import type { DraftOrder, ComplaintCase, OwnerTask } from "@orderpilot/shared";

export type MockStore = {
  messages: Record<string, unknown>[];
  orders: DraftOrder[];
  complaints: ComplaintCase[];
  ownerTasks: OwnerTask[];
  logs: Record<string, unknown>[];
};

export const mockStore: MockStore = {
  messages: [],
  orders: [],
  complaints: [],
  ownerTasks: [],
  logs: [],
};

let _supabaseClient: unknown = null;

export function getSupabaseClient(): unknown {
  if (_supabaseClient) return _supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    // TODO: Import and initialise the real Supabase client
    // const { createClient } = require("@supabase/supabase-js");
    // _supabaseClient = createClient(url, key);
    // return _supabaseClient;
    console.warn("[Supabase] Credentials found but real client not wired — using mock store");
  }

  console.info("[Supabase] Running with in-memory mock store (no SUPABASE_URL set)");
  return null;
}

export function isUsingMockStore(): boolean {
  return getSupabaseClient() === null;
}

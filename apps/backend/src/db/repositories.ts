/**
 * Repository layer.
 *
 * Each function dispatches to Supabase or the in-memory mock store
 * depending on whether DATA_MODE=supabase is active.
 *
 * Supabase operations use the REST API via @supabase/supabase-js.
 * Mock operations use the in-memory mockStore (resets on restart).
 */

import type { DraftOrder, ComplaintCase, OwnerTask, DashboardSummary } from "@orderpilot/shared";
import { getSupabaseClient, isSupabaseMode, mockStore } from "./supabase";

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveInboundMessage(msg: Record<string, unknown>): Promise<void> {
  if (!isSupabaseMode()) {
    mockStore.messages.push({ ...msg, saved_at: new Date().toISOString() });
    return;
  }
  const { error } = await getSupabaseClient()!.from("messages").insert(msg);
  if (error) console.error("[Repo] saveInboundMessage:", error.message);
}

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * Persist a draft order.
 *
 * Supabase: POST /rest/v1/orders  (Prefer: return=representation)
 * Mock:     upsert into in-memory store
 *
 * Returns true if saved to Supabase, false otherwise (mock or error).
 * The caller should include this in the response as `supabase_order_created`.
 */
export async function saveDraftOrder(order: DraftOrder): Promise<boolean> {
  if (!isSupabaseMode()) {
    const idx = mockStore.orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      mockStore.orders[idx] = order;
    } else {
      mockStore.orders.push(order);
    }
    return false; // in-memory, not Supabase
  }

  const row = {
    id: order.id,
    business_id: order.business_id,
    customer_phone: order.customer_phone,
    customer_name: order.customer_name,
    items: order.items,
    fulfillment: order.fulfillment,
    requested_date: order.requested_date,
    notes: order.notes,
    total_gbp: order.total_gbp,
    status: order.status,
    checkout_url: order.checkout_url,
    created_at: order.created_at,
  };

  const { error } = await getSupabaseClient()!
    .from("orders")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.error("[Repo] saveDraftOrder:", error.message);
    return false;
  }

  console.info(`[Repo] Order ${order.id} saved to Supabase`);
  return true;
}

export async function getOrderById(orderId: string): Promise<DraftOrder | null> {
  if (!isSupabaseMode()) {
    return mockStore.orders.find((o) => o.id === orderId) ?? null;
  }

  const { data, error } = await getSupabaseClient()!
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[Repo] getOrderById:", error.message);
    return null;
  }
  return data as DraftOrder | null;
}

export async function updateOrderStatus(
  orderId: string,
  status: DraftOrder["status"]
): Promise<void> {
  if (!isSupabaseMode()) {
    const order = mockStore.orders.find((o) => o.id === orderId);
    if (order) order.status = status;
    return;
  }

  const { error } = await getSupabaseClient()!
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) console.error("[Repo] updateOrderStatus:", error.message);
  else console.info(`[Repo] Order ${orderId} status → ${status}`);
}

// ─── Complaints ───────────────────────────────────────────────────────────────

export async function saveComplaintCase(complaint: ComplaintCase): Promise<void> {
  if (!isSupabaseMode()) {
    mockStore.complaints.push(complaint);
    return;
  }
  const { error } = await getSupabaseClient()!.from("complaints").insert(complaint);
  if (error) console.error("[Repo] saveComplaintCase:", error.message);
}

// ─── Owner tasks ──────────────────────────────────────────────────────────────

export async function saveOwnerTask(task: OwnerTask): Promise<void> {
  if (!isSupabaseMode()) {
    mockStore.ownerTasks.push(task);
    return;
  }
  const { error } = await getSupabaseClient()!.from("owner_tasks").insert(task);
  if (error) console.error("[Repo] saveOwnerTask:", error.message);
}

export async function getOpenOwnerTasks(businessId: string): Promise<OwnerTask[]> {
  if (!isSupabaseMode()) {
    return mockStore.ownerTasks.filter(
      (t) => t.business_id === businessId && t.status === "open"
    );
  }

  const { data, error } = await getSupabaseClient()!
    .from("owner_tasks")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "open");

  if (error) {
    console.error("[Repo] getOpenOwnerTasks:", error.message);
    return [];
  }
  return (data ?? []) as OwnerTask[];
}

// ─── Agent logs ───────────────────────────────────────────────────────────────

export async function saveAgentLog(log: Record<string, unknown>): Promise<void> {
  if (!isSupabaseMode()) {
    mockStore.logs.push(log);
    return;
  }
  const { error } = await getSupabaseClient()!.from("agent_logs").insert(log);
  if (error) console.error("[Repo] saveAgentLog:", error.message);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(businessId: string): Promise<DashboardSummary> {
  if (!isSupabaseMode()) {
    return getMockDashboard(businessId);
  }

  const client = getSupabaseClient()!;

  const [
    { count: totalMessages },
    { data: orders, error: ordersErr },
    { count: complaintsCount },
    { data: openTasks, error: tasksErr },
  ] = await Promise.all([
    client.from("messages").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    client.from("orders").select("items, total_gbp").eq("business_id", businessId),
    client.from("complaints").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    client.from("owner_tasks").select("*").eq("business_id", businessId).eq("status", "open"),
  ]);

  if (ordersErr) console.error("[Repo] getDashboardSummary orders:", ordersErr.message);
  if (tasksErr) console.error("[Repo] getDashboardSummary tasks:", tasksErr.message);

  // Tally product frequency from order items
  const productCounts = new Map<string, number>();
  for (const order of (orders ?? [])) {
    const items = order.items as { product_name: string; quantity: number }[];
    for (const item of (items ?? [])) {
      productCounts.set(item.product_name, (productCounts.get(item.product_name) ?? 0) + item.quantity);
    }
  }

  const topProducts = Array.from(productCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    business_id: businessId,
    period: "all_time",
    total_messages: totalMessages ?? 0,
    orders_drafted: (orders ?? []).length,
    complaints_received: complaintsCount ?? 0,
    owner_tasks_open: (openTasks ?? []).length,
    top_products: topProducts,
  };
}

function getMockDashboard(businessId: string): DashboardSummary {
  const orders = mockStore.orders.filter((o) => o.business_id === businessId);
  const complaints = mockStore.complaints.filter((c) => c.business_id === businessId);
  const openTasks = mockStore.ownerTasks.filter(
    (t) => t.business_id === businessId && t.status === "open"
  );

  const productCounts = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      productCounts.set(item.product_name, (productCounts.get(item.product_name) ?? 0) + item.quantity);
    }
  }

  const topProducts = Array.from(productCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    business_id: businessId,
    period: "all_time",
    total_messages: mockStore.messages.length,
    orders_drafted: orders.length,
    complaints_received: complaints.length,
    owner_tasks_open: openTasks.length,
    top_products: topProducts,
  };
}

/**
 * Repository layer.
 *
 * Each function tries to use the real Supabase client if available,
 * otherwise falls back to the in-memory mock store.
 *
 * TODO: Implement real Supabase queries in each function once the client
 * is wired up in supabase.ts.
 */

import type { DraftOrder, ComplaintCase, OwnerTask, DashboardSummary } from "@orderpilot/shared";
import { mockStore, isUsingMockStore } from "./supabase";

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveInboundMessage(msg: Record<string, unknown>): Promise<void> {
  if (isUsingMockStore()) {
    mockStore.messages.push({ ...msg, saved_at: new Date().toISOString() });
    return;
  }
  // TODO: supabase.from("messages").insert(msg)
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function saveDraftOrder(order: DraftOrder): Promise<void> {
  if (isUsingMockStore()) {
    const idx = mockStore.orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      mockStore.orders[idx] = order;
    } else {
      mockStore.orders.push(order);
    }
    return;
  }
  // TODO: supabase.from("orders").upsert(order)
}

export async function getOrderById(orderId: string): Promise<DraftOrder | null> {
  if (isUsingMockStore()) {
    return mockStore.orders.find((o) => o.id === orderId) ?? null;
  }
  // TODO: supabase.from("orders").select("*").eq("id", orderId).single()
  return null;
}

export async function updateOrderStatus(
  orderId: string,
  status: DraftOrder["status"]
): Promise<void> {
  if (isUsingMockStore()) {
    const order = mockStore.orders.find((o) => o.id === orderId);
    if (order) order.status = status;
    return;
  }
  // TODO: supabase.from("orders").update({ status }).eq("id", orderId)
}

// ─── Complaints ───────────────────────────────────────────────────────────────

export async function saveComplaintCase(complaint: ComplaintCase): Promise<void> {
  if (isUsingMockStore()) {
    mockStore.complaints.push(complaint);
    return;
  }
  // TODO: supabase.from("complaints").insert(complaint)
}

// ─── Owner tasks ──────────────────────────────────────────────────────────────

export async function saveOwnerTask(task: OwnerTask): Promise<void> {
  if (isUsingMockStore()) {
    mockStore.ownerTasks.push(task);
    return;
  }
  // TODO: supabase.from("owner_tasks").insert(task)
}

export async function getOpenOwnerTasks(businessId: string): Promise<OwnerTask[]> {
  if (isUsingMockStore()) {
    return mockStore.ownerTasks.filter(
      (t) => t.business_id === businessId && t.status === "open"
    );
  }
  // TODO: supabase.from("owner_tasks").select("*").eq("business_id", businessId).eq("status", "open")
  return [];
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export async function saveAgentLog(log: Record<string, unknown>): Promise<void> {
  if (isUsingMockStore()) {
    mockStore.logs.push(log);
    return;
  }
  // TODO: supabase.from("agent_logs").insert(log)
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(businessId: string): Promise<DashboardSummary> {
  if (isUsingMockStore()) {
    const orders = mockStore.orders.filter((o) => o.business_id === businessId);
    const complaints = mockStore.complaints.filter((c) => c.business_id === businessId);
    const openTasks = mockStore.ownerTasks.filter(
      (t) => t.business_id === businessId && t.status === "open"
    );

    // Count product frequency
    const productCounts = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        productCounts.set(
          item.product_name,
          (productCounts.get(item.product_name) ?? 0) + item.quantity
        );
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

  // TODO: implement with real Supabase aggregation queries
  return {
    business_id: businessId,
    period: "all_time",
    total_messages: 0,
    orders_drafted: 0,
    complaints_received: 0,
    owner_tasks_open: 0,
    top_products: [],
  };
}

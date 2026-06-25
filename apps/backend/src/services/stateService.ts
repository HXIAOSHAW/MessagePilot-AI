/**
 * Conversation state service.
 *
 * Stores per-conversation context (e.g. pending order draft, last intent)
 * so agents can handle multi-turn conversations.
 *
 * Uses in-memory storage by default.
 * TODO: replace with Supabase-backed storage for production.
 */

export interface ConversationState {
  conversation_id: string;
  business_id: string;
  customer_phone: string;
  last_intent: string | null;
  pending_order_id: string | null;
  pending_complaint_id: string | null;
  turn_count: number;
  updated_at: string;
}

const store = new Map<string, ConversationState>();

export async function getState(conversationId: string): Promise<ConversationState | null> {
  return store.get(conversationId) ?? null;
}

export async function setState(state: ConversationState): Promise<void> {
  store.set(state.conversation_id, { ...state, updated_at: new Date().toISOString() });
}

export async function incrementTurn(conversationId: string): Promise<void> {
  const existing = store.get(conversationId);
  if (existing) {
    existing.turn_count += 1;
    existing.updated_at = new Date().toISOString();
  }
}

export async function clearState(conversationId: string): Promise<void> {
  store.delete(conversationId);
}

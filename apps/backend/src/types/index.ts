// Backend-specific types that extend the shared package types

export interface LogEntry {
  timestamp: string;
  business_id: string;
  conversation_id: string;
  customer_phone: string;
  intent: string;
  agent: string;
  duration_ms: number;
  success: boolean;
  error?: string;
}

export interface CheckoutResult {
  checkout_url: string;
  provider_ref: string;
  expires_at: string;
}

export interface ManusAnalysisResult {
  sentiment: "positive" | "neutral" | "negative" | "hostile";
  severity_score: number; // 0–10
  suggested_severity: "low" | "medium" | "high";
  key_topics: string[];
  suggested_reply: string;
  escalate: boolean;
}

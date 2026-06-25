const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function getDashboardSummary(businessId: string) {
  const res = await fetch(`${API_BASE}/dashboard/summary?business_id=${businessId}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard summary");
  return res.json();
}

export async function sendAgentMessage(payload: {
  business_id: string;
  customer_phone: string;
  customer_name: string;
  message: string;
  image_url: string | null;
  conversation_id: string;
}) {
  const res = await fetch(`${API_BASE}/agent/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

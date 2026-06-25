// ─── Business IDs ─────────────────────────────────────────────────────────────

export const DEMO_BUSINESS_ID = "demo_luna_bakery";

// ─── Intent keywords ──────────────────────────────────────────────────────────

export const ORDER_KEYWORDS = [
  "order",
  "buy",
  "purchase",
  "want",
  "need",
  "get",
  "can i have",
  "i'd like",
  "i would like",
  "pickup",
  "delivery",
  "book",
  "reserve",
  "cake",
  "cupcake",
];

export const COMPLAINT_KEYWORDS = [
  "complaint",
  "complain",
  "problem",
  "issue",
  "wrong",
  "broken",
  "damaged",
  "missing",
  "unhappy",
  "disappointed",
  "refund",
  "compensation",
  "terrible",
  "awful",
  "disgusting",
  "disgusted",
  "angry",
  "furious",
  "unacceptable",
  "never again",
  "horrible",
  "sick",
  "ill",
];

// ─── Risky signals: if any appear in an apparent order, re-route away ────────
// These are complaint/escalation markers that must win over order signals.

// Risky signals — use whole-word or phrase matching in the router.
// Avoid short tokens that appear inside common words (e.g. "ill" in "vanilla").
export const RISKY_ORDER_SIGNALS = [
  "damaged",
  "wrong item",
  "wrong name",
  "missing item",
  "arrived broken",
  "arrived damaged",
  "not what i ordered",
  "incorrect order",
  "refund",
  "compensation",
  "really upset",
  "very upset",
  "very unhappy",
  "disgusting",
  "disgusted",
  "furious",
  "angry",
  "livid",
  "allergy",
  "allergic",
  "food poisoning",
  "gone sick",       // avoid bare "sick" matching "sickness benefit" etc.
  "made me sick",
  "hospital",
  "injured",
  "legal action",
  "solicitor",
  "lawyer",
  "going to court",
  "trading standards",
  "post a review",
  "leave a review",
  "social media",
  "post about this",
  "tell everyone",
  "never again",
  "waste of money",
];

export const HUMAN_HANDOVER_KEYWORDS = [
  "speak to a human",
  "speak to someone",
  "talk to a person",
  "real person",
  "manager",
  "supervisor",
  "agent",
  "escalate",
];

// ─── Safety: topics that must NEVER be auto-approved ─────────────────────────

export const SAFETY_BLOCKED_TOPICS = [
  "refund",
  "compensation",
  "legal",
  "solicitor",
  "lawyer",
  "court",
  "sue",
  "food poisoning",
  "allergy",
  "allergic",
  "hospital",
  "health",
  "safety",
  "trading standards",
  "covid",
];

// ─── Complaint severity thresholds ───────────────────────────────────────────

export const HIGH_VALUE_ORDER_THRESHOLD_GBP = 100;

// ─── Default messages ─────────────────────────────────────────────────────────

export const DEFAULT_OWNER_ESCALATION_MESSAGE =
  "Our team has received your message and a member of staff will be in touch shortly to assist you personally. We apologise for any inconvenience.";

export const DEFAULT_UNKNOWN_REPLY =
  "Thanks for your message! Could you tell us a bit more about what you need? We're here to help with orders and any questions about our products.";

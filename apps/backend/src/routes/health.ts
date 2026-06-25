import { Router } from "express";
import { isUsingMockStore } from "../db/supabase";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "OrderPilot AI Backend",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    storage: isUsingMockStore() ? "in-memory (mock)" : "supabase",
    adapters: {
      messaging: process.env.WASSIST_API_KEY ? "wassist (stub)" : "mock",
      payment: process.env.PAYPAL_CLIENT_ID ? "paypal (stub)" : "mock",
      manus: process.env.MANUS_MODE === "external" && process.env.MANUS_API_KEY ? "external (Manus AI)" : "mock",
    },
  });
});

export default router;

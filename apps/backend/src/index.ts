import path from "path";
import dotenv from "dotenv";
// Load .env from monorepo root (apps/backend/src → ../../../)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import express from "express";
import cors from "cors";

import healthRouter from "./routes/health";
import agentRouter from "./routes/agent";
import paymentRouter from "./routes/payment";
import dashboardRouter from "./routes/dashboard";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/health", healthRouter);
app.use("/agent", agentRouter);
app.use("/payment", paymentRouter);
app.use("/dashboard", dashboardRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const manusMode = process.env.MANUS_MODE === "external" && process.env.MANUS_API_KEY
    ? "external (Manus AI) "
    : "mock (router agent) ";
  const storageMode = process.env.DATA_MODE === "supabase" && process.env.SUPABASE_URL
    ? "Supabase        "
    : "in-memory mock  ";
  console.log(`
╔════════════════════════════════════════════╗
║   MessagePilot AI Backend                  ║
║   Running on http://localhost:${PORT}         ║
║   Storage: ${storageMode}        ║
║   Manus:   ${manusMode}   ║
╚════════════════════════════════════════════╝
  `);
});

export default app;

import "dotenv/config";
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
  console.log(`
╔════════════════════════════════════════════╗
║   MessagePilot AI Backend                  ║
║   Running on http://localhost:${PORT}         ║
║   Storage: ${process.env.SUPABASE_URL ? "Supabase        " : "in-memory mock   "}          ║
║   Manus:   ${process.env.MANUS_API_KEY  ? "connected      " : "mock (no key)    "}          ║
╚════════════════════════════════════════════╝
  `);
});

export default app;

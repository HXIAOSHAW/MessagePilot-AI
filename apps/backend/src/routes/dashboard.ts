import { Router, Request, Response } from "express";
import { DashboardQuerySchema } from "@orderpilot/shared";
import { getDashboardSummary, getOpenOwnerTasks } from "../db/repositories";
import { mockStore } from "../db/supabase";

const router = Router();

/**
 * GET /dashboard/summary?business_id=demo_luna_bakery
 *
 * Returns an operations summary for the owner dashboard.
 */
router.get("/summary", async (req: Request, res: Response) => {
  const parsed = DashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "business_id query parameter is required",
    });
  }

  const { business_id } = parsed.data;

  const [summary, openTasks] = await Promise.all([
    getDashboardSummary(business_id),
    getOpenOwnerTasks(business_id),
  ]);

  return res.json({
    ...summary,
    open_tasks: openTasks,
    generated_at: new Date().toISOString(),
  });
});

export default router;

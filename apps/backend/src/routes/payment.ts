import { Router, Request, Response } from "express";
import { PaymentStatusSchema } from "@orderpilot/shared";
import { getOrderById, updateOrderStatus } from "../db/repositories";

const router = Router();

/**
 * POST /payment/status
 *
 * Webhook endpoint to receive payment status updates from the payment
 * provider (PayPal, Stripe, etc.).
 *
 * TODO: Add HMAC signature verification once a real payment provider is
 * connected (use PAYPAL_WEBHOOK_SECRET or similar env var).
 */
router.post("/status", async (req: Request, res: Response) => {
  const parsed = PaymentStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payment status payload",
      details: parsed.error.flatten(),
    });
  }

  const { order_id, payment_provider_ref, status, amount_gbp } = parsed.data;

  console.log(`[Payment] Status update: order=${order_id}, status=${status}, ref=${payment_provider_ref}, amount=£${amount_gbp}`);

  const order = await getOrderById(order_id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Map payment status to order status
  const orderStatus =
    status === "completed"
      ? "confirmed"
      : status === "refunded"
      ? "cancelled"
      : order.status;

  await updateOrderStatus(order_id, orderStatus);

  return res.json({
    success: true,
    order_id,
    new_status: orderStatus,
    processed_at: new Date().toISOString(),
  });
});

export default router;

import createError from "http-errors";
import { STATUS_TRANSITIONS } from "../../models/salesorder.model.js";

/**
 * Validates that req.body.status is allowed from current sales‑order.status.
 * Use in PUT / PATCH where status change is possible.
 */
export default async function statusGuard(req, res, next) {
  const current = res.locals.currentSO?.status; // set by controller
  const nextStatus = req.body.status;

  // no status change -> allow through
  if (!nextStatus || nextStatus === current) return next();

  if (!STATUS_TRANSITIONS[current]?.includes(nextStatus)) {
    return next(
      createError(
        400,
        `❌ Illegal status transition: ${current} → ${nextStatus}`
      )
    );
  }
  next();
}

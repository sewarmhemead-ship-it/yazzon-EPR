/**
 * alerts.controller.js
 * Layer: controller — HTTP only. No business logic.
 * Errors are forwarded to the central errorHandler via next(err).
 */

import { listAlerts, markOrdered } from './alerts.service.js';

/** Lists items that need purchasing. */
export async function getAlerts(_req, res, next) {
  try {
    const items = await listAlerts();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/** Marks an item as ordered (is_ordered = true). */
export async function markItemOrdered(req, res, next) {
  try {
    const item = await markOrdered(req.params.id, true);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

/** Clears the ordered mark (is_ordered = false) — manual correction. */
export async function unmarkItemOrdered(req, res, next) {
  try {
    const item = await markOrdered(req.params.id, false);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

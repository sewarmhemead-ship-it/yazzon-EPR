/**
 * transactions.controller.js
 * Layer: controller — HTTP only: read the request, call the service, send the
 * response. No business logic.
 *
 * userId always comes from req.user (the authenticated identity), never from
 * the request body — movements must be tied to the real actor (section 7,
 * dispute resolution) and impersonation must be impossible.
 * Errors are forwarded to the central errorHandler via next(err).
 */

import {
  addStock,
  consumeStock,
  adjustStock,
  undoTransaction,
  getTransactions,
} from './transactions.service.js';

/** Movement history with optional query-string filters. */
export async function list(req, res, next) {
  try {
    const { itemId, locationId, type, limit } = req.query;
    const transactions = await getTransactions({ itemId, locationId, type, limit });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

/** Goods receipt (in). */
export async function receive(req, res, next) {
  try {
    const { itemId, quantity, note } = req.body ?? {};
    const result = await addStock({ itemId, userId: req.user.id, quantity, note });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/** Withdrawal (out or waste). */
export async function consume(req, res, next) {
  try {
    const { itemId, quantity, type, note } = req.body ?? {};
    const result = await consumeStock({ itemId, userId: req.user.id, quantity, type, note });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/** Inventory adjustment. */
export async function adjust(req, res, next) {
  try {
    const { itemId, delta, note } = req.body ?? {};
    const result = await adjustStock({ itemId, userId: req.user.id, delta, note });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/** Undo of a previous movement (reversal). */
export async function undo(req, res, next) {
  try {
    const { note } = req.body ?? {};
    const result = await undoTransaction({
      transactionId: req.params.id,
      userId: req.user.id,
      note,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

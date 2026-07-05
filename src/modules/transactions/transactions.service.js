/**
 * transactions.service.js
 * Layer: service — stock movement business logic; enforces the invariants:
 *   [INV-1] no negative stock — via the conditional atomic UPDATE in the repository.
 *   [INV-2] one DB transaction per movement — everything wrapped in withTransaction.
 *   [INV-3] immutable ledger — corrections are new reversal rows, never edits.
 *   [INV-4] numeric quantities — passed as decimal strings, no float math.
 *   [INV-6] one base unit per item — all quantities use the item's unit.
 */

import { withTransaction } from '../../shared/withTransaction.js';
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import {
  assertPositiveQuantity,
  assertSignedNonZeroQuantity,
  assertNonEmptyString,
} from '../../shared/validate.js';
import { findItemByIdTx } from '../items/items.repository.js';
import {
  decrementStock,
  incrementStock,
  applyStockDelta,
  insertTransaction,
  findTransactionById,
  hasReversal,
  listTransactions,
} from './transactions.repository.js';

/** Movement types (single source, no scattered string literals). */
export const TX_TYPE = Object.freeze({
  IN: 'in',
  OUT: 'out',
  WASTE: 'waste',
  ADJUSTMENT: 'adjustment',
});

/** Types that withdraw stock. */
const CONSUMING_TYPES = new Set([TX_TYPE.OUT, TX_TYPE.WASTE]);

/** Maximum rows a single history request may return. */
const HISTORY_MAX_LIMIT = 200;
/** Default history page size. */
const HISTORY_DEFAULT_LIMIT = 50;

/**
 * Adds stock (goods receipt) and records it as an "in" movement.
 * One transaction because the balance update and the ledger insert must
 * succeed or fail together [INV-2].
 * @param {object} input
 * @param {string} input.itemId
 * @param {string} input.userId Acting user.
 * @param {string|number} input.quantity Positive amount in the item's base unit.
 * @param {string} [input.note]
 * @returns {Promise<{ item: object, transaction: object }>}
 * @throws {NotFoundError} When the item does not exist.
 */
export async function addStock({ itemId, userId, quantity, note }) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const uid = assertNonEmptyString(userId, 'userId');
  const qty = assertPositiveQuantity(quantity, 'quantity'); // [INV-4]

  return withTransaction(async (client) => {
    const item = await incrementStock(client, id, qty);
    if (!item) {
      throw new NotFoundError('Item not found');
    }
    const transaction = await insertTransaction(client, {
      itemId: id,
      userId: uid,
      type: TX_TYPE.IN,
      quantityChange: qty, // positive = inflow
      note,
    });
    return { item, transaction };
  });
}

/**
 * Withdraws stock (consumption or waste) and records the movement.
 *
 * [INV-1] The decrement happens in one conditional atomic UPDATE
 * (decrementStock); zero rows = insufficient stock. We never read the balance
 * first to decide — that would reintroduce the race condition. The SELECT
 * below runs only after the UPDATE failed, purely to tell "not found" apart
 * from "insufficient".
 * @param {object} input
 * @param {string} input.itemId
 * @param {string} input.userId
 * @param {string|number} input.quantity Positive amount to withdraw.
 * @param {'out'|'waste'} [input.type] Withdrawal type (default out). waste is
 *   tracked separately so managers can see losses (section 7).
 * @param {string} [input.note]
 * @returns {Promise<{ item: object, transaction: object }>}
 * @throws {ValidationError} For a disallowed type.
 * @throws {NotFoundError} When the item does not exist.
 * @throws {InsufficientStockError} When stock does not cover the amount.
 */
export async function consumeStock({ itemId, userId, quantity, type = TX_TYPE.OUT, note }) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const uid = assertNonEmptyString(userId, 'userId');
  const qty = assertPositiveQuantity(quantity, 'quantity'); // [INV-4]
  if (!CONSUMING_TYPES.has(type)) {
    throw new ValidationError(`Invalid withdrawal type: ${type}`);
  }

  return withTransaction(async (client) => {
    // [INV-1] The whole decision lives inside this conditional atomic UPDATE.
    const item = await decrementStock(client, id, qty);
    if (!item) {
      // Diagnose only: distinguish missing item from insufficient stock.
      const exists = await findItemByIdTx(client, id);
      if (!exists) {
        throw new NotFoundError('Item not found');
      }
      throw new InsufficientStockError();
    }
    const transaction = await insertTransaction(client, {
      itemId: id,
      userId: uid,
      type,
      quantityChange: `-${qty}`, // negative = outflow
      note,
    });
    return { item, transaction };
  });
}

/**
 * Inventory adjustment: applies a signed delta to reconcile the system with
 * reality (section 7). The delta may be positive or negative; the balance can
 * never drop below zero [INV-1].
 * @param {object} input
 * @param {string} input.itemId
 * @param {string} input.userId
 * @param {string|number} input.delta Signed, non-zero difference.
 * @param {string} [input.note] Reason for the adjustment (recommended).
 * @returns {Promise<{ item: object, transaction: object }>}
 * @throws {NotFoundError} When the item does not exist.
 * @throws {InsufficientStockError} When a negative delta exceeds available stock.
 */
export async function adjustStock({ itemId, userId, delta, note }) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const uid = assertNonEmptyString(userId, 'userId');
  const signedDelta = assertSignedNonZeroQuantity(delta, 'delta'); // [INV-4]

  return withTransaction(async (client) => {
    // [INV-1] Atomic conditional apply: current_stock + delta >= 0.
    const item = await applyStockDelta(client, id, signedDelta);
    if (!item) {
      const exists = await findItemByIdTx(client, id);
      if (!exists) {
        throw new NotFoundError('Item not found');
      }
      throw new InsufficientStockError('Adjustment would drop stock below zero');
    }
    const transaction = await insertTransaction(client, {
      itemId: id,
      userId: uid,
      type: TX_TYPE.ADJUSTMENT,
      quantityChange: signedDelta,
      note,
    });
    return { item, transaction };
  });
}

/**
 * Undoes a movement by inserting a reversal that references it [INV-3] —
 * the original row is never deleted or modified. The reversal applies the
 * opposite effect atomically, still respecting the non-negative rule [INV-1].
 * @param {object} input
 * @param {string} input.transactionId Original movement id.
 * @param {string} input.userId User performing the undo.
 * @param {string} [input.note] Reason for the undo.
 * @returns {Promise<{ item: object, transaction: object }>} Item after the
 *   correction and the reversal row.
 * @throws {NotFoundError} When the original movement does not exist.
 * @throws {ValidationError} When it was already reversed or is itself a reversal.
 * @throws {InsufficientStockError} When reversing would drop stock below zero
 *   (the received goods were already consumed).
 */
export async function undoTransaction({ transactionId, userId, note }) {
  const txId = assertNonEmptyString(transactionId, 'transactionId');
  const uid = assertNonEmptyString(userId, 'userId');

  return withTransaction(async (client) => {
    const original = await findTransactionById(client, txId);
    if (!original) {
      throw new NotFoundError('Transaction not found');
    }
    // Reversals cannot be undone themselves; it would create confusing chains [INV-3].
    if (original.reverses_transaction_id) {
      throw new ValidationError('A reversal cannot be undone');
    }
    if (await hasReversal(client, txId)) {
      throw new ValidationError('This transaction was already undone');
    }

    // The undo effect is the negation of the original quantity_change,
    // computed on the decimal string — no float math [INV-4].
    const reversalDelta = negateNumericString(original.quantity_change);

    // [INV-1] Atomic apply with the non-negative guard (e.g. undoing an "in"
    // whose goods were partially consumed already).
    const item = await applyStockDelta(client, original.item_id, reversalDelta);
    if (!item) {
      throw new InsufficientStockError('Cannot undo: current stock does not cover the reversal');
    }

    // [INV-3] New reversal row referencing the original; the original stays untouched.
    const transaction = await insertTransaction(client, {
      itemId: original.item_id,
      userId: uid,
      type: TX_TYPE.ADJUSTMENT,
      quantityChange: reversalDelta,
      note: note ?? `Undo of transaction ${txId}`,
      reversesTransactionId: txId,
    });
    return { item, transaction };
  });
}

/**
 * Reads the movement history (newest first) with optional filters — what came
 * in, went out, spoiled, or was corrected. Read-only ledger view [INV-3].
 * @param {object} [filters]
 * @param {string} [filters.itemId]
 * @param {string} [filters.locationId] Location (fridge).
 * @param {string} [filters.type] in|out|waste|adjustment.
 * @param {string|number} [filters.limit]
 * @returns {Promise<object[]>}
 * @throws {ValidationError} For an unknown type.
 */
export async function getTransactions({ itemId, locationId, type, limit } = {}) {
  if (type && !Object.values(TX_TYPE).includes(type)) {
    throw new ValidationError(`Unknown transaction type: ${type}`);
  }
  const parsed = Number.parseInt(limit ?? HISTORY_DEFAULT_LIMIT, 10);
  const safeLimit = Number.isInteger(parsed)
    ? Math.min(Math.max(parsed, 1), HISTORY_MAX_LIMIT)
    : HISTORY_DEFAULT_LIMIT;
  return listTransactions({
    itemId: itemId || null,
    locationId: locationId || null,
    type: type || null,
    limit: safeLimit,
  });
}

/**
 * Negates a decimal string without converting it to a float [INV-4].
 * @param {string} value Numeric string from the database (e.g. "5", "-2.5").
 * @returns {string} The string with its sign flipped ("-5", "2.5").
 */
function negateNumericString(value) {
  const str = String(value).trim();
  if (str.startsWith('-')) {
    return str.slice(1);
  }
  return `-${str}`;
}

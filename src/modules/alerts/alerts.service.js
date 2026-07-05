/**
 * alerts.service.js
 * Layer: service — purchase alert business logic: the low-stock list and the
 * is_ordered flag. Kept as its own layer so controllers stay logic-free
 * (section 5). Alerts are a live query (section 10) — no jobs, no extra tables.
 */

import { NotFoundError } from '../../shared/errors.js';
import { assertNonEmptyString } from '../../shared/validate.js';
import { getLowStockItems, setItemOrdered } from './alerts.repository.js';

/**
 * Returns items that need purchasing (at or below minimum), in the order
 * defined by section 10.
 * @returns {Promise<object[]>}
 */
export async function listAlerts() {
  return getLowStockItems();
}

/**
 * Marks an item as ordered (or clears the mark) so the alert stops repeating
 * once the purchase order is out (section 7). The flag is reset automatically
 * on goods receipt inside addStock — not here.
 * @param {string} itemId Item id.
 * @param {boolean} isOrdered New flag value.
 * @returns {Promise<object>} Updated item.
 * @throws {NotFoundError} When the item does not exist.
 */
export async function markOrdered(itemId, isOrdered) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const item = await setItemOrdered(id, Boolean(isOrdered));
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  return item;
}

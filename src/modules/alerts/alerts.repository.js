/**
 * alerts.repository.js
 * Layer: repository — SQL for purchase alerts only. No business logic.
 * The alert is a live query (section 10) — no scheduled jobs, no extra tables.
 * All SQL is hand-written and parameterized via node-postgres (section 2).
 */

import { query } from '../../config/db.js';

/**
 * Lists items at or below their minimum stock level (need purchasing).
 * Order (section 10): not-yet-ordered first (is_ordered ASC), then largest
 * shortfall first — so the manager sees priorities immediately.
 * @returns {Promise<object[]>}
 */
export async function getLowStockItems() {
  const { rows } = await query(
    `SELECT * FROM items
     WHERE current_stock <= min_stock_level
     ORDER BY is_ordered ASC, (min_stock_level - current_stock) DESC`,
  );
  return rows;
}

/**
 * Sets an item's "ordered" flag and stamps last_ordered_at when marking.
 * Separates "needed" from "needed but already ordered" so the alert does not
 * keep nagging after the purchase order went out (section 7).
 * @param {string} itemId Item id.
 * @param {boolean} isOrdered New flag value.
 * @returns {Promise<object | null>} Updated row, or null when not found.
 */
export async function setItemOrdered(itemId, isOrdered) {
  const { rows } = await query(
    `UPDATE items
     SET is_ordered = $1,
         last_ordered_at = CASE WHEN $1 THEN now() ELSE last_ordered_at END
     WHERE id = $2
     RETURNING *`,
    [isOrdered, itemId],
  );
  return rows[0] ?? null;
}

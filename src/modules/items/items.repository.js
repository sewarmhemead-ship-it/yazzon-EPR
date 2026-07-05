/**
 * items.repository.js
 * Layer: repository — SQL for items only. No business logic.
 * All SQL is hand-written and parameterized via node-postgres (section 2).
 */

import { query } from '../../config/db.js';

/**
 * Lists all items ordered by name, with category and location names joined
 * for display.
 * @returns {Promise<object[]>} Item rows (+ category_name, location_name).
 */
export async function listItems() {
  const { rows } = await query(
    `SELECT items.*, categories.name AS category_name, locations.name AS location_name
     FROM items
     LEFT JOIN categories ON categories.id = items.category_id
     LEFT JOIN locations ON locations.id = items.location_id
     ORDER BY items.name ASC`,
  );
  return rows;
}

/**
 * Fetches an item by id (plain read outside any transaction).
 * @param {string} id Item id.
 * @returns {Promise<object | null>}
 */
export async function findItemById(id) {
  const { rows } = await query('SELECT * FROM items WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * Fetches an item by id within an open transaction (using its client).
 * Used only to distinguish "item not found" from "insufficient stock" after
 * the atomic UPDATE failed — never to decide the decrement itself; that
 * decision stays inside the conditional atomic UPDATE [INV-1].
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {string} id Item id.
 * @returns {Promise<object | null>}
 */
export async function findItemByIdTx(client, id) {
  const { rows } = await client.query('SELECT * FROM items WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * Creates an item. current_stock is intentionally not accepted: every balance
 * starts at zero and changes only through ledger-recorded movements [INV-3].
 * Any opening stock is booked as a separate "in" movement.
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.unit Base unit [INV-6].
 * @param {string} data.minStockLevel Alert threshold (decimal string) [INV-4].
 * @param {string|null} [data.categoryId]
 * @param {string|null} [data.locationId]
 * @returns {Promise<object>} The created row.
 */
export async function createItem({ name, unit, minStockLevel, categoryId, locationId }) {
  const { rows } = await query(
    `INSERT INTO items (name, unit, min_stock_level, category_id, location_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, unit, minStockLevel, categoryId ?? null, locationId ?? null],
  );
  return rows[0];
}

/**
 * Updates an item's metadata without ever touching current_stock [INV-3].
 * Only keys present in `data` are changed; null is a real value for nullable
 * metadata such as category_id/location_id, so callers can clear them.
 * @param {string} id Item id.
 * @param {object} data
 * @param {string|null} [data.name]
 * @param {string|null} [data.unit]
 * @param {string|null} [data.minStockLevel]
 * @param {string|null} [data.categoryId]
 * @param {string|null} [data.locationId]
 * @returns {Promise<object | null>} Updated row, or null when not found.
 */
export async function updateItem(id, data) {
  const assignments = [];
  const params = [id];

  const pushAssignment = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (Object.hasOwn(data, 'name')) pushAssignment('name', data.name);
  if (Object.hasOwn(data, 'unit')) pushAssignment('unit', data.unit);
  if (Object.hasOwn(data, 'minStockLevel')) pushAssignment('min_stock_level', data.minStockLevel);
  if (Object.hasOwn(data, 'categoryId')) pushAssignment('category_id', data.categoryId);
  if (Object.hasOwn(data, 'locationId')) pushAssignment('location_id', data.locationId);

  if (assignments.length === 0) {
    return findItemById(id);
  }

  const { rows } = await query(
    `UPDATE items
     SET ${assignments.join(', ')}
     WHERE id = $1
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

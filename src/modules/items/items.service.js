/**
 * items.service.js
 * Layer: service — item business logic and input validation.
 * Enforces: [INV-4] min_stock_level stays a decimal string (no floats),
 * [INV-6] one base unit per item.
 * Never touches current_stock: balances change only through ledger-recorded
 * movements [INV-3] (see transactions.service).
 */

import { NotFoundError } from '../../shared/errors.js';
import { assertNonEmptyString, assertPositiveQuantity } from '../../shared/validate.js';
import {
  listItems,
  findItemById,
  createItem,
  updateItem,
} from './items.repository.js';

/** Default alert threshold when none is provided (matches the DB default). */
const DEFAULT_MIN_STOCK = '1';

/**
 * Returns all items for the frontend list.
 * @returns {Promise<object[]>}
 */
export async function getItems() {
  return listItems();
}

/**
 * Returns a single item by id.
 * @param {string} itemId
 * @returns {Promise<object>}
 * @throws {NotFoundError} When the item does not exist.
 */
export async function getItem(itemId) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const item = await findItemById(id);
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  return item;
}

/**
 * Creates a new item (quick creation for a new ingredient, section 7).
 * Stock starts at zero; any opening quantity is booked later as an "in"
 * movement [INV-3].
 * @param {object} input
 * @param {string} input.name
 * @param {string} input.unit Base unit [INV-6].
 * @param {string|number} [input.minStockLevel] Alert threshold; defaults to 1.
 * @param {string|null} [input.categoryId]
 * @param {string|null} [input.locationId]
 * @returns {Promise<object>} The created item.
 * @throws {ValidationError} For invalid input.
 */
export async function addItem({ name, unit, minStockLevel, categoryId, locationId }) {
  const cleanName = assertNonEmptyString(name, 'name');
  const cleanUnit = assertNonEmptyString(unit, 'unit'); // [INV-6]
  const min =
    minStockLevel === undefined || minStockLevel === null || minStockLevel === ''
      ? DEFAULT_MIN_STOCK
      : assertPositiveQuantity(minStockLevel, 'minStockLevel'); // [INV-4]

  return createItem({
    name: cleanName,
    unit: cleanUnit,
    minStockLevel: min,
    categoryId: categoryId ?? null,
    locationId: locationId ?? null,
  });
}

/**
 * Updates an item's metadata (never the balance [INV-3]).
 * Partial update: only the provided fields are validated and changed.
 * @param {string} itemId
 * @param {object} changes
 * @param {string} [changes.name]
 * @param {string} [changes.unit]
 * @param {string|number} [changes.minStockLevel]
 * @param {string|null} [changes.categoryId]
 * @param {string|null} [changes.locationId]
 * @returns {Promise<object>} The updated item.
 * @throws {NotFoundError} When the item does not exist.
 * @throws {ValidationError} For invalid input.
 */
export async function editItem(itemId, changes = {}) {
  const id = assertNonEmptyString(itemId, 'itemId');

  const patch = {};
  if (Object.hasOwn(changes, 'name')) {
    patch.name = assertNonEmptyString(changes.name, 'name');
  }
  if (Object.hasOwn(changes, 'unit')) {
    patch.unit = assertNonEmptyString(changes.unit, 'unit');
  }
  if (Object.hasOwn(changes, 'minStockLevel')) {
    patch.minStockLevel = assertPositiveQuantity(changes.minStockLevel, 'minStockLevel');
  }
  if (Object.hasOwn(changes, 'categoryId')) {
    patch.categoryId = changes.categoryId ?? null;
  }
  if (Object.hasOwn(changes, 'locationId')) {
    patch.locationId = changes.locationId ?? null;
  }

  const item = await updateItem(id, patch);
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  return item;
}

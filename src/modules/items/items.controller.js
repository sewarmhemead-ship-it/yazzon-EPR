/**
 * items.controller.js
 * Layer: controller — HTTP only: read the request, call the service, send the
 * response. No business logic. Errors are forwarded to the central
 * errorHandler via next(err).
 */

import { getItems, getItem, addItem, editItem } from './items.service.js';

/** Lists all items. */
export async function listAll(_req, res, next) {
  try {
    const items = await getItems();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/** Returns a single item by id. */
export async function getOne(req, res, next) {
  try {
    const item = await getItem(req.params.id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

/** Creates a new item. */
export async function create(req, res, next) {
  try {
    const { name, unit, minStockLevel, categoryId, locationId } = req.body ?? {};
    const item = await addItem({ name, unit, minStockLevel, categoryId, locationId });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

/** Updates an item's metadata. */
export async function update(req, res, next) {
  try {
    const { name, unit, minStockLevel, categoryId, locationId } = req.body ?? {};
    const item = await editItem(req.params.id, { name, unit, minStockLevel, categoryId, locationId });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

/**
 * categories.controller.js
 * Layer: controller — HTTP only. No business logic.
 */

import { getCategories, addCategory } from './categories.service.js';

/** Lists all categories. */
export async function listAll(_req, res, next) {
  try {
    const categories = await getCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

/** Creates a category. */
export async function create(req, res, next) {
  try {
    const category = await addCategory(req.body?.name);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
}

/**
 * categories.controller.js
 * الطبقة: controller — HTTP فقط. لا منطق أعمال.
 */

import { getCategories, addCategory } from './categories.service.js';

/** قائمة التصنيفات. */
export async function listAll(_req, res, next) {
  try {
    const categories = await getCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

/** إنشاء تصنيف. */
export async function create(req, res, next) {
  try {
    const category = await addCategory(req.body?.name);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
}

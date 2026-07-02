/**
 * items.controller.js
 * الطبقة: controller — HTTP فقط: يقرأ الطلب، يستدعي الـ service، يعيد الرد. لا منطق أعمال.
 * الأخطاء تُمرَّر عبر next(err) إلى errorHandler المركزي.
 */

import { getItems, getItem, addItem, editItem } from './items.service.js';

/** قائمة كل العناصر. */
export async function listAll(_req, res, next) {
  try {
    const items = await getItems();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/** عنصر واحد بمعرّفه. */
export async function getOne(req, res, next) {
  try {
    const item = await getItem(req.params.id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

/** إنشاء عنصر جديد. */
export async function create(req, res, next) {
  try {
    const { name, unit, minStockLevel, categoryId, locationId } = req.body ?? {};
    const item = await addItem({ name, unit, minStockLevel, categoryId, locationId });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

/** تعديل بيانات عنصر (وصفية فقط). */
export async function update(req, res, next) {
  try {
    const { name, unit, minStockLevel, categoryId, locationId } = req.body ?? {};
    const item = await editItem(req.params.id, { name, unit, minStockLevel, categoryId, locationId });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

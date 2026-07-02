/**
 * locations.controller.js
 * الطبقة: controller — HTTP فقط. لا منطق أعمال.
 */

import { getLocations, addLocation } from './locations.service.js';

/** قائمة الأقسام. */
export async function listAll(_req, res, next) {
  try {
    const locations = await getLocations();
    res.json({ locations });
  } catch (err) {
    next(err);
  }
}

/** إنشاء قسم. */
export async function create(req, res, next) {
  try {
    const { name, position } = req.body ?? {};
    const location = await addLocation(name, position);
    res.status(201).json({ location });
  } catch (err) {
    next(err);
  }
}

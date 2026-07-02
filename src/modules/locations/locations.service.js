/**
 * locations.service.js
 * الطبقة: service — منطق أعمال الأقسام (تحقّق المدخلات).
 */

import { assertNonEmptyString } from '../../shared/validate.js';
import { listLocations, createLocation } from './locations.repository.js';

/** يعيد كل الأقسام. */
export async function getLocations() {
  return listLocations();
}

/**
 * يُنشئ قسماً بعد التحقق.
 * @param {string} name
 * @param {number} [position]
 */
export async function addLocation(name, position = 0) {
  const clean = assertNonEmptyString(name, 'name');
  const pos = Number.isFinite(Number(position)) ? Number(position) : 0;
  return createLocation(clean, pos);
}

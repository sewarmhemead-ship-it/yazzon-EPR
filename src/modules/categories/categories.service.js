/**
 * categories.service.js
 * الطبقة: service — منطق أعمال التصنيفات (تحقّق المدخلات).
 */

import { assertNonEmptyString } from '../../shared/validate.js';
import { listCategories, createCategory } from './categories.repository.js';

/**
 * يعيد كل التصنيفات.
 * @returns {Promise<object[]>}
 */
export async function getCategories() {
  return listCategories();
}

/**
 * يُنشئ تصنيفاً بعد التحقق من الاسم.
 * @param {string} name
 * @returns {Promise<object>}
 * @throws {ValidationError} لاسم فارغ.
 */
export async function addCategory(name) {
  const clean = assertNonEmptyString(name, 'name');
  return createCategory(clean);
}

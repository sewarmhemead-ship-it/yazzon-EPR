/**
 * locations.repository.js
 * الطبقة: repository — استعلامات SQL لأقسام التخزين (البرادات) فقط. لا منطق أعمال.
 */

import { query } from '../../config/db.js';

/**
 * يجلب كل الأقسام بترتيب العرض.
 * @returns {Promise<object[]>}
 */
export async function listLocations() {
  const { rows } = await query('SELECT * FROM locations ORDER BY position ASC, name ASC');
  return rows;
}

/**
 * يُنشئ قسماً جديداً.
 * @param {string} name اسم القسم (مثل "Kühlschrank 13").
 * @param {number} position ترتيب العرض.
 * @returns {Promise<object>}
 */
export async function createLocation(name, position) {
  const { rows } = await query(
    'INSERT INTO locations (name, position) VALUES ($1, $2) RETURNING *',
    [name, position],
  );
  return rows[0];
}

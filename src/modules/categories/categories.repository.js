/**
 * categories.repository.js
 * الطبقة: repository — استعلامات SQL للتصنيفات فقط. لا منطق أعمال.
 * القاعدة (القسم 2): كل SQL يدوي و parameterized عبر node-postgres.
 */

import { query } from '../../config/db.js';

/**
 * يجلب كل التصنيفات مرتّبة بالاسم.
 * @returns {Promise<object[]>}
 */
export async function listCategories() {
  const { rows } = await query('SELECT * FROM categories ORDER BY name ASC');
  return rows;
}

/**
 * يُنشئ تصنيفاً جديداً.
 * @param {string} name اسم التصنيف.
 * @returns {Promise<object>} صفّ التصنيف المُنشأ.
 */
export async function createCategory(name) {
  const { rows } = await query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *',
    [name],
  );
  return rows[0];
}

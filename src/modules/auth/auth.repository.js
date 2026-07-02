/**
 * auth.repository.js
 * الطبقة: repository — استعلامات SQL الخاصة بالمصادقة فقط. لا منطق أعمال.
 * القاعدة (القسم 2): كل SQL يدوي و parameterized عبر node-postgres.
 */

import { query } from '../../config/db.js';

/**
 * يجلب المستخدم بمعرّفه (نفس معرّف Supabase Auth) من جدول users.
 * السبب: نربط هوية التوكن بصفّ users لقراءة الدور (RBAC). لا نعيد أعمدة زائدة.
 * @param {string} id معرّف المستخدم (uuid) من حقل sub في التوكن.
 * @returns {Promise<{ id: string, name: string, email: string, role: string } | null>}
 *   صفّ المستخدم أو null إن لم يوجد.
 */
export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

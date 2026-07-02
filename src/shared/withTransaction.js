/**
 * withTransaction.js
 * الطبقة: shared — مساعد يلفّ عملية داخل معاملة قاعدة بيانات واحدة.
 * يفرض: [INV-2] كل حركة = معاملة DB واحدة — تنجح كل الخطوات معاً أو تُلغى كلها (ROLLBACK).
 *
 * الاستخدام (المرحلة 3): تمرَّر الاستعلامات كلها على نفس الـ client الممرَّر للـ callback
 * حتى تكون ضمن نفس المعاملة. أي استعلام على pool مباشرةً يخرج عن المعاملة — لا تفعل.
 */

import { getClient } from '../config/db.js';

/**
 * ينفّذ callback داخل BEGIN/COMMIT، ويعمل ROLLBACK عند أي خطأ، ثم يحرّر العميل دائماً.
 * السبب: يضمن ذرّية تحديث الرصيد + إدراج صف transactions معاً [INV-2]،
 * ويمنع تسرّب اتصالات الـ pool عبر release في finally.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 *   دالة تتلقّى العميل المحجوز وتنفّذ كل استعلاماتها عليه.
 * @returns {Promise<T>} قيمة الـ callback بعد نجاح COMMIT.
 * @throws يُعاد رمي أي خطأ من الـ callback بعد تنفيذ ROLLBACK.
 */
export async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // نلغي كل التغييرات الجزئية حتى لا يبقى الرصيد أو السجل في حالة نصفية [INV-2].
    await client.query('ROLLBACK');
    throw err; // لا نبتلع الخطأ — يصعد إلى errorHandler المركزي (القسم 6/بند 5).
  } finally {
    client.release();
  }
}

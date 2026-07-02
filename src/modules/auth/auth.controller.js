/**
 * auth.controller.js
 * الطبقة: controller — HTTP فقط لمسارات المصادقة. لا منطق أعمال.
 */

/**
 * يعيد بيانات المستخدم الموثّق حالياً (كما حمّلها requireAuth في req.user).
 * السبب: تتيح للواجهة معرفة الهوية والدور بعد تسجيل الدخول.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function getMe(req, res) {
  res.json({ user: req.user });
}

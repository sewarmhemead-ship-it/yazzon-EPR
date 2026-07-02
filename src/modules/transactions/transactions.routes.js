/**
 * transactions.routes.js
 * الطبقة: route — يربط مسارات الحركات بالـ controller وسلسلة الـ middleware. لا منطق.
 *
 * RBAC (القسم 2 + الاختبار الإلزامي #10):
 *   - التسجيل اليومي (in/out/waste) متاح للموثّقين (staff + admin).
 *   - التسويات (adjustment) والتراجع (undo) حسّاسة → admin فقط.
 * كل المسارات تتطلب توثيقاً؛ userId يُشتقّ من req.user لا من الجسم.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { receive, consume, adjust, undo, list } from './transactions.controller.js';

const router = Router();

router.use(requireAuth); // كل ما تحت هذا الموجّه يتطلب هوية موثّقة.

router.get('/', list); // سجل الحركات (جاي/رايح/فاسد/تصحيح)
router.post('/receive', receive); // in
router.post('/consume', consume); // out | waste
router.post('/adjust', requireRole('admin'), adjust); // تسوية جرد
router.post('/:id/undo', requireRole('admin'), undo); // تراجع

export default router;

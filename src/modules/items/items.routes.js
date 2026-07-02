/**
 * items.routes.js
 * الطبقة: route — يربط مسارات العناصر بالـ controller وسلسلة الـ middleware. لا منطق.
 *
 * RBAC (القسم 1: المدير يدير العناصر؛ العامل يسجّل الحركات):
 *   - عرض العناصر: متاح للموثّقين (staff + admin) — العامل يحتاج القائمة لتسجيل الحركات.
 *   - إنشاء/تعديل العناصر: admin فقط (إدارة).
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { listAll, getOne, create, update } from './items.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listAll);
router.get('/:id', getOne);
router.post('/', requireRole('admin'), create);
router.patch('/:id', requireRole('admin'), update);

export default router;

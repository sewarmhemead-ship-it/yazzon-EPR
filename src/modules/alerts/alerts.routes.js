/**
 * alerts.routes.js
 * الطبقة: route — يربط مسارات التنبيهات بالـ controller وسلسلة الـ middleware. لا منطق.
 *
 * RBAC (القسم 1: المدير يرى التنبيهات ويدير العناصر):
 *   - عرض التنبيهات: متاح للموثّقين (staff + admin) — العامل يحتاج رؤية النقص.
 *   - تعليم/إلغاء "تم طلبه": admin فقط (قرار شراء).
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { getAlerts, markItemOrdered, unmarkItemOrdered } from './alerts.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', getAlerts);
router.post('/:id/ordered', requireRole('admin'), markItemOrdered);
router.delete('/:id/ordered', requireRole('admin'), unmarkItemOrdered);

export default router;

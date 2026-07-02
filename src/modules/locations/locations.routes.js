/**
 * locations.routes.js
 * الطبقة: route — ربط فقط. عرض للموثّقين، إنشاء للمدير.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { listAll, create } from './locations.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listAll);
router.post('/', requireRole('admin'), create);

export default router;

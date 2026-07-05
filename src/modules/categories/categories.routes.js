/**
 * categories.routes.js
 * Layer: route — wiring only. Reading for authenticated users, creation for
 * admins (same RBAC split as items).
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { listAll, create } from './categories.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listAll);
router.post('/', requireRole('admin'), create);

export default router;

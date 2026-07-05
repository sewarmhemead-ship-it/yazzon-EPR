/**
 * items.routes.js
 * Layer: route — maps item URLs to the controller and middleware chain.
 *
 * RBAC (section 1: admins manage items, staff record movements):
 *   - Reading items: any authenticated user — staff need the list to book.
 *   - Creating/updating items: admin only.
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

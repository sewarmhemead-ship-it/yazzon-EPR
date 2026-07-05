/**
 * alerts.routes.js
 * Layer: route — maps alert URLs to the controller and middleware chain.
 *
 * RBAC (section 1: the manager sees alerts and manages items):
 *   - Viewing alerts: any authenticated user — staff need to see shortages.
 *   - Marking/unmarking "ordered": admin only (purchasing decision).
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

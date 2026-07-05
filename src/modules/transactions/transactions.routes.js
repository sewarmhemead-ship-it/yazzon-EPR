/**
 * transactions.routes.js
 * Layer: route — maps movement URLs to the controller and middleware chain.
 *
 * RBAC (section 2 + mandatory test 10):
 *   - Daily bookings (in/out/waste) and reading history: any authenticated user.
 *   - Adjustments and undo are sensitive: admin only.
 * Every route requires authentication; userId derives from req.user.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { receive, consume, adjust, undo, list } from './transactions.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', list); // movement history (in/out/waste/adjustment)
router.post('/receive', receive); // in
router.post('/consume', consume); // out | waste
router.post('/adjust', requireRole('admin'), adjust); // inventory adjustment
router.post('/:id/undo', requireRole('admin'), undo); // reversal

export default router;

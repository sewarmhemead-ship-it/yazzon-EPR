/**
 * auth.routes.js
 * Layer: route — maps auth URLs to the controller and middleware chain.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getMe } from './auth.controller.js';

const router = Router();

// Who am I? Requires a valid token for an existing users row.
router.get('/me', requireAuth, getMe);

export default router;

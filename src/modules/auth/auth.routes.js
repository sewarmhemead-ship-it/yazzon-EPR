/**
 * auth.routes.js
 * الطبقة: route — يربط مسارات المصادقة بالـ controller وسلسلة الـ middleware. لا منطق.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getMe } from './auth.controller.js';

const router = Router();

// من أنا؟ — يتطلب توكناً صالحاً لمستخدم موجود في users.
router.get('/me', requireAuth, getMe);

export default router;

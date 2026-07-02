/**
 * app.js
 * الطبقة: تركيب (composition) — يبني تطبيق Express ويربط الـ middleware والـ modules.
 * المسؤولية: تجميع القطع فقط. لا منطق أعمال هنا.
 * يُصدَّر app دون listen ليتمكّن supertest من اختباره مباشرةً (القسم 9).
 *
 * ترتيب الـ modules لاحقاً:
 *   المرحلة 2: auth      → app.use('/api/auth', ...)
 *   المرحلة 3: transactions → app.use('/api/transactions', ...)
 *   المرحلة 1+: items    → app.use('/api/items', ...)
 *   المرحلة 4: alerts    → app.use('/api/alerts', ...)
 * errorHandler يبقى دائماً آخر شيء بعد كل المسارات.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware/errorHandler.js';
import { errorBody } from './shared/errors.js';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import transactionsRoutes from './modules/transactions/transactions.routes.js';
import alertsRoutes from './modules/alerts/alerts.routes.js';
import itemsRoutes from './modules/items/items.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import locationsRoutes from './modules/locations/locations.routes.js';

export const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../frontend/dist');
const frontendIndex = path.join(frontendDist, 'index.html');

// السماح للواجهة (مناشئ Vite) بالوصول عبر CORS مع ترويسة Authorization.
app.use(cors({ origin: env.corsOrigins }));

// تحليل أجسام JSON للطلبات.
app.use(express.json());

// فحص صحّة بسيط للتأكد أن الخادم حيّ (لا يمسّ قاعدة البيانات).
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// مسار للتطوير فقط لتوليد JWT في وضع العرض (لا يعمل خارج DEMO_MODE).
if (process.env.DEMO_MODE === 'true') {
  // حسابات العرض الوحيدة المقبولة — أي بريد آخر أو كلمة مرور خاطئة → 401 (كسلوك مصادقة حقيقي).
  const DEMO_ACCOUNTS = {
    'admin@demo.com': { id: '11111111-1111-1111-1111-111111111111', role: 'admin' },
    'staff@demo.com': { id: '22222222-2222-2222-2222-222222222222', role: 'staff' },
  };
  const DEMO_PASSWORD = 'demo';

  app.post('/api/demo/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const account = DEMO_ACCOUNTS[email];
    if (!account || password !== DEMO_PASSWORD) {
      return res
        .status(401)
        .json(errorBody('UNAUTHORIZED', 'E-Mail oder Passwort falsch'));
    }
    const token = jwt.sign(
      { sub: account.id, email, user_metadata: { role: account.role } },
      env.supabaseJwtSecret,
      { expiresIn: '8h' },
    );
    res.json({ access_token: token, user: { id: account.id, role: account.role, email } });
  });
}

// --- ربط الـ modules ---
app.use('/api/auth', authRoutes); // المرحلة 2
app.use('/api/items', itemsRoutes); // المرحلة 1+ (items API)
app.use('/api/categories', categoriesRoutes); // التصنيفات (Brot, Käse, Belag …)
app.use('/api/locations', locationsRoutes); // الأقسام/البرادات (Kühlschränke)
app.use('/api/transactions', transactionsRoutes); // المرحلة 3
app.use('/api/alerts', alertsRoutes); // المرحلة 4

// في الإنتاج يخدم Express واجهة React المبنية، بحيث يعمل Railway كتطبيق واحد.
if (env.nodeEnv === 'production' && existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(frontendIndex);
  });
}

// مسار غير موجود → رد 404 موحّد.
app.use((_req, res) => {
  res.status(404).json(errorBody('NOT_FOUND', 'المسار غير موجود'));
});

// معالج الأخطاء المركزي — يجب أن يكون آخر middleware (القسم 6/بند 5).
app.use(errorHandler);

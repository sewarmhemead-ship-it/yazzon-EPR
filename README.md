# نظام إدارة مخزون مخبز/كافيه

نظام مخزون بسيط ومستقر لمخبز وكافيه: تتبّع دقيق للمواد الخام وتنبيه شراء تلقائي عند الحدّ الأدنى.
**المصدر الوحيد للحقيقة والقوانين:** [`CLAUDE.md`](./CLAUDE.md) — اقرأه قبل أي تعديل.

## التقنيات

- **Backend:** Node.js + Express
- **قاعدة البيانات:** PostgreSQL (Supabase) عبر **node-postgres (`pg`)** — كل SQL يدوي و parameterized
- **الاختبارات:** Vitest + supertest على قاعدة اختبار منفصلة
- **الواجهة:** React + Vite (المرحلة 5)

## المتطلبات

- Node.js ‏≥ 20
- قاعدة PostgreSQL (محلية أو Supabase) — واحدة للتطوير وأخرى للاختبار

## التشغيل محلياً

```bash
# 1) ثبّت التبعيات
npm install

# 2) جهّز متغيرات البيئة
cp .env.example .env
# ثم عدّل .env: DATABASE_URL و TEST_DATABASE_URL و PORT

# 3) طبّق مخطط قاعدة البيانات (ينشئ الجداول من migrations/)
npm run migrate

# 4) شغّل الخادم
npm run dev        # مع إعادة التشغيل التلقائي
# أو
npm start
```

تحقق من الإقلاع: `GET http://localhost:3000/health` يعيد `{ "status": "ok" }`.

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تشغيل الخادم مع مراقبة التغييرات |
| `npm start` | تشغيل الخادم |
| `npm run migrate` | تطبيق ملفات `migrations/*.sql` بالترتيب |
| `npm test` | تشغيل كل اختبارات Vitest |
| `npm run test:unit` | اختبارات unit سريعة بلا قاعدة بيانات |
| `npm run test:integration` | اختبارات Express/service مع PostgreSQL حقيقي (`TEST_DATABASE_URL`) |
| `npm run test:stress` | اختبار ضغط التزامن على السحب الذرّي (`TEST_DATABASE_URL`) |
| `npm run test:frontend` | بناء الواجهة كفحص إنتاج |
| `npm run test:all` | بوابة محلية قبل الرفع: unit + integration + stress + frontend build |
| `npm run ci` | نفس بوابة CI/CD |

محلياً، إذا لم تكن قاعدة `TEST_DATABASE_URL` متاحة فاختبارات integration/stress تُتخطّى برسالة واضحة.
داخل GitHub Actions لا تُتخطّى: الـ workflow يشغّل PostgreSQL حقيقي، وغيابه يفشل البوابة.

## الواجهة (frontend — React + Vite + Tailwind)

الواجهة بالألمانية (LTR) وتستخدم `supabase-js` للمصادقة، وتنادي الـ backend عبر توكن Bearer.

```bash
cd frontend
npm install
cp .env.example .env   # املأ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY و VITE_API_URL
npm run dev            # http://localhost:5173
```

الشاشات: **Übersicht** · **Kühlung** · **Bestand** · **Warnungen** · **Verlauf**.

> **مهم:** لتسجيل الدخول يجب أن يكون لمستخدم Supabase صفٌّ مطابق في جدول `users` بنفس `id`
> (الـ backend يرفض هوية بلا صفّ — القرار 2-ب). أنشئ المستخدمين وعيّن أدوارهم (`admin`/`staff`).

## النشر على GitHub ثم Railway

المشروع مجهّز كتطبيق واحد على Railway: Express يخدم `/api/*` ويخدم واجهة React المبنية من `frontend/dist`.

قبل الرفع:

```bash
npm run test:all
npm run build
```

على GitHub:

1. ارفع المشروع إلى repository.
2. GitHub Actions في `.github/workflows/ci.yml` يشغّل unit + integration + stress + frontend build.
3. اختبارات integration/stress تحتاج PostgreSQL؛ الـ workflow يوفّر Postgres service تلقائياً.

على Railway:

1. أنشئ مشروع Railway من GitHub repo.
2. أضف PostgreSQL service.
3. اضبط متغيرات الخدمة:
   - `NODE_ENV=production`
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `SUPABASE_URL=https://ouixuwmkqptcaunatlub.supabase.co`
   - `SUPABASE_JWKS_URL=https://ouixuwmkqptcaunatlub.supabase.co/auth/v1/.well-known/jwks.json`
   - `SUPABASE_JWT_SECRET=...` فقط إذا مشروعك يستخدم HS256/JWT secret القديم
   - `CORS_ORIGIN=https://YOUR-RAILWAY-DOMAIN`
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
4. ملف `railway.json` يحدد:
   - build: `npm run build`
   - pre-deploy: `npm run migrate`
   - start: `npm start`
   - healthcheck: `/health`

بعد أول نشر، أضف دومين Railway في Supabase Auth كـ allowed redirect/site URL حسب إعدادات مشروعك.

## البنية

بنية معيارية حسب الميزة بأربع طبقات: `route → controller → service → repository → (DB)`.
التفاصيل الكاملة وشجرة الملفات في [`CLAUDE.md`](./CLAUDE.md) (القسم 5).

## ملاحظات مهمة

- **الأسرار في `.env` فقط** — لا تُرفَع (`.gitignore`).
- **تغييرات المخطط عبر ملف migration جديد فقط** — لا من لوحة Supabase.
- **Row Level Security مُطفأة** — الحماية مسؤولية Express (Auth + RBAC).

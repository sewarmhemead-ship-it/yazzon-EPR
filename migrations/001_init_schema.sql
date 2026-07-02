-- =============================================================================
-- 001_init_schema.sql
-- الطبقة: migration — إنشاء مخطط قاعدة البيانات الأولي (القسم 4 من CLAUDE.md).
-- ملف ترقيمي: لا يُعدَّل بعد الدمج. أي تغيير لاحق = migration جديد (002_...).
--
-- يفرض:
--   [INV-1] لا رصيد سالب أبداً  → CHECK (current_stock >= 0)
--   [INV-3] السجل ثابت          → transactions للقراءة/الإضافة فقط (يُفرَض في الكود؛
--            التصحيح = حركة عكسية عبر reverses_transaction_id، لا حذف/تعديل)
--   [INV-4] الكميات numeric      → لا float/real في أي عمود كمية
--   [INV-5] التواريخ timestamptz → كلها UTC، تُعرض بتوقيت Europe/Vienna في الواجهة
-- =============================================================================

-- gen_random_uuid() مدمجة في PostgreSQL 13+ (وموجودة في Supabase). الحارس للأمان فقط.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- users
-- id يطابق معرّف مستخدم Supabase Auth (auth.users.id) ويُمرَّر صراحةً عند المزامنة.
-- ⚠️ لا DEFAULT على id عمداً: لو نسي الكود تمريره يفشل الإدراج بوضوح بدل توليد uuid
--    عشوائي لا يطابق هوية Auth (خطأ صامت يصعب تعقّبه في المرحلة 2).
-- الصلاحيات تُفرَض في Express middleware — RLS مُطفأة (القسم 2).
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id         uuid        PRIMARY KEY,
  name       text        NOT NULL,
  email      text        NOT NULL UNIQUE,
  role       text        NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()   -- [INV-5]
);

-- -----------------------------------------------------------------------------
-- categories — تصنيف بسيط للعناصر
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

-- -----------------------------------------------------------------------------
-- items — المواد الخام. current_stock هو الرصيد الحيّ بالوحدة الأساسية [INV-6].
--   [INV-1] current_stock >= 0 يُدعَم على مستوى القاعدة كخطّ دفاع أخير؛
--           لكن الفرض الحقيقي هو الـ UPDATE الشرطي الذرّي في الـ service.
-- -----------------------------------------------------------------------------
CREATE TABLE items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  unit            text        NOT NULL,                       -- [INV-6] الوحدة الأساسية = وحدة الاستهلاك
  current_stock   numeric     NOT NULL DEFAULT 0 CHECK (current_stock >= 0),   -- [INV-1][INV-4]
  min_stock_level numeric     NOT NULL DEFAULT 1 CHECK (min_stock_level >= 0), -- [INV-4]
  category_id     uuid        REFERENCES categories(id),
  is_ordered      boolean     NOT NULL DEFAULT false,         -- تم طلبه؟ (القسم 7: يفصل "مطلوب" عن "مطلوب وتم طلبه")
  last_ordered_at timestamptz                                 -- [INV-5] nullable
);

-- -----------------------------------------------------------------------------
-- transactions — السجل الثابت (Immutable Ledger) [INV-3].
--   quantity_change: موجب = إدخال، سالب = سحب. أنواعه: in | out | waste | adjustment.
--   created_at من السيرفر (now()) لا من العميل، لضمان ترتيب موثوق (القسم 7: النزاعات).
--   reverses_transaction_id: يشير للحركة الأصلية عند التصحيح (Undo) [INV-3].
-- -----------------------------------------------------------------------------
CREATE TABLE transactions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id                 uuid        NOT NULL REFERENCES items(id),
  user_id                 uuid        NOT NULL REFERENCES users(id),
  type                    text        NOT NULL CHECK (type IN ('in', 'out', 'waste', 'adjustment')),
  quantity_change         numeric     NOT NULL CHECK (quantity_change <> 0),   -- [INV-4] لا حركة صفرية
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),                  -- [INV-5] من السيرفر
  reverses_transaction_id uuid        REFERENCES transactions(id)             -- [INV-3] nullable
);

-- -----------------------------------------------------------------------------
-- فهارس
-- -----------------------------------------------------------------------------
-- سجل حركات كل عنصر مرتّباً زمنياً (Undo لآخر حركة + التقارير مستقبلاً).
CREATE INDEX idx_transactions_item_created ON transactions (item_id, created_at DESC);
-- تسريع استعلام التنبيهات اللحظي (القسم 10): العناصر عند/تحت حدّها الأدنى.
CREATE INDEX idx_items_low_stock ON items (is_ordered) WHERE current_stock <= min_stock_level;

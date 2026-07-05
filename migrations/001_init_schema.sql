-- =============================================================================
-- 001_init_schema.sql
-- Layer: migration — initial database schema (CLAUDE.md section 4).
-- Numbered file: never edited after merge. Later changes get a new migration.
--
-- Enforces:
--   [INV-1] stock never negative        -> CHECK (current_stock >= 0)
--   [INV-3] immutable ledger            -> transactions are insert-only
--           (enforced in code; corrections reference the original row via
--           reverses_transaction_id — never UPDATE/DELETE)
--   [INV-4] quantities are numeric      -> no float/real on any quantity column
--   [INV-5] timestamps are timestamptz  -> stored UTC, displayed Europe/Vienna
-- =============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (and Supabase); guard only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- users
-- id matches the Supabase Auth user id (auth.users.id) and is provided
-- explicitly on sync. Intentionally no DEFAULT: if code forgets to pass the
-- id, the insert fails loudly instead of silently generating a uuid that
-- does not match the auth identity.
-- Authorization is enforced in Express middleware — RLS is disabled (section 2).
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id         uuid        PRIMARY KEY,
  name       text        NOT NULL,
  email      text        NOT NULL UNIQUE,
  role       text        NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()   -- [INV-5]
);

-- -----------------------------------------------------------------------------
-- categories — simple item grouping
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

-- -----------------------------------------------------------------------------
-- items — raw materials. current_stock is the live balance in the item's
-- base unit [INV-6].
--   [INV-1] current_stock >= 0 is backed at the database level as a last line
--           of defense; the real enforcement is the conditional atomic UPDATE
--           in the service layer.
-- -----------------------------------------------------------------------------
CREATE TABLE items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  unit            text        NOT NULL,                       -- [INV-6] base unit = consumption unit
  current_stock   numeric     NOT NULL DEFAULT 0 CHECK (current_stock >= 0),   -- [INV-1][INV-4]
  min_stock_level numeric     NOT NULL DEFAULT 1 CHECK (min_stock_level >= 0), -- [INV-4]
  category_id     uuid        REFERENCES categories(id),
  is_ordered      boolean     NOT NULL DEFAULT false,         -- separates "needed" from "needed and ordered" (section 7)
  last_ordered_at timestamptz                                 -- [INV-5] nullable
);

-- -----------------------------------------------------------------------------
-- transactions — the immutable ledger [INV-3].
--   quantity_change: positive = inflow, negative = outflow.
--   Types: in | out | waste | adjustment.
--   created_at comes from the server (now()), not the client, for a
--   trustworthy chronological order (section 7, dispute resolution).
--   reverses_transaction_id references the original movement on undo [INV-3].
-- -----------------------------------------------------------------------------
CREATE TABLE transactions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id                 uuid        NOT NULL REFERENCES items(id),
  user_id                 uuid        NOT NULL REFERENCES users(id),
  type                    text        NOT NULL CHECK (type IN ('in', 'out', 'waste', 'adjustment')),
  quantity_change         numeric     NOT NULL CHECK (quantity_change <> 0),   -- [INV-4] no zero movements
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),                  -- [INV-5] server time
  reverses_transaction_id uuid        REFERENCES transactions(id)             -- [INV-3] nullable
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
-- Per-item movement history in chronological order (undo + future reports).
CREATE INDEX idx_transactions_item_created ON transactions (item_id, created_at DESC);
-- Speeds up the live alert query (section 10): items at/below their minimum.
CREATE INDEX idx_items_low_stock ON items (is_ordered) WHERE current_stock <= min_stock_level;

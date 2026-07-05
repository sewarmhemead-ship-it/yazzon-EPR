-- =============================================================================
-- 002_add_locations.sql
-- Layer: migration — storage locations (fridges / Kühlschränke).
-- The extension planned in CLAUDE.md section 5: multi-location support via a
-- location_id column. Each item belongs to one location; the same product in
-- two fridges is two item rows, each with its own balance and threshold.
-- New numbered file — 001 is never edited after merge (section 8, rule 7).
-- =============================================================================

CREATE TABLE locations (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,
  position int  NOT NULL DEFAULT 0   -- display order in the UI (fridge 1..12)
);

-- An item belongs to one location (nullable: shelf items without a fridge).
ALTER TABLE items ADD COLUMN location_id uuid REFERENCES locations(id);

-- Speeds up listing a location's contents.
CREATE INDEX idx_items_location ON items (location_id);

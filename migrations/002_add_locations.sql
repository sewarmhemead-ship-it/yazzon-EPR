-- =============================================================================
-- 002_add_locations.sql
-- الطبقة: migration — أقسام التخزين (البرادات/Kühlschränke).
-- التوسعة المخطّطة في CLAUDE.md §5: "تعدّد الفروع/المخازن → عمود location_id".
-- كل عنصر يُسند لقسم واحد؛ نفس المادة في برادين = صفّا عنصر (لكلٍّ رصيده وحدّه).
-- ملف ترقيمي جديد — لا تعديل على 001 بعد اعتماده (§8/بند 7).
-- =============================================================================

CREATE TABLE locations (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL,
  position int  NOT NULL DEFAULT 0   -- ترتيب العرض في الواجهة (براد 1..12)
);

-- العنصر ينتمي لقسم (nullable: عناصر الرفّ/بلا قسم مسموحة).
ALTER TABLE items ADD COLUMN location_id uuid REFERENCES locations(id);

-- تسريع عرض محتويات قسم.
CREATE INDEX idx_items_location ON items (location_id);

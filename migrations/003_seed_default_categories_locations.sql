-- =============================================================================
-- 003_seed_default_categories_locations.sql
-- الطبقة: migration — بيانات تشغيل افتراضية للتصنيفات وأماكن التخزين.
-- السبب: الواجهة تعتمد على categories/locations كخيارات يومية؛ الجداول الفارغة تجعل
--        إنشاء العناصر وشاشة البرادات تبدوان بلا خيارات رغم أن الـ API يعمل.
-- آمن للتكرار: كل إدخال مشروط بالاسم حتى لا تتكرر البيانات في بيئات متعددة.
-- =============================================================================

INSERT INTO categories (name)
SELECT name
FROM (
  VALUES
    ('Brot & Gebäck'),
    ('Käse'),
    ('Belag & Zutaten'),
    ('Saucen & Aufstriche'),
    ('Getränke'),
    ('Milchprodukte'),
    ('Obst & Gemüse'),
    ('Verpackung')
) AS seed(name)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE lower(c.name) = lower(seed.name)
);

INSERT INTO locations (name, position)
SELECT name, position
FROM (
  VALUES
    ('Kühlschrank 01', 1),
    ('Kühlschrank 02', 2),
    ('Kühlschrank 03', 3),
    ('Kühlschrank 04', 4),
    ('Kühlschrank 05', 5),
    ('Kühlschrank 06', 6),
    ('Kühlschrank 07', 7),
    ('Kühlschrank 08', 8),
    ('Kühlschrank 09', 9),
    ('Kühlschrank 10', 10),
    ('Kühlschrank 11', 11),
    ('Kühlschrank 12', 12)
) AS seed(name, position)
WHERE NOT EXISTS (
  SELECT 1 FROM locations l WHERE lower(l.name) = lower(seed.name)
);

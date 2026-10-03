-- =============================================================================
--  Chen Furniture - the "Best Selling" homepage row
--  --------------------------------------------------------------------------
--  The homepage carries a fourth product block, "Best Selling", directly under
--  "New Products". It lists the products ticked "Best Selling" on their category
--  screen (products.price_from = 1), the same switch the product form writes, so
--  the shop fills the row from the admin instead of from this file. The blocks
--  that sat under "New Products" step down one slot each:
--
--    1 "Homepage carousel" (hero)             (unchanged)
--    2 "New Products"                         (same slot, driven by a switch now)
--    3 "Best Selling"                         (new)
--    4 "Discover Products & Ranges"           (was 3)
--    5 "All Products"                         (was 4)
--    6 "Shop Outdoor / Shop Indoor"           (was 5)
--    7 "Are you sitting comfortably?"         (was 6)
--    8 "Keep Cosy Anywhere"                   (was 7)
--
--  "New Products" also stops naming the two collections it used to pick and
--  reads the products ticked "New" (products.is_new = 1) instead, so its "VIEW
--  ALL" button points at /products rather than at one of those collections. The
--  collections themselves, and every other block, are left exactly as they were:
--  nothing here is deleted, renamed or restyled.
--
--  Rows are matched on (page, type, name) instead of on id, the INSERT only fires
--  while the row is missing, and every statement is plain SQL - running the file
--  twice changes nothing the second time. `scripts/data/content.mjs` carries the
--  same rows, so a database seeded from `0002_seed.sql` already matches them and
--  these statements then match nothing.
--
--  Note: no unique index covers (page, position), so the transient duplicates
--  while the statements run are fine; the final values are a permutation of the
--  eight slots the seed writes.
-- =============================================================================

INSERT INTO sections (page, type, name, position, enabled, data)
SELECT 'home', 'product_row', 'Best Selling', 3, 1,
       '{"heading":"Best Selling","subheading":"","source":"best","view_all":{"label":"VIEW ALL","url":"/products"}}'
WHERE NOT EXISTS (
  SELECT 1 FROM sections WHERE page = 'home' AND type = 'product_row' AND name = 'Best Selling'
);

UPDATE sections
   SET data = json_remove(
         json_set(
           data,
           '$.source', 'new',
           '$.view_all', json('{"label":"VIEW ALL","url":"/products"}')
         ),
         '$.pickers'
       )
 WHERE page = 'home' AND type = 'product_row' AND name = 'New Products';

UPDATE sections SET position = 3 WHERE page = 'home' AND type = 'product_row' AND name = 'Best Selling';
UPDATE sections SET position = 4 WHERE page = 'home' AND type = 'masonry' AND name = 'Discover Products & Ranges';
UPDATE sections SET position = 5 WHERE page = 'home' AND type = 'product_row' AND name = 'All Products';
UPDATE sections SET position = 6 WHERE page = 'home' AND type = 'link_grid' AND name = 'Shop Outdoor / Shop Indoor';
UPDATE sections SET position = 7 WHERE page = 'home' AND type = 'image_banner' AND name = 'Are you sitting comfortably?';
UPDATE sections SET position = 8 WHERE page = 'home' AND type = 'image_banner' AND name = 'Keep Cosy Anywhere';

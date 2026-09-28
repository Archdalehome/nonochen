-- =============================================================================
--  Chen Furniture - the homepage blocks in the order the shop asked for
--  --------------------------------------------------------------------------
--  The storefront renders the `sections` rows of page 'home' ordered by
--  `position`, so the three product blocks move directly under the hero and the
--  banner blocks follow them:
--
--    1 "Homepage carousel" (hero)             (unchanged)
--    2 "New Products"                         (was 5)
--    3 "Discover Products & Ranges"           (was 7)
--    4 "All Products"                         (was 2)
--    5 "Shop Outdoor / Shop Indoor"           (was 3)
--    6 "Are you sitting comfortably?"         (was 4)
--    7 "Keep Cosy Anywhere"                   (was 6)
--
--  Nothing is deleted, renamed or restyled: every block keeps its own markup,
--  copy and images and only changes slot. `scripts/data/content.mjs` carries the
-- same positions, so a database seeded from `0002_seed.sql` already matches and
-- these statements then match nothing.
--
--  Rows are matched on (page, type, name) instead of on id, and every statement
--  is a plain UPDATE - running the file twice changes nothing the second time.
--
--  Note: no unique index covers (page, position), so the transient duplicates
--  while the statements run are fine; the final values are a permutation of the
--  seven slots the seed writes.
-- =============================================================================

UPDATE sections SET position = 1 WHERE page = 'home' AND type = 'hero' AND name = 'Homepage carousel';
UPDATE sections SET position = 2 WHERE page = 'home' AND type = 'product_row' AND name = 'New Products';
UPDATE sections SET position = 3 WHERE page = 'home' AND type = 'masonry' AND name = 'Discover Products & Ranges';
UPDATE sections SET position = 4 WHERE page = 'home' AND type = 'product_row' AND name = 'All Products';
UPDATE sections SET position = 5 WHERE page = 'home' AND type = 'link_grid' AND name = 'Shop Outdoor / Shop Indoor';
UPDATE sections SET position = 6 WHERE page = 'home' AND type = 'image_banner' AND name = 'Are you sitting comfortably?';
UPDATE sections SET position = 7 WHERE page = 'home' AND type = 'image_banner' AND name = 'Keep Cosy Anywhere';

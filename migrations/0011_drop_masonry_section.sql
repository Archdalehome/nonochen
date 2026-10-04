-- =============================================================================
--  Chen Furniture - the "Discover Products & Ranges" block leaves the homepage
--  --------------------------------------------------------------------------
--  The masonry block that sat between "Best Selling" and "All Products" is
--  deleted, so the blocks the shop asked for run straight through:
--
--    1 "Homepage carousel" (hero)             (unchanged)
--    2 "New Products"                         (unchanged)
--    3 "Best Selling"                         (unchanged)
--    4 "All Products"                         (was 5)
--    5 "Shop Outdoor / Shop Indoor"           (was 6)
--    6 "Are you sitting comfortably?"         (was 7)
--    7 "Keep Cosy Anywhere"                   (was 8)
--
--  The row is removed rather than switched off: nothing renders it any more
--  (`views/admin.js` only has panels for the product rows, the tiles and the
--  banners) and the four images it used - modular-b-poufe.png,
--  modular-cushions.png, modular-lighting.png and modular-dogbed.png - are not
--  used by any other block. `views/home.js` keeps its `masonry` renderer and the
--  `sections` schema is untouched, so a future row of that type still draws.
--
--  `scripts/data/content.mjs` no longer carries the block and the positions above
--  are what `0002_seed.sql` writes, so a database seeded from the file already
--  matches and these statements then match nothing. Rows are matched on
--  (page, type, name) instead of on id, and running the file twice changes
--  nothing the second time.
--
--  Note: no unique index covers (page, position), so the transient duplicates
--  while the statements run are fine; the final values are a permutation of the
--  seven slots the seed writes.
-- =============================================================================

DELETE FROM sections
 WHERE page = 'home' AND type = 'masonry' AND name = 'Discover Products & Ranges';

UPDATE sections SET position = 4 WHERE page = 'home' AND type = 'product_row' AND name = 'All Products';
UPDATE sections SET position = 5 WHERE page = 'home' AND type = 'link_grid' AND name = 'Shop Outdoor / Shop Indoor';
UPDATE sections SET position = 6 WHERE page = 'home' AND type = 'image_banner' AND name = 'Are you sitting comfortably?';
UPDATE sections SET position = 7 WHERE page = 'home' AND type = 'image_banner' AND name = 'Keep Cosy Anywhere';

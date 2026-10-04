-- =============================================================================
--  Chen Furniture - the company block in the footer (/admin/footer)
--  --------------------------------------------------------------------------
--  The bottom left of every page is the company block: an uploaded logo, the
--  name of the business and one line of copy under it. /admin/footer edits all
--  three, so the logo needs a setting of its own next to the `site_name` and
--  `brand_line` rows that were already there.
--
--  `scripts/data/content.mjs` seeds the key (and `0002_seed.sql`, which is
--  generated from it, writes it into a fresh database). This statement brings the
--  databases that were seeded before it in line - the deployed one included. It is
--  guarded, so running it twice is harmless, and the empty default shows the name
--  on its own, exactly as the footer reads today.
-- =============================================================================

INSERT INTO settings (key, value, label, group_name)
SELECT 'footer_logo', '', NULL, 'brand'
 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'footer_logo');
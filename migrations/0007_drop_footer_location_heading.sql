-- =============================================================================
--  Chen Furniture - the "Location heading" setting is gone
--  --------------------------------------------------------------------------
--  /admin/footer used to edit the heading over the currency picker, stored as
--  the setting `footer_location_heading`, and `views/footer.js` rendered it.
--  Both are removed: the currency picker still closes the row of footer columns,
--  but it carries no heading any more.
--
--  `scripts/data/content.mjs` no longer seeds the key (so `0002_seed.sql`, which
--  is generated from it, does not either). This statement takes the row back out
--  of the databases that already have it - the deployed one included - and
--  matches nothing once it is gone, so running it twice is harmless.
-- =============================================================================

DELETE FROM settings WHERE key = 'footer_location_heading';

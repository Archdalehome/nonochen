-- =============================================================================
--  Chen Furniture - the currency picker is gone
--  --------------------------------------------------------------------------
--  The footer used to close its row of link columns with a country/currency
--  <select> (the setting `country_options`, seeded from the scraped country
--  list). The picker never did anything: no page reads the setting, nothing
--  handles `data-localize` and the Worker has never had a /localization route -
--  the form posted into a 404. The <select>, the form and the setting are all
--  removed, and the link columns now split the row between themselves.
--
--  `scripts/data/content.mjs` no longer carries the country list and
--  `scripts/build-seed.mjs` no longer seeds the key (so `0002_seed.sql`, generated
--  from them, does not either). This statement takes the row back out of the
--  databases that already have it - the deployed one included - and matches
--  nothing once it is gone, so running it twice is harmless.
-- =============================================================================

DELETE FROM settings WHERE key = 'country_options';

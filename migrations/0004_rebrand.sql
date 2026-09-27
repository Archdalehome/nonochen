-- =============================================================================
--  Rebrand: 0002_seed.sql was generated before the store was renamed, so every
--  database seeded from it still carries the previous brand name. This migration
--  rewrites those rows in place and is safe to run more than once.
-- =============================================================================

-- The old brand name in copy and links.
UPDATE settings SET value = REPLACE(value, 'Extreme Lounging', 'Chen Furniture');
UPDATE settings SET value = REPLACE(value, 'extremelounging.com', 'chenfurniture.com');
UPDATE settings SET value = REPLACE(value, 'extremelounging', 'chenfurniture');

UPDATE sections SET data = REPLACE(data, 'Extreme Lounging', 'Chen Furniture');
UPDATE sections SET data = REPLACE(data, 'extremelounging.com', 'chenfurniture.com');
UPDATE sections SET data = REPLACE(data, 'extremelounging', 'chenfurniture');

UPDATE menu_items SET label = REPLACE(label, 'Extreme Lounging', 'Chen Furniture');
UPDATE menu_items SET url = REPLACE(url, 'extremelounging.com', 'chenfurniture.com');
UPDATE menu_items SET url = REPLACE(url, 'extremelounging', 'chenfurniture');

UPDATE product_usps SET description = REPLACE(description, 'Extreme Lounging', 'Chen Furniture');
UPDATE products SET seo_title = REPLACE(seo_title, 'Extreme Lounging', 'Chen Furniture');

-- The seeded contact page published the previous owner's phone number and postal
-- address; neither belongs on this site.
UPDATE sections
   SET data = '{"title":"Contact Details","body":"<p>Customer Service: <a href=\"mailto:customerservice@chenfurniture.com\">customerservice@chenfurniture.com</a></p><p>We aim to reply within one working day, Monday to Friday.</p>"}'
 WHERE page = 'page:contact-details' AND name = 'Contact Details';

-- No phone line in the footer, and empty handles hide the social icons and the
-- third party website credit instead of linking at somebody else's pages.
DELETE FROM menu_items WHERE location = 'footer' AND label = 'Call Us';
UPDATE settings SET value = '' WHERE key IN ('social_facebook', 'social_instagram', 'footer_credit', 'footer_credit_url');

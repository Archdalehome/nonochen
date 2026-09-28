-- =============================================================================
--  Chen Furniture - the footer link columns (/admin/footer)
--  --------------------------------------------------------------------------
--  The bottom of every page is built from `menu_items` (location = 'footer'):
--  one 'group_heading' row per column plus one 'link' row per item under it.
--  `views/footer.js` renders whatever is enabled, and /admin/footer edits those
--  same rows, so none of this needs a deploy again.
--
--  This migration brings an existing database in line with the seed:
--
--    * Company -> About, Contact, FAQ
--    * Follow  -> Instagram, Facebook, TikTok (the social profiles)
--    * Help    -> unchanged (Terms, Privacy, Delivery, Returns)
--    * the Location heading keeps the currency picker it already heads
--
--  About and FAQ are new content pages (`sections` with page = 'page:about' and
--  page = 'page:faq'), so those two links answer instead of 404ing. They are
--  ordinary pages: edit the copy in D1, or repoint the footer links from
--  /admin/footer. Every statement is guarded, so running this twice - by hand
--  and then by the pipeline - is harmless.
-- =============================================================================

-- 1. Repair first. The seed wrote a column and its links in one multi row
--    INSERT, and a subquery there cannot always see the column row it points at,
--    so some links ended up with `parent_id` NULL - and a link nobody owns is a
--    link the storefront never renders (the Help column lost all four of its
--    own that way). Adopting them by `group_label` puts them back; the statement
--    matches nothing once every link has a parent.
UPDATE menu_items
   SET parent_id = (SELECT g.id FROM menu_items g
                     WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = menu_items.group_label)
 WHERE location = 'footer' AND kind = 'link' AND parent_id IS NULL
   AND EXISTS (SELECT 1 FROM menu_items g
                WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = menu_items.group_label);

-- 2. Company: the four links the theme shipped with give way to About / Contact
--    / FAQ. Both the owner and the `group_label` are checked, so a link stored
--    without a parent is cleared too, and the inserts below are what make this
--    repeatable.
DELETE FROM menu_items
 WHERE location = 'footer' AND kind = 'link'
   AND (group_label = 'Company'
        OR parent_id IN (SELECT id FROM menu_items
                          WHERE location = 'footer' AND kind = 'group_heading' AND label = 'Company'));

INSERT INTO menu_items (location, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order, enabled)
SELECT 'footer', g.id, 'link', 1, g.label, 'About', '/pages/about', NULL, NULL, 1, 1
  FROM menu_items g
 WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = 'Company';

INSERT INTO menu_items (location, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order, enabled)
SELECT 'footer', g.id, 'link', 1, g.label, 'Contact', '/pages/contact-details', NULL, NULL, 2, 1
  FROM menu_items g
 WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = 'Company';

INSERT INTO menu_items (location, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order, enabled)
SELECT 'footer', g.id, 'link', 1, g.label, 'FAQ', '/pages/faq', NULL, NULL, 3, 1
  FROM menu_items g
 WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = 'Company';


-- 3. Follow: the social profiles, beside Company. Help (and the Location picker
--    that follows it) step one place to the right, so the row reads Company /
--    Follow / Help / Location. Both statements are guarded, so a re-run cannot
--    undo an order that was changed in /admin/footer in the meantime.
UPDATE menu_items
   SET sort_order = 3
 WHERE location = 'footer' AND kind = 'group_heading' AND label = 'Help' AND sort_order = 2
   AND NOT EXISTS (SELECT 1 FROM menu_items
                    WHERE location = 'footer' AND kind = 'group_heading' AND label = 'Follow');

INSERT INTO menu_items (location, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order, enabled)
SELECT 'footer', NULL, 'group_heading', 1, NULL, 'Follow', '', NULL, NULL, 2, 1
 WHERE NOT EXISTS (SELECT 1 FROM menu_items
                    WHERE location = 'footer' AND kind = 'group_heading' AND label = 'Follow');

INSERT INTO menu_items (location, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order, enabled)
SELECT 'footer', g.id, 'link', 1, g.label, 'Instagram', 'https://www.instagram.com/', NULL, NULL, 1, 1
  FROM menu_items g
 WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = 'Follow'
   AND NOT EXISTS (SELECT 1 FROM menu_items x WHERE x.parent_id = g.id AND x.label = 'Instagram');

INSERT INTO menu_items (location, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order, enabled)
SELECT 'footer', g.id, 'link', 1, g.label, 'Facebook', 'https://www.facebook.com/', NULL, NULL, 2, 1
  FROM menu_items g
 WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = 'Follow'
   AND NOT EXISTS (SELECT 1 FROM menu_items x WHERE x.parent_id = g.id AND x.label = 'Facebook');

INSERT INTO menu_items (location, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order, enabled)
SELECT 'footer', g.id, 'link', 1, g.label, 'TikTok', 'https://www.tiktok.com/', NULL, NULL, 3, 1
  FROM menu_items g
 WHERE g.location = 'footer' AND g.kind = 'group_heading' AND g.label = 'Follow'
   AND NOT EXISTS (SELECT 1 FROM menu_items x WHERE x.parent_id = g.id AND x.label = 'TikTok');

-- 4. The two pages the new Company links point at. The wording sticks to what
--    the site already publishes (3-5 working days, the 14 day cancellation and
--    the customer service address), so nothing here is a new promise.
INSERT INTO sections (page, type, name, position, enabled, data)
SELECT 'page:about', 'page', 'About', 1, 1,
       '{"title":"About Chen Furniture","body":"<p>Chen Furniture makes bean bags, chairs and loungers for indoors and outdoors. The range is built around one idea: generous, sink-into-it comfort that suits the living room as well as the garden.</p><p>The fabrics are water resistant and UV resistant, so a shower of rain or a season in the sun is not a problem - every product page lists the features it was made with.</p><p>Questions about a product, an order or a return? Email <a href=\"mailto:customerservice@chenfurniture.com\">customerservice@chenfurniture.com</a> and we will reply within one working day, Monday to Friday.</p>"}'
 WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page = 'page:about');

INSERT INTO sections (page, type, name, position, enabled, data)
SELECT 'page:faq', 'page', 'FAQ', 1, 1,
       '{"title":"FAQ","body":"<p><strong>How long does delivery take?</strong><br>Orders are delivered within 3-5 working days, and free Mainland UK shipping is included. See <a href=\"/pages/delivery\">Delivery Details</a>.</p><p><strong>Can I return an order?</strong><br>Yes - you can cancel within 14 days of receiving the products. See <a href=\"/pages/returns\">Returns</a>.</p><p><strong>Where can I see the products in person?</strong><br>Our bean bags are stocked by independent retailers across the UK and Ireland - see <a href=\"/pages/store-locator\">Store Locator</a>.</p><p><strong>How do I get in touch?</strong><br>Email <a href=\"mailto:customerservice@chenfurniture.com\">customerservice@chenfurniture.com</a> or see <a href=\"/pages/contact-details\">Contact Details</a>.</p>"}'
 WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page = 'page:faq');


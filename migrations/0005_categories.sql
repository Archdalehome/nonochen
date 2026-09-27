-- =============================================================================
--  Chen Furniture - product categories (managed from /admin)
--  --------------------------------------------------------------------------
--  `categories` drives the strip of links that sits directly under the black
--  announcement bar on every page. Rows are created, edited, reordered and
--  deleted in the admin UI (/admin/login, admin/admin) which writes to this
--  table, so adding a category never needs a code change or a deploy.
--
--  filter_type tells the /category/<slug> page which products to list:
--    collection -> every product in the collection named `filter_value`
--    tag        -> every product whose cat_handle / cat_label matches
--                  `filter_value` (case insensitive)
--    all        -> every product
--
--  url is optional. Leave it empty to link at /category/<slug>, or point it at
--  an existing page such as /collections/<handle> or /products.
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  url          TEXT    NOT NULL DEFAULT '',
  filter_type  TEXT    NOT NULL DEFAULT 'tag',   -- collection | tag | all
  filter_value TEXT    NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0,
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_bar ON categories (enabled, position, id);

-- Seed the bar with the curated collections (sort_order 1-10 in 0002_seed.sql)
-- so it is not empty on first load. The admin can edit or delete these.
INSERT OR IGNORE INTO categories (slug, name, url, filter_type, filter_value, position, enabled)
SELECT handle, title, '/collections/' || handle, 'collection', handle, sort_order, 1
  FROM collections
 WHERE sort_order <= 10
 ORDER BY sort_order;

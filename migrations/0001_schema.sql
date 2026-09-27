-- =============================================================================
--  Extreme Lounging replica - D1 schema (Cloudflare D1 / SQLite)
--  Every piece of site copy that the original Shopify theme renders is stored
--  here so it can be edited from the admin API without touching code.
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  label       TEXT,
  group_name  TEXT DEFAULT 'general',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- header / mobile / footer navigation, mega-menu columns and promo tiles
CREATE TABLE IF NOT EXISTS menu_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  location     TEXT    NOT NULL DEFAULT 'header',   -- header | mobile | footer
  parent_id    INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
  kind         TEXT    NOT NULL DEFAULT 'link',     -- link | top_level | group_heading | promo | column_heading
  column_no    INTEGER NOT NULL DEFAULT 1,
  group_label  TEXT,
  label        TEXT    NOT NULL,
  url          TEXT    DEFAULT '',
  image        TEXT,
  badge        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  enabled      INTEGER NOT NULL DEFAULT 1
);

-- homepage (and other page) content blocks, `data` holds the block payload as JSON
CREATE TABLE IF NOT EXISTS sections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page       TEXT    NOT NULL DEFAULT 'home',
  type       TEXT    NOT NULL,                       -- hero | link_grid | product_row | image_banner | masonry | newsletter
  name       TEXT    NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  enabled    INTEGER NOT NULL DEFAULT 1,
  data       TEXT    NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  handle      TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  subtitle    TEXT    DEFAULT '',
  description TEXT    DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  handle             TEXT    NOT NULL UNIQUE,
  title              TEXT    NOT NULL,
  short_title        TEXT    DEFAULT '',
  price              REAL    NOT NULL DEFAULT 0,
  compare_at_price   REAL,
  price_from         INTEGER NOT NULL DEFAULT 0,     -- render "from "
  badge              TEXT,
  image              TEXT    NOT NULL,
  cat_handle         TEXT    DEFAULT '',             -- first tag pill, e.g. outdoor
  cat_label          TEXT    DEFAULT '',
  colour             TEXT    DEFAULT '',
  colour_hex         TEXT    DEFAULT '#5f6062',
  summary            TEXT    DEFAULT '',
  description        TEXT    DEFAULT '',
  features           TEXT    NOT NULL DEFAULT '[]',  -- JSON array<string>
  specs              TEXT    NOT NULL DEFAULT '[]',  -- JSON array<{label,value}>
  shipping_note      TEXT    DEFAULT '',
  collection_handle  TEXT    DEFAULT '',
  sold_out           INTEGER NOT NULL DEFAULT 0,
  is_new             INTEGER NOT NULL DEFAULT 0,
  show_in_home_grid  INTEGER NOT NULL DEFAULT 1,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  seo_title          TEXT    DEFAULT '',
  seo_description    TEXT    DEFAULT '',
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- many to many: a product can appear in several collections / rows
CREATE TABLE IF NOT EXISTS product_collections (
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_handle TEXT    NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, collection_handle)
);

-- size variants (Mini / Mighty / Monster) and colour swatches
CREATE TABLE IF NOT EXISTS product_variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL DEFAULT 'size',        -- size | colour
  name       TEXT    NOT NULL,
  hex        TEXT,
  image      TEXT,
  price      REAL,
  dims       TEXT    NOT NULL DEFAULT '[]',          -- JSON array<string> e.g. ["H: 74cm","W: 74cm"]
  weight     TEXT    DEFAULT '',
  available  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- "Product Features" cards. product_id NULL => brand wide defaults
CREATE TABLE IF NOT EXISTS product_usps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    DEFAULT '',
  icon        TEXT    DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- gallery: mixed image / video blocks for the "images list" section of the PDP
CREATE TABLE IF NOT EXISTS product_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL DEFAULT 'image',       -- image | video
  src        TEXT    NOT NULL,
  poster     TEXT,
  span       TEXT    NOT NULL DEFAULT 'col-6',       -- bootstrap column classes
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS carts (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id        TEXT    NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id     INTEGER NOT NULL DEFAULT 0,
  qty            INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cart_id, product_id, variant_id)
);

CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  message    TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_location    ON menu_items (location, parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sections_page    ON sections (page, position);
CREATE INDEX IF NOT EXISTS idx_products_grid    ON products (show_in_home_grid, sort_order);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants (product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_product    ON product_media (product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_usps_product     ON product_usps (product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cart_items       ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_prod_collections ON product_collections (collection_handle, sort_order);


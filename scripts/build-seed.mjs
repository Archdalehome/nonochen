/**
 * Builds migrations/0002_seed.sql from scripts/data/content.mjs and the scraped
 * row data in scripts/data/rowb-products.json.
 *
 *   node scripts/build-seed.mjs      (or: npm run seed:build)
 *
 * The whole file is idempotent: it clears the content tables first, so it can be
 * re-run against local or remote D1 at any time. Carts, subscribers and
 * enquiries are left alone.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  settings,
  collections as collectionsContent,
  menu,
  sections,
  allProducts,
  collectionCopy,
  extraCollections,
  defaultFeatures,
  defaultUsp,
} from './data/content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const rowbProducts = JSON.parse(readFileSync(join(here, 'data', 'rowb-products.json'), 'utf8'));

/* --------------------------------------------------------------- helpers ---- */

const q = (value) =>
  value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

const n = (value) => (value === null || value === undefined || value === '' ? 'NULL' : Number(value));

const pretty = (handle) =>
  handle
    .split('-')
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(' ');

const lines = [];
const push = (sql) => lines.push(sql);
const insertMany = (table, columns, rows, perStatement = 25) => {
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    push(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n` +
        chunk.map((row) => `  (${row.join(', ')})`).join(',\n') +
        ';'
    );
  }
};

/* -------------------------------------------------------------- settings ---- */

const settingsRows = settings.map((s) => [q(s.key), q(s.value), q(s.label ?? null), q(s.group ?? 'general')]);
settingsRows.push([q('country_options'), q(JSON.stringify(menu.countries)), q('Country picker'), q('footer')]);

/* ----------------------------------------------------------- collections ---- */

const collectionRows = [];
for (const collection of collectionsContent) {
  collectionRows.push([
    q(collection.handle),
    q(collection.title),
    q(collection.subtitle || ''),
    q(collection.description || ''),
    collection.sort,
  ]);
}
extraCollections.forEach((handle, i) => {
  collectionRows.push([q(handle), q(pretty(handle)), q(''), q(''), 100 + i]);
});

/* -------------------------------------------------------------- products ---- */

const mediaSpans = ['col-12 col-md-7', 'col-6 col-md-5', 'col-6 col-md-5', 'col-6 col-md-4', 'col-6 col-md-3', 'col-12'];

const productRows = [];
const variantRows = [];
const mediaRows = [];
const productCollectionRows = [];

const addProduct = (p, sortOrder, inGrid) => {
  const colours = p.colours || [];
  const collections = p.collections || (p.collection ? [p.collection] : []);
  const primary = colours[0] || { name: '', hex: '#5f6062' };
  const specs = (p.specs || []).map(([label, value]) => ({ label, value }));
  const handle = p.handle;
  const price = Number(p.price || 0);

  productRows.push([
    q(handle),
    q(p.title),
    q(p.short_title || ''),
    price,
    n(p.compare_at_price),
    p.price_from ? 1 : 0,
    q(p.badge || ''),
    q(p.image),
    q(p.category || ''),
    q(pretty(p.category || '')),
    q(primary.name),
    q(primary.hex),
    q(p.summary || ''),
    q(p.description || ''),
    q(JSON.stringify(p.features || defaultUsp)),
    q(JSON.stringify(specs)),
    q(p.shipping_note || ''),
    q(collections[0] || ''),
    p.sold_out ? 1 : 0,
    p.badge === 'NEW' ? 1 : 0,
    inGrid ? 1 : 0,
    sortOrder,
    q(`${p.title} | Extreme Lounging`),
    q(p.summary || ''),
  ]);

  const id = `(SELECT id FROM products WHERE handle = ${q(handle)})`;

  collections.forEach((collection, i) => {
    productCollectionRows.push([id, q(collection), i]);
  });

  (p.sizes || []).forEach((size, i) => {
    const dims = (size.dims || '')
      .split(/\s{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
    variantRows.push([
      id,
      q('size'),
      q(size.name),
      'NULL',
      q(size.image || ''),
      n(size.price),
      q(JSON.stringify(dims)),
      q(size.weight || ''),
      1,
      size.sort || i + 1,
    ]);
  });

  colours.forEach((colour, i) => {
    variantRows.push([id, q('colour'), q(colour.name), q(colour.hex), 'NULL', 'NULL', q('[]'), q(''), 1, i + 1]);
  });

  (p.images || [p.image]).forEach((src, i) => {
    mediaRows.push([id, q('image'), q(src), 'NULL', q(mediaSpans[i % mediaSpans.length]), i + 1]);
  });

  if (p.video) {
    mediaRows.push([id, q('video'), q(p.video), q(p.poster || ''), q('col-12'), (p.images || []).length + 1]);
  }
};

allProducts.forEach((product) => addProduct(product, product.sort, Boolean(product.grid)));

rowbProducts.forEach((raw, index) => {
  const copy = collectionCopy[raw.collection] || {};
  addProduct(
    {
      handle: raw.handle.replace('/products/', ''),
      title: raw.title,
      category: copy.category || 'accessories',
      price: raw.price,
      price_from: copy.price_from || 0,
      image: raw.image,
      images: [raw.image],
      collections: [raw.collection],
      summary: copy.summary || '',
      description: copy.description || '',
      specs: copy.specs || [],
      colours: [],
    },
    1000 + index,
    false
  );
});

/* ------------------------------------------------------------------ menu ---- */

const menuRows = []; // [location, parentSql, kind, column_no, group_label, label, url, image, badge, sort_order]

const addHeaderTree = (location, item) => {
  const parent =
    `(SELECT id FROM menu_items WHERE location = ${q(location)} AND label = ${q(item.label)} AND parent_id IS NULL)`;
  menuRows.push([
    q(location), 'NULL', q('top_level'), 1, 'NULL', q(item.label), q(item.url), 'NULL', 'NULL', item.sort || 0,
  ]);
  (item.columns || []).forEach((column, ci) => {
    menuRows.push([
      q(location), parent, q('column_heading'), ci + 1, 'NULL', q(column.heading), q(column.url), 'NULL', 'NULL', ci + 1,
    ]);
    const columnParent =
      `(SELECT id FROM menu_items WHERE location = ${q(location)} AND label = ${q(column.heading)} AND kind = 'column_heading')`;
    (column.links || []).forEach(([label, url], li) => {
      menuRows.push([q(location), columnParent, q('link'), ci + 1, q(column.heading), q(label), q(url), 'NULL', 'NULL', li + 1]);
    });
  });
  if (location === 'header') {
    (item.promos || []).forEach((promo, pi) => {
      menuRows.push([q('header'), parent, q('promo'), 0, 'NULL', q(promo.label), q(promo.url), q(promo.image), 'NULL', pi + 1]);
    });
  }
};

menu.header.forEach((item, index) => {
  if (item.kind === 'top_level') {
    addHeaderTree('header', { ...item, sort: index + 1 });
    addHeaderTree('mobile', { ...item, sort: index + 1 });
  } else {
    menuRows.push([q('header'), 'NULL', q('link'), 1, 'NULL', q(item.label), q(item.url), 'NULL', 'NULL', index + 1]);
    menuRows.push([q('mobile'), 'NULL', q('link'), 1, 'NULL', q(item.label), q(item.url), 'NULL', 'NULL', index + 1]);
  }
});

menu.footer.forEach((group, gi) => {
  menuRows.push([q('footer'), 'NULL', q('group_heading'), 1, 'NULL', q(group.heading), q(''), 'NULL', 'NULL', gi + 1]);
  const groupParent =
    `(SELECT id FROM menu_items WHERE location = 'footer' AND label = ${q(group.heading)} AND kind = 'group_heading')`;
  group.links.forEach(([label, url], li) => {
    menuRows.push([q('footer'), groupParent, q('link'), 1, q(group.heading), q(label), q(url), 'NULL', 'NULL', li + 1]);
  });
});

/* -------------------------------------------------------------- sections ---- */

const sectionRows = sections.map((section) => [
  q(section.page),
  q(section.type),
  q(section.name || ''),
  section.position || 0,
  section.enabled === 0 ? 0 : 1,
  q(JSON.stringify(section.data || {})),
]);

/* ----------------------------------------------------------------- write ---- */

push('-- =============================================================================');
push('--  GENERATED FILE - do not edit by hand.');
push('--  Run `npm run seed:build` after changing scripts/data/content.mjs');
push('-- =============================================================================');
push('');
push('PRAGMA foreign_keys = OFF;');
push('');
push('DELETE FROM product_media;');
push('DELETE FROM product_variants;');
push('DELETE FROM product_usps;');
push('DELETE FROM product_collections;');
push('DELETE FROM products;');
push('DELETE FROM collections;');
push('DELETE FROM menu_items;');
push('DELETE FROM sections;');
push('DELETE FROM settings;');
push('');

insertMany('settings', ['key', 'value', 'label', 'group_name'], settingsRows);
push('');
insertMany('collections', ['handle', 'title', 'subtitle', 'description', 'sort_order'], collectionRows);
push('');
insertMany(
  'products',
  [
    'handle', 'title', 'short_title', 'price', 'compare_at_price', 'price_from', 'badge', 'image', 'cat_handle',
    'cat_label', 'colour', 'colour_hex', 'summary', 'description', 'features', 'specs', 'shipping_note',
    'collection_handle', 'sold_out', 'is_new', 'show_in_home_grid', 'sort_order', 'seo_title', 'seo_description',
  ],
  productRows,
  10
);
push('');
insertMany('product_collections', ['product_id', 'collection_handle', 'sort_order'], productCollectionRows);
push('');
insertMany(
  'product_variants',
  ['product_id', 'kind', 'name', 'hex', 'image', 'price', 'dims', 'weight', 'available', 'sort_order'],
  variantRows
);
push('');
insertMany('product_media', ['product_id', 'kind', 'src', 'poster', 'span', 'sort_order'], mediaRows);
push('');
insertMany(
  'product_usps',
  ['product_id', 'title', 'description', 'icon', 'sort_order'],
  defaultFeatures.map((feature, i) => ['NULL', q(feature.name), q(feature.text), q(feature.icon), i + 1])
);
push('');
insertMany(
  'menu_items',
  ['location', 'parent_id', 'kind', 'column_no', 'group_label', 'label', 'url', 'image', 'badge', 'sort_order'],
  menuRows
);
push('');
insertMany('sections', ['page', 'type', 'name', 'position', 'enabled', 'data'], sectionRows, 4);
push('');
push('PRAGMA foreign_keys = ON;');
push('');

writeFileSync(join(root, 'migrations', '0002_seed.sql'), lines.join('\n'), 'utf8');

console.log(
  `migrations/0002_seed.sql written: ${productRows.length} products, ${variantRows.length} variants, ` +
    `${mediaRows.length} media rows, ${menuRows.length} menu items, ${sectionRows.length} sections`
);

/**
 * All D1 access lives here so the renderers can stay declarative.
 *
 * Reads that every page needs (settings, navigation, sections) are memoised for
 * `TTL` inside the isolate; the admin endpoints call `invalidate()` after a
 * write so the change shows up immediately.
 */
const TTL = 30_000;
const store = new Map();

const memo = async (key, loader, ttl = TTL) => {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;
  const value = await loader();
  store.set(key, { value, expires: now + ttl });
  return value;
};

export const invalidate = (prefix = '') => {
  for (const key of [...store.keys()]) {
    if (!prefix || key.startsWith(prefix)) store.delete(key);
  }
};

/* --------------------------------------------------------------- helpers ---- */

const parseJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value || '');
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const hydrate = (row) =>
  row && {
    ...row,
    features: parseJson(row.features, []),
    specs: parseJson(row.specs, []),
    priceFrom: Boolean(row.price_from),
    soldOut: Boolean(row.sold_out),
    isNew: Boolean(row.is_new),
    inGrid: Boolean(row.show_in_home_grid),
  };

const groupBy = (rows, key) => {
  const map = new Map();
  for (const row of rows) {
    const bucket = map.get(row[key]);
    if (bucket) bucket.push(row);
    else map.set(row[key], [row]);
  }
  return map;
};

/* -------------------------------------------------------------- settings ---- */

export const settings = (db) =>
  memo('settings', async () => {
    const { results } = await db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries((results || []).map((row) => [row.key, row.value]));
  });

export const saveSetting = async (db, key, value) => {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, value)
    .run();
  invalidate('settings');
};

/* ------------------------------------------------------------- navigation ---- */

export const navigation = (db, location = 'header') =>
  memo(`menu:${location}`, async () => {
    const { results } = await db
      .prepare(
        `SELECT id, parent_id, kind, column_no, group_label, label, url, image, badge, sort_order
           FROM menu_items
          WHERE location = ? AND enabled = 1
          ORDER BY sort_order, id`
      )
      .bind(location)
      .all();

    const rows = results || [];
    const children = groupBy(rows, 'parent_id');
    const roots = rows.filter((row) => row.parent_id === null);

    return roots.map((root) => {
      const kids = children.get(root.id) || [];
      const columns = kids
        .filter((row) => row.kind === 'column_heading')
        .map((column) => ({
          ...column,
          links: (children.get(column.id) || []).filter((row) => row.kind === 'link'),
        }));
      return {
        ...root,
        columns,
        promos: kids.filter((row) => row.kind === 'promo'),
        links: kids.filter((row) => row.kind === 'link'),
      };
    });
  });

export const footerGroups = (db) =>
  memo('menu:footer-groups', async () => {
    const { results } = await db
      .prepare(
        `SELECT id, parent_id, kind, group_label, label, url, sort_order
           FROM menu_items WHERE location = 'footer' AND enabled = 1 ORDER BY sort_order, id`
      )
      .all();
    const rows = results || [];
    const children = groupBy(rows, 'parent_id');
    return rows
      .filter((row) => row.kind === 'group_heading')
      .map((group) => ({ ...group, links: children.get(group.id) || [] }));
  });

/* --------------------------------------------------------------- content ---- */

export const sections = (db, page = 'home') =>
  memo(`sections:${page}`, async () => {
    const { results } = await db
      .prepare(
        `SELECT id, page, type, name, position, data FROM sections
          WHERE page = ? AND enabled = 1 ORDER BY position, id`
      )
      .bind(page)
      .all();
    return (results || []).map((row) => ({ ...row, data: parseJson(row.data, {}) }));
  });

/* ------------------------------------------------------------ collections ---- */

export const collections = (db) =>
  memo('collections', async () => {
    const { results } = await db
      .prepare(
        `SELECT c.handle, c.title, c.subtitle, c.description, c.sort_order,
                (SELECT COUNT(*) FROM product_collections pc WHERE pc.collection_handle = c.handle) AS product_count
           FROM collections c ORDER BY c.sort_order, c.title`
      )
      .all();
    return (results || []).map((row) => ({ ...row, productCount: row.product_count }));
  });

export const collection = async (db, handle) => {
  const all = await collections(db);
  return all.find((row) => row.handle === handle) || null;
};


/* --------------------------------------------------------------- products ---- */

const PRODUCT_COLUMNS = `p.id, p.handle, p.title, p.short_title, p.price, p.compare_at_price, p.price_from,
  p.badge, p.image, p.cat_handle, p.cat_label, p.colour, p.colour_hex, p.summary, p.description,
  p.features, p.specs, p.shipping_note, p.collection_handle, p.sold_out, p.is_new,
  p.show_in_home_grid, p.sort_order, p.seo_title, p.seo_description`;

/** Attaches `colours` and `sizes` arrays to a list of hydrated products. */
const withVariants = async (db, products) => {
  if (!products.length) return products;
  const ids = products.map((product) => product.id);
  const placeholders = ids.map(() => '?').join(', ');
  const { results } = await db
    .prepare(
      `SELECT id, product_id, kind, name, hex, image, price, dims, weight, available, sort_order
         FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY sort_order, id`
    )
    .bind(...ids)
    .all();

  const byProduct = groupBy(results || [], 'product_id');
  return products.map((product) => {
    const variants = byProduct.get(product.id) || [];
    return {
      ...product,
      colours: variants
        .filter((row) => row.kind === 'colour')
        .map((row) => ({ name: row.name, hex: row.hex || '#18181b', image: row.image || '' })),
      sizes: variants
        .filter((row) => row.kind === 'size')
        .map((row) => ({
          id: row.id,
          name: row.name,
          price: row.price === null ? product.price : row.price,
          dims: parseJson(row.dims, []),
          weight: row.weight || '',
          image: row.image || '',
          available: Boolean(row.available),
        })),
    };
  });
};

const selectProducts = async (
  db,
  { where = '', params = [], order = 'p.sort_order, p.title', limit = 60, offset = 0 } = {}
) => {
  const { results } = await db
    .prepare(
      `SELECT ${PRODUCT_COLUMNS} FROM products p
        ${where ? `WHERE ${where}` : ''}
        ORDER BY ${order} LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all();
  return withVariants(db, (results || []).map(hydrate));
};

export const productByHandle = (db, handle) =>
  memo(`product:${handle}`, async () => {
    const row = await db
      .prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.handle = ?`)
      .bind(handle)
      .first();
    if (!row) return null;

    const [product] = await withVariants(db, [hydrate(row)]);
    const { results: media } = await db
      .prepare(
        'SELECT id, kind, src, poster, span, sort_order FROM product_media WHERE product_id = ? ORDER BY sort_order, id'
      )
      .bind(row.id)
      .all();
    const { results: usps } = await db
      .prepare(
        `SELECT id, title, description, icon, sort_order FROM product_usps
          WHERE product_id = ? OR product_id IS NULL ORDER BY sort_order, id`
      )
      .bind(row.id)
      .all();

    return {
      ...product,
      media: (media || []).map((item) => ({ ...item, isVideo: item.kind === 'video' })),
      usps: usps || [],
    };
  });

export const productList = (db, options = {}) => {
  const { collection: collectionHandle, handles, limit = 60, offset = 0, gridOnly = false, source } = options;
  const key = `list:${collectionHandle || ''}:${source || ''}:${(handles || []).join(',')}:${limit}:${offset}:${gridOnly}`;
  return memo(key, async () => {
    const where = [];
    const params = [];
    if (collectionHandle) {
      where.push('p.id IN (SELECT pc.product_id FROM product_collections pc WHERE pc.collection_handle = ?)');
      params.push(collectionHandle);
    }
    if (handles && handles.length) {
      where.push(`p.handle IN (${handles.map(() => '?').join(', ')})`);
      params.push(...handles);
    }
    if (gridOnly) where.push('p.show_in_home_grid = 1');
    return selectProducts(db, { where: where.join(' AND '), params, limit, offset });
  });
};

/** Products sharing the current collection first, then a generic fill. */
export const relatedProducts = async (db, product, limit = 12) => {
  const siblings = await selectProducts(db, {
    where: 'p.id != ? AND p.id IN (SELECT product_id FROM product_collections WHERE collection_handle = ?)',
    params: [product.id, product.collection_handle || ''],
    limit,
  });
  if (siblings.length >= 4) return siblings;

  const seen = [product.id, ...siblings.map((item) => item.id)];
  const fallback = await selectProducts(db, {
    where: `p.id NOT IN (${seen.map(() => '?').join(', ')})`,
    params: seen,
    limit: limit - siblings.length,
  });
  return [...siblings, ...fallback];
};

export const searchProducts = (db, term, limit = 24) => {
  const needle = String(term || '').trim();
  if (!needle) return Promise.resolve([]);
  const like = `%${needle}%`;
  return selectProducts(db, {
    where: 'p.title LIKE ? OR p.summary LIKE ? OR p.description LIKE ? OR p.cat_label LIKE ?',
    params: [like, like, like, like],
    limit,
  });
};

/* ------------------------------------------------------------------- misc ---- */

export const defaultFeatures = (db) =>
  memo('features:default', async () => {
    const { results } = await db
      .prepare('SELECT title, description, icon FROM product_usps WHERE product_id IS NULL ORDER BY sort_order, id')
      .all();
    return results || [];
  });

export const addSubscriber = (db, email) =>
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').bind(email).run();

export const addEnquiry = (db, { name, email, message }) =>
  db
    .prepare('INSERT INTO enquiries (name, email, message) VALUES (?, ?, ?)')
    .bind(name || '', email || '', message || '')
    .run();

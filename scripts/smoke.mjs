/**
 * HTTP smoke test for a running server - either `npm run dev` locally or the
 * deployed Worker, which is how the deploy workflow verifies a release:
 *
 *   npm run smoke                                  # http://127.0.0.1:8787
 *   node scripts/smoke.mjs https://<worker>.workers.dev
 *
 * Exits non-zero as soon as anything answers unexpectedly.
 */
const base = process.argv[2] || 'http://127.0.0.1:8787';
const readable = (type = '') => /text|json|xml|javascript/.test(type);
let failures = 0;

const call = async (path, init = {}) => {
  const res = await fetch(base + path, { redirect: 'manual', ...init });
  const type = res.headers.get('content-type') || '';
  const body = readable(type) && !type.includes('image') ? await res.text() : '';
  return { res, type, body };
};

const check = async (path, { init, expect = 200, contains = [], type: wantType, headers: wantHeaders = {} } = {}) => {
  try {
    const { res, type, body } = await call(path, init);
    const problems = [];
    if (res.status !== expect) problems.push(`status ${res.status} != ${expect}`);
    if (wantType && !type.includes(wantType)) problems.push(`content-type ${type}`);
    for (const needle of contains) if (!body.includes(needle)) problems.push(`missing "${needle}"`);
    for (const [name, want] of Object.entries(wantHeaders)) {
      const got = res.headers.get(name) || '';
      if (!got.includes(want)) problems.push(`header ${name}: "${got}" != "${want}"`);
    }
    const label = problems.length ? 'FAIL' : 'ok  ';
    if (problems.length) failures++;
    console.log(`${label} ${String(res.status).padEnd(3)} ${type.split(';')[0].padEnd(24)} ${path}${problems.length ? '  <- ' + problems.join('; ') : ''}`);
    return { res, body };
  } catch (error) {
    failures++;
    console.log(`FAIL --- ${path}  <- ${error.message}`);
    return { res: null, body: '' };
  }
};

console.log(`smoke testing ${base}\n`);

/* pages ------------------------------------------------------------------ */
await check('/', { contains: ['Chen Furniture', '/css/site.css', '/js/site.js', 'cart--offcanvas'] });
await check('/products', { contains: ['/products/'] });
await check('/collections', { contains: ['/collections/'] });
await check('/cart', { contains: ['Your Cart'] });
await check('/checkout', {});
await check('/checkout/thanks?name=Ada', { contains: ['Ada'] });
await check('/search?q=bean', { contains: ['bean'] });
await check('/pages/delivery', {});
await check('/pages/not-a-page', { expect: 404 });
await check('/nope', { expect: 404 });
await check('/robots.txt', { contains: ['Sitemap:'], type: 'text/plain' });
await check('/sitemap.xml', { contains: ['<urlset', '/products/'], type: 'xml' });

/* static assets ---------------------------------------------------------- */
await check('/css/site.css', { type: 'text/css', contains: ['--cf-black'] });
await check('/js/site.js', { type: 'javascript' });
await check('/wrangler.jsonc', { expect: 404 });
await check('/package.json', { expect: 404 });
await check('/src/index.js', { expect: 404 });
await check('/migrations/0001_schema.sql', { expect: 404 });

/* dynamic routes from the seeded data ----------------------------------- */
const products = await check('/products');
const handle = (products.body.match(/\/products\/([a-z0-9-]+)/) || [])[1];
if (!handle) {
  failures++;
  console.log('FAIL no product handle found on /products');
} else {
  await check(`/products/${handle}`, { contains: [handle] });
}

// The first collection *card* on /collections: the header and the drawer link to
// collections as well, and those links get their own check below.
const collections = await check('/collections');
const collection = (collections.body.match(/href="\/collections\/([a-z0-9-]+)"[^>]*>\s*<h2/) || [])[1];
if (collection) await check(`/collections/${collection}`);
else console.log('     note: no collection cards on /collections');

/* admin ------------------------------------------------------------------ */

// The product categories have to sit in the header row (with the logo, the
// search and the cart) and in the mobile menu, and every link among them has to
// answer: they come from /admin, so a Link override pointing at a page that does
// not exist is a 404 in the header and in the drawer.
// `wrangler deploy` returns before every edge serves the new release, so the
// deploy workflow asks for retries (SMOKE_HEADER_ATTEMPTS) rather than reading
// the previous markup as a regression. Locally this is a single request.
const headerAttempts = Math.max(1, Number.parseInt(process.env.SMOKE_HEADER_ATTEMPTS || '1', 10) || 1);
const headerDelayMs = Math.max(0, Number.parseInt(process.env.SMOKE_HEADER_DELAY_MS || '5000', 10) || 0);
const placement = (body) => {
  const rowStart = body.indexOf('top-navbar');
  const rowEnd = body.indexOf('</nav>', rowStart);
  const categoryAt = body.indexOf('header-categories__link', rowStart);
  return {
    inRow: rowStart >= 0 && rowEnd >= 0 && categoryAt >= 0 && categoryAt <= rowEnd,
    inMenu: body.includes('mobile-nav__category-link'),
    // The drawer is the categories plus the three links at the bottom of it - the
    // scraped menu_items tree used to fill the middle.
    menuClean: !body.includes('mobileNavAccordion') && !body.includes('Shop all'),
  };
};
const placedOk = (result) => result.inRow && result.inMenu && result.menuClean;

let homeBody = (await check('/')).body;
let placed = placement(homeBody);
for (let attempt = 1; attempt < headerAttempts && !placedOk(placed); attempt++) {
  await new Promise((resolve) => setTimeout(resolve, headerDelayMs));
  // Silent on purpose: the retry only keeps the log readable when the release
  // was still rolling out.
  const retry = await call('/').catch(() => ({ body: '' }));
  if (retry.body) homeBody = retry.body;
  placed = placement(homeBody);
  if (placedOk(placed)) {
    console.log(`     note: the categories showed up on retry ${attempt} - the release was still rolling out`);
  }
}
if (!placed.inRow) {
  failures++;
  console.log('FAIL the product categories are not rendered in the header row');
}
if (!placed.inMenu) {
  failures++;
  console.log('FAIL the product categories are missing from the mobile menu');
}
if (!placed.menuClean) {
  failures++;
  console.log('FAIL the mobile menu still renders the scraped menu items');
}
const categoryLinks = [
  ...new Set(
    (homeBody.match(/<a[^>]+class="[^"]*header-categories__link[^"]*"[^>]*>/g) || [])
      .map((tag) => (tag.match(/href="([^"]+)"/) || [])[1])
      .filter(Boolean)
  ),
];
if (!categoryLinks.length) console.log('     note: no categories in the header yet');
for (const href of categoryLinks) {
  const { res } = await check(href);
  const status = res ? res.status : 0;
  if (status !== 200) {
    console.log(`     note: ${href} is a link set in /admin/categories - point its Link override at a page that exists`);
  }
}

console.log('\nadmin');
// The Worker falls back to admin/admin; SMOKE_ADMIN_* follow a custom password
// (the deploy workflow passes the matching repository secrets through).
const adminUser = process.env.SMOKE_ADMIN_USER || 'admin';
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || 'admin';
await check('/admin', { expect: 303, headers: { location: '/admin/login?next=%2Fadmin' } });
await check('/admin/categories', {
  expect: 303,
  headers: { location: '/admin/login?next=%2Fadmin%2Fcategories' },
});
// The product screens and actions sit behind the same session, posts included.
await check('/admin/categories/products?slug=outdoor-range', {
  expect: 303,
  headers: { location: '/admin/login?next=%2Fadmin%2Fcategories%2Fproducts' },
});
await check('/admin/products/create', {
  init: { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'title=nope' },
  expect: 303,
  headers: { location: '/admin/login?next=%2Fadmin%2Fproducts%2Fcreate' },
});
await check('/admin/login', { contains: ['Sign in', 'name="username"', 'name="password"'], headers: { 'x-robots-tag': 'noindex' } });
await check('/admin/login', {
  init: {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(adminUser)}&password=definitely-not-it`,
  },
  expect: 303,
  headers: { location: '/admin/login?error=credentials' },
});

const login = await check('/admin/login', {
  init: {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(adminUser)}&password=${encodeURIComponent(adminPassword)}`,
  },
  expect: 303,
  headers: { location: '/admin/categories' },
});
const adminCookie = ((login.res && login.res.headers.get('set-cookie')) || '').split(';')[0];
const admin = { cookie: adminCookie };
const adminForm = { ...admin, 'content-type': 'application/x-www-form-urlencoded' };
/** The admin forms are plain POSTs, so their bodies are built the same way. */
const adminBody = (fields) =>
  Object.entries(fields)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
console.log(`     session cookie: ${adminCookie ? 'set' : '(none)'}`);
await check('/admin/categories', { init: { headers: admin }, contains: ['Product categories', 'Add a category'] });
// A category that is not there is a 404 inside the admin, not a stack trace.
await check('/admin/categories/products?slug=no-such-category', {
  init: { headers: admin },
  expect: 404,
  contains: ['Not found'],
});

// The round trip runs on a hidden row whose name carries a timestamp, so a
// smoke test against production never collides with a parallel run and never
// disturbs the public bar. It filters on a tag, so the product round trip below
// can add, unlink and delete a product of its own.
const smokeStamp = Date.now();
const smokeName = `Smoke Test ${smokeStamp}`;
const smokeSlug = `smoke-test-${smokeStamp}`;
const smokeTag = `smoke-shelf-${smokeStamp}`;
const smokeBody = `name=${encodeURIComponent(smokeName)}&slug=${smokeSlug}&filter_type=tag&filter_value=${smokeTag}&enabled=0`;
await check('/admin/categories', {
  init: { method: 'POST', headers: adminForm, body: smokeBody },
  expect: 303,
  headers: { location: '/admin/categories?flash=created' },
});
const created = await check('/admin/categories', { init: { headers: admin }, contains: [smokeName] });
await check('/admin/categories', {
  init: { method: 'POST', headers: adminForm, body: smokeBody },
  expect: 303,
  headers: { location: '/admin/categories?error=duplicate' },
});
await check('/admin/categories', {
  init: { method: 'POST', headers: adminForm, body: 'name=No Slug Here&slug=not a slug' },
  expect: 303,
  headers: { location: '/admin/categories?error=slug' },
});
await check(`/category/${smokeSlug}`, { expect: 404 }); // hidden from shoppers

const smokeId = (created.body.match(new RegExp(`id="name-(\\d+)"[^>]*value="${smokeName}"`)) || [])[1];
if (!smokeId) {
  failures++;
  console.log('FAIL no id for the smoke test category in the admin list');
} else {
  await check('/admin/categories/save', {
    init: {
      method: 'POST',
      headers: adminForm,
      body: adminBody({
        id: smokeId,
        name: smokeName,
        slug: smokeSlug,
        filter_type: 'tag',
        filter_value: smokeTag,
        enabled: '0',
        position: '99',
      }),
    },
    expect: 303,
    headers: { location: '/admin/categories?flash=saved' },
  });
  await check('/admin/categories/move', {
    init: { method: 'POST', headers: adminForm, body: `id=${smokeId}&direction=up` },
    expect: 303,
    headers: { location: '/admin/categories?flash=moved' },
  });
}

// The products of that category: create one, edit it, take it out of the shelf,
// put it back and delete it again. It stays out of the homepage rows and its
// handle carries the timestamp, so a run that dies half way leaves something
// easy to spot instead of a product a shopper would notice.
const productName = `Smoke Product ${smokeStamp}`;
const productHandle = `smoke-product-${smokeStamp}`;
const productFields = {
  category_slug: smokeSlug,
  title: productName,
  handle: productHandle,
  price: '12.34',
  image: '/images/logo.svg',
  summary: 'Created by the deploy smoke test.',
  sold_out: '0',
  is_new: '0',
  price_from: '0',
  show_in_home_grid: '0',
};
const productScreen = `/admin/categories/products?slug=${smokeSlug}`;
const productFlash = (query) => `${productScreen}&${query}`;

await check('/admin/products/create', {
  init: { method: 'POST', headers: adminForm, body: adminBody(productFields) },
  expect: 303,
  headers: { location: productFlash('flash=product-created') },
});
// A price that is not a number and a slug that is taken have to bounce back
// without writing a row.
await check('/admin/products/create', {
  init: { method: 'POST', headers: adminForm, body: adminBody({ ...productFields, title: 'No price', price: '' }) },
  expect: 303,
  headers: { location: productFlash('error=product-price') },
});
await check('/admin/products/create', {
  init: { method: 'POST', headers: adminForm, body: adminBody({ ...productFields, title: 'Copy of the smoke product' }) },
  expect: 303,
  headers: { location: productFlash('error=product-duplicate') },
});

const shelf = await check(productScreen, {
  init: { headers: admin },
  contains: [productName, 'Delete product', 'Remove from this category'],
});
const productId = (shelf.body.match(/id="p-(\d+)-title"/) || [])[1];
if (!productId) {
  failures++;
  console.log('FAIL the product screen has no editor for the smoke product');
} else {
  await check(`/products/${productHandle}`, { contains: [productName] });

  await check('/admin/products/save', {
    init: {
      method: 'POST',
      headers: adminForm,
      // The real form carries every field of the row, tag included - posting a
      // blank tag would take the product out of the category it was edited from.
      body: adminBody({
        ...productFields,
        id: productId,
        title: `${productName} v2`,
        price: '99.99',
        cat_handle: smokeTag,
        cat_label: smokeName,
      }),
    },
    expect: 303,
    headers: { location: productFlash('flash=product-saved') },
  });
  await check(productScreen, { init: { headers: admin }, contains: [`${productName} v2`, 'value="99.99"'] });

  await check('/admin/products/remove', {
    init: { method: 'POST', headers: adminForm, body: adminBody({ id: productId, category_slug: smokeSlug }) },
    expect: 303,
    headers: { location: productFlash('flash=product-removed') },
  });
  const unlinked = await check(productScreen, {
    init: { headers: admin },
    contains: ['No products in this category yet'],
  });
  if (unlinked.body.includes(`id="p-${productId}-title"`)) {
    failures++;
    console.log('FAIL the product stayed in the category after being removed');
  }
  if (!unlinked.body.includes(`<option value="${productId}">`)) {
    failures++;
    console.log('FAIL the removed product is missing from the add-product picker');
  }

  await check('/admin/products/add', {
    init: { method: 'POST', headers: adminForm, body: adminBody({ category_slug: smokeSlug, product_id: productId }) },
    expect: 303,
    headers: { location: productFlash('flash=product-added') },
  });
  await check(productScreen, { init: { headers: admin }, contains: [`id="p-${productId}-title"`] });

  await check('/admin/products/delete', {
    init: { method: 'POST', headers: adminForm, body: adminBody({ id: productId, category_slug: smokeSlug }) },
    expect: 303,
    headers: { location: productFlash('flash=product-deleted') },
  });
  await check(`/products/${productHandle}`, { expect: 404 });
  const emptied = await check(productScreen, { init: { headers: admin } });
  if (emptied.body.includes(productName)) {
    failures++;
    console.log('FAIL the deleted product is still listed on the category screen');
  }
}

await check('/admin/categories/delete', {
  init: { method: 'POST', headers: adminForm, body: `slug=${smokeSlug}` },
  expect: 303,
  headers: { location: '/admin/categories?flash=deleted' },
});
const cleaned = await check('/admin/categories', { init: { headers: admin } });
if (cleaned.body.includes(smokeName)) {
  failures++;
  console.log('FAIL the smoke test category was not deleted');
}

const logout = await check('/admin/logout', {
  init: { method: 'POST', headers: adminForm },
  expect: 303,
  headers: { location: '/admin/login' },
});
const cleared = (logout.res && logout.res.headers.get('set-cookie')) || '';
if (!cleared.includes('cf_admin=;') || !cleared.includes('Max-Age=0')) {
  failures++;
  console.log('FAIL signing out did not clear the session cookie');
}

/* media --------------------------------------------------------------- */
const image = (products.body.match(/\/images\/([A-Za-z0-9._-]+)/) || [])[1];
if (image) {
  const { res } = await check(`/images/${image}`, { type: 'image' });
  const cache = (res && res.headers.get('cache-control')) || '(none)';
  console.log(`     /images/${image}: cache-control ${cache}${cache.includes('immutable') ? ' (served from R2)' : ' (static asset fallback)'}`);
}
await check('/images/does-not-exist.png', { expect: 404 });

/* cart round trip ------------------------------------------------------- */
const page = await call('/products');
const id = (page.body.match(/name="product_id"[^>]*value="(\d+)"/) || page.body.match(/data-product-id="(\d+)"/) || [])[1];
console.log(`\ncart test with product id ${id}`);

if (id) {
  const { res, body } = await check('/cart/add', {
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-requested-with': 'fetch' },
      body: JSON.stringify({ product_id: Number(id), qty: 2, colour: 'Charcoal' }),
    },
    headers: { 'set-cookie': 'el_cart=' },
  });
  const cookie = ((res && res.headers.get('set-cookie')) || '').split(';')[0];
  const auth = { cookie };
  let count = null;
  try {
    count = JSON.parse(body).count;
  } catch {}
  console.log(`     cart count after add: ${count}, cookie: ${cookie || '(none)'}`);

  await check('/cart', { init: { headers: auth }, contains: ['Charcoal'] });
  await check('/cart/drawer', { init: { headers: auth }, contains: ['Charcoal', 'data-cart-line="'] });

  // A plain browser form post (no fetch headers) has to redirect, not JSON.
  const form = { ...auth, 'content-type': 'application/x-www-form-urlencoded' };
  await check('/cart/add', {
    init: { method: 'POST', headers: form, body: `product_id=${id}&qty=1&colour=Charcoal&return_to=/cart` },
    expect: 303,
    headers: { location: '/cart' },
  });

  const cartPage = await check('/cart', { init: { headers: auth }, contains: ['Charcoal'] });
  const line = (cartPage.body.match(/name="line" value="(\d+)"/) || [])[1];
  if (!line) {
    failures++;
    console.log('FAIL no cart line id found on /cart');
  } else {
    await check('/cart/change', {
      init: { method: 'POST', headers: form, body: `line=${line}&qty=3` },
      expect: 303,
    });
    await check('/cart', { init: { headers: auth }, contains: ['data-line-qty>3<'] });
    await check('/cart/drawer', { init: { headers: auth }, contains: ['data-line-qty>3<'] });
    await check('/cart/remove', {
      init: { method: 'POST', headers: form, body: `line=${line}` },
      expect: 303,
    });
    await check('/cart', { init: { headers: auth }, contains: ['Cart is empty'] });
    await check('/cart/drawer', { init: { headers: auth }, contains: ['Cart is empty'] });
  }
}

console.log(`\n${failures ? failures + ' check(s) failed' : 'all checks passed'}`);
process.exit(failures ? 1 : 0);

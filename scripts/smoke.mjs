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

const collections = await check('/collections');
const collection = (collections.body.match(/\/collections\/([a-z0-9-]+)/) || [])[1];
if (collection) await check(`/collections/${collection}`);

/* admin ------------------------------------------------------------------ */

// The product categories have to sit in the header row (with the logo, the
// search and the cart) and in the mobile menu, and one of them must answer.
const home = await check('/');
const rowStart = home.body.indexOf('top-navbar');
const rowEnd = home.body.indexOf('</nav>', rowStart);
const categoryAt = home.body.indexOf('header-categories__link', rowStart);
if (rowStart < 0 || rowEnd < 0 || categoryAt < 0 || categoryAt > rowEnd) {
  failures++;
  console.log('FAIL the product categories are not rendered in the header row');
}
if (!home.body.includes('mobile-nav__category-link')) {
  failures++;
  console.log('FAIL the product categories are missing from the mobile menu');
}
const categoryLink = (home.body.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*header-categories__link/) || [])[1];
if (categoryLink) await check(categoryLink);
else console.log('     note: no categories in the header yet');

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
console.log(`     session cookie: ${adminCookie ? 'set' : '(none)'}`);
await check('/admin/categories', { init: { headers: admin }, contains: ['Product categories', 'Add a category'] });

// The round trip runs on a hidden row whose name carries a timestamp, so a
// smoke test against production never collides with a parallel run and never
// disturbs the public bar.
const smokeStamp = Date.now();
const smokeName = `Smoke Test ${smokeStamp}`;
const smokeSlug = `smoke-test-${smokeStamp}`;
const smokeBody = `name=${smokeName}&slug=${smokeSlug}&filter_type=all&enabled=0`;
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
      body: `id=${smokeId}&name=${smokeName}&slug=${smokeSlug}&filter_type=all&enabled=0&position=99`,
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

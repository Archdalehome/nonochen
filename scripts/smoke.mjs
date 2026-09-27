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

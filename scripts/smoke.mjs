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
// Kept for the breadcrumb check below, which needs it next to the category list.
let detailBody = '';
if (!handle) {
  failures++;
  console.log('FAIL no product handle found on /products');
} else {
  detailBody = (await check(`/products/${handle}`, { contains: [handle] })).body;
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

// The homepage keeps the order the shop asked for: the hero, then the three
// product blocks - "New Products", "Discover Products & Ranges", "All Products"
// - then the banner blocks. The order is a row of `position` values in D1, so
// these markers read the database the deployed Worker serves from (see
// migrations/0009_home_block_order.sql). They join the retry loop below because
// a release that is still rolling out serves the previous markup.
const blockMarkers = [
  'id="hero-',
  '<h2 class="heading-font text-uppercase fw-normal fs-2 mb-2">New Products</h2>',
  '<h2 class="heading-font text-uppercase fw-normal fs-2 mb-2">Discover Products &amp; Ranges</h2>',
  '<h2 class="heading-font text-uppercase fw-normal fs-2 mb-2">All Products</h2>',
];
const blockOrder = (body) => blockMarkers.map((marker) => body.indexOf(marker));
const orderOk = (positions) =>
  positions.every((position) => position >= 0) &&
  positions.every((position, index) => index === 0 || position > positions[index - 1]);

let homeBody = (await check('/')).body;
let placed = placement(homeBody);
let blockAt = blockOrder(homeBody);
for (let attempt = 1; attempt < headerAttempts && !(placedOk(placed) && orderOk(blockAt)); attempt++) {
  await new Promise((resolve) => setTimeout(resolve, headerDelayMs));
  // Silent on purpose: the retry only keeps the log readable when the release
  // was still rolling out.
  const retry = await call('/').catch(() => ({ body: '' }));
  if (retry.body) homeBody = retry.body;
  placed = placement(homeBody);
  blockAt = blockOrder(homeBody);
  if (placedOk(placed) && orderOk(blockAt)) {
    console.log(`     note: the header and the homepage blocks showed up on retry ${attempt} - the release was still rolling out`);
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
const missingBlocks = blockMarkers.filter((marker, index) => blockAt[index] < 0);
if (missingBlocks.length) {
  failures++;
  console.log(`FAIL the homepage is missing one of its top blocks: ${missingBlocks.join(' / ')}`);
} else if (!orderOk(blockAt)) {
  failures++;
  console.log(`FAIL the homepage blocks are out of order (${blockAt.join(', ')})`);
}
// The categories as the header lists them - link -> name. The product detail
// breadcrumb below has to name one of these, so the label matters as well.
const headerCategories = new Map(
  (homeBody.match(/<a[^>]+class="[^"]*header-categories__link[^"]*"[^>]*>[^<]*<\/a>/g) || [])
    .map((tag) => [
      (tag.match(/href="([^"]+)"/) || [])[1],
      ((tag.match(/>([^<]*)<\/a>$/) || [])[1] || '').trim(),
    ])
    .filter(([href]) => Boolean(href))
);
const categoryLinks = [...headerCategories.keys()];
if (!categoryLinks.length) console.log('     note: no categories in the header yet');
for (const href of categoryLinks) {
  const { res } = await check(href);
  const status = res ? res.status : 0;
  if (status !== 200) {
    console.log(`     note: ${href} is a link set in /admin/categories - point its Link override at a page that exists`);
  }
}

// The product detail page reads *Home / the category it was filed under in /admin
// / the product*, so the middle crumb has to be one of the categories above,
// named and linked the way the header names it. Loading the product's own
// collection there - the `/collections/<handle>` that shipped - is the bug this
// guards against, and a product that merely sits in a collection does not pass.
if (!handle) {
  // the /products check above has already failed this run
} else if (!categoryLinks.length) {
  console.log('     note: no categories in the header, so the product breadcrumb is not checked');
} else {
  const nav = (detailBody.match(/<nav aria-label="breadcrumb"[\s\S]*?<\/nav>/) || [''])[0].replace(/\s+/g, ' ');
  const trail = [...nav.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((match) => ({
    href: match[1],
    label: match[2].trim(),
  }));
  const [home, crumb] = trail;
  if (trail.length !== 2 || !home || home.href !== '/') {
    failures++;
    console.log(`FAIL the breadcrumb on /products/${handle} is not Home / <category> / <product>`);
  } else if (!headerCategories.has(crumb.href)) {
    failures++;
    console.log(
      `FAIL the breadcrumb on /products/${handle} names "${crumb.label}" (${crumb.href}), which is not one of the categories in the header`
    );
  } else if (headerCategories.get(crumb.href) !== crumb.label) {
    failures++;
    console.log(
      `FAIL the breadcrumb on /products/${handle} says "${crumb.label}" where the header calls ${crumb.href} "${headerCategories.get(crumb.href)}"`
    );
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
// So does the home page screen (the announcement bar and the hero).
await check('/admin/home', {
  expect: 303,
  headers: { location: '/admin/login?next=%2Fadmin%2Fhome' },
});
await check('/admin/home/announcement', {
  init: { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'announcement_text=nope' },
  expect: 303,
  headers: { location: '/admin/login?next=%2Fadmin%2Fhome%2Fannouncement' },
});
await check('/admin/home/hero', {
  init: { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'section_id=1' },
  expect: 303,
  headers: { location: '/admin/login?next=%2Fadmin%2Fhome%2Fhero' },
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

// The home page screen holds the announcement bar and the hero the storefront
// renders. Saving the values it just showed back proves the whole path (form ->
// D1 -> storefront) without changing what the site displays - so it is safe to
// run against production. The fields are HTML escaped in the markup, so they are
// decoded again before they are posted back.
const home = await check('/admin/home', {
  init: { headers: admin },
  contains: ['Home page content', 'Announcement bar', 'action="/admin/home/announcement"', 'action="/admin/home/hero"'],
});
const inputValue = (body, name) => {
  const found = new RegExp(`name="${name}"[^>]*value="([^"]*)"`).exec(body || '');
  if (!found) return '';
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
  return found[1].replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => entities[entity]);
};

const barText = inputValue(home.body, 'announcement_text');
if (barText) {
  await check('/admin/home/announcement', {
    init: {
      method: 'POST',
      headers: adminForm,
      body: adminBody({ announcement_text: barText, announcement_icon: inputValue(home.body, 'announcement_icon') }),
    },
    expect: 303,
    headers: { location: '/admin/home?flash=bar-saved' },
  });
  // An icon that is neither a path nor a URL is refused instead of stored.
  await check('/admin/home/announcement', {
    init: {
      method: 'POST',
      headers: adminForm,
      body: adminBody({ announcement_text: barText, announcement_icon: 'icon-delivery.svg' }),
    },
    expect: 303,
    headers: { location: '/admin/home?error=bar-icon' },
  });
} else {
  console.log('     note: no announcement text in the database - skipping the bar round trip');
}

const heroId = inputValue(home.body, 'section_id');
const heroVideo = inputValue(home.body, 'video');
if (heroId && heroVideo) {
  const heroFields = {
    section_id: heroId,
    slide: inputValue(home.body, 'slide') || '0',
    video: heroVideo,
    video_mobile: inputValue(home.body, 'video_mobile'),
    poster: inputValue(home.body, 'poster'),
    poster_mobile: inputValue(home.body, 'poster_mobile'),
    title: inputValue(home.body, 'title'),
    text: inputValue(home.body, 'text'),
    link: inputValue(home.body, 'link'),
    button_label: inputValue(home.body, 'button_label'),
    button_url: inputValue(home.body, 'button_url'),
  };
  await check('/admin/home/hero', {
    init: { method: 'POST', headers: adminForm, body: adminBody(heroFields) },
    expect: 303,
    headers: { location: '/admin/home?flash=hero-saved' },
  });
  // The homepage still shows the very same hero.
  await check('/', { contains: [heroVideo, ...(heroFields.title ? [heroFields.title] : [])] });
  // A section that is not the hero, and a link that is neither a path nor a URL,
  // are refused as well.
  await check('/admin/home/hero', {
    init: { method: 'POST', headers: adminForm, body: adminBody({ ...heroFields, section_id: '0' }) },
    expect: 303,
    headers: { location: '/admin/home?error=hero-missing' },
  });
  await check('/admin/home/hero', {
    init: { method: 'POST', headers: adminForm, body: adminBody({ ...heroFields, link: 'collections/outdoor-range' }) },
    expect: 303,
    headers: { location: '/admin/home?error=hero-link' },
  });
} else {
  console.log('     note: the homepage has no hero video - skipping the hero round trip');
}

// The footer screen edits the link columns the storefront shows. Saving back
// exactly what the screen just displayed proves the path (form -> menu_items ->
// footer) without moving anything a shopper sees, so this is safe against
// production as well.
const footer = await check('/admin/footer', {
  init: { headers: admin },
  contains: ['Footer', 'action="/admin/footer/group"', 'action="/admin/footer/link"'],
});
// The Location heading and the currency picker are gone from both sides of the
// wire: the screen stopped offering them and the storefront stopped rendering
// them. The homepage check below is where the picker used to sit.
if (footer.body.includes('Location heading') || footer.body.includes('action="/admin/footer/location"')) {
  failures++;
  console.log('FAIL /admin/footer  <- the Location heading form is still there');
}
const storefront = await check('/');
for (const gone of [
  'id="currency-selector"',
  'country_code',
  'data-localize',
  '<h5 class="lh-sm fw-medium mb-4">Location',
]) {
  if (storefront.body.includes(gone)) {
    failures++;
    console.log(`FAIL /  <- the footer still renders ${gone}`);
  }
}
/** The markup of one form on that screen, from its action attribute to its close. */
const formBlock = (body, marker) => {
  const source = String(body || '');
  const at = source.indexOf(marker);
  if (at < 0) return '';
  const end = source.indexOf('</form>', at);
  return source.slice(at, end < 0 ? at + 1200 : end);
};

const columnHeading = inputValue(footer.body, 'label');
if (columnHeading) {
  const column = formBlock(footer.body, 'action="/admin/footer/group/save"');
  const columnId = inputValue(column, 'id');
  await check('/admin/footer/group/save', {
    init: {
      method: 'POST',
      headers: adminForm,
      body: adminBody({
        id: columnId,
        label: columnHeading,
        position: inputValue(column, 'position'),
        enabled: /checked/.test(column) ? '1' : '0',
      }),
    },
    expect: 303,
    headers: { location: '/admin/footer?flash=group-saved' },
  });
  // The heading the screen lists is the one the storefront renders.
  await check('/', { contains: [columnHeading] });
  // A column heading with no words is refused instead of stored.
  await check('/admin/footer/group/save', {
    init: { method: 'POST', headers: adminForm, body: adminBody({ id: columnId, label: '   ' }) },
    expect: 303,
    headers: { location: '/admin/footer?error=group-heading' },
  });

  const link = formBlock(footer.body, 'action="/admin/footer/link/save"');
  const linkUrl = inputValue(link, 'url');
  if (linkUrl) {
    const linkId = inputValue(link, 'id');
    await check('/admin/footer/link/save', {
      init: {
        method: 'POST',
        headers: adminForm,
        body: adminBody({
          id: linkId,
          label: inputValue(link, 'label'),
          url: linkUrl,
          position: inputValue(link, 'position'),
          enabled: /checked/.test(link) ? '1' : '0',
        }),
      },
      expect: 303,
      headers: { location: '/admin/footer?flash=link-saved' },
    });
    await check('/', { contains: [linkUrl] });
    // A link that goes nowhere is refused as well.
    await check('/admin/footer/link/save', {
      init: {
        method: 'POST',
        headers: adminForm,
        body: adminBody({ id: linkId, label: 'Wherever', url: 'pages/about' }),
      },
      expect: 303,
      headers: { location: '/admin/footer?error=link-url' },
    });
  } else {
    console.log('     note: the first footer column has no links - skipping the link round trip');
  }
} else {
  console.log('     note: the footer has no columns - skipping the footer round trip');
}

// The pages the Company column links to have to answer.
await check('/pages/about', {});
await check('/pages/faq', {});

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

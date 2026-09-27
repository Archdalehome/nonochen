import { render } from './lib/html.js';
import {
  addEnquiry,
  addSubscriber,
  collection,
  collections,
  footerGroups,
  navigation,
  productByHandle,
  productList,
  relatedProducts,
  searchProducts,
  sections,
  settings as loadSettings,
} from './lib/db.js';
import {
  addItem,
  cartId,
  clear as clearCart,
  ensureCartId,
  loadCart,
  removeItem,
  setCartCookie,
  setQty,
} from './lib/cart.js';
import { layout, plainPage } from './views/layout.js';
import { renderSections } from './views/home.js';
import { SORTS, collectionIndex, collectionView } from './views/collection.js';
import { productView } from './views/product.js';
import { cartPage, checkoutPage, thankYouPage } from './views/cart.js';
import { contentPage, searchPage } from './views/pages.js';
import { cartDrawerContent } from './views/cart-drawer.js';

/* --------------------------------------------------------------- responses ---- */

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
};

const page = (body, status = 200) => new Response(render(body), { status, headers: HTML_HEADERS });

// Note: `extra` may be a Headers instance (cart cookies), so it has to be
// copied with the Headers constructor - spreading it would drop every header.
const json = (data, status = 200, extra = {}) => {
  const headers = new Headers(extra);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers });
};

const redirect = (location, extra = {}) => {
  const headers = new Headers(extra);
  headers.set('location', location);
  return new Response(null, { status: 303, headers });
};

const notFound = (ctx, message = 'We could not find that page.') =>
  page(
    layout({
      ...ctx,
      title: 'Page not found',
      body: plainPage({
        title: 'Page not found',
        message,
        action: { label: 'Back to the homepage', url: '/' },
      }),
    }),
    404
  );

/* ------------------------------------------------------------------- chrome ---- */

const currencySymbol = (env) => env.CURRENCY_SYMBOL || '£';

/** Everything the layout needs: settings, nav, footer and the cart. */
const chrome = async (request, env) => {
  const db = env.DB;
  const id = cartId(request);
  const [siteSettings, nav, groups, cart] = await Promise.all([
    loadSettings(db),
    navigation(db, 'header'),
    footerGroups(db),
    loadCart(db, id),
  ]);
  return { settings: siteSettings, nav, groups, cart, symbol: currencySymbol(env) };
};

const view = (ctx, { title, description, canonical, image, body, bodyClass, status = 200 }) =>
  page(layout({ ...ctx, title, description, canonical, image, body, bodyClass }), status);

/* --------------------------------------------------------------------- home ---- */

/** Loads the products that each `product_row` section on a page needs. */
const productsForSections = async (db, list) => {
  const map = {};
  await Promise.all(
    list
      .filter((section) => section.type === 'product_row')
      .map(async (section) => {
        const { source, pickers = [] } = section.data;
        const tabs = pickers.length
          ? pickers
          : [{ label: section.data.heading || 'Featured', collection: section.data.collection || '' }];
        map[section.id] = await Promise.all(
          tabs.map(async (tab) => ({
            label: tab.label,
            products:
              source === 'grid' && !pickers.length
                ? await productList(db, { gridOnly: true, limit: 12 })
                : await productList(db, { collection: tab.collection, limit: 12 }),
          }))
        );
      })
  );
  return map;
};

const homeRoute = async (request, env, ctx) => {
  const list = await sections(env.DB, 'home');
  const products = await productsForSections(env.DB, list);
  return view(ctx, {
    title: '',
    description: ctx.settings.meta_description,
    canonical: new URL('/', request.url).toString(),
    body: renderSections(list, { products, settings: ctx.settings, symbol: ctx.symbol }),
  });
};

/* ----------------------------------------------------------------- products ---- */

const effectivePrice = (product) =>
  product.sizes && product.sizes.length ? Math.min(...product.sizes.map((size) => Number(size.price))) : Number(product.price);

const sortProducts = (list, sort) => {
  const copy = [...list];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    case 'price-desc':
      return copy.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-desc':
      return copy.sort((a, b) => b.title.localeCompare(a.title));
    default:
      return copy;
  }
};

const allProductsRoute = async (request, env, ctx) => {
  const url = new URL(request.url);
  const sort = SORTS.some((option) => option.value === url.searchParams.get('sort'))
    ? url.searchParams.get('sort')
    : 'featured';
  const list = await productList(env.DB, { limit: 120 });
  const heading = ctx.settings.products_heading || 'All products';

  return view(ctx, {
    title: heading,
    description: ctx.settings.products_intro,
    canonical: url.toString(),
    body: collectionView({
      collection: {
        handle: 'all',
        title: heading,
        subtitle: '',
        description: ctx.settings.products_intro || '',
      },
      products: sortProducts(list, sort),
      sort,
      symbol: ctx.symbol,
    }),
  });
};

const productRoute = async (request, env, ctx, handle) => {
  const product = await productByHandle(env.DB, handle);
  if (!product) return notFound(ctx, 'That product is no longer available.');

  const [related, parent] = await Promise.all([
    relatedProducts(env.DB, product, 4),
    product.collection_handle ? collection(env.DB, product.collection_handle) : null,
  ]);
  const symbol = ctx.symbol;
  const title = product.seo_title || product.title;
  const price = effectivePrice(product);

  return view(ctx, {
    title,
    description: product.seo_description || product.summary,
    canonical: new URL(`/products/${product.handle}`, request.url).toString(),
    image: product.image,
    body: productView({ product, related, settings: ctx.settings, symbol, collectionTitle: parent ? parent.title : '' }),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: product.summary || product.description,
      image: product.image,
      brand: { '@type': 'Brand', name: 'Extreme Lounging' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'GBP',
        price: price.toFixed(2),
        availability: product.soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      },
    },
  });
};

/* -------------------------------------------------------------- collections ---- */

const collectionsRoute = async (request, env, ctx) => {
  const list = await collections(env.DB);
  return view(ctx, {
    title: 'Collections',
    description: 'Every Extreme Lounging collection, from outdoor bean bags to indoor lighting.',
    canonical: new URL('/collections', request.url).toString(),
    body: collectionIndex({ list, symbol: ctx.symbol }),
  });
};

const collectionRoute = async (request, env, ctx, handle) => {
  const url = new URL(request.url);
  const current = await collection(env.DB, handle);
  if (!current) return notFound(ctx, 'That collection has moved or sold out.');

  const sort = SORTS.some((option) => option.value === url.searchParams.get('sort'))
    ? url.searchParams.get('sort')
    : 'featured';
  const list = await productList(env.DB, { collection: handle, limit: 120 });

  return view(ctx, {
    title: current.title,
    description: current.subtitle || current.description,
    canonical: url.toString(),
    body: collectionView({
      collection: current,
      products: sortProducts(list, sort),
      sort,
      symbol: ctx.symbol,
    }),
  });
};

/* --------------------------------------------------------------------- cart ---- */

const readForm = async (request) => {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      return (await request.json()) || {};
    } catch {
      return {};
    }
  }
  const form = await request.formData();
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
};

const wantsJson = (request) =>
  (request.headers.get('accept') || '').includes('application/json') ||
  request.headers.get('x-requested-with') === 'fetch';

/** Returns the current cart plus any Set-Cookie header a new cart needs. */
const cartWithCookie = async (request, env, { create = false } = {}) => {
  const existing = cartId(request);
  const id = create || !existing ? await ensureCartId(env.DB, existing) : existing;
  const cart = await loadCart(env.DB, id);
  const headers = new Headers();
  if (id !== existing) setCartCookie(headers, id);
  return { cart, headers };
};

const cartResponse = (request, ctx, cart, headers, { fallback = '/cart' } = {}) => {
  if (wantsJson(request)) {
    return json(
      {
        ok: true,
        count: cart.count,
        subtotal: cart.subtotal,
        drawer: render(cartDrawerContent(ctx.settings, cart, ctx.symbol)),
      },
      200,
      headers
    );
  }
  headers.set('location', fallback);
  return new Response(null, { status: 303, headers });
};

const cartAddRoute = async (request, env, ctx) => {
  const data = await readForm(request);
  const productId = Number(data.product_id);
  if (!productId) return json({ ok: false, error: 'Missing product' }, 400);

  const { cart, headers } = await cartWithCookie(request, env, { create: true });
  const updated = await addItem(env.DB, cart.id, {
    productId,
    variantId: Number(data.variant_id) || 0,
    colour: String(data.colour || ''),
    qty: Number(data.qty) || 1,
  });
  return cartResponse(request, ctx, updated, headers, {
    fallback: String(data.return_to || request.headers.get('referer') || '/cart'),
  });
};

const cartChangeRoute = async (request, env, ctx) => {
  const data = await readForm(request);
  const { cart, headers } = await cartWithCookie(request, env, { create: true });
  const line = Number(data.line || data.item_id);
  const qty = Number(data.qty);
  const updated = Number.isFinite(qty) ? await setQty(env.DB, cart.id, line, qty) : cart;
  return cartResponse(request, ctx, updated, headers);
};

const cartRemoveRoute = async (request, env, ctx) => {
  const data = await readForm(request);
  const { cart, headers } = await cartWithCookie(request, env, { create: true });
  const updated = await removeItem(env.DB, cart.id, Number(data.line || data.item_id));
  return cartResponse(request, ctx, updated, headers);
};

const cartDrawerRoute = async (request, env, ctx) =>
  new Response(render(cartDrawerContent(ctx.settings, ctx.cart, ctx.symbol)), { headers: HTML_HEADERS });

/* ------------------------------------------------------------------- search ---- */

const searchRoute = async (request, env, ctx) => {
  const term = (new URL(request.url).searchParams.get('q') || '').trim();
  const products = await searchProducts(env.DB, term, 48);
  return view(ctx, {
    title: term ? `Search: ${term}` : 'Search',
    description: `Search results for ${term}`,
    body: searchPage({ term, products, symbol: ctx.symbol }),
    bodyClass: 'search',
  });
};

/* -------------------------------------------------------------- content pages ---- */

const pageRoute = async (request, env, ctx, handle) => {
  const list = await sections(env.DB, `page:${handle}`);
  if (!list.length) return notFound(ctx, 'That page does not exist.');
  const first = list.find((section) => section.type === 'page');
  return view(ctx, {
    title: (first && first.data.title) || handle,
    description: first && first.data.body ? first.data.body.replace(/<[^>]+>/g, ' ').slice(0, 160) : '',
    body: contentPage({ handle, list }),
  });
};

const newsletterRoute = async (request, env, ctx) => {
  const data = await readForm(request);
  const email = String(data.email || '').trim();
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!valid) {
    return wantsJson(request)
      ? json({ ok: false, error: 'Please enter a valid email address.' }, 400)
      : redirect('/?subscribed=0');
  }
  await addSubscriber(env.DB, email);
  return wantsJson(request)
    ? json({ ok: true, message: env.NEWSLETTER_MESSAGE || 'Thanks - you are on the list.' })
    : redirect(`${new URL(request.url).searchParams.get('return_to') || '/'}?subscribed=1`);
};

/* ---------------------------------------------------------------- checkout ---- */

const checkoutRoute = (request, env, ctx) =>
  view(ctx, {
    title: 'Checkout',
    description: 'Secure checkout',
    body: checkoutPage({ cart: ctx.cart, symbol: ctx.symbol }),
  });

const checkoutSubmitRoute = async (request, env, ctx) => {
  const data = await readForm(request);
  const cart = ctx.cart;
  if (!cart.items.length) return redirect('/cart');

  const lines = cart.items
    .map((item) => `${item.qty} x ${item.title}${item.variantName ? ` (${item.variantName})` : ''}${item.colour ? ` - ${item.colour}` : ''}`)
    .join('\n');
  await addEnquiry(env.DB, {
    name: String(data.name || ''),
    email: String(data.email || ''),
    message: [
      `Subtotal: £${cart.subtotal.toFixed(2)}`,
      `Address: ${data.address || ''}`,
      lines,
      data.message ? `Notes: ${data.message}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
  if (cart.id) await clearCart(env.DB, cart.id);

  return redirect(`/checkout/thanks?name=${encodeURIComponent(String(data.name || ''))}`);
};

const thanksRoute = (request, env, ctx) =>
  view(ctx, {
    title: 'Thank you',
    body: thankYouPage({ name: new URL(request.url).searchParams.get('name') || '' }),
  });

/* ------------------------------------------------------------------- media ---- */

const imageRoute = async (request, env) => {
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

  if (env.MEDIA) {
    const object = await env.MEDIA.get(key);
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      if (request.headers.get('if-none-match') === object.httpEtag) {
        return new Response(null, { status: 304, headers });
      }
      return new Response(request.method === 'HEAD' ? null : object.body, { headers });
    }
  }
  // Falls back to the copies in public/images (created by `npm run setup`).
  return env.ASSETS.fetch(request);
};

const robotsRoute = (request) => {
  const origin = new URL(request.url).origin;
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /cart', 'Disallow: /checkout', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};

const sitemapRoute = async (request, env) => {
  const origin = new URL(request.url).origin;
  const [list, cols] = await Promise.all([productList(env.DB, { limit: 500 }), collections(env.DB)]);
  const urls = [
    '/',
    '/products',
    '/collections',
    '/cart',
    '/search',
    ...cols.map((item) => `/collections/${item.handle}`),
    ...list.map((item) => `/products/${item.handle}`),
    '/pages/delivery',
    '/pages/returns',
    '/pages/contact-details',
    '/pages/store-locator',
    '/pages/privacy',
    '/pages/terms-and-conditions',
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};

/* ------------------------------------------------------------------ router ---- */

const segment = (path, prefix) => decodeURIComponent(path.slice(prefix.length));

const route = async (request, env) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (path.startsWith('/images/')) return imageRoute(request, env);
  if (path === '/robots.txt') return robotsRoute(request);
  if (path === '/sitemap.xml') return sitemapRoute(request, env);

  if (method === 'POST') {
    const ctx = await chrome(request, env);
    switch (path) {
      case '/cart/add':
        return cartAddRoute(request, env, ctx);
      case '/cart/change':
        return cartChangeRoute(request, env, ctx);
      case '/cart/remove':
        return cartRemoveRoute(request, env, ctx);
      case '/newsletter':
        return newsletterRoute(request, env, ctx);
      case '/checkout':
        return checkoutSubmitRoute(request, env, ctx);
      default:
        return notFound(ctx);
    }
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, POST, HEAD' } });
  }

  const ctx = await chrome(request, env);

  if (path === '/') return homeRoute(request, env, ctx);
  if (path === '/cart') {
    return view(ctx, {
      title: ctx.settings.cart_title || 'Your Cart',
      body: cartPage({ cart: ctx.cart, settings: ctx.settings, symbol: ctx.symbol }),
    });
  }
  if (path === '/cart/drawer') return cartDrawerRoute(request, env, ctx);
  if (path === '/checkout') return checkoutRoute(request, env, ctx);
  if (path === '/checkout/thanks') return thanksRoute(request, env, ctx);
  if (path === '/search') return searchRoute(request, env, ctx);
  if (path === '/products') return allProductsRoute(request, env, ctx);
  if (path.startsWith('/products/')) return productRoute(request, env, ctx, segment(path, '/products/'));
  if (path === '/collections') return collectionsRoute(request, env, ctx);
  if (path.startsWith('/collections/')) return collectionRoute(request, env, ctx, segment(path, '/collections/'));
  if (path.startsWith('/pages/')) return pageRoute(request, env, ctx, segment(path, '/pages/'));

  // Everything that is not a page is a static asset (css, js, images). The
  // Worker runs first because of `run_worker_first`, so fall through to them.
  if (env.ASSETS) {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
  }

  return notFound(ctx);
};

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      console.error('Unhandled error', error && error.stack ? error.stack : error);
      const fallback = new Response(
        '<!doctype html><meta charset="utf-8"><title>Something went wrong</title><h1>Something went wrong</h1><p>Please try again in a moment.</p>',
        { status: 500, headers: HTML_HEADERS }
      );
      return fallback;
    }
  },
};




import { html, render } from './lib/html.js';
import {
  addEnquiry,
  addProductToCategory,
  addSubscriber,
  allCategories,
  categories,
  categoryBySlug,
  categorySlugTaken,
  collection,
  collections,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  footerGroups,
  moveCategory,
  navigation,
  productByHandle,
  productById,
  productHandleTaken,
  productList,
  productPicker,
  productsByCategory,
  relatedProducts,
  removeProductFromCategory,
  searchProducts,
  sections,
  settings as loadSettings,
  updateCategory,
  updateProduct,
} from './lib/db.js';
import {
  createSession,
  credentials,
  defaultPasswordInUse,
  destroySession,
  normalizeCategory,
  normalizeProduct,
  safeNext,
  sessionUser,
  verifyLogin,
} from './lib/admin.js';
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
import { adminNotFound, adminPage, categoriesView, categoryProductsView, loginView } from './views/admin.js';
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

const methodNotAllowed = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'GET, POST, HEAD' } });

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

/** Everything the layout needs: settings, nav, footer, cart and the header categories. */
const chrome = async (request, env) => {
  const db = env.DB;
  const id = cartId(request);
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  const [siteSettings, nav, groups, cart, topCategories] = await Promise.all([
    loadSettings(db),
    navigation(db, 'header'),
    footerGroups(db),
    loadCart(db, id),
    categories(db),
  ]);
  return {
    settings: siteSettings,
    nav,
    groups,
    cart,
    categories: topCategories,
    path,
    symbol: currencySymbol(env),
  };
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
      brand: { '@type': 'Brand', name: 'Chen Furniture' },
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
    description: 'Every Chen Furniture collection, from outdoor bean bags to indoor lighting.',
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

/* ------------------------------------------------------------ categories ---- */

/**
 * `/category/<slug>` backs the header links that have no link override.
 * The row picked in /admin decides which products are listed - a collection, a
 * product tag or everything - so a brand new category needs no code change.
 */
const categoryRoute = async (request, env, ctx, slug) => {
  const url = new URL(request.url);
  const current = await categoryBySlug(env.DB, slug);
  // Hidden categories stay reachable for signed in admins so Preview works.
  if (!current || (!current.enabled && !(await sessionUser(request, env)))) {
    return notFound(ctx, 'That category is not available.');
  }

  const sort = SORTS.some((option) => option.value === url.searchParams.get('sort'))
    ? url.searchParams.get('sort')
    : 'featured';
  const list = await productsByCategory(env.DB, current, 120);

  return view(ctx, {
    title: current.name,
    description: `Shop ${current.name} at ${ctx.settings.site_name || 'Chen Furniture'}.`,
    canonical: new URL(`/category/${current.slug}`, request.url).toString(),
    body: collectionView({
      collection: { handle: current.slug, title: current.name, subtitle: '', description: '' },
      products: sortProducts(list, sort),
      sort,
      symbol: ctx.symbol,
    }),
  });
};

/* ------------------------------------------------------------------ admin ---- */

const ADMIN_HEADERS = { ...HTML_HEADERS, 'x-robots-tag': 'noindex, nofollow' };

const adminSiteName = (env) => env.SITE_NAME || 'Chen Furniture';

/** `?flash=` / `?error=` values the admin screens can show. */
const ADMIN_NOTICES = {
  created: { kind: 'success', message: 'Category added - it is already live in the header.' },
  saved: { kind: 'success', message: 'Category saved.' },
  moved: { kind: 'success', message: 'Order updated.' },
  deleted: { kind: 'success', message: 'Category deleted.' },
  name: { kind: 'danger', message: 'A category needs a name.' },
  slug: { kind: 'danger', message: 'That slug is not valid - use a-z, 0-9 and dashes (up to 60 characters).' },
  url: { kind: 'danger', message: 'The link override has to start with "/" (for example /collections/outdoor-range).' },
  duplicate: { kind: 'danger', message: 'Another category already uses that slug.' },
  missing: { kind: 'danger', message: 'That category could not be found.' },
};

/**
 * The same idea for the product screen, which lives inside a category. The keys
 * are prefixed so a `?flash=` from one screen can never read oddly on the other.
 */
const PRODUCT_NOTICES = {
  'product-created': { kind: 'success', message: 'Product created - it is listed in this category already.' },
  'product-saved': { kind: 'success', message: 'Product saved.' },
  'product-added': { kind: 'success', message: 'Product added to this category.' },
  'product-removed': { kind: 'success', message: 'Product removed from this category. The product itself is untouched.' },
  'product-deleted': { kind: 'success', message: 'Product deleted, along with its variants, media and cart lines.' },
  'product-title': { kind: 'danger', message: 'A product needs a title.' },
  'product-handle': {
    kind: 'danger',
    message: 'That product slug is not valid - use a-z, 0-9 and dashes (up to 80 characters).',
  },
  'product-duplicate': { kind: 'danger', message: 'Another product already uses that slug.' },
  'product-price': { kind: 'danger', message: 'The price has to be a number, for example 249 or 249.99.' },
  'product-compare': { kind: 'danger', message: 'The "was" price has to be a number, or left empty.' },
  'product-image': {
    kind: 'danger',
    message: 'A product needs an image: a path such as /images/b-bag-grey.png or a full https:// URL.',
  },
  'product-missing': { kind: 'danger', message: 'That product is no longer in the catalogue.' },
  'product-pick': { kind: 'danger', message: 'Pick a product from the list first.' },
  'product-filter': {
    kind: 'danger',
    message: 'This category lists every product, so there is nothing to add or remove.',
  },
};

const adminNotice = (url, notices = ADMIN_NOTICES) => {
  const key = url.searchParams.get('error') || url.searchParams.get('flash') || '';
  return notices[key] || null;
};

/** The product screen of one category, plus its `?flash=` / `?error=`. */
const productScreen = (slug, query = '') =>
  `/admin/categories/products?slug=${encodeURIComponent(slug)}${query ? `&${query}` : ''}`;

/** How many products the admin screen lists before it stops rendering forms. */
const ADMIN_PRODUCT_LIMIT = 200;

const adminResponse = ({ env, user = '', title, body, status = 200, flash = null }) =>
  new Response(
    render(
      adminPage({
        user,
        siteName: adminSiteName(env),
        title,
        body,
        flash,
        warning: defaultPasswordInUse(env)
          ? html`The default <code>admin</code> / <code>admin</code> login is still active. To protect this area set your own password with <code>npx wrangler secret put ADMIN_PASSWORD</code>.`
          : '',
      })
    ),
    { status, headers: ADMIN_HEADERS }
  );

const adminLoginPage = async (request, env) => {
  const url = new URL(request.url);
  if (await sessionUser(request, env)) return redirect(safeNext(url.searchParams.get('next')));
  const error = url.searchParams.get('error') === 'credentials' ? 'That username and password do not match.' : '';
  return new Response(
    render(
      loginView({
        siteName: adminSiteName(env),
        error,
        next: url.searchParams.has('next') ? safeNext(url.searchParams.get('next'), '') : '',
      })
    ),
    { status: 200, headers: ADMIN_HEADERS }
  );
};

const adminLoginSubmit = async (request, env) => {
  const data = await readForm(request);
  if (!(await verifyLogin(env, data.username, data.password))) {
    const next = safeNext(data.next, '');
    return redirect(`/admin/login?error=credentials${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  }
  const headers = await createSession(env, credentials(env).user);
  headers.set('location', safeNext(data.next));
  return new Response(null, { status: 303, headers });
};

const adminLogout = () => {
  const headers = destroySession();
  headers.set('location', '/admin/login');
  return new Response(null, { status: 303, headers });
};

const adminCategoriesPage = async (request, env, user) => {
  const list = await allCategories(env.DB);
  return adminResponse({
    env,
    user,
    title: 'Product categories',
    body: categoriesView({ list }),
    flash: adminNotice(new URL(request.url)),
  });
};

const adminCategoryCreate = async (request, env) => {
  const { error, values } = normalizeCategory(await readForm(request));
  if (error) return redirect(`/admin/categories?error=${error}`);
  if (await categorySlugTaken(env.DB, values.slug)) return redirect('/admin/categories?error=duplicate');
  await createCategory(env.DB, values);
  return redirect('/admin/categories?flash=created');
};

const adminCategorySave = async (request, env) => {
  const data = await readForm(request);
  const id = Number(data.id) || 0;
  if (!id) return redirect('/admin/categories?error=missing');
  const { error, values } = normalizeCategory(data);
  if (error) return redirect(`/admin/categories?error=${error}`);
  if (await categorySlugTaken(env.DB, values.slug, id)) return redirect('/admin/categories?error=duplicate');
  await updateCategory(env.DB, id, values);
  return redirect('/admin/categories?flash=saved');
};

const adminCategoryDelete = async (request, env) => {
  const data = await readForm(request);
  let id = Number(data.id) || 0;
  if (!id && data.slug) {
    const found = await categoryBySlug(env.DB, String(data.slug));
    id = found ? found.id : 0;
  }
  if (!id) return redirect('/admin/categories?error=missing');
  await deleteCategory(env.DB, id);
  return redirect('/admin/categories?flash=deleted');
};

const adminCategoryMove = async (request, env) => {
  const data = await readForm(request);
  const moved = await moveCategory(env.DB, Number(data.id), data.direction === 'up' ? 'up' : 'down');
  return redirect(moved ? '/admin/categories?flash=moved' : '/admin/categories?error=missing');
};

/**
 * The products one category lists - the same rows the storefront renders, so
 * the editors below write exactly what `/category/<slug>` (or the header link)
 * shows a shopper a moment later.
 */
const adminCategoryProductsPage = async (request, env, user) => {
  const url = new URL(request.url);
  const category = await categoryBySlug(env.DB, String(url.searchParams.get('slug') || ''));
  if (!category) {
    return adminResponse({
      env,
      user,
      title: 'Not found',
      body: adminNotFound({ message: 'That category does not exist (any more).' }),
      status: 404,
    });
  }

  const [list, picker] = await Promise.all([
    productsByCategory(env.DB, category, ADMIN_PRODUCT_LIMIT),
    productPicker(env.DB),
  ]);
  return adminResponse({
    env,
    user,
    title: `Products in ${category.name}`,
    body: categoryProductsView({
      category,
      list,
      picker,
      symbol: currencySymbol(env),
      limit: ADMIN_PRODUCT_LIMIT,
    }),
    flash: adminNotice(url, PRODUCT_NOTICES),
  });
};

/** Reads the form and the category it was submitted from (`category_slug`). */
const productFormContext = async (request, env) => {
  const data = await readForm(request);
  const category = await categoryBySlug(env.DB, String(data.category_slug || ''));
  return { data, category };
};

const adminProductCreate = async (request, env) => {
  const { data, category } = await productFormContext(request, env);
  if (!category) return redirect('/admin/categories?error=missing');
  const { error, values } = normalizeProduct(data);
  if (error) return redirect(productScreen(category.slug, `error=product-${error}`));
  if (await productHandleTaken(env.DB, values.handle)) {
    return redirect(productScreen(category.slug, 'error=product-duplicate'));
  }

  const id = await createProduct(env.DB, values);
  if (!id) return redirect(productScreen(category.slug, 'error=product-missing'));
  // The new product lands in the category it was created from.
  await addProductToCategory(env.DB, category, id);
  return redirect(productScreen(category.slug, 'flash=product-created'));
};

const adminProductSave = async (request, env) => {
  const { data, category } = await productFormContext(request, env);
  if (!category) return redirect('/admin/categories?error=missing');
  const id = Number(data.id) || 0;
  if (!id) return redirect(productScreen(category.slug, 'error=product-missing'));
  const { error, values } = normalizeProduct(data);
  if (error) return redirect(productScreen(category.slug, `error=product-${error}`));
  if (await productHandleTaken(env.DB, values.handle, id)) {
    return redirect(productScreen(category.slug, 'error=product-duplicate'));
  }

  const saved = await updateProduct(env.DB, id, values);
  return redirect(productScreen(category.slug, saved ? 'flash=product-saved' : 'error=product-missing'));
};

/** Adds a product that is already in the catalogue to the category. */
const adminProductAdd = async (request, env) => {
  const { data, category } = await productFormContext(request, env);
  if (!category) return redirect('/admin/categories?error=missing');
  const id = Number(data.product_id) || 0;
  if (!id || !(await productById(env.DB, id))) return redirect(productScreen(category.slug, 'error=product-pick'));

  const added = await addProductToCategory(env.DB, category, id);
  return redirect(productScreen(category.slug, added ? 'flash=product-added' : 'error=product-filter'));
};

/** Takes a product out of the category, leaving the product in the shop. */
const adminProductRemove = async (request, env) => {
  const { data, category } = await productFormContext(request, env);
  if (!category) return redirect('/admin/categories?error=missing');
  const id = Number(data.id) || 0;
  if (!id || !(await productById(env.DB, id))) return redirect(productScreen(category.slug, 'error=product-missing'));

  const removed = await removeProductFromCategory(env.DB, category, id);
  return redirect(productScreen(category.slug, removed ? 'flash=product-removed' : 'error=product-filter'));
};

/** Deletes the product itself: shop, collections and carts. */
const adminProductDelete = async (request, env) => {
  const { data, category } = await productFormContext(request, env);
  if (!category) return redirect('/admin/categories?error=missing');
  const deleted = await deleteProduct(env.DB, data.id);
  return redirect(productScreen(category.slug, deleted ? 'flash=product-deleted' : 'error=product-missing'));
};

/**
 * Everything under /admin. Only /admin/login is public; every other screen and
 * action needs a valid session cookie or bounces back to the login page.
 */
const adminRoute = async (request, env, path, method) => {
  const isGet = method === 'GET' || method === 'HEAD';
  const isPost = method === 'POST';

  if (path === '/admin/login') {
    if (isPost) return adminLoginSubmit(request, env);
    return isGet ? adminLoginPage(request, env) : methodNotAllowed();
  }

  const user = await sessionUser(request, env);
  if (!user) return redirect(`/admin/login?next=${encodeURIComponent(path)}`);

  if (path === '/admin') return redirect('/admin/categories');
  if (path === '/admin/logout' && isPost) return adminLogout();
  if (path === '/admin/categories') {
    if (isPost) return adminCategoryCreate(request, env);
    return isGet ? adminCategoriesPage(request, env, user) : methodNotAllowed();
  }
  if (path === '/admin/categories/save') return isPost ? adminCategorySave(request, env) : methodNotAllowed();
  if (path === '/admin/categories/delete') return isPost ? adminCategoryDelete(request, env) : methodNotAllowed();
  if (path === '/admin/categories/move') return isPost ? adminCategoryMove(request, env) : methodNotAllowed();
  if (path === '/admin/categories/products') {
    return isGet ? adminCategoryProductsPage(request, env, user) : methodNotAllowed();
  }
  if (path === '/admin/products/create') return isPost ? adminProductCreate(request, env) : methodNotAllowed();
  if (path === '/admin/products/save') return isPost ? adminProductSave(request, env) : methodNotAllowed();
  if (path === '/admin/products/add') return isPost ? adminProductAdd(request, env) : methodNotAllowed();
  if (path === '/admin/products/remove') return isPost ? adminProductRemove(request, env) : methodNotAllowed();
  if (path === '/admin/products/delete') return isPost ? adminProductDelete(request, env) : methodNotAllowed();

  return adminResponse({
    env,
    user,
    title: 'Not found',
    body: adminNotFound({ message: `There is no admin screen at ${path}.` }),
    status: 404,
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
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /admin',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};

const sitemapRoute = async (request, env) => {
  const origin = new URL(request.url).origin;
  const [list, cols, cats] = await Promise.all([
    productList(env.DB, { limit: 500 }),
    collections(env.DB),
    categories(env.DB),
  ]);
  const urls = [
    '/',
    '/products',
    '/collections',
    '/cart',
    '/search',
    ...cols.map((item) => `/collections/${item.handle}`),
    ...cats.filter((item) => item.href.startsWith('/category/')).map((item) => item.href),
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

  // The admin area renders its own chrome and handles its own methods.
  if (path === '/admin' || path.startsWith('/admin/')) return adminRoute(request, env, path, method);

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
    return methodNotAllowed();
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
  if (path.startsWith('/category/')) return categoryRoute(request, env, ctx, segment(path, '/category/'));
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




import { html, money, safe } from '../lib/html.js';
import { CATEGORY_FILTERS } from '../lib/admin.js';

/* ---------------------------------------------------------------- shell ---- */

/**
 * `/admin` renders its own (chrome free) document so the editorial screens stay
 * small: Bootstrap + site.css for the typography, no storefront navigation.
 * `noindex` is repeated in the response headers by the router.
 */
export const adminDocument = ({ siteName, title, body }) => html`<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${title} | ${siteName} admin</title>
    <link rel="icon" href="/images/logo.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/css/bootstrap.min.css">
    <link rel="stylesheet" href="/css/site.css">
  </head>
  <body class="admin bg-body d-flex flex-column min-vh-100">
    ${body}
    <script src="/js/site.js" defer></script>
  </body>
</html>`;

export const adminHeader = ({ user, siteName }) => html`
  <header class="admin-header bg-primary text-white py-2">
    <div class="container d-flex align-items-center gap-3 flex-wrap">
      <a href="/admin/categories" class="heading-font text-uppercase text-white text-decoration-none fs-6">${siteName} admin</a>
      <nav class="ms-auto d-flex align-items-center gap-3 fs-7">
        <a href="/admin/categories" class="text-white text-decoration-none">Categories</a>
        <a href="/" class="text-white text-decoration-none" target="_blank" rel="noopener">View store</a>
        <span class="text-white-50 d-none d-md-inline">Signed in as ${user}</span>
        <form method="post" action="/admin/logout" class="mb-0">
          <button class="btn btn-sm btn-outline-light rounded px-3" type="submit">Sign out</button>
        </form>
      </nav>
    </div>
  </header>`;

const notice = ({ kind, message }) =>
  html`<div class="alert alert-${kind} rounded-3 fs-7 mb-4" role="status">${message}</div>`;

/** Full admin screen: header, optional notices, then the page body. */
export const adminPage = ({ user, siteName, title, body, flash = null, warning = '' }) =>
  adminDocument({
    siteName,
    title,
    body: html`${adminHeader({ user, siteName })}
      <main class="flex-grow-1 py-4">
        <div class="container">
          ${flash ? notice(flash) : ''}
          ${warning ? notice({ kind: 'warning', message: warning }) : ''}
          ${body}
        </div>
      </main>`,
  });

/* ---------------------------------------------------------------- login ---- */

export const loginView = ({ siteName, error = '', next = '' }) =>
  adminDocument({
    siteName,
    title: 'Sign in',
    body: html`
      <main class="admin-login flex-grow-1 d-flex flex-column justify-content-center align-items-center px-3 py-5">
        <div class="card border-0 shadow-sm rounded-3 w-100" style="max-width: 24rem;">
          <div class="card-body p-4 p-md-5">
            <h1 class="heading-font text-uppercase h5 mb-1">${siteName}</h1>
            <p class="text-secondary fs-8 mb-4">Sign in to manage the store.</p>
            ${error ? notice({ kind: 'danger', message: error }) : ''}
            <form method="post" action="/admin/login" class="d-flex flex-column gap-3">
              ${next ? html`<input type="hidden" name="next" value="${next}">` : ''}
              <div>
                <label class="form-label fs-8 text-uppercase mb-1" for="admin-username">Username</label>
                <input class="form-control" id="admin-username" name="username" autocomplete="username" required autofocus>
              </div>
              <div>
                <label class="form-label fs-8 text-uppercase mb-1" for="admin-password">Password</label>
                <input class="form-control" id="admin-password" name="password" type="password" autocomplete="current-password" required>
              </div>
              <button class="btn btn-primary rounded w-100 py-2 mt-2" type="submit">Sign in</button>
            </form>
          </div>
        </div>
        <a class="fs-8 text-secondary mt-4" href="/">Back to the storefront</a>
      </main>`,
  });

/* ------------------------------------------------------------ categories ---- */

const FILTER_LABEL = Object.fromEntries(CATEGORY_FILTERS.map((filter) => [filter.value, filter.label]));

const filterSelect = ({ name, value, id }) => html`
  <select class="form-select form-select-sm" id="${id}" name="${name}">
    ${CATEGORY_FILTERS.map(
      (filter) => html`<option value="${filter.value}" ${filter.value === value ? safe('selected') : ''}>${filter.label}</option>`
    )}
  </select>`;

/**
 * Hidden first, checkbox second: the last value in the body wins, so an
 * unchecked box still posts a 0.
 */
const toggleField = ({ id, name, label, checked }) => html`
  <input type="hidden" name="${name}" value="0">
  <div class="form-check form-switch mb-0">
    <input class="form-check-input" type="checkbox" role="switch" name="${name}" value="1" id="${id}" ${checked ? safe('checked') : ''}>
    <label class="form-check-label fs-8 text-uppercase" for="${id}">${label}</label>
  </div>`;

const enabledToggle = ({ id, checked, hidden = false }) =>
  toggleField({ id, name: 'enabled', checked, label: hidden ? 'Visible in the header' : 'Visible' });

const filterValueField = (item, id) => html`
  <label class="form-label fs-8 text-uppercase mb-1" for="${id}">Filter value</label>
  <input class="form-control form-control-sm" id="${id}" name="filter_value" value="${item.filterValue || ''}" maxlength="80"
         placeholder="${item.filterType === 'collection' ? 'collection handle' : item.filterType === 'all' ? 'not used' : 'tag, e.g. outdoor'}">`;

/**
 * A `/collections/<handle>` link that points at a collection nobody created
 * shows a 404 to shoppers, so the products added here stay invisible. Returns
 * the missing handle, or '' when the link is fine or `collections` is unknown.
 */
const missingCollection = (href, collections) => {
  if (!Array.isArray(collections)) return '';
  const match = /^\/collections\/([^/?#]+)/.exec(String(href || ''));
  if (!match) return '';
  const handle = decodeURIComponent(match[1]);
  return collections.includes(handle) ? '' : handle;
};

const missingCollectionNote = (item, collections) => {
  const handle = missingCollection(item.href, collections);
  if (!handle) return '';
  return html`<span class="text-danger">
    &middot; <strong>that collection does not exist</strong>, so this link 404s and nothing you add here shows on the site.
    Clear the Link override to use <code>/category/${item.slug}</code>, or type a collection handle that exists.
  </span>`;
};

const categoryRow = (item, index, count, collections) => html`
  <div class="card border-0 shadow-sm rounded-3 mb-3">
    <form method="post" action="/admin/categories/save">
      <input type="hidden" name="id" value="${item.id}">
      <div class="card-body row g-3">
        <div class="col-12 col-lg-4">
          <label class="form-label fs-8 text-uppercase mb-1" for="name-${item.id}">Name</label>
          <input class="form-control form-control-sm" id="name-${item.id}" name="name" value="${item.name}" maxlength="80" required>
        </div>
        <div class="col-6 col-lg-2">
          <label class="form-label fs-8 text-uppercase mb-1" for="slug-${item.id}">Slug</label>
          <input class="form-control form-control-sm" id="slug-${item.id}" name="slug" value="${item.slug}" maxlength="60">
        </div>
        <div class="col-6 col-lg-3">
          <label class="form-label fs-8 text-uppercase mb-1" for="url-${item.id}">Link override</label>
          <input class="form-control form-control-sm" id="url-${item.id}" name="url" value="${item.url || ''}" maxlength="200"
                 placeholder="/category/${item.slug}">
        </div>
        <div class="col-6 col-lg-1">
          <label class="form-label fs-8 text-uppercase mb-1" for="position-${item.id}">Order</label>
          <input class="form-control form-control-sm" id="position-${item.id}" name="position" type="number" min="0" max="999"
                 value="${item.position}">
        </div>
        <div class="col-6 col-lg-2 d-flex align-items-end">
          ${enabledToggle({ id: `enabled-${item.id}`, checked: item.enabled })}
        </div>
        <div class="col-12 col-lg-4">
          <label class="form-label fs-8 text-uppercase mb-1" for="filter-${item.id}">Products shown</label>
          ${filterSelect({ id: `filter-${item.id}`, name: 'filter_type', value: item.filterType })}
        </div>
        <div class="col-6 col-lg-4">${filterValueField(item, `filter-value-${item.id}`)}</div>
        <div class="col-6 col-lg-4 d-flex align-items-end justify-content-lg-end gap-2">
          <button class="btn btn-primary btn-sm rounded px-3" type="submit">Save</button>
          <a class="btn btn-outline-dark btn-sm rounded px-3" href="${item.href}" target="_blank" rel="noopener">Preview</a>
        </div>
      </div>
    </form>
    <div class="card-footer bg-white border-top-0 d-flex flex-wrap align-items-center justify-content-between gap-2 pt-0">
      <span class="fs-8 text-secondary">
        Links to <code>${item.href}</code> &middot;
        ${item.filterType === 'all' ? 'all products' : html`${FILTER_LABEL[item.filterType]}: <code>${item.filterValue}</code>`}
        &middot; <a href="/admin/categories/products?slug=${item.slug}">Manage the products in this category</a>
        ${missingCollectionNote(item, collections)}
      </span>
      <div class="d-flex align-items-center gap-2">
        <form method="post" action="/admin/categories/move" class="mb-0">
          <input type="hidden" name="id" value="${item.id}">
          <input type="hidden" name="direction" value="up">
          <button class="btn btn-outline-secondary btn-sm rounded px-2" type="submit" ${index === 0 ? safe('disabled') : ''}
                  aria-label="Move ${item.name} up">&uarr;</button>
        </form>
        <form method="post" action="/admin/categories/move" class="mb-0">
          <input type="hidden" name="id" value="${item.id}">
          <input type="hidden" name="direction" value="down">
          <button class="btn btn-outline-secondary btn-sm rounded px-2" type="submit" ${index === count - 1 ? safe('disabled') : ''}
                  aria-label="Move ${item.name} down">&darr;</button>
        </form>
        <form method="post" action="/admin/categories/delete" class="mb-0"
              data-admin-confirm="Delete &quot;${item.name}&quot;? The link disappears from the header straight away.">
          <input type="hidden" name="id" value="${item.id}">
          <button class="btn btn-outline-danger btn-sm rounded px-3" type="submit">Delete</button>
        </form>
      </div>
    </div>
  </div>`;

export const categoriesView = ({ list = [], collections } = {}) => html`
  ${list.some((item) => missingCollection(item.href, collections))
    ? html`<div class="alert alert-warning rounded-3" role="alert">
        <strong>Some header links point at a collection that does not exist yet.</strong>
        Those links land on a 404, so the products you add to that category cannot show up on the site. Either clear the
        Link override (the category then uses its own <code>/category/&lt;slug&gt;</code> page) or point it at a collection
        that is already in the shop.
      </div>`
    : ''}
  <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
    <div>
      <h1 class="heading-font text-uppercase h4 mb-1">Product categories</h1>
      <p class="text-secondary fs-7 mb-0">
        These links fill the header row, next to the logo and the cart, in the order below.
      </p>
    </div>
    <span class="fs-7 text-secondary">${list.length} categor${list.length === 1 ? 'y' : 'ies'}</span>
  </div>

  <section class="card border-0 shadow-sm rounded-3 mb-4">
    <div class="card-body">
      <h2 class="h6 text-uppercase mb-3">Add a category</h2>
      <form method="post" action="/admin/categories" class="row g-3">
        <div class="col-12 col-lg-4">
          <label class="form-label fs-8 text-uppercase mb-1" for="new-name">Name</label>
          <input class="form-control form-control-sm" id="new-name" name="name" maxlength="80" required placeholder="Outdoor Range">
        </div>
        <div class="col-6 col-lg-2">
          <label class="form-label fs-8 text-uppercase mb-1" for="new-slug">Slug</label>
          <input class="form-control form-control-sm" id="new-slug" name="slug" maxlength="60" placeholder="auto">
        </div>
        <div class="col-6 col-lg-3">
          <label class="form-label fs-8 text-uppercase mb-1" for="new-url">Link override</label>
          <input class="form-control form-control-sm" id="new-url" name="url" maxlength="200" placeholder="optional, e.g. /products">
        </div>
        <div class="col-12 col-lg-3">
          <label class="form-label fs-8 text-uppercase mb-1" for="new-filter">Products shown</label>
          ${filterSelect({ id: 'new-filter', name: 'filter_type', value: 'tag' })}
        </div>
        <div class="col-12 col-lg-4">${filterValueField({ filterType: 'tag', filterValue: '' }, 'new-filter-value')}</div>
        <div class="col-12 col-lg-4 d-flex align-items-end">
          ${enabledToggle({ id: 'new-enabled', checked: true, hidden: true })}
        </div>
        <div class="col-12 col-lg-4 d-flex align-items-end justify-content-lg-end">
          <button class="btn btn-primary btn-sm rounded px-4" type="submit">Add category</button>
        </div>
      </form>
    </div>
  </section>

  ${list.length
    ? list.map((item, index) => categoryRow(item, index, list.length, collections))
    : html`<div class="card border-0 shadow-sm rounded-3">
        <div class="card-body text-center py-5">
          <h2 class="h5 mb-2">No categories yet</h2>
          <p class="text-secondary fs-7 mb-0">Add one above and it appears at the top of every page.</p>
        </div>
      </div>`}
`;

/* ----------------------------------------------------- category products ---- */

/** One labelled input. `attrs` is a literal attribute string the caller writes by hand. */
const textField = ({ id, name, label, value = '', col = 'col-6 col-lg-2', type = 'text', attrs = '' }) => html`
  <div class="${col}">
    <label class="form-label fs-8 text-uppercase mb-1" for="${id}">${label}</label>
    <input type="${type}" class="form-control form-control-sm" id="${id}" name="${name}" value="${value}" ${safe(attrs)}>
  </div>`;

const textAreaField = ({ id, name, label, value = '', rows = 2, col = 'col-12', attrs = '' }) => html`
  <div class="${col}">
    <label class="form-label fs-8 text-uppercase mb-1" for="${id}">${label}</label>
    <textarea class="form-control form-control-sm" id="${id}" name="${name}" rows="${rows}" ${safe(attrs)}>${value}</textarea>
  </div>`;

/** The fields the create and the edit forms share; `prefix` keeps the ids unique. */
const productFields = (item, prefix) => html`
  ${textField({ id: `${prefix}-title`, name: 'title', label: 'Title', value: item.title, col: 'col-12 col-lg-4', attrs: 'maxlength="120" required' })}
  ${textField({ id: `${prefix}-slug`, name: 'handle', label: 'Slug', value: item.handle || '', attrs: 'maxlength="80" placeholder="auto, e.g. b-bag-grey"' })}
  ${textField({ id: `${prefix}-price`, name: 'price', label: 'Price', value: item.price === undefined ? '' : item.price, type: 'number', attrs: 'min="0" step="0.01" required' })}
  ${textField({ id: `${prefix}-compare`, name: 'compare_at_price', label: 'Was', value: item.compare_at_price === undefined || item.compare_at_price === null ? '' : item.compare_at_price, type: 'number', attrs: 'min="0" step="0.01"' })}
  ${textField({ id: `${prefix}-badge`, name: 'badge', label: 'Badge', value: item.badge || '', attrs: 'maxlength="40" placeholder="Best seller"' })}
  ${textField({ id: `${prefix}-image`, name: 'image', label: 'Image', value: item.image || '', col: 'col-12 col-lg-4', attrs: 'maxlength="300" required placeholder="/images/b-bag-grey.png"' })}
  ${textField({ id: `${prefix}-cat-handle`, name: 'cat_handle', label: 'Tag handle', value: item.cat_handle || '', attrs: 'maxlength="60" placeholder="outdoor"' })}
  ${textField({ id: `${prefix}-cat-label`, name: 'cat_label', label: 'Tag label', value: item.cat_label || '', attrs: 'maxlength="60" placeholder="Outdoor"' })}
  ${textField({ id: `${prefix}-swatch`, name: 'colour_hex', label: 'Swatch', value: item.colour_hex || '#5f6062', attrs: 'maxlength="20"' })}
  ${textField({ id: `${prefix}-order`, name: 'sort_order', label: 'Order', value: item.sort_order === undefined || item.sort_order === null ? '' : item.sort_order, type: 'number', attrs: 'min="0" max="9999"' })}
  ${textAreaField({ id: `${prefix}-summary`, name: 'summary', label: 'Summary', value: item.summary || '', attrs: 'maxlength="300" placeholder="One line shown under the title"' })}
  ${textAreaField({ id: `${prefix}-description`, name: 'description', label: 'Description', value: item.description || '', rows: 3, attrs: 'maxlength="2000"' })}
  <div class="col-6 col-lg-3 d-flex align-items-end">${toggleField({ id: `${prefix}-sold-out`, name: 'sold_out', label: 'Sold out', checked: Boolean(item.sold_out) })}</div>
  <div class="col-6 col-lg-3 d-flex align-items-end">${toggleField({ id: `${prefix}-new`, name: 'is_new', label: 'New', checked: Boolean(item.is_new) })}</div>
  <div class="col-6 col-lg-3 d-flex align-items-end">${toggleField({ id: `${prefix}-from`, name: 'price_from', label: 'Show from', checked: Boolean(item.price_from) })}</div>
  <div class="col-6 col-lg-3 d-flex align-items-end">${toggleField({ id: `${prefix}-grid`, name: 'show_in_home_grid', label: 'Homepage row', checked: Boolean(item.show_in_home_grid) })}</div>
  ${textField({ id: `${prefix}-seo-title`, name: 'seo_title', label: 'SEO title', value: item.seo_title || '', col: 'col-12 col-lg-6', attrs: 'maxlength="120"' })}
  ${textField({ id: `${prefix}-seo-description`, name: 'seo_description', label: 'SEO description', value: item.seo_description || '', col: 'col-12 col-lg-6', attrs: 'maxlength="300"' })}
`;

/** One product in the list: a summary, the editor for its fields and its actions. */
const productEditor = (item, { category, canLink, symbol, owners }) => {
  // A product lives in one category, so flag any it is listed in besides this one.
  const alsoIn = ((owners && owners.get(item.id)) || []).filter((owner) => owner.id !== category.id);

  return html`
  <article class="card border-0 shadow-sm rounded-3 mb-3">
    <div class="card-header bg-white d-flex flex-wrap align-items-center gap-3">
      <img src="${item.image}" alt="" width="48" height="48" class="rounded object-fit-contain bg-body-secondary">
      <div class="flex-grow-1">
        <h3 class="fs-6 mb-1">${item.title}</h3>
        <p class="fs-8 text-secondary mb-0">
          <code>${item.handle}</code> &middot; ${money(item.price, symbol)}
          ${item.collection_handle ? html` &middot; collection <code>${item.collection_handle}</code>` : ''}
        </p>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        ${alsoIn.length
          ? html`<span class="badge text-bg-warning text-dark border">Also in ${alsoIn.map((owner) => owner.name).join(', ')}</span>`
          : ''}
        ${item.soldOut ? html`<span class="badge text-bg-dark">Sold out</span>` : ''}
        ${item.badge ? html`<span class="badge text-bg-light text-dark border">${item.badge}</span>` : ''}
        ${item.inGrid ? '' : html`<span class="badge text-bg-light text-secondary border">Not on the homepage</span>`}
      </div>
    </div>
    <form method="post" action="/admin/products/save">
      <input type="hidden" name="id" value="${item.id}">
      <input type="hidden" name="category_slug" value="${category.slug}">
      <div class="card-body row g-3">${productFields(item, `p-${item.id}`)}</div>
      <div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span class="fs-8 text-secondary">Product #${item.id}</span>
        <button class="btn btn-primary btn-sm rounded px-4" type="submit">Save product</button>
      </div>
    </form>
    <div class="card-footer bg-white border-top-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <a class="fs-8" href="/products/${item.handle}" target="_blank" rel="noopener">View the product page</a>
      <div class="d-flex flex-wrap align-items-center gap-2">
        ${canLink
          ? html`<form method="post" action="/admin/products/remove" class="mb-0"
                       data-admin-confirm="Take &quot;${item.title}&quot; out of ${category.name}? The product itself stays in the shop.">
              <input type="hidden" name="id" value="${item.id}">
              <input type="hidden" name="category_slug" value="${category.slug}">
              <button class="btn btn-outline-secondary btn-sm rounded px-3" type="submit">Remove from this category</button>
            </form>`
          : ''}
        <form method="post" action="/admin/products/delete" class="mb-0"
              data-admin-confirm="Delete &quot;${item.title}&quot; completely? It leaves the shop, every collection and every cart.">
          <input type="hidden" name="id" value="${item.id}">
          <input type="hidden" name="category_slug" value="${category.slug}">
          <button class="btn btn-outline-danger btn-sm rounded px-3" type="submit">Delete product</button>
        </form>
      </div>
    </div>
  </article>`;
};

/**
 * `/admin/categories/products` - the products one category lists, with the
 * forms that add, edit, unlink and delete them. Collection and tag categories
 * get the add/remove controls; an "all products" category only gets the editors.
 */
export const categoryProductsView = ({
  category,
  list = [],
  picker = [],
  owners,
  collections,
  symbol = '£',
  limit = 200,
}) => {
  const listed = new Set(list.map((item) => item.id));
  const ownerOf = (item) => ((owners && owners.get(item.id)) || []).find((owner) => owner.id !== category.id) || null;
  // A product lives in one category at a time, so anything another category
  // holds is offered as a locked (disabled) entry that names its category.
  const candidates = picker.filter((item) => !listed.has(item.id) && !ownerOf(item));
  const held = picker.filter((item) => !listed.has(item.id) && ownerOf(item));
  const canLink = category.filterType !== 'all' && Boolean(category.filterValue);
  const missing = missingCollection(category.href, collections);
  const note =
    category.filterType === 'collection'
      ? html`Lists <strong>every product in the collection</strong> <code>${category.filterValue}</code>. Adding links the
          product to that collection and sets its <strong>Tag handle / Tag label</strong> to this category; removing takes
          both away again - the product itself stays in the shop either way.`
      : category.filterType === 'tag'
        ? html`Lists <strong>every product tagged</strong> <code>${category.filterValue}</code>. Adding sets the product's
            <strong>Tag handle / Tag label</strong> to this category, which is what puts it here; removing clears them
            again - the product itself stays in the shop either way.`
        : html`Lists <strong>every product</strong>, so there is nothing to add or remove - a brand new product shows up
            here straight away.`;

  return html`
    <p class="fs-8 mb-2">
      <a class="text-secondary" href="/admin/categories">Product categories</a> / ${category.name}
    </p>
    ${missing
      ? html`<div class="alert alert-warning rounded-3" role="alert">
          <strong>This category links to <code>/collections/${missing}</code>, and no collection uses that handle.</strong>
          Shoppers who follow the header link get a 404, so the products below only show up on the category's own page.
          Clear the Link override to link at <code>/category/${category.slug}</code> instead, or point it at a collection
          that exists.
        </div>`
      : ''}
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <div>
        <h1 class="heading-font text-uppercase h4 mb-1">Products in ${category.name}</h1>
        <p class="text-secondary fs-7 mb-0">${note}</p>
        <p class="text-secondary fs-8 mb-0">
          A product belongs to one category at a time - its Tag handle and Tag label point at it - so a product that
          another category already holds is locked in the picker below. <code>Remove from this category</code> sets it
          free again.
        </p>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <a class="btn btn-outline-dark btn-sm rounded px-3" href="${category.href}" target="_blank" rel="noopener">Preview</a>
        <a class="btn btn-outline-secondary btn-sm rounded px-3" href="/admin/categories">Back to categories</a>
      </div>
    </div>

    <section class="card border-0 shadow-sm rounded-3 mb-4">
      <div class="card-body">
        <h2 class="h6 text-uppercase mb-3">Add a product</h2>
        <div class="row g-4">
          <div class="col-12 col-lg-6">
            ${canLink
              ? html`<form method="post" action="/admin/products/add" class="row g-2 align-items-end">
                  <input type="hidden" name="category_slug" value="${category.slug}">
                  <div class="col-12 col-sm-8">
                    <label class="form-label fs-8 text-uppercase mb-1" for="add-product">Product already in the shop</label>
                    <select class="form-select form-select-sm" id="add-product" name="product_id" required>
                      <option value="">Pick a product&hellip;</option>
                      ${candidates.map((item) => html`<option value="${item.id}">${item.title}</option>`)}
                      ${held.length
                        ? html`<optgroup label="Already in another category">
                            ${held.map(
                              (item) => html`<option value="${item.id}" disabled>${item.title} - ${ownerOf(item).name}</option>`
                            )}
                          </optgroup>`
                        : ''}
                    </select>
                    <p class="fs-8 text-secondary mb-0 mt-1">
                      ${candidates.length} product${candidates.length === 1 ? '' : 's'} outside this category.
                      ${held.length
                        ? html`${held.length} product${held.length === 1 ? '' : 's'} sit in another category already -
                            take ${held.length === 1 ? 'it' : 'them'} out of that one first.`
                        : ''}
                    </p>
                  </div>
                  <div class="col-12 col-sm-4">
                    <button class="btn btn-primary btn-sm rounded px-3 w-100" type="submit">Add to category</button>
                  </div>
                </form>`
              : html`<p class="fs-7 text-secondary mb-0">Every product in the shop is listed here already.</p>`}
          </div>
          <div class="col-12 col-lg-6">
            <details class="border rounded-3 p-3">
              <summary class="fs-7 text-uppercase">Create a brand new product</summary>
              <form method="post" action="/admin/products/create" class="row g-3 mt-2">
                <input type="hidden" name="category_slug" value="${category.slug}">
                ${productFields({ sold_out: 0, is_new: 0, price_from: 0, show_in_home_grid: 1, price: '' }, 'new')}
                <div class="col-12 d-flex justify-content-end">
                  <button class="btn btn-primary btn-sm rounded px-4" type="submit">Create product</button>
                </div>
              </form>
            </details>
          </div>
        </div>
      </div>
    </section>

    <div class="d-flex flex-wrap justify-content-between align-items-center mb-2">
      <h2 class="h6 text-uppercase mb-0">${list.length} product${list.length === 1 ? '' : 's'} listed</h2>
      ${list.length >= limit
        ? html`<span class="fs-8 text-secondary">Showing the first ${limit} - the storefront reads the same list.</span>`
        : ''}
    </div>

    ${list.length
      ? list.map((item) => productEditor(item, { category, canLink, symbol, owners }))
      : html`<div class="card border-0 shadow-sm rounded-3">
          <div class="card-body text-center py-5">
            <h2 class="h5 mb-2">No products in this category yet</h2>
            <p class="text-secondary fs-7 mb-0">Add one above and it appears on the storefront straight away.</p>
          </div>
        </div>`}
  `;
};

export const adminNotFound = ({ message = 'That admin page does not exist.' }) => html`
  <div class="card border-0 shadow-sm rounded-3">
    <div class="card-body text-center py-5">
      <h1 class="heading-font text-uppercase h4 mb-2">Not found</h1>
      <p class="text-secondary fs-7 mb-3">${message}</p>
      <a class="btn btn-primary btn-sm rounded px-4" href="/admin/categories">Back to categories</a>
    </div>
  </div>`;

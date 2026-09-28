import { html, money, safe } from '../lib/html.js';
import { CATEGORY_FILTERS } from '../lib/admin.js';
import { announcementBar } from './partials.js';

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
        <a href="/admin/home" class="text-white text-decoration-none">Home page</a>
        <a href="/admin/footer" class="text-white text-decoration-none">Footer</a>
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

/* --------------------------------------------------- home page content ---- */

/**
 * One media field: the path the storefront renders, plus a file picker that
 * replaces it. Both post with the same form, so without JavaScript the file is
 * simply stored and the field is updated in one save.
 */
const mediaField = ({ id, name, label, value = '', file, accept, hint, upload = true, col = 'col-12 col-lg-6' }) => html`
  <div class="${col}">
    <label class="form-label fs-8 text-uppercase mb-1" for="${id}">${label}</label>
    <input class="form-control form-control-sm" id="${id}" name="${name}" value="${value}" maxlength="300" placeholder="${hint}">
    ${upload
      ? html`<input class="form-control form-control-sm mt-1 fs-8" type="file" name="${file}" accept="${accept}" aria-label="${label}: choose a file to upload">`
      : ''}
  </div>`;

/** One hero slide: what the site shows now, and the fields that change it. */
const heroSlide = ({ slide, index, section, media }) => html`
  <form method="post" action="/admin/home/hero" enctype="multipart/form-data" class="card border-0 shadow-sm rounded-3 mb-4">
    <input type="hidden" name="section_id" value="${section.id}">
    <input type="hidden" name="slide" value="${index}">
    <div class="card-header bg-white d-flex flex-wrap align-items-center justify-content-between gap-2">
      <h2 class="h6 text-uppercase mb-0">Slide ${index + 1}</h2>
      <span class="fs-8 text-secondary">${slide.video || 'no video'}</span>
    </div>
    <div class="card-body row g-3">
      <div class="col-12 col-lg-4">
        <p class="form-label fs-8 text-uppercase mb-1">On the site now</p>
        ${slide.video
          ? html`<video class="w-100 rounded bg-body-secondary" style="max-height: 12rem" src="${slide.video}" poster="${slide.poster || ''}" controls muted loop playsinline preload="metadata"></video>`
          : html`<p class="fs-8 text-secondary mb-0">This slide has no video, so the storefront skips it.</p>`}
        <p class="fs-8 text-secondary mt-1 mb-0">
          ${slide.title ? html`Heading: <strong>${slide.title}</strong>. ` : 'No heading. '}
          ${slide.button && slide.button.label
            ? html`Button: <strong>${slide.button.label}</strong> &rarr; <code>${slide.button.url}</code>.`
            : html`No button${slide.url ? html`, the whole slide links to <code>${slide.url}</code>` : ''}.`}
        </p>
      </div>
      <div class="col-12 col-lg-8 row g-3">
        ${mediaField({
          id: `slide-${index}-video`,
          name: 'video',
          label: 'Video - desktop',
          value: slide.video || '',
          file: 'video_file',
          accept: 'video/mp4,video/webm,video/quicktime',
          hint: '/images/hero-outdoor-desktop.mp4',
          upload: media,
        })}
        ${mediaField({
          id: `slide-${index}-video-mobile`,
          name: 'video_mobile',
          label: 'Video - phone',
          value: slide.video_mobile || '',
          file: 'video_mobile_file',
          accept: 'video/mp4,video/webm,video/quicktime',
          hint: 'empty: the desktop video is used on phones too',
          upload: media,
        })}
        ${mediaField({
          id: `slide-${index}-poster`,
          name: 'poster',
          label: 'Still - desktop',
          value: slide.poster || '',
          file: 'poster_file',
          accept: 'image/jpeg,image/png,image/webp,image/avif',
          hint: 'shown while the video loads, optional',
          upload: media,
        })}
        ${mediaField({
          id: `slide-${index}-poster-mobile`,
          name: 'poster_mobile',
          label: 'Still - phone',
          value: slide.poster_mobile || '',
          file: 'poster_mobile_file',
          accept: 'image/jpeg,image/png,image/webp,image/avif',
          hint: 'optional',
          upload: media,
        })}
        ${textField({ id: `slide-${index}-title`, name: 'title', label: 'Heading on the video', value: slide.title || '', col: 'col-12 col-lg-6', attrs: 'maxlength="120"' })}
        ${textField({ id: `slide-${index}-text`, name: 'text', label: 'Text under the heading', value: slide.text || '', col: 'col-12 col-lg-6', attrs: 'maxlength="300"' })}
        ${textField({ id: `slide-${index}-link`, name: 'link', label: 'Link for the whole slide', value: slide.url || '', col: 'col-12 col-lg-6', attrs: 'maxlength="300" placeholder="/collections/outdoor-range - used when there is no button"' })}
        ${textField({ id: `slide-${index}-button-label`, name: 'button_label', label: 'Button label', value: (slide.button && slide.button.label) || '', col: 'col-6 col-lg-3', attrs: 'maxlength="60" placeholder="Shop Outdoor"' })}
        ${textField({ id: `slide-${index}-button-url`, name: 'button_url', label: 'Button link', value: (slide.button && slide.button.url) || '', col: 'col-6 col-lg-3', attrs: 'maxlength="300" placeholder="/collections/outdoor-range"' })}
      </div>
    </div>
    <div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span class="fs-8 text-secondary">
        ${media
          ? 'A file you pick is stored in R2 and the path above is updated to it.'
          : 'No MEDIA bucket is bound, so only a path or a URL can be saved.'}
        The button keeps its styling, and the carousel its timing - neither is editable here.
      </span>
      <button class="btn btn-primary btn-sm rounded px-4" type="submit">Save hero</button>
    </div>
  </form>`;

/**
 * `/admin/home` - the announcement bar and the hero. Both are already on the
 * storefront (`views/chrome.js` renders the bar on every page, `views/home.js`
 * the hero video with its wording and links); this screen only changes what they
 * say and which files they use, so the homepage keeps its layout.
 */
export const homeView = ({ settings = {}, hero = null, media = true } = {}) => {
  const slides = (hero && Array.isArray(hero.data.slides) && hero.data.slides) || [];

  return html`
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <div>
        <h1 class="heading-font text-uppercase h4 mb-1">Home page content</h1>
        <p class="text-secondary fs-7 mb-0">
          The announcement bar that sits above the header on every page, and the video, wording and links of the hero.
          Both are on the site already - these forms change what they show, never how they are laid out.
        </p>
        <p class="text-secondary fs-8 mb-0">
          <a class="text-secondary" href="/admin/categories">Product categories</a> live on their own screen.
        </p>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <a class="btn btn-outline-dark btn-sm rounded px-3" href="/" target="_blank" rel="noopener">Preview the homepage</a>
      </div>
    </div>

    ${media
      ? ''
      : html`<div class="alert alert-warning rounded-3 fs-7" role="alert">
          <strong>No MEDIA bucket is bound to this Worker</strong>, so a file picked below cannot be stored. The field
          next to it still takes a path such as <code>/images/hero-outdoor-desktop.mp4</code> or a full URL.
        </div>`}

    <section class="card border-0 shadow-sm rounded-3 mb-4">
      <div class="card-body">
        <h2 class="h6 text-uppercase mb-1">Announcement bar</h2>
        <p class="text-secondary fs-7 mb-3">
          The strip at the very top of the site. Leave the icon empty for a bar with only the message.
        </p>
        <div class="mb-3">${announcementBar(settings)}</div>
        <form method="post" action="/admin/home/announcement" class="row g-3">
          ${textField({ id: 'bar-text', name: 'announcement_text', label: 'Message', value: settings.announcement_text || '', col: 'col-12 col-lg-6', attrs: 'maxlength="160" required' })}
          ${textField({ id: 'bar-icon', name: 'announcement_icon', label: 'Icon', value: settings.announcement_icon || '', col: 'col-12 col-lg-6', attrs: 'maxlength="300" placeholder="empty: no icon"' })}
          <div class="col-12 d-flex justify-content-lg-end">
            <button class="btn btn-primary btn-sm rounded px-4" type="submit">Save bar</button>
          </div>
        </form>
      </div>
    </section>

    <h2 class="h6 text-uppercase mb-1">Hero</h2>
    <p class="text-secondary fs-7 mb-3">
      The carousel at the top of the homepage: its videos, the wording over them and where they link to. Saving one
      slide rewrites that slide of the hero section, so the storefront shows it on its next request.
    </p>
    ${hero && hero.enabled === false
      ? html`<div class="alert alert-warning rounded-3 fs-7" role="alert">
          <strong>This hero block is switched off</strong> (<code>sections.enabled = 0</code>), so the homepage does not
          show it at all. Saving still updates it, and it appears as soon as the row is enabled again.
        </div>`
      : ''}
    ${slides.length
      ? slides.map((slide, index) => heroSlide({ slide, index, section: hero, media }))
      : html`<div class="card border-0 shadow-sm rounded-3">
          <div class="card-body text-center py-5">
            <h3 class="h5 mb-2">No hero section</h3>
            <p class="text-secondary fs-7 mb-0">
              The homepage has no <code>hero</code> block in <code>sections</code>, so there is no video to edit.
            </p>
          </div>
        </div>`}
  `;
};

/* -------------------------------------------------------- footer columns ---- */

/**
 * The up / down / delete controls each footer row carries. The buttons post on
 * their own, so reordering or removing one row never touches the others - the
 * same pattern the category rows use.
 */
const rowControls = ({ kind, label, id, index, count, confirm }) => html`
  <div class="d-flex align-items-center gap-2">
    <form method="post" action="/admin/footer/${kind}/move" class="mb-0">
      <input type="hidden" name="id" value="${id}">
      <input type="hidden" name="direction" value="up">
      <button class="btn btn-outline-secondary btn-sm rounded px-2" type="submit" ${index === 0 ? safe('disabled') : ''}
              aria-label="Move ${label} up">&uarr;</button>
    </form>
    <form method="post" action="/admin/footer/${kind}/move" class="mb-0">
      <input type="hidden" name="id" value="${id}">
      <input type="hidden" name="direction" value="down">
      <button class="btn btn-outline-secondary btn-sm rounded px-2" type="submit" ${index === count - 1 ? safe('disabled') : ''}
              aria-label="Move ${label} down">&darr;</button>
    </form>
    <form method="post" action="/admin/footer/${kind}/delete" class="mb-0" data-admin-confirm="${confirm}">
      <input type="hidden" name="id" value="${id}">
      <button class="btn btn-outline-danger btn-sm rounded px-3" type="submit">Delete</button>
    </form>
  </div>`;

/** One link of a column: its words, the page behind it and its place in the list. */
const footerLinkRow = (link, index, count) => html`
  <form method="post" action="/admin/footer/link/save" class="border-top pt-3 mt-3">
    <input type="hidden" name="id" value="${link.id}">
    <div class="row g-2 align-items-end">
      ${textField({
        id: `link-label-${link.id}`,
        name: 'label',
        label: 'Link text',
        value: link.label,
        col: 'col-12 col-lg-3',
        attrs: 'maxlength="60" required placeholder="About"',
      })}
      ${textField({
        id: `link-url-${link.id}`,
        name: 'url',
        label: 'Link',
        value: link.url,
        col: 'col-12 col-lg-5',
        attrs: 'maxlength="300" required placeholder="/pages/about"',
      })}
      ${textField({
        id: `link-order-${link.id}`,
        name: 'position',
        label: 'Order',
        value: link.sort_order,
        col: 'col-4 col-lg-1',
        type: 'number',
        attrs: 'min="0" max="999"',
      })}
      <div class="col-8 col-lg-1">${toggleField({ id: `link-enabled-${link.id}`, name: 'enabled', label: 'Shows', checked: link.enabled })}</div>
      <div class="col-12 col-lg-2 d-flex justify-content-lg-end">
        <button class="btn btn-primary btn-sm rounded px-3" type="submit">Save</button>
      </div>
    </div>
  </form>
  <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2">
    <span class="fs-8 text-secondary">
      ${/^https?:\/\//i.test(link.url) ? 'leaves this site, so it opens in a new tab' : 'a page on this site'}
      &middot; <a href="${link.url}" target="_blank" rel="noopener">Preview</a>
    </span>
    ${rowControls({
      kind: 'link',
      id: link.id,
      label: link.label,
      index,
      count,
      confirm: `Delete "${link.label}"? The link leaves the footer straight away.`,
    })}
  </div>`;



/**
 * `/admin/footer`: the link columns at the bottom of every page. The columns are
 * rows in `menu_items` (location = 'footer'), so nothing here decides how they
 * are laid out - the screen only changes the words, the links and the order.
 */
export const footerView = ({ groups = [], settings = {} } = {}) => html`
  <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
    <div>
      <h1 class="heading-font text-uppercase h4 mb-1">Footer</h1>
      <p class="text-secondary fs-7 mb-0">
        The link columns at the bottom of every page, in the order below. A link that starts with <code>/</code> stays on
        the site; a full <code>https://</code> URL (the socials) opens in a new tab.
      </p>
      <p class="text-secondary fs-8 mb-0">
        The copyright line and the currency picker are settings, not columns - <code>footer_copyright</code> and
        <code>country_options</code> live in D1.
      </p>
    </div>
    <span class="fs-7 text-secondary">${groups.length} column${groups.length === 1 ? '' : 's'}</span>
  </div>

  <section class="card border-0 shadow-sm rounded-3 mb-4">
    <div class="card-body row g-3 align-items-end">
      <div class="col-12 col-md-8">
        <h2 class="h6 text-uppercase mb-1">Location heading</h2>
        <p class="text-secondary fs-7 mb-0">
          The heading over the currency picker, the last thing in the row of columns.
        </p>
      </div>
      <form method="post" action="/admin/footer/location" class="col-12 col-md-4 m-0 row g-2 align-items-end">
        ${textField({
          id: 'location-heading',
          name: 'heading',
          label: 'Heading',
          value: settings.footer_location_heading || 'Location',
          col: 'col-8',
          attrs: 'maxlength="40" required',
        })}
        <div class="col-4 d-flex justify-content-end">
          <button class="btn btn-primary btn-sm rounded px-3" type="submit">Save</button>
        </div>
      </form>
    </div>
  </section>

  ${groups.length
    ? groups.map(
        (group, index) => html`
          <section class="card border-0 shadow-sm rounded-3 mb-4">
            <form method="post" action="/admin/footer/group/save">
              <input type="hidden" name="id" value="${group.id}">
              <div class="card-body row g-3">
                ${textField({
                  id: `column-heading-${group.id}`,
                  name: 'label',
                  label: 'Column heading',
                  value: group.label,
                  col: 'col-12 col-lg-5',
                  attrs: 'maxlength="40" required',
                })}
                ${textField({
                  id: `column-order-${group.id}`,
                  name: 'position',
                  label: 'Order',
                  value: group.sort_order,
                  col: 'col-6 col-lg-2',
                  type: 'number',
                  attrs: 'min="0" max="999"',
                })}
                <div class="col-6 col-lg-3">
                  ${toggleField({ id: `column-enabled-${group.id}`, name: 'enabled', label: 'Shows on the site', checked: group.enabled })}
                </div>
                <div class="col-12 col-lg-2 d-flex justify-content-lg-end">
                  <button class="btn btn-primary btn-sm rounded px-3" type="submit">Save column</button>
                </div>
              </div>
            </form>
            <div class="card-body pt-0 border-top">
              ${group.links.length
                ? group.links.map((link, position) => footerLinkRow(link, position, group.links.length))
                : html`<p class="fs-7 text-secondary mt-3 mb-0">This column has no links yet.</p>`}
              <form method="post" action="/admin/footer/link" class="border-top pt-3 mt-3 row g-2 align-items-end">
                <input type="hidden" name="parent_id" value="${group.id}">
                ${textField({
                  id: `new-link-label-${group.id}`,
                  name: 'label',
                  label: 'Link text',
                  col: 'col-12 col-lg-4',
                  attrs: 'maxlength="60" required placeholder="About"',
                })}
                ${textField({
                  id: `new-link-url-${group.id}`,
                  name: 'url',
                  label: 'Link',
                  col: 'col-12 col-lg-5',
                  attrs: 'maxlength="300" required placeholder="/pages/about"',
                })}
                <div class="col-12 col-lg-3 d-flex align-items-end justify-content-lg-end">
                  <button class="btn btn-outline-dark btn-sm rounded px-3" type="submit">Add link</button>
                </div>
              </form>
            </div>
            <div class="card-footer bg-white border-top-0 d-flex flex-wrap align-items-center justify-content-between gap-2 pt-0">
              <span class="fs-8 text-secondary">
                ${group.enabled
                  ? 'Shows in the footer'
                  : 'Hidden - the column stays here, the storefront drops it until it is switched back on'}
                &middot; ${group.links.length} link${group.links.length === 1 ? '' : 's'}
                &middot; add a link to this column with the form above
              </span>
              ${rowControls({
                kind: 'group',
                id: group.id,
                label: group.label,
                index,
                count: groups.length,
                confirm: `Delete the "${group.label}" column and every link in it?`,
              })}
            </div>
          </section>`
      )
    : html`<div class="card border-0 shadow-sm rounded-3 mb-4">
        <div class="card-body text-center py-5">
          <h2 class="h5 mb-2">No footer columns yet</h2>
          <p class="text-secondary fs-7 mb-0">Add one below and it appears at the bottom of every page.</p>
        </div>
      </div>`}

  <section class="card border-0 shadow-sm rounded-3">
    <div class="card-body">
      <h2 class="h6 text-uppercase mb-3">Add a column</h2>
      <form method="post" action="/admin/footer/group" class="row g-3">
        ${textField({
          id: 'new-column-heading',
          name: 'label',
          label: 'Heading',
          col: 'col-12 col-lg-6',
          attrs: 'maxlength="40" required placeholder="Company"',
        })}
        ${textField({
          id: 'new-column-order',
          name: 'position',
          label: 'Order',
          col: 'col-6 col-lg-2',
          type: 'number',
          attrs: 'min="0" max="999" placeholder="next"',
        })}
        <div class="col-6 col-lg-2 d-flex align-items-end">
          ${toggleField({ id: 'new-column-enabled', name: 'enabled', label: 'Shows', checked: true })}
        </div>
        <div class="col-12 col-lg-2 d-flex align-items-end justify-content-lg-end">
          <button class="btn btn-primary btn-sm rounded px-4" type="submit">Add column</button>
        </div>
      </form>
    </div>
  </section>`;

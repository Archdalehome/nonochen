import { html, safe } from '../lib/html.js';
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

const enabledToggle = ({ id, checked, hidden = false }) => html`
  <!-- Hidden first, checkbox second: the last value in the body wins, so an
       unchecked box still posts enabled=0. -->
  <input type="hidden" name="enabled" value="0">
  <div class="form-check form-switch mb-0">
    <input class="form-check-input" type="checkbox" role="switch" name="enabled" value="1" id="${id}" ${checked ? safe('checked') : ''}>
    <label class="form-check-label fs-8 text-uppercase" for="${id}">${hidden ? 'Visible in the top bar' : 'Visible'}</label>
  </div>`;

const filterValueField = (item, id) => html`
  <label class="form-label fs-8 text-uppercase mb-1" for="${id}">Filter value</label>
  <input class="form-control form-control-sm" id="${id}" name="filter_value" value="${item.filterValue || ''}" maxlength="80"
         placeholder="${item.filterType === 'collection' ? 'collection handle' : item.filterType === 'all' ? 'not used' : 'tag, e.g. outdoor'}">`;

const categoryRow = (item, index, count) => html`
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
              data-admin-confirm="Delete &quot;${item.name}&quot;? The link disappears from the top bar straight away.">
          <input type="hidden" name="id" value="${item.id}">
          <button class="btn btn-outline-danger btn-sm rounded px-3" type="submit">Delete</button>
        </form>
      </div>
    </div>
  </div>`;

export const categoriesView = ({ list = [] }) => html`
  <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
    <div>
      <h1 class="heading-font text-uppercase h4 mb-1">Product categories</h1>
      <p class="text-secondary fs-7 mb-0">
        These links fill the strip directly under the
        <strong>&ldquo;Free Mainland UK Shipping On All Orders&rdquo;</strong> bar, in the order below.
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
    ? list.map((item, index) => categoryRow(item, index, list.length))
    : html`<div class="card border-0 shadow-sm rounded-3">
        <div class="card-body text-center py-5">
          <h2 class="h5 mb-2">No categories yet</h2>
          <p class="text-secondary fs-7 mb-0">Add one above and it appears at the top of every page.</p>
        </div>
      </div>`}
`;

export const adminNotFound = ({ message = 'That admin page does not exist.' }) => html`
  <div class="card border-0 shadow-sm rounded-3">
    <div class="card-body text-center py-5">
      <h1 class="heading-font text-uppercase h4 mb-2">Not found</h1>
      <p class="text-secondary fs-7 mb-3">${message}</p>
      <a class="btn btn-primary btn-sm rounded px-4" href="/admin/categories">Back to categories</a>
    </div>
  </div>`;

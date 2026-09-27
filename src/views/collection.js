import { html, safe } from '../lib/html.js';
import { breadcrumbs, productCard, sectionHeading } from './partials.js';

export const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'title', label: 'Alphabetically, A-Z' },
  { value: 'title-desc', label: 'Alphabetically, Z-A' },
];

/** The list of collections (`/collections`). */
export const collectionIndex = ({ list, symbol = '£' }) => html`
  <section class="py-4 py-md-5">
    <div class="container">
      ${breadcrumbs([{ label: 'Home', url: '/' }, { label: 'Collections' }], 'mb-3')}
      ${sectionHeading({ heading: 'Shop the range', intro: 'Everything we make, grouped by collection.', align: 'start' })}
      <div class="row g-3 g-md-4">
        ${list.map(
          (item) => html`
            <div class="col-12 col-md-6 col-lg-4">
              <a href="/collections/${item.handle}" class="d-block text-reset text-decoration-none border rounded-3 p-4 h-100 bg-white">
                <h2 class="h4 fw-normal mb-2">${item.title}</h2>
                ${item.subtitle ? html`<p class="text-secondary fs-7 mb-2">${item.subtitle}</p>` : ''}
                <p class="fs-8 text-uppercase text-secondary mb-0">${item.productCount} products</p>
              </a>
            </div>`
        )}
      </div>
    </div>
  </section>`;

export const collectionView = ({ collection: current, products, sort = 'featured', symbol = '£' }) => html`
  <section class="collection-hero text-center pt-4 pb-2">
    <div class="container">
      ${breadcrumbs([{ label: 'Home', url: '/' }, { label: current.title }])}
      <h1 class="heading-font text-uppercase fs-1 mt-3 mb-2">${current.title}</h1>
      ${current.subtitle ? html`<p class="fs-6 text-secondary mb-2">${current.subtitle}</p>` : ''}
      ${current.description
        ? html`<div class="text-secondary mx-auto fs-7" style="max-width: 48rem;">${current.description}</div>`
        : ''}
    </div>
  </section>

  <section class="collection-grid pb-5">
    <div class="container">
      <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-4 gap-3 flex-wrap">
        <p class="mb-0 fs-7 text-secondary" data-collection-count>${products.length} products</p>
        <form class="d-flex align-items-center gap-2" method="get" data-sort-form>
          <label class="fs-8 text-uppercase mb-0" for="sort-by">Sort</label>
          <select id="sort-by" name="sort" class="form-select form-select-sm w-auto" data-sort-select>
            ${SORTS.map(
              (option) => html`<option value="${option.value}" ${option.value === sort ? safe('selected') : ''}>${option.label}</option>`
            )}
          </select>
          <noscript><button type="submit" class="btn btn-sm btn-primary rounded">Apply</button></noscript>
        </form>
      </div>

      ${products.length
        ? html`<div class="row g-3 g-md-4">
            ${products.map((product) => productCard(product, { symbol }))}
          </div>`
        : html`<div class="text-center py-5">
            <h2 class="h4 fw-light mb-3">Nothing here yet</h2>
            <p class="text-secondary mb-4">We are busy restocking this collection.</p>
            <a href="/products" class="btn btn-primary rounded px-4">Shop all products</a>
          </div>`}
    </div>
  </section>`;

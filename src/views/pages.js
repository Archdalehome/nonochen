import { html, safe } from '../lib/html.js';
import { breadcrumbs, productCard, sectionHeading } from './partials.js';
import { imageBanner } from './home.js';

const bodyCopy = (body) => html`<div class="rte text-secondary fs-7">${safe(body || '')}</div>`;

/**
 * Content pages (`/pages/:handle`) are stored as one or more `sections` rows
 * where `page = 'page:<handle>'`. The first `page` section supplies the heading.
 */
export const contentPage = ({ handle, list }) => {
  const first = list.find((section) => section.type === 'page');
  const title = (first && first.data.title) || handle.replace(/-/g, ' ');

  return html`
    <div class="container pt-3">
      ${breadcrumbs([{ label: 'Home', url: '/' }, { label: title }])}
    </div>
    <section class="content-page py-4">
      <div class="container">
        <h1 class="heading-font text-uppercase fs-2 mb-4 text-center">${title}</h1>
        <div class="mx-auto" style="max-width: 60rem;">
          ${list.map((section) => {
            switch (section.type) {
              case 'page':
                return html`<div class="mb-4">
                  ${section.data.title && section.data.title !== title
                    ? html`<h2 class="h4 fw-normal mb-3">${section.data.title}</h2>`
                    : ''}
                  ${bodyCopy(section.data.body)}
                </div>`;
              case 'image_banner':
                return imageBanner(section);
              default:
                return '';
            }
          })}
        </div>
      </div>
    </section>`;
};

export const searchPage = ({ term, products, symbol = '£' }) => html`
  <div class="container pt-3">
    ${breadcrumbs([{ label: 'Home', url: '/' }, { label: 'Search' }])}
  </div>
  <section class="search-page py-4">
    <div class="container">
      <form method="get" action="/search" class="mb-4" role="search">
        <label class="visually-hidden" for="search-input">Search products</label>
        <div class="d-flex gap-2" style="max-width: 32rem;">
          <input class="form-control" type="search" id="search-input" name="q" value="${term}" placeholder="Search for bean bags, cushions, lighting...">
          <button class="btn btn-primary rounded px-4" type="submit">Search</button>
        </div>
      </form>

      ${term
        ? html`<p class="text-secondary fs-7 mb-4">
            ${products.length} result${products.length === 1 ? '' : 's'} for &ldquo;${term}&rdquo;
          </p>`
        : sectionHeading({ heading: 'Search the range', intro: 'Looking for something in particular?', align: 'start' })}

      ${products.length
        ? html`<div class="row g-3 g-md-4">${products.map((product) => productCard(product, { symbol }))}</div>`
        : term
          ? html`<div class="text-center py-5">
              <h2 class="h4 fw-light mb-3">No products found</h2>
              <p class="text-secondary mb-4">Try a shorter search term, or browse the collections.</p>
              <a href="/collections" class="btn btn-primary rounded px-4">Browse collections</a>
            </div>`
          : ''}
    </div>
  </section>`;

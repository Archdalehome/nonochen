import { html } from '../lib/html.js';
import { icons, svgLogo } from './icons.js';
import { announcementBar } from './partials.js';

/* -------------------------------------------------------- category links ---- */

/**
 * The product categories managed in /admin. They are the storefront navigation:
 * inline in the header row next to the logo, search and cart on desktop, and
 * listed at the top of the mobile offcanvas menu.
 */
const categoryLink = (item, path, className) => {
  const href = String(item.href || '#');
  const current = href.split('?')[0] === path;
  return html`<a
    href="${href}"
    class="${className}${current ? ' is-current' : ''}"
    ${current ? html`aria-current="page"` : ''}
  >${item.name}</a>`;
};

/** The category links that sit between the logo and the search/cart icons. */
export const categoryNav = (list = [], path = '') => {
  if (!list.length) return '';
  return html`
    <ul class="navbar-nav d-none d-md-flex flex-row justify-content-center flex-fill py-1 mb-0 header-categories" aria-label="Product categories">
      ${list.map(
        (item) => html`<li class="navbar-item">
          ${categoryLink(item, path, 'nav-link fs-6 text-capitalize nav--top-level header-categories__link')}
        </li>`
      )}
    </ul>`;
};

/* ------------------------------------------------------------------ mobile ---- */

export const mobileNav = (nav, categories = [], path = '') => html`
  <div class="offcanvas offcanvas-start mobile-nav" tabindex="-1" id="offcanvasNavbar" aria-labelledby="offcanvasNavbarLabel">
    <div class="offcanvas-header border-bottom">
      <span class="heading-font text-uppercase h5 mb-0" id="offcanvasNavbarLabel">Menu</span>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body flex-column">
      ${categories.length
        ? html`<nav class="w-100" aria-label="Product categories">
            <p class="fs-8 text-uppercase text-secondary mb-2">Shop by category</p>
            <ul class="mobile-nav__categories mb-4">
              ${categories.map((item) => html`<li>${categoryLink(item, path, 'mobile-nav__category-link')}</li>`)}
            </ul>
          </nav>`
        : ''}
      <div class="accordion accordion-flush w-100" id="mobileNavAccordion">
        ${nav.map((item, index) =>
          item.columns.length
            ? html`<div class="accordion-item border-bottom">
                <h6 class="accordion-header" id="mobile-heading-${index}">
                  <button class="accordion-button collapsed px-0 fs-6" type="button" data-bs-toggle="collapse" data-bs-target="#mobile-collapse-${index}" aria-expanded="false" aria-controls="mobile-collapse-${index}">
                    ${item.label}
                  </button>
                </h6>
                <div id="mobile-collapse-${index}" class="accordion-collapse collapse" aria-labelledby="mobile-heading-${index}" data-bs-parent="#mobileNavAccordion">
                  <div class="accordion-body px-0 pt-0">
                    <a href="${item.url}" class="d-block mb-3 fw-medium text-decoration-underline">Shop all ${item.label}</a>
                    ${item.columns.map(
                      (column) => html`<div class="mb-3">
                        <p class="fs-8 text-uppercase text-secondary mb-2">${column.heading}</p>
                        ${column.links.map(
                          (link) => html`<a href="${link.url || '#'}" class="d-block mb-2 fs-7 text-reset">${link.label}</a>`
                        )}
                      </div>`
                    )}
                  </div>
                </div>
              </div>`
            : html`<div class="border-bottom py-3">
                <a href="${item.url || '#'}" class="fs-6 text-reset text-decoration-none">${item.label}</a>
              </div>`
        )}
      </div>
      <div class="mt-4 d-flex flex-column gap-3 fs-7">
        <a class="text-reset" href="/search">Search</a>
        <a class="text-reset" href="/pages/contact-details">Contact Details</a>
        <a class="text-reset" href="/pages/store-locator">Store Locator</a>
      </div>
    </div>
  </div>`;

/* ------------------------------------------------------------------ header ---- */

export const header = (settings, nav, cart, categories = [], path = '') => html`
  <header class="site-header">
    <div class="site-header__bar">
      ${announcementBar(settings)}
      <nav class="navbar bg-white p-0 border-bottom">
        <div class="container-fluid container-xl px-2">
          <div class="d-flex justify-content-center w-100 top-navbar align-items-center py-2 py-md-0">
            <div class="d-flex d-md-none me-auto flex-fill">
              <button class="nav-link border-0 bg-transparent p-2" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasNavbar" aria-controls="offcanvasNavbar" aria-label="Toggle navigation">
                ${icons.menu}
              </button>
            </div>
            <div class="d-flex">
              <div class="navbar-item">
                <a href="/" class="navbar-brand nav-link p-0 d-flex align-items-center h-100 me-2 me-lg-4" aria-label="Chen Furniture home">
                  ${svgLogo('header__heading-logo', 48)}
                </a>
              </div>
            </div>
            <div class="d-flex ms-auto flex-fill justify-content-end">
              ${categoryNav(categories, path)}
              <div class="d-flex align-items-center">
                <a href="/search" class="nav-link p-2" aria-label="Search">${icons.search}</a>
                <button class="nav-link border-0 bg-transparent p-2 position-relative" type="button" data-bs-toggle="offcanvas" data-bs-target="#cart" aria-controls="cart" aria-label="Open cart">
                  ${icons.cart}
                  <span class="cart-count badge rounded-pill bg-primary ${cart.count ? '' : 'd-none'}" data-cart-count>${cart.count}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
    ${mobileNav(nav, categories, path)}
  </header>`;

import { html } from '../lib/html.js';
import { icons, svgLogo } from './icons.js';
import { announcementBar } from './partials.js';

/* ------------------------------------------------------------- mega menu ---- */

export const megaMenu = (item, index) => html`
  <li class="navbar-item dropdown mega-menu-container bg-white text-primary py-3">
    <div class="nav-link text-center d-flex align-items-center h-100" id="mega-menu-link-${index}">
      <a href="${item.url}" class="text-primary fs-6 text-capitalize nav--top-level">${item.label}</a>
      <a
        class="nav-link px-2 d-flex align-items-center"
        href="#"
        role="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label="Open ${item.label} menu"
      >${icons.chevronDown}</a>
    </div>
    <div class="dropdown-menu mega-menu bg-white py-5 pe-3 rounded-0 border-top border-primary" aria-labelledby="mega-menu-link-${index}">
      <div class="container-fluid">
        <div class="row">
          <div class="col-5">
            <div class="row h-75">
              ${item.columns.map(
                (column) => html`
                  <div class="col-6 ps-5 pe-5 border-end mega-menu__column">
                    <a href="${column.url || '#'}" class="d-flex h5 text-start pt-0 pb-2 mb-2 text-primary fw-bold border-bottom border-secondary mega-menu__heading">${column.heading}</a>
                    <ul class="list-unstyled mb-0">
                      ${column.links.map(
                        (link) => html`<li class="mb-2">
                          <a href="${link.url || '#'}" class="text-capitalize text-start fs-6 text-primary">${link.label}</a>
                        </li>`
                      )}
                    </ul>
                  </div>`
              )}
            </div>
          </div>
          <div class="col-7">
            <div class="row h-100">
              ${item.promos.map(
                (promo) => html`
                  <div class="col max-col-4 h-100">
                    <div class="position-relative w-100 h-100 mb-4">
                      <a href="${promo.url || '#'}" class="overflow-hidden d-block rounded-3 block-image--wrapper-shadow h-100" aria-label="${promo.label}">
                        <img
                          src="${promo.image}"
                          width="100%"
                          height="100%"
                          loading="lazy"
                          alt="${promo.label}"
                          class="object-fit-cover rounded h-100 w-100"
                        >
                        <span class="visually-hidden">${promo.label}</span>
                      </a>
                      <div class="position-absolute bottom-0 p-4">
                        <h3 class="text-white fw-light lh-1 mb-2 h4">${promo.label}</h3>
                      </div>
                    </div>
                  </div>`
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </li>`;

/* ------------------------------------------------------------------ mobile ---- */

export const mobileNav = (nav) => html`
  <div class="offcanvas offcanvas-start mobile-nav" tabindex="-1" id="offcanvasNavbar" aria-labelledby="offcanvasNavbarLabel">
    <div class="offcanvas-header border-bottom">
      <span class="heading-font text-uppercase h5 mb-0" id="offcanvasNavbarLabel">Menu</span>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body flex-column">
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

export const header = (settings, nav, cart) => html`
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
              <ul class="navbar-nav d-none d-md-flex flex-row justify-content-center flex-fill py-1 mb-0">
                ${nav.map((item, index) => (item.columns.length ? megaMenu(item, index) : menuLink(item)))}
              </ul>
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
    ${mobileNav(nav)}
  </header>`;

export const menuLink = (item) => html`
  <li class="navbar-item py-3">
    <a href="${item.url || '#'}" class="nav-link fs-6 text-capitalize">${item.label}</a>
  </li>`;

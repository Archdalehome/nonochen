import { safe } from '../lib/html.js';

/**
 * Inline SVGs (the original theme ships Bootstrap Icons through its own CDN, we
 * keep the handful of glyphs we actually use here so the site stays dependency
 * free). Everything is wrapped in `safe()` so it can be dropped straight into an
 * `html` template.
 */
const icon = (paths, { size = 20, width = 1.6, viewBox = '0 0 24 24', fill = 'none' } = {}) =>
  safe(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="${fill}" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`
  );

export const icons = {
  menu: icon('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  search: icon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  cart: icon(
    '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/>'
  ),
  chevronDown: icon('<path d="M6 9l6 6 6-6"/>'),
  chevronRight: icon('<path d="M9 6l6 6-6 6"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  minus: icon('<path d="M5 12h14"/>'),
  check: icon('<path d="M4 12.5l5 5L20 6.5"/>'),
  truck: icon('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>'),
  lock: icon('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/>'),
  facebook: safe(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8.5h2.5V5H14c-2.2 0-4 1.8-4 4v2H8v3.5h2V22h3.5v-7.5H16l.5-3.5h-3V9c0-.3.2-.5.5-.5z"/></svg>'
  ),
  instagram: icon('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1"/>'),
  arrow: icon('<path d="M5 12h13M13 6l6 6-6 6"/>', { size: 18 }),
  box: icon('<path d="M21 8.5 12 4 3 8.5v7L12 20l9-4.5z"/><path d="M3 8.5 12 13l9-4.5M12 13v7"/>'),
  refresh: icon('<path d="M20 11a8 8 0 1 0-2.4 5.7"/><path d="M20 5v6h-6"/>'),
};

export const svgLogo = (className = '', size = 48) =>
  safe(
    `<img src="/images/logo.svg" width="${size}" height="${size}" alt="Extreme Lounging" class="${className}" loading="eager">`
  );


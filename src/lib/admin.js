/**
 * Admin authentication and the category form rules.
 *
 * There is exactly one operator account. It defaults to `admin` / `admin` (as
 * requested) and can be overridden without a code change by setting the
 * `ADMIN_USER` / `ADMIN_PASSWORD` variables (or secrets) on the Worker:
 *
 *   npx wrangler secret put ADMIN_PASSWORD
 *
 * A successful login sets a stateless, HMAC signed cookie - the signing key is
 * derived from the password, so changing the password invalidates every open
 * session. Signatures are checked in constant time and have a 12 hour expiry.
 */
import { slugify } from './html.js';
import { readCookie, setCookie } from './cookies.js';

export const ADMIN_COOKIE = 'cf_admin';
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours, in seconds

export const CATEGORY_FILTERS = [
  { value: 'collection', label: 'Products in a collection' },
  { value: 'tag', label: 'Products with a matching tag' },
  { value: 'all', label: 'All products' },
];

const encoder = new TextEncoder();

export const credentials = (env) => ({
  user: String(env.ADMIN_USER || 'admin'),
  password: String(env.ADMIN_PASSWORD || 'admin'),
});

/** True while the built-in fallback password is still in use. */
export const defaultPasswordInUse = (env) => !env.ADMIN_PASSWORD;

const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));

const sign = async (env, payload) => {
  const secret = `chen-furniture-admin:${env.ADMIN_SECRET || ''}:${credentials(env).password}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
};

/** Length independent comparison - never bails out on the first mismatch. */
const sameString = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const verifyLogin = async (env, user, password) => {
  const expected = credentials(env);
  const okUser = sameString(String(user === undefined || user === null ? '' : user), expected.user);
  const okPassword = sameString(String(password === undefined || password === null ? '' : password), expected.password);
  return okUser && okPassword;
};

/** Headers carrying the signed session cookie for a fresh login. */
export const createSession = async (env, user) => {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${encodeURIComponent(user)}.${expires}`;
  const headers = new Headers();
  setCookie(headers, ADMIN_COOKIE, `${payload}.${await sign(env, payload)}`, { maxAge: SESSION_MAX_AGE });
  return headers;
};

/** Headers that clear the session cookie. */
export const destroySession = () => {
  const headers = new Headers();
  setCookie(headers, ADMIN_COOKIE, '', { maxAge: 0 });
  return headers;
};

/** The signed in user, or `''` when the request has no valid session. */
export const sessionUser = async (request, env) => {
  const raw = readCookie(request, ADMIN_COOKIE);
  if (!raw) return '';
  const parts = raw.split('.');
  if (parts.length !== 3) return '';
  const [user, expires, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < Date.now()) return '';
  try {
    fromBase64Url(signature);
  } catch {
    return '';
  }
  if (!sameString(signature, await sign(env, `${user}.${expires}`))) return '';
  try {
    return decodeURIComponent(user);
  } catch {
    return '';
  }
};

/** Only in-admin redirects, so `?next=` can never bounce to another host. */
export const safeNext = (value, fallback = '/admin/categories') => {
  const next = String(value || '');
  if (/^\/admin(\/[A-Za-z0-9\-/]*)?$/.test(next) && !next.startsWith('/admin/login')) return next;
  return fallback;
};

/* ------------------------------------------------- product form rules ---- */

export const PRODUCT_ERRORS = {
  title: 'A product needs a title.',
  handle: 'That product slug is not valid - use a-z, 0-9 and dashes (up to 80 characters).',
  duplicate: 'Another product already uses that slug.',
  price: 'The price has to be a number, for example 249 or 249.99.',
  compare: 'The "was" price has to be a number, or left empty.',
  image: 'A product needs an image: a path such as /images/b-bag-grey.png or a full https:// URL.',
  missing: 'That product is no longer in the catalogue.',
  pick: 'Pick a product from the list first.',
  filter: 'This category lists every product, so there is nothing to add or remove.',
};

/** "£249.50", " 1,249.5 " and "249" all read as numbers; blanks as null, junk as NaN. */
const toPrice = (value) => {
  const raw = String(value === undefined || value === null ? '' : value)
    .replace(/[£$€,\s]/g, '')
    .trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : NaN;
};

const flag = (data, name, fallback) => {
  const raw = data[name];
  if (raw === undefined) return fallback;
  return String(raw) === '0' ? 0 : 1;
};

/**
 * Validates one product form submission (create or edit). Returns
 * `{ error, message, values }` - `message` is ready for the admin UI.
 */
export const normalizeProduct = (data) => {
  const title = String(data.title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
  let handle = String(data.handle || '')
    .trim()
    .toLowerCase();
  if (!handle) handle = slugify(title).slice(0, 80);
  const image = String(data.image || '').trim().slice(0, 300);
  const price = toPrice(data.price);
  const compareAtPrice = toPrice(data.compare_at_price);
  const rawOrder = String(data.sort_order === undefined || data.sort_order === null ? '' : data.sort_order).trim();
  const sortOrder = /^\d{1,4}$/.test(rawOrder) ? Number(rawOrder) : null;

  const error = !title
    ? 'title'
    : !/^[a-z0-9][a-z0-9-]{0,79}$/.test(handle)
      ? 'handle'
      : price === null || Number.isNaN(price)
        ? 'price'
        : Number.isNaN(compareAtPrice)
          ? 'compare'
          : !image || !(image.startsWith('/') || /^https?:\/\//.test(image))
            ? 'image'
            : '';

  return {
    error,
    message: PRODUCT_ERRORS[error] || '',
    values: {
      title,
      handle,
      shortTitle: String(data.short_title || '').trim().slice(0, 80),
      price: Number.isNaN(price) ? 0 : price,
      compareAtPrice: Number.isNaN(compareAtPrice) ? null : compareAtPrice,
      priceFrom: flag(data, 'price_from', 0),
      badge: String(data.badge || '').trim().slice(0, 40),
      image,
      catHandle: String(data.cat_handle || '').trim().toLowerCase().slice(0, 60),
      catLabel: String(data.cat_label || '').trim().slice(0, 60),
      colourHex: String(data.colour_hex || '').trim().slice(0, 20) || '#5f6062',
      summary: String(data.summary || '').trim().slice(0, 300),
      description: String(data.description || '').trim().slice(0, 2000),
      // The collection a product belongs to comes from the category it was added
      // to (`addProductToCategory`), never from a form field.
      collectionHandle: '',
      soldOut: flag(data, 'sold_out', 0),
      isNew: flag(data, 'is_new', 0),
      inGrid: flag(data, 'show_in_home_grid', 1),
      sortOrder,
      seoTitle: String(data.seo_title || '').trim().slice(0, 120),
      seoDescription: String(data.seo_description || '').trim().slice(0, 300),
    },
  };
};

/* -------------------------------------------------- category form rules ---- */

const CATEGORY_ERRORS = {
  name: 'A category needs a name.',
  slug: 'That slug is not valid - use a-z, 0-9 and dashes (up to 60 characters).',
  url: 'The link override has to start with "/" (for example /collections/outdoor-range) or be left empty.',
};

/**
 * Validates one category form submission. Returns `{ error, message, values }`
 * where `message` is ready to show in the admin UI.
 */
export const normalizeCategory = (data) => {
  const name = String(data.name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  let slug = String(data.slug || '')
    .trim()
    .toLowerCase();
  if (!slug) slug = slugify(name);
  const url = String(data.url || '').trim().slice(0, 200);
  const filterType = CATEGORY_FILTERS.some((filter) => filter.value === String(data.filter_type))
    ? String(data.filter_type)
    : 'tag';
  const filterValue = String(data.filter_value || '').trim().slice(0, 80);
  // An empty (or nonsense) order means "keep the current slot" / "append".
  const rawPosition = String(data.position === undefined || data.position === null ? '' : data.position).trim();
  const position = /^\d{1,3}$/.test(rawPosition) ? Number(rawPosition) : null;
  // The view posts `enabled=0` (hidden input) followed by `enabled=1` (checkbox),
  // so the last value wins and an unchecked box still arrives as "0".
  const enabled = String(data.enabled) === '0' ? 0 : 1;

  const error = !name ? 'name' : !/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug) ? 'slug' : url && !url.startsWith('/') ? 'url' : '';

  return {
    error,
    message: CATEGORY_ERRORS[error] || '',
    values: {
      name,
      slug,
      url,
      filterType,
      filterValue: filterType === 'all' ? '' : filterValue || slug,
      position,
      enabled,
    },
  };
};

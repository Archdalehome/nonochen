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

/* --------------------------------------------------- home content rules ---- */

/**
 * The announcement bar and the homepage hero. Both already render on the
 * storefront (`views/partials.js` and `views/home.js`); these rules only police
 * what the admin forms may store, so the renderers keep finding what they expect.
 *
 * `views/home.js` reads a slide as: video, video_mobile, poster, poster_mobile,
 * title, text, url, button { label, url } - anything else in the payload (button
 * colour and style, the carousel timing) is left exactly as it was.
 */
const HOME_ERRORS = {
  'bar-text': 'The announcement bar needs some text - an empty bar is a blue stripe with nothing in it.',
  'bar-icon': 'The bar icon has to be a path such as /images/icon-delivery.svg or a full https:// URL.',
  'hero-video': 'The hero needs a video: a path such as /images/hero-outdoor-desktop.mp4, a full https:// URL, or a file to upload.',
  'hero-media': 'The still images have to be paths such as /images/hero-outdoor-poster-desktop.jpg or full https:// URLs.',
  'hero-link': 'Links have to start with "/" (for example /collections/outdoor-range) or be a full https:// URL.',
  'hero-button': 'A button needs both a label and a link - clear the label to link the whole slide instead.',
  'hero-slide': 'That slide is not part of the hero any more - reload the screen and try again.',
};

const clip = (value, length) =>
  String(value === undefined || value === null ? '' : value)
    .trim()
    .slice(0, length);

/** A path on this site (`/images/...`) or a full http(s) URL. */
const onSite = (value) => value.startsWith('/') || /^https?:\/\//.test(value);

/** The announcement bar form: the message and the little icon in front of it. */
export const normalizeAnnouncement = (data) => {
  const text = clip(data.announcement_text, 160).replace(/\s+/g, ' ');
  const icon = clip(data.announcement_icon, 300);
  const error = !text ? 'text' : icon && !onSite(icon) ? 'icon' : '';
  return {
    error,
    message: HOME_ERRORS[`bar-${error}`] || '',
    values: { announcement_text: text, announcement_icon: icon },
  };
};

/**
 * One hero slide form. `stored` is the section's current `data`, so the fields
 * the form does not carry are copied through untouched and only the slide the
 * form names is rewritten. Returns the whole payload to write back.
 */
export const normalizeHero = (data, stored = {}) => {
  const slides = Array.isArray(stored.slides) ? stored.slides : [];
  const index = Number(data.slide);
  const current = Number.isInteger(index) && index >= 0 && index < slides.length ? slides[index] : null;
  if (!current) return { error: 'slide', message: HOME_ERRORS['hero-slide'], values: null };

  const video = clip(data.video, 300);
  const videoMobile = clip(data.video_mobile, 300);
  const poster = clip(data.poster, 300);
  const posterMobile = clip(data.poster_mobile, 300);
  const title = clip(data.title, 120);
  const copy = clip(data.text, 300);
  const link = clip(data.link, 300);
  const buttonLabel = clip(data.button_label, 60);
  const buttonUrl = clip(data.button_url, 300);

  const error = !video || !onSite(video)
    ? 'video'
    : [videoMobile, poster, posterMobile].some((value) => value && !onSite(value))
      ? 'media'
      : [link, buttonUrl].some((value) => value && !onSite(value))
        ? 'link'
        : buttonLabel && !buttonUrl
          ? 'button'
          : '';
  if (error) return { error, message: HOME_ERRORS[`hero-${error}`], values: null };

  const next = {
    ...current,
    video,
    // A phone with no file of its own would show an empty hero, so the desktop
    // video stands in. The renderer still writes the same two <video> tags.
    video_mobile: videoMobile || video,
    poster,
    poster_mobile: posterMobile || poster,
    title,
    text: copy,
    url: link,
  };
  // The button only exists while it has a label; without one the whole slide is
  // the link (which is how views/home.js renders it too).
  if (buttonLabel) next.button = { ...(current.button || {}), label: buttonLabel, url: buttonUrl };
  else delete next.button;

  return {
    error: '',
    message: '',
    values: { ...stored, slides: slides.map((slide, position) => (position === index ? next : slide)) },
  };
};

/* -------------------------------------------- homepage section rules ---- */

/**
 * The product rows under the hero, the tiles of the link grid and the image
 * banners are rows in `sections` that `views/home.js` renders; /admin/home
 * edits them. These rules only police what those forms may store, and copy
 * every field a form does not carry through untouched, so saving one field can
 * never drop another.
 *
 * A product row reads one product switch - the same toggles the product form
 * writes (`is_new`, `price_from`, `show_in_home_grid`, see `productList` in
 * `lib/db.js`). A row that still lists collections keeps its `pickers`, which
 * this screen does not edit.
 *
 * The keys are the query values /admin/home reports errors with, so
 * `src/index.js` turns them straight into notices.
 */
export const SECTION_ERRORS = {
  'row-heading': 'A product row needs a heading, for example New Products.',
  'row-source': 'Pick what the row lists: the products ticked New, the ones ticked Best Selling, or the ones ticked Homepage row.',
  'row-link': 'Links have to start with "/" (for example /collections/outdoor-range) or be a full https:// URL.',
  'grid-label': 'A tile needs the words shown over it, for example Shop Outdoor.',
  'grid-url': 'A tile needs a link: "/" (for example /collections/outdoor-range) or a full https:// URL.',
  'grid-image': 'A tile needs a background image: a path such as /images/banner-shop-outdoor.jpg or a full https:// URL.',
  'grid-height': 'The tile height has to be a number with a unit, for example 60vh or 420px.',
  'grid-item': 'That tile is not part of this block any more - reload the screen and try again.',
  'banner-image': 'A banner needs an image: a path such as /images/banner-facts.jpg or a full https:// URL.',
  'banner-position': 'The image position has to be percentages or keywords, for example 88% 86% or center 20%.',
  'banner-link': 'Links have to start with "/" (for example /collections/b-blanket) or be a full https:// URL.',
  'banner-button': 'A button needs a label and a link - clear the label to show the copy without a button.',
  'banner-colour': 'The button colour has to be a hex value such as #18181B.',
};

/** What one product row can list. The first three read a product switch. */
export const PRODUCT_ROW_SOURCES = [
  { value: 'new', label: 'Products ticked "New"' },
  { value: 'best', label: 'Products ticked "Best Selling"' },
  { value: 'grid', label: 'Products ticked "Homepage row" (All products)' },
  { value: 'collection', label: 'The collections picked for this row' },
];

/** The button classes `public/css/site.css` styles; anything else renders flat. */
export const BANNER_BUTTONS = ['btn-primary', 'btn-white', 'btn-light', 'btn-outline-primary', 'btn-outline-secondary'];

const TILE_HEIGHT = /^\d{1,4}(px|vh|rem|em|%)$/;
// `views/home.js` writes this straight into a `style` attribute, so anything
// that could close the attribute (quotes, semicolons) is refused.
const IMAGE_POSITION = /^[0-9A-Za-z.%\s-]{1,60}$/;
const HEX_COLOUR = /^#[0-9a-fA-F]{3,8}$/;

/** One product row: its heading, what it lists and the "view all" button. */
export const normalizeProductRow = (data, stored = {}) => {
  const heading = clip(data.heading, 80).replace(/\s+/g, ' ');
  const subheading = clip(data.subheading, 200).replace(/\s+/g, ' ');
  const source = String(data.source || '');
  const viewAllLabel = clip(data.view_all_label, 40);
  const viewAllUrl = clip(data.view_all_url, 300);
  const error = !heading
    ? 'heading'
    : !PRODUCT_ROW_SOURCES.some((item) => item.value === source)
      ? 'source'
      : viewAllLabel && !onSite(viewAllUrl)
        ? 'link'
        : '';
  if (error) return { error, message: SECTION_ERRORS[`row-${error}`], values: null };

  const next = { ...stored, heading, subheading, source };
  if (viewAllLabel) next.view_all = { ...(stored.view_all || {}), label: viewAllLabel, url: viewAllUrl };
  else delete next.view_all;
  return { error: '', message: '', values: next };
};

/** One tile of the link grid: the words over it, where it links and its image. */
export const normalizeLinkGridItem = (data, stored = {}) => {
  const items = Array.isArray(stored.items) ? stored.items : [];
  const index = Number(data.item);
  const current = Number.isInteger(index) && index >= 0 && index < items.length ? items[index] : null;
  if (!current) return { error: 'item', message: SECTION_ERRORS['grid-item'], values: null };

  const label = clip(data.label, 60).replace(/\s+/g, ' ');
  const url = clip(data.url, 300);
  const image = clip(data.image, 300);
  const height = clip(data.height, 20);
  const error = !label
    ? 'label'
    : !onSite(url)
      ? 'url'
      : !onSite(image)
        ? 'image'
        : height && !TILE_HEIGHT.test(height)
          ? 'height'
          : '';
  if (error) return { error, message: SECTION_ERRORS[`grid-${error}`], values: null };

  const next = { ...current, label, url, image };
  if (height) next.height = height;
  // An empty height means the renderer's own default (60vh).
  else delete next.height;
  return {
    error: '',
    message: '',
    values: { ...stored, items: items.map((item, position) => (position === index ? next : item)) },
  };
};

/** One image banner: its image, the copy over it and the button under it. */
export const normalizeImageBanner = (data, stored = {}) => {
  const image = clip(data.image, 300);
  const objectPosition = clip(data.object_position, 60);
  const title = clip(data.title, 120);
  const text = clip(data.text, 600);
  const buttonLabel = clip(data.button_label, 60);
  const buttonUrl = clip(data.button_url, 300);
  const buttonColour = clip(data.button_color, 20);
  const buttonStyle = BANNER_BUTTONS.includes(String(data.button_style)) ? String(data.button_style) : '';
  const error = !onSite(image)
    ? 'image'
    : objectPosition && !IMAGE_POSITION.test(objectPosition)
      ? 'position'
      : buttonUrl && !onSite(buttonUrl)
        ? 'link'
        : buttonLabel && !buttonUrl
          ? 'button'
          : buttonColour && !HEX_COLOUR.test(buttonColour)
            ? 'colour'
            : '';
  if (error) return { error, message: SECTION_ERRORS[`banner-${error}`], values: null };

  const next = { ...stored, image, title, text };
  if (objectPosition) next.object_position = objectPosition;
  else delete next.object_position;
  // The button only exists while it has a label; without one `views/home.js`
  // renders the copy block on its own.
  if (buttonLabel) {
    const was = stored.button || {};
    next.button = {
      ...was,
      label: buttonLabel,
      url: buttonUrl,
      style: buttonStyle || was.style || 'btn-primary',
      color: buttonColour || was.color || '#18181B',
    };
  } else delete next.button;

  return { error: '', message: '', values: next };
};

/* ------------------------------------------------------------ footer rules ---- */

/**
 * The columns at the bottom of every page are rows in `menu_items`
 * (location = 'footer'), which `views/footer.js` renders and /admin/footer
 * edits. These rules only police what the forms may store: a heading, the words
 * of a link and a link that goes somewhere.
 */
const FOOTER_ERRORS = {
  heading: 'A footer column needs a heading, for example Company.',
  label: 'A footer link needs the text that is shown on the site.',
  url: 'Footer links have to start with "/" (for example /pages/about), be a full https:// URL or a mailto: address.',
};

/** A path on this site, a link to another site, or a mailto: address. */
const linkable = (value) => value.startsWith('/') || /^(https?:\/\/|mailto:)/i.test(value);

/** An empty or nonsense order means "leave it in the slot it is in". */
const positionValue = (value) => {
  const raw = String(value === undefined || value === null ? '' : value).trim();
  return /^\d{1,3}$/.test(raw) ? Number(raw) : null;
};

/** One footer column: its heading, its place in the row and whether it shows. */
export const normalizeFooterGroup = (data) => {
  const label = clip(data.label, 40).replace(/\s+/g, ' ');
  const error = !label ? 'heading' : '';
  return {
    error,
    message: FOOTER_ERRORS[error] || '',
    values: { label, position: positionValue(data.position), enabled: String(data.enabled) === '0' ? 0 : 1 },
  };
};

/** One footer link: the words a shopper reads and the page they land on. */
export const normalizeFooterLink = (data) => {
  const label = clip(data.label, 60).replace(/\s+/g, ' ');
  const url = clip(data.url, 300);
  const error = !label ? 'label' : !linkable(url) ? 'url' : '';
  return {
    error,
    message: FOOTER_ERRORS[error] || '',
    values: { label, url, position: positionValue(data.position), enabled: String(data.enabled) === '0' ? 0 : 1 },
  };
};

/**
 * The company block that opens the footer: the logo over the name and the line
 * under it. Unlike the columns it is not a `menu_items` row - the three parts are
 * `settings` rows (`footer_logo`, `site_name`, `brand_line`), which is what
 * /admin/footer writes and `views/footer.js` renders.
 *
 * The keys are the query values /admin/footer reports errors with, so
 * `src/index.js` turns them straight into notices.
 */
export const FOOTER_BRAND_ERRORS = {
  'brand-name': 'The company block needs the name of the business, for example Chen Furniture.',
  'brand-logo': 'The logo has to be a path such as /images/footer/logo.png or a full https:// URL (or left empty).',
};

/**
 * The company block form: the logo (optional - without one the name stands on its
 * own), the name and the description under it. A name is required because the
 * header, the page titles and `views/footer.js` all read the same setting.
 */
export const normalizeFooterBrand = (data = {}) => {
  const name = clip(data.site_name, 60).replace(/\s+/g, ' ');
  const line = clip(data.brand_line, 300);
  const logo = clip(data.footer_logo, 300);
  const error = !name ? 'brand-name' : logo && !onSite(logo) ? 'brand-logo' : '';
  if (error) return { error, message: FOOTER_BRAND_ERRORS[error], values: null };
  return { error: '', message: '', values: { site_name: name, brand_line: line, footer_logo: logo } };
};

/* -------------------------------------------------------------- uploads ---- */

/**
 * What the hero may be given, and which extension each media type gets. The
 * extension comes from the declared MIME type, never from the file name - the
 * same rule `scripts/upload-media.mjs` follows with `--content-type`.
 */
const MEDIA_TYPES = {
  video: {
    label: 'Video',
    extensions: ['mp4', 'webm', 'mov'],
    mime: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' },
  },
  image: {
    label: 'Image',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    mime: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' },
  },
};

/** Hero videos run to a few MB; Worker requests start failing around 100 MB. */
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Turns one uploaded file into the R2 key it will live under. The `images/`
 * prefix is what the `/images/*` route reads, and the timestamp keeps a replaced
 * video from being served out of the year long cache of the one it replaced.
 *
 * Every upload lands in the folder of the form it came from - hero videos in
 * `images/hero/`, the footer logo in `images/footer/` - so the objects stay easy
 * to find next to the files `scripts/upload-media.mjs` pushes.
 */
export const mediaKey = (file, kind = 'video', stamp = Date.now(), folder = 'hero') => {
  const table = MEDIA_TYPES[kind] || MEDIA_TYPES.video;
  const name = slugify(String(file.name || '').replace(/\.[^.]+$/, '')) || folder;
  const declared = String(file.type || '').toLowerCase();
  const extension = table.mime[declared];
  if (!extension) {
    return { error: 'type', path: '', message: `${table.label} uploads have to be ${table.extensions.join(', ')}.` };
  }
  if (!file.size) return { error: 'empty', path: '', message: 'That file is empty.' };
  if (file.size > MEDIA_MAX_BYTES) {
    return { error: 'size', path: '', message: `That file is ${Math.round(file.size / 1048576)} MB - the limit is 25 MB.` };
  }
  const key = `images/${folder}/${stamp}-${name}.${extension}`;
  // `contentType` is what R2 hands back with the object, so the browser gets a
  // real video/mp4 (the extension is only part of the key).
  return { error: '', kind, key, path: `/${key}`, contentType: declared, message: '' };
};

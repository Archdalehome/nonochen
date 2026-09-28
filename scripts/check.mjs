/**
 * Local sanity check: parses every module, imports them (which also executes
 * them), then renders a few views against the seed content so a broken template
 * or a typo in a field name fails here instead of at request time.
 *
 *   npm run check
 */
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const failures = [];

/** `node --check` in stdin/module mode - reports syntax errors without running the file. */
const parseCheck = (relative) => {
  const source = readFileSync(new URL(relative, root), 'utf8');
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8' });
  if (result.status !== 0) {
    const message = (result.stderr || '').split('\n').slice(0, 6).join(' ').trim();
    failures.push(`${relative}: ${message}`);
    return false;
  }
  return true;
};

const listFiles = (directory) =>
  readdirSync(new URL(directory, root))
    .filter((file) => file.endsWith('.js'))
    .map((file) => `${directory}${file}`);

// 1. every source file must parse
const files = [...listFiles('src/lib/'), ...listFiles('src/views/'), 'src/index.js'];
const parseable = files.filter(parseCheck);

// 2. its imports must resolve and the router must expose a fetch handler
if (parseable.length === files.length) {
  for (const file of files) {
    try {
      await import(new URL(file, root).href);
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }

  const worker = await import(new URL('src/index.js', root).href);
  if (typeof (worker.default && worker.default.fetch) !== 'function') {
    failures.push('src/index.js: default export has no fetch handler');
  }
}

// 3. the seed data must line up with the schema (ids, handles, colours)
const [{ products, collections, settings }, { productCard }, { render }] = await Promise.all([
  import(new URL('scripts/data/content.mjs', root).href),
  import(new URL('src/views/partials.js', root).href),
  import(new URL('src/lib/html.js', root).href),
]);

for (const product of products) {
  if (!product.handle) failures.push(`content: product ${product.title} has no handle`);
  const colours = product.colours || [];
  for (const colour of colours) {
    if (!colour.name || !colour.hex) failures.push(`content: ${product.handle} has a colour without a name or hex`);
  }
  const card = render(
    productCard(
      { ...product, id: product.sort, image: '/images/placeholder.png' },
      { symbol: '£' }
    )
  );
  if (!card.includes(product.handle)) failures.push(`views: productCard did not render ${product.handle}`);
  if (!card.includes(product.title)) failures.push(`views: productCard did not render the title of ${product.handle}`);
}

for (const collection of collections) {
  if (!collection.handle) failures.push('content: collection without a handle');
}

for (const setting of settings) {
  if (!setting.key) failures.push('content: setting without a key');
}

// 4. the header categories and the admin screens must render
const [
  { categoryNav, header, mobileNav },
  { adminPage, categoriesView, categoryProductsView, footerView, homeView, loginView },
  {
    MEDIA_MAX_BYTES,
    mediaKey,
    normalizeAnnouncement,
    normalizeCategory,
    normalizeFooterGroup,
    normalizeFooterLink,
    normalizeHero,
    normalizeProduct,
  },
  { hero: storefrontHero },
  { footer: storefrontFooter },
] = await Promise.all([
  import(new URL('src/views/chrome.js', root).href),
  import(new URL('src/views/admin.js', root).href),
  import(new URL('src/lib/admin.js', root).href),
  import(new URL('src/views/home.js', root).href),
  import(new URL('src/views/footer.js', root).href),
]);

const links = [
  { name: 'Indoor Range', href: '/collections/indoor-range', enabled: true },
  { name: 'New Products', href: '/category/new-products', enabled: true },
];

const nav = render(categoryNav(links, '/collections/indoor-range'));
if (!nav.includes('/collections/indoor-range') || !nav.includes('Indoor Range')) {
  failures.push('views: categoryNav did not render the managed categories');
}
if (!nav.includes('aria-current="page"')) failures.push('views: categoryNav did not mark the current category');
if (render(categoryNav([], '/')) !== '') failures.push('views: categoryNav should render nothing without categories');

// The categories belong in the header row (between the logo, the search and the
// cart) and at the top of the mobile drawer, whose only other content is the
// three links under them - the scraped mega menu must be gone for good.
const chrome = render(
  header(
    { announcement_text: 'Free Mainland UK Shipping On All Orders' },
    { count: 0 },
    links,
    '/collections/indoor-range'
  )
);
const rowStart = chrome.indexOf('top-navbar');
const rowEnd = chrome.indexOf('</nav>', rowStart);
const categoriesAt = chrome.indexOf('header-categories__link', rowStart);
if (rowStart < 0 || rowEnd < 0 || categoriesAt < 0 || categoriesAt > rowEnd) {
  failures.push('views: the categories are missing from the header row');
}
if (!chrome.includes('mobile-nav__category-link')) failures.push('views: the categories are missing from the mobile menu');
if (chrome.includes('mega-menu')) failures.push('views: the header still renders the old mega menu');

// The drawer lists the categories, then Search / Contact Details / Store Locator
// and nothing in between.
const drawer = render(mobileNav(links, '/collections/indoor-range'));
if (!drawer.includes('mobile-nav__category-link')) failures.push('views: the mobile menu did not render the categories');
for (const [label, href] of [
  ['Search', '/search'],
  ['Contact Details', '/pages/contact-details'],
  ['Store Locator', '/pages/store-locator'],
]) {
  if (!drawer.includes(`href="${href}">${label}</a>`)) failures.push(`views: the mobile menu is missing the ${label} link`);
}
for (const scraped of ['mobileNavAccordion', 'accordion-button', 'border-bottom py-3', 'Shop all']) {
  if (drawer.includes(scraped)) failures.push(`views: the mobile menu still renders the scraped menu (${scraped})`);
}
if (!render(mobileNav([], '/')).includes('Store Locator')) {
  failures.push('views: the mobile menu links should survive an empty category list');
}

const login = render(loginView({ siteName: 'Chen Furniture', error: 'nope', next: '/admin/categories' }));
if (!login.includes('name="username"') || !login.includes('name="password"')) {
  failures.push('views: loginView is missing the sign in form');
}

const admin = render(
  adminPage({
    user: 'admin',
    siteName: 'Chen Furniture',
    title: 'Product categories',
    body: categoriesView({
      list: [
        {
          id: 1,
          slug: 'outdoor-range',
          name: 'Outdoor Range',
          url: '',
          href: '/category/outdoor-range',
          filterType: 'collection',
          filterValue: 'outdoor-range',
          position: 1,
          enabled: true,
        },
      ],
    }),
    flash: { kind: 'success', message: 'Category saved.' },
  })
);
const adminMarkup = [
  'admin-header',
  'action="/admin/categories"',
  'action="/admin/categories/save"',
  'action="/admin/categories/delete"',
  'action="/admin/categories/move"',
  '/admin/categories/products?slug=outdoor-range',
  '/category/outdoor-range',
  'Category saved.',
];
for (const expected of adminMarkup) {
  if (!admin.includes(expected)) failures.push(`views: the category admin screen is missing ${expected}`);
}

// 5. the category form rules behind those screens
const valid = normalizeCategory({ name: 'Outdoor  Bean Bags', slug: '', url: '', filter_type: 'tag', enabled: '1' });
if (valid.error) failures.push(`admin: a valid category was rejected (${valid.error})`);
if (valid.values.slug !== 'outdoor-bean-bags') failures.push(`admin: expected slug outdoor-bean-bags, got ${valid.values.slug}`);
if (valid.values.filterValue !== 'outdoor-bean-bags') failures.push('admin: an empty filter value should fall back to the slug');
if (valid.values.position !== null) failures.push('admin: an empty order should keep the current slot');
if (normalizeCategory({ name: '' }).error !== 'name') failures.push('admin: an empty name should be rejected');
if (normalizeCategory({ name: 'Lighting', slug: 'Not A Slug' }).error !== 'slug') failures.push('admin: a bad slug should be rejected');
if (normalizeCategory({ name: 'Lighting', slug: 'lighting', url: 'https://example.com' }).error !== 'url') {
  failures.push('admin: an external link override should be rejected');
}
if (normalizeCategory({ name: 'Lighting', slug: 'lighting', enabled: '0' }).values.enabled !== 0) {
  failures.push('admin: an unchecked visible switch should save 0');
}

// 6. the products of one category, and the rules behind their forms
const categoryProducts = render(
  adminPage({
    user: 'admin',
    siteName: 'Chen Furniture',
    title: 'Products in Outdoor Range',
    body: categoryProductsView({
      category: {
        id: 1,
        slug: 'outdoor-range',
        name: 'Outdoor Range',
        href: '/category/outdoor-range',
        filterType: 'collection',
        filterValue: 'outdoor-range',
      },
      list: [
        {
          id: 7,
          handle: 'b-bag-grey',
          title: 'B-Bag - Grey',
          price: 249,
          compare_at_price: null,
          price_from: 0,
          badge: 'Best seller',
          image: '/images/b-bag-grey.png',
          cat_handle: 'outdoor',
          cat_label: 'Outdoor',
          colour_hex: '#5f6062',
          summary: 'A bean bag.',
          description: 'The long copy.',
          collection_handle: 'outdoor-range',
          sold_out: 0,
          is_new: 0,
          show_in_home_grid: 1,
          sort_order: 3,
          soldOut: false,
          inGrid: true,
        },
      ],
      picker: [
        { id: 7, title: 'B-Bag - Grey', cat_handle: 'outdoor', cat_label: 'Outdoor', collection_handle: 'outdoor-range' },
        { id: 9, title: 'B-Lamp - Grey', cat_handle: 'lighting', cat_label: 'Lighting', collection_handle: 'indoor-range' },
      ],
      symbol: '£',
    }),
    flash: { kind: 'success', message: 'Product saved.' },
  })
);
const productMarkup = [
  'action="/admin/products/create"',
  'action="/admin/products/add"',
  'action="/admin/products/save"',
  'action="/admin/products/remove"',
  'action="/admin/products/delete"',
  'name="category_slug" value="outdoor-range"',
  'id="p-7-title"',
  'id="new-title"',
  'name="sold_out" value="0"',
  'name="show_in_home_grid" value="1"',
  'Product saved.',
];
for (const expected of productMarkup) {
  if (!categoryProducts.includes(expected)) failures.push(`views: the product screen is missing ${expected}`);
}
// The picker only offers the products that are not in the category yet.
if (!categoryProducts.includes('<option value="9">B-Lamp - Grey')) {
  failures.push('views: the add-product picker did not list the product outside the category');
}
if (categoryProducts.includes('<option value="7">')) {
  failures.push('views: the add-product picker offered a product that is already in the category');
}

const product = normalizeProduct({ title: 'B-Bag  Grey', price: '£249.50', image: '/images/b-bag-grey.png' });
if (product.error) failures.push(`admin: a valid product was rejected (${product.error})`);
if (product.values.handle !== 'b-bag-grey') failures.push(`admin: expected slug b-bag-grey, got ${product.values.handle}`);
if (product.values.price !== 249.5) failures.push(`admin: a price with a currency symbol should parse (${product.values.price})`);
if (product.values.compareAtPrice !== null) failures.push('admin: an empty "was" price should save NULL');
if (product.values.inGrid !== 1) failures.push('admin: a missing homepage switch should keep a product in the grid');
if (normalizeProduct({ title: '', price: '1', image: '/x.png' }).error !== 'title') {
  failures.push('admin: a product without a title should be rejected');
}
if (normalizeProduct({ title: 'X', price: 'free', image: '/x.png' }).error !== 'price') {
  failures.push('admin: a price that is not a number should be rejected');
}
if (normalizeProduct({ title: 'X', price: '1', compare_at_price: 'nope', image: '/x.png' }).error !== 'compare') {
  failures.push('admin: a "was" price that is not a number should be rejected');
}
if (normalizeProduct({ title: 'X', price: '1', image: 'b-bag.png' }).error !== 'image') {
  failures.push('admin: an image that is neither a path nor a URL should be rejected');
}
if (normalizeProduct({ title: 'X', price: '1', image: '/x.png', sort_order: 'later' }).values.sortOrder !== null) {
  failures.push('admin: a nonsense order should keep the current slot');
}
if (normalizeProduct({ title: 'X', price: '1', image: '/x.png', sold_out: '0' }).values.soldOut !== 0) {
  failures.push('admin: an unchecked sold out switch should save 0');
}

// 7. the home page screen (the announcement bar and the hero) and its rules
const heroSection = {
  id: 3,
  name: 'Homepage carousel',
  position: 1,
  enabled: true,
  data: {
    interval: 3000,
    slides: [
      {
        interval: 5000,
        url: '/collections/outdoor-range',
        title: 'Embrace the Outdoors',
        text: '',
        button: { label: 'Shop Outdoor', url: '/collections/outdoor-range', style: 'btn-white', color: '#000000' },
        video: '/images/hero-outdoor-desktop.mp4',
        video_mobile: '/images/hero-outdoor-mobile.mp4',
        poster: '',
        poster_mobile: '',
      },
    ],
  },
};

const home = render(
  adminPage({
    user: 'admin',
    siteName: 'Chen Furniture',
    title: 'Home page content',
    body: homeView({
      settings: {
        announcement_text: 'Free Mainland UK Shipping On All Orders',
        announcement_icon: '/images/icon-delivery.svg',
      },
      hero: heroSection,
      media: true,
    }),
  })
);
const homeMarkup = [
  'action="/admin/home/announcement"',
  'action="/admin/home/hero"',
  'enctype="multipart/form-data"',
  'name="announcement_text" value="Free Mainland UK Shipping On All Orders"',
  'name="announcement_icon" value="/images/icon-delivery.svg"',
  'name="section_id" value="3"',
  'name="slide" value="0"',
  'name="video" value="/images/hero-outdoor-desktop.mp4"',
  'name="video_mobile" value="/images/hero-outdoor-mobile.mp4"',
  'name="title" value="Embrace the Outdoors"',
  'name="link" value="/collections/outdoor-range"',
  'name="button_label" value="Shop Outdoor"',
  'name="button_url" value="/collections/outdoor-range"',
  'name="video_file"',
];
for (const expected of homeMarkup) {
  if (!home.includes(expected)) failures.push(`views: the home page screen is missing ${expected}`);
}
// It previews the real bar, and it only offers a file picker when there is a
// bucket behind it.
if (!home.includes('announcement-bar')) failures.push('views: the home page screen does not preview the announcement bar');
if (!render(homeView({ settings: {}, hero: null })).includes('No hero section')) {
  failures.push('views: the home page screen should say so when the homepage has no hero');
}
if (render(homeView({ settings: {}, hero: heroSection, media: false })).includes('type="file"')) {
  failures.push('views: the home page screen should not offer uploads without a MEDIA bucket');
}
// A hero the homepage is not showing says so, so a save is not a surprise.
if (!render(homeView({ settings: {}, hero: { ...heroSection, enabled: false } })).includes('This hero block is switched off')) {
  failures.push('views: the home page screen should flag a hero that is switched off');
}
if (render(homeView({ settings: {}, hero: heroSection })).includes('switched off')) {
  failures.push('views: an enabled hero should not be flagged as switched off');
}

const bar = normalizeAnnouncement({
  announcement_text: '  Free   Mainland UK Shipping  ',
  announcement_icon: '/images/icon-delivery.svg',
});
if (bar.error) failures.push(`admin: a valid announcement bar was rejected (${bar.error})`);
if (bar.values.announcement_text !== 'Free Mainland UK Shipping') {
  failures.push('admin: the bar message should lose its double spaces');
}
if (normalizeAnnouncement({ announcement_text: '   ' }).error !== 'text') {
  failures.push('admin: an empty bar message should be rejected');
}
if (normalizeAnnouncement({ announcement_text: 'Hi', announcement_icon: 'icon-delivery.svg' }).error !== 'icon') {
  failures.push('admin: a bar icon that is neither a path nor a URL should be rejected');
}
if (normalizeAnnouncement({ announcement_text: 'Hi' }).values.announcement_icon !== '') {
  failures.push('admin: an empty bar icon should stay empty - no icon is rendered then');
}

const heroForm = (fields = {}) =>
  normalizeHero({ slide: '0', video: '/images/hero-outdoor-desktop.mp4', ...fields }, heroSection.data);
const saved = heroForm({
  video_mobile: '',
  poster: '',
  poster_mobile: '',
  title: 'Embrace the Outdoors',
  text: 'Made to last',
  link: '/collections/outdoor-range',
  button_label: '',
  button_url: '',
});
if (saved.error) failures.push(`admin: a valid hero slide was rejected (${saved.error})`);
const slide = saved.values.slides[0];
if (slide.text !== 'Made to last') failures.push('admin: the text over the hero video was not saved');
if (slide.video_mobile !== '/images/hero-outdoor-desktop.mp4') {
  failures.push('admin: a hero with no phone video should reuse the desktop one');
}
if (slide.button) failures.push('admin: clearing the button label should drop the button');
if (saved.values.slides.length !== 1) failures.push('admin: saving one slide should not add or drop slides');
if (saved.values.interval !== 3000) {
  failures.push('admin: saving the hero should keep the fields the form does not show');
}

const kept = heroForm({ button_label: 'SHOP OUTDOOR', button_url: '/collections/outdoor-range' });
if (kept.values.slides[0].button.style !== 'btn-white' || kept.values.slides[0].button.color !== '#000000') {
  failures.push('admin: saving the hero button should keep its style and colour');
}
if (!kept.values.slides[0].button.url) failures.push('admin: the hero button should keep its link');
if (heroForm({ video: '' }).error !== 'video') failures.push('admin: a hero without a video should be rejected');
if (heroForm({ video: 'hero.mp4' }).error !== 'video') {
  failures.push('admin: a hero video that is neither a path nor a URL should be rejected');
}
if (heroForm({ poster: 'poster.jpg' }).error !== 'media') {
  failures.push('admin: a hero still that is neither a path nor a URL should be rejected');
}
if (heroForm({ link: 'collections/outdoor-range' }).error !== 'link') {
  failures.push('admin: a hero link that is neither a path nor a URL should be rejected');
}
if (heroForm({ button_label: 'Shop', button_url: '' }).error !== 'button') {
  failures.push('admin: a button without a link should be rejected');
}
if (normalizeHero({ slide: '9', video: '/x.mp4' }, heroSection.data).error !== 'slide') {
  failures.push('admin: a slide that is not in the hero should be rejected');
}

// Uploads: the extension follows the declared type (never the file name) and the
// object keeps the `images/` prefix the /images/* route reads.
const upload = mediaKey({ name: 'Hero Outdoor! .MP4', type: 'video/mp4', size: 4 * 1024 * 1024 }, 'video', 123);
if (upload.error) failures.push(`admin: a valid hero video was rejected (${upload.error})`);
if (upload.key !== 'images/hero/123-hero-outdoor.mp4') failures.push(`admin: unexpected upload key ${upload.key}`);
if (upload.path !== '/images/hero/123-hero-outdoor.mp4') {
  failures.push('admin: the upload path should be the one the /images/* route serves');
}
if (upload.contentType !== 'video/mp4') {
  failures.push(`admin: an upload of a video/mp4 file should be served as video/mp4, got ${upload.contentType}`);
}
if (mediaKey({ name: 'a.svg', type: 'image/svg+xml', size: 10 }, 'image').error !== 'type') {
  failures.push('admin: an upload of a type the site cannot serve should be rejected');
}
if (mediaKey({ name: 'huge.mp4', type: 'video/mp4', size: MEDIA_MAX_BYTES + 1 }, 'video').error !== 'size') {
  failures.push('admin: an oversized upload should be rejected');
}

// The storefront renders the same hero it rendered before the editor existed.
const heroMarkup = render(storefrontHero(heroSection));
for (const expected of [
  '<source src="/images/hero-outdoor-desktop.mp4" type="video/mp4">',
  '<source src="/images/hero-outdoor-mobile.mp4" type="video/mp4">',
  'Embrace the Outdoors',
  'Shop Outdoor',
  'href="/collections/outdoor-range"',
]) {
  if (!heroMarkup.includes(expected)) failures.push(`views: the storefront hero lost ${expected}`);
}

// 6. the footer columns: what /admin/footer writes is what the storefront shows
const footerColumn = (id, label, order, links) => ({
  id,
  parent_id: null,
  kind: 'group_heading',
  label,
  url: '',
  sort_order: order,
  enabled: true,
  links: links.map(([linkId, linkLabel, url, linkOrder]) => ({
    id: linkId,
    parent_id: id,
    kind: 'link',
    label: linkLabel,
    url,
    sort_order: linkOrder,
    enabled: true,
  })),
});
const footerGroups = [
  footerColumn(1, 'Company', 1, [
    [11, 'About', '/pages/about', 1],
    [12, 'Contact', '/pages/contact-details', 2],
    [13, 'FAQ', '/pages/faq', 3],
  ]),
  footerColumn(2, 'Follow', 2, [
    [21, 'Instagram', 'https://www.instagram.com/', 1],
    [22, 'Facebook', 'https://www.facebook.com/', 2],
    [23, 'TikTok', 'https://www.tiktok.com/', 3],
  ]),
  footerColumn(3, 'Help', 3, [[31, 'Returns', '/pages/returns', 1]]),
];
const footerSettings = { footer_copyright: '© 2026 Chen Furniture', footer_location_heading: 'Location' };

const footerAdmin = render(footerView({ groups: footerGroups, settings: footerSettings }));
for (const expected of [
  'Footer',
  'action="/admin/footer/group"',
  'action="/admin/footer/group/save"',
  'action="/admin/footer/group/move"',
  'action="/admin/footer/group/delete"',
  'action="/admin/footer/link"',
  'action="/admin/footer/link/save"',
  'action="/admin/footer/link/move"',
  'action="/admin/footer/link/delete"',
  'action="/admin/footer/location"',
  'value="Company"',
  'value="Follow"',
  'value="/pages/about"',
  'value="https://www.instagram.com/"',
  'value="Location"',
]) {
  if (!footerAdmin.includes(expected)) failures.push(`views: the footer admin screen is missing ${expected}`);
}

// The storefront renders those very columns, keeps the currency picker next to
// them and sends a link that leaves the site to a new tab.
const footerMarkup = render(storefrontFooter(footerSettings, footerGroups));
for (const expected of [
  '<h5 class="lh-sm fw-medium mb-4">Company</h5>',
  '<h5 class="lh-sm fw-medium mb-4">Follow</h5>',
  '>About</a>',
  'href="/pages/about"',
  'href="https://www.instagram.com/" target="_blank" rel="noopener"',
  'id="currency-selector"',
  'col-6 col-lg-3',
]) {
  if (!footerMarkup.includes(expected)) failures.push(`views: the storefront footer is missing ${expected}`);
}
// Two columns and the picker read as three equal thirds, as they always did.
const twoColumns = render(storefrontFooter(footerSettings, footerGroups.slice(0, 2)));
if (!twoColumns.includes('<div class="col-4">')) {
  failures.push('views: two footer columns plus the picker should keep the original thirds');
}

// 7. the footer form rules behind that screen
if (normalizeFooterLink({ label: 'FAQ', url: '/pages/faq' }).error) failures.push('admin: a valid footer link was rejected');
if (normalizeFooterLink({ label: 'Instagram', url: 'https://www.instagram.com/' }).error) {
  failures.push('admin: a social URL should be a valid footer link');
}
if (normalizeFooterLink({ label: 'Email', url: 'mailto:customerservice@chenfurniture.com' }).error) {
  failures.push('admin: a mailto footer link should be accepted');
}
if (normalizeFooterLink({ label: '  ', url: '/pages/faq' }).error !== 'label') {
  failures.push('admin: a footer link without words should be rejected');
}
if (normalizeFooterLink({ label: 'FAQ', url: 'pages/faq' }).error !== 'url') {
  failures.push('admin: a footer link that is neither a path nor a URL should be rejected');
}
if (normalizeFooterLink({ label: 'FAQ', url: '' }).error !== 'url') {
  failures.push('admin: a footer link with no URL should be rejected');
}
if (normalizeFooterLink({ label: 'FAQ', url: '/pages/faq', enabled: '0' }).values.enabled !== 0) {
  failures.push('admin: an unchecked footer link should save 0');
}
if (normalizeFooterLink({ label: 'FAQ', url: '/pages/faq' }).values.position !== null) {
  failures.push('admin: an empty footer order should keep the current slot');
}
if (normalizeFooterGroup({ label: '' }).error !== 'heading') {
  failures.push('admin: a footer column without a heading should be rejected');
}
if (normalizeFooterGroup({ label: ' Company ' }).values.label !== 'Company') {
  failures.push('admin: a footer heading should be trimmed');
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s) found:\n`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `All good: ${files.length} modules parsed, ${products.length} products, ${collections.length} collections, admin + header views render.`
);


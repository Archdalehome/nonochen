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
  { categoryNav, header },
  { adminPage, categoriesView, categoryProductsView, loginView },
  { normalizeCategory, normalizeProduct },
] = await Promise.all([
  import(new URL('src/views/chrome.js', root).href),
  import(new URL('src/views/admin.js', root).href),
  import(new URL('src/lib/admin.js', root).href),
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
// cart) and in the mobile menu; the scraped mega menu must be gone for good.
const chrome = render(
  header(
    { announcement_text: 'Free Mainland UK Shipping On All Orders' },
    [{ label: 'Indoor', url: '/collections/indoor-range', columns: [], promos: [] }],
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

if (failures.length) {
  console.error(`\n${failures.length} problem(s) found:\n`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `All good: ${files.length} modules parsed, ${products.length} products, ${collections.length} collections, admin + header views render.`
);


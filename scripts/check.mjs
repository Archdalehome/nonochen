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

if (failures.length) {
  console.error(`\n${failures.length} problem(s) found:\n`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`All good: ${files.length} modules parsed, ${products.length} products, ${collections.length} collections.`);


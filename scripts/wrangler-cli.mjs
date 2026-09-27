/**
 * Shared helpers for the maintenance scripts: locating the vendored Wrangler
 * CLI, reading wrangler.jsonc, walking ./images and running small task pools.
 *
 * Nothing here talks to the network on its own - it only wraps the CLI.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const imagesDir = join(root, 'images');
export const migrationsDir = join(root, 'migrations');
export const WRANGLER_BIN = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

/** Resolves once the Wrangler process exits, with its combined output. */
export function wrangler(args, { quiet = false, forward = true } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!existsSync(WRANGLER_BIN)) {
      rejectPromise(new Error('wrangler is not installed - run `npm install` first'));
      return;
    }
    const child = spawn(process.execPath, [WRANGLER_BIN, ...args], {
      cwd: root,
      // CI keeps Wrangler from prompting (stdin is not a TTY here).
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk, stream) => {
      output += chunk;
      if (forward) stream.write(chunk);
    };
    child.stdout.on('data', (chunk) => collect(chunk, quiet ? { write: () => {} } : process.stdout));
    child.stderr.on('data', (chunk) => collect(chunk, process.stderr));
    child.on('error', rejectPromise);
    child.on('close', (code) => resolvePromise({ code, output }));
  });
}

/** Minimal JSONC reader - enough for wrangler.jsonc (comments + trailing commas). */
export function readConfig() {
  const text = readFileSync(join(root, 'wrangler.jsonc'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'])\/\/[^\n]*/g, '$1')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}

/** The R2 bucket the MEDIA binding points at (and the D1 database name). */
export function bindings() {
  const config = readConfig();
  const bucket = (config.r2_buckets || [])[0] || {};
  const db = (config.d1_databases || [])[0] || {};
  return {
    bucket: bucket.bucket_name,
    database: db.database_name || db.binding,
    assets: (config.assets && config.assets.directory) || null,
  };
}

/** Every migration, in filename order, as paths relative to the repo root. */
export const migrationFiles = () =>
  readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => `migrations/${file}`);

/** Every file under ./images, recursively, using forward slashes. */
export function imageFiles(directory = imagesDir, base = directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) imageFiles(full, base, found);
    else found.push(relative(base, full).split(sep).join('/'));
  }
  return found.sort();
}

const MIME = {
  '.avif': 'image/avif',
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const mimeType = (file) => MIME[extname(file).toLowerCase()] || 'application/octet-stream';

export const fileSize = (file) => statSync(join(imagesDir, file)).size;

export const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}mb` : `${Math.max(1, Math.round(bytes / 1024))}kb`;

/** Runs `worker(item, index)` over `items`, keeping `limit` of them in flight. */
export async function pool(items, limit, worker) {
  const results = [];
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Turns a shell-style glob (`hero-*.png`) into a regex. */
export const globToRegExp = (glob) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}$`);

/** Parses the flags shared by the maintenance scripts. */
export function parseArgs(argv, { target = 'local' } = {}) {
  const args = {
    target,
    dryRun: false,
    only: [],
    concurrency: 6,
    retries: 3,
    dbOnly: false,
    skipDb: false,
    mediaOnly: false,
    withMedia: false,
    skipCopy: false,
    reset: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--remote') args.target = 'remote';
    else if (arg === '--local') args.target = 'local';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--db-only') args.dbOnly = true;
    else if (arg === '--skip-db') args.skipDb = true;
    else if (arg === '--media-only') args.mediaOnly = true;
    else if (arg === '--with-media') args.withMedia = true;
    else if (arg === '--skip-copy') args.skipCopy = true;
    else if (arg === '--reset') args.reset = true;
    else if (arg === '--only') args.only.push(argv[++i] || '');
    else if (arg.startsWith('--only=')) args.only.push(arg.slice('--only='.length));
    else if (arg === '--concurrency') args.concurrency = Math.max(1, Number(argv[++i]) || 6);
    else if (arg.startsWith('--concurrency=')) args.concurrency = Math.max(1, Number(arg.split('=')[1]) || 6);
    else if (arg === '--retries') args.retries = Math.max(1, Number(argv[++i]) || 3);
    else if (arg.startsWith('--retries=')) args.retries = Math.max(1, Number(arg.split('=')[1]) || 3);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else args.unknown = [...(args.unknown || []), arg];
  }
  return args;
}

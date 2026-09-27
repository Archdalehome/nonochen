/**
 * Bootstraps the replica:
 *   1. copies ./images into public/images so /images/* resolves as a static
 *      asset before any R2 object exists,
 *   2. applies every migration in ./migrations to D1,
 *   3. optionally pushes ./images into the R2 bucket bound to MEDIA.
 *
 *   node scripts/setup.mjs                      # assets + local D1
 *   node scripts/setup.mjs --with-media         # ... and local R2 media
 *   node scripts/setup.mjs --reset              # wipe local D1/R2 state first
 *   node scripts/setup.mjs --db-only            # migrations only
 *   node scripts/setup.mjs --remote --db-only   # the deployed D1 database
 *   node scripts/setup.mjs --dry-run            # show what would happen
 *
 * `wrangler d1 migrations apply` records what it has already run in the
 * d1_migrations table, so this is safe to call repeatedly.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

import { bindings, imageFiles, migrationFiles, parseArgs, root, wrangler, WRANGLER_BIN } from './wrangler-cli.mjs';

const HELP = `
Bootstraps assets and D1 (and optionally R2) for the replica.

  node scripts/setup.mjs [--local | --remote] [options]

  --local         use the local simulator (default, used by \`npm run dev\`)
  --remote        use the deployed database and bucket
  --db-only       apply migrations only
  --media-only    upload ./images to R2 only
  --with-media    do both
  --skip-copy     do not mirror ./images into public/images
  --reset         delete .wrangler/state before migrating (local only)
  --dry-run       print the commands without running them
  --help          show this message
`;

/** Mirrors ./images into public/images, skipping files that are already there. */
const copyImages = (files, { dryRun }) => {
  let copied = 0;
  for (const file of files) {
    const from = join(root, 'images', file);
    const to = join(root, 'public', 'images', file);
    const current = existsSync(to) ? statSync(to) : null;
    if (current && current.size === statSync(from).size && current.mtimeMs >= statSync(from).mtimeMs) continue;
    copied++;
    if (dryRun) continue;
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  // Wrangler always ignores these two names; writing the file keeps the
  // public directory self-describing.
  if (!dryRun) writeFileSync(join(root, 'public', '.assetsignore'), '_worker.js\n_routes.json\n');
  return copied;
};

const args = parseArgs(process.argv.slice(2));

if (args.help || args.unknown) {
  console.log(HELP.trim());
  if (args.unknown) {
    console.error(`\nUnknown option(s): ${args.unknown.join(', ')}`);
    process.exitCode = 1;
  }
} else {
  const { database, bucket, assets } = bindings();
  const migrations = migrationFiles();
  const images = imageFiles();
  const where = args.target === 'remote' ? '--remote' : '--local';
  const media = args.mediaOnly || args.withMedia;
  const db = !args.mediaOnly;

  console.log(`Target      : ${args.target}`);
  console.log(`Database    : ${database}`);
  console.log(`Bucket      : ${bucket || '(none configured)'}`);
  console.log(`Assets dir  : ${assets}`);
  console.log(`Migrations  : ${migrations.length} (${migrations.join(', ')})`);
  console.log(`Media files : ${images.length}`);

  if (!existsSync(WRANGLER_BIN)) {
    console.error('\nwrangler is not installed - run `npm install` first.');
    process.exit(1);
  }

  if (args.reset) {
    if (args.target === 'remote') {
      console.error('\nRefusing to reset: --reset only works against the local simulator.');
      process.exit(1);
    }
    const state = join(root, '.wrangler', 'state', 'v3');
    console.log(`\nReset       : ${args.dryRun ? 'would delete' : 'deleting'} ${state}`);
    if (!args.dryRun) rmSync(state, { recursive: true, force: true });
  }

  const failed = [];

  if (!args.skipCopy) {
    const pending = copyImages(images, { dryRun: true });
    console.log(`\n> mirror ${images.length} file(s) from ./images into public/images (${pending} need copying)`);
    if (args.dryRun) console.log('  dry run - not executed');
    else copyImages(images, { dryRun: false });
  }

  if (db) {
    const command = ['d1', 'migrations', 'apply', database, where];
    console.log(`\n> wrangler ${command.join(' ')}`);
    if (args.dryRun) console.log('  dry run - not executed');
    else {
      const { code } = await wrangler(command);
      if (code !== 0) failed.push('d1 migrations apply');
    }
  }

  if (media) {
    const command = [join(root, 'scripts', 'upload-media.mjs'), where];
    console.log(`\n> node scripts/upload-media.mjs ${where}`);
    if (args.dryRun) console.log('  dry run - not executed');
    else {
      const code = await new Promise((resolve) => {
        const child = spawn(process.execPath, command, { cwd: root, stdio: 'inherit' });
        child.on('close', resolve);
      });
      if (code !== 0) failed.push('upload-media');
    }
  }

  if (failed.length) {
    console.error(`\n${failed.join(' and ')} failed.`);
    if (args.target === 'remote') console.error('Remote runs need `npx wrangler login` and a real database_id in wrangler.jsonc.');
    else console.error('A local failure is usually a half-applied migration: retry with `node scripts/setup.mjs --reset`.');
    process.exit(1);
  }

  console.log('\nDone.');
  if (args.target === 'local') {
    console.log('Next: `npm run dev`, then open http://localhost:8787/');
    if (!media) console.log('Optional: `npm run media:local` to serve /images/* from the local R2 bucket.');
  } else {
    console.log('Next: `npm run deploy` (`npx wrangler deploy --dry-run` inspects the bundle without publishing).');
    if (!media) console.log('Optional: `npm run media:remote` to push ./images into the deployed bucket.');
  }
}

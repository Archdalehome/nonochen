/**
 * Uploads every file in ./images to the R2 bucket the MEDIA binding points at
 * (el-media), keeping the `images/` prefix so the objects line up with the
 * `/images/*` route in src/index.js.
 *
 *   npm run media:local                      # local R2 simulator, for wrangler dev
 *   npm run media:remote                     # the real bucket
 *   node scripts/upload-media.mjs --remote --only "hero-*.png" --dry-run
 *   node scripts/upload-media.mjs --remote --only "*.mp4" --concurrency 2
 */
import { bindings, fileSize, formatSize, globToRegExp, imageFiles, mimeType, parseArgs, pool, wrangler } from './wrangler-cli.mjs';

const HELP = `
Uploads ./images to the MEDIA R2 bucket.

  node scripts/upload-media.mjs [--local | --remote] [options]

  --local            write to the local R2 simulator (default)
  --remote           write to the deployed bucket
  --only <glob>      repeatable filter, e.g. --only "hero-*"
  --concurrency <n>  parallel uploads, default 6
  --retries <n>      attempts per object, default 3
  --dry-run          list what would be uploaded
  --help             show this message
`;

const args = parseArgs(process.argv.slice(2));
if (args.help || args.unknown) {
  console.log(HELP.trim());
  if (args.unknown) {
    console.error(`\nUnknown option(s): ${args.unknown.join(', ')}`);
    process.exitCode = 1;
  }
} else {
  const { bucket } = bindings();
  if (!bucket) {
    console.error('wrangler.jsonc has no r2_buckets entry to upload to.');
    process.exit(1);
  }

  const filters = args.only.filter(Boolean).map(globToRegExp);
  const files = imageFiles().filter((file) => !filters.length || filters.some((filter) => filter.test(file)));

  if (!files.length) {
    console.log('Nothing to upload - run `npm run media:fetch` to download ./images first.');
  } else {
    const where = args.target === 'remote' ? 'remote' : 'local';
    console.log(`Uploading ${files.length} object(s) to ${bucket} (${where})\n`);

    const failures = await pool(files, args.concurrency, async (file) => {
      const key = `images/${file}`;
      const size = formatSize(fileSize(file));
      const type = mimeType(file);
      if (args.dryRun) {
        console.log(`  dry   ${key}  ${size}  ${type}`);
        return null;
      }
      // Parallel `wrangler r2 object put` runs occasionally die on the shared
      // local simulator state, so a failed object is retried a few times.
      for (let attempt = 1; attempt <= args.retries; attempt++) {
        const { code, output } = await wrangler(
          ['r2', 'object', 'put', `${bucket}/${key}`, `--file=images/${file}`, `--content-type=${type}`, `-y`, `--${where}`],
          { quiet: true }
        );
        if (code === 0) {
          console.log(`  ok    ${key}  ${size}${attempt > 1 ? `  (attempt ${attempt})` : ''}`);
          return null;
        }
        if (attempt === args.retries) {
          console.log(`  FAIL  ${key}\n${output.trim().split('\n').slice(-3).join('\n')}`);
          return file;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
      return null;
    });

    const failed = failures.filter(Boolean);
    console.log(`\n${files.length - failed.length} of ${files.length} uploaded to ${bucket} (${where}).`);
    if (failed.length) {
      console.error(`Failed: ${failed.join(', ')}`);
      process.exit(1);
    }
    if (where === 'local') console.log('Local objects are served by `npm run dev`; use `npm run media:remote` before deploying.');
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'images');
const MANIFEST = path.join(__dirname, 'data', 'media.json');
fs.mkdirSync(IMG_DIR, { recursive: true });

// Every asset that ships with the replica. Re-fetch them with:
//    npm run media:fetch -- --origin https://the-storefront-they-came-from
// The manifest maps a local file name in ./images to the *path* the asset was
// captured from, so no third party host name is baked into this repo. The origin
// has to be supplied at run time (or through MEDIA_ORIGIN).
const args = process.argv.slice(2);
const originFlag = args.indexOf('--origin');
const ORIGIN = (originFlag >= 0 ? args[originFlag + 1] : '') || process.env.MEDIA_ORIGIN || '';
if (!/^https?:\/\//.test(ORIGIN)) {
  console.error('Usage: npm run media:fetch -- --origin https://<the storefront the media was captured from>');
  process.exit(1);
}
const absolute = (source) => new URL(source, ORIGIN).toString();

const media = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

async function download(item) {
  const dest = path.join(IMG_DIR, item.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log('skip  ' + item.file);
    return true;
  }
  const url = absolute(item.source);
  try {
    if (item.maxBytes) {
      const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
      const size = head ? Number(head.headers.get('content-length') || 0) : 0;
      if (size && size > item.maxBytes) {
        console.log('skip  ' + item.file + ' (too large: ' + (size / 1024 / 1024).toFixed(1) + 'mb)');
        return true;
      }
    }
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; site-replica)' } });
    if (!res.ok) {
      console.log('FAIL  ' + res.status + ' ' + item.file);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log('ok    ' + item.file + '  ' + (buf.length / 1024).toFixed(0) + 'kb');
    return true;
  } catch (err) {
    console.log('ERR   ' + item.file + '  ' + err.message);
    return false;
  }
}

let failed = 0;
for (const item of media) {
  const ok = await download(item);
  if (!ok) failed++;
}
console.log('\nfailed: ' + failed + ' of ' + media.length);

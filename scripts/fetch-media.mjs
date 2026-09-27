import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'images');
const MANIFEST = path.join(__dirname, 'data', 'media.json');
fs.mkdirSync(IMG_DIR, { recursive: true });

// Every asset that ships with the replica. Fetch with:
//    npm run media:fetch
// The manifest maps a local file name in ./images to the original CDN url.
const media = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

async function download(item) {
  const dest = path.join(IMG_DIR, item.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log('skip  ' + item.file);
    return true;
  }
  try {
    if (item.maxBytes) {
      const head = await fetch(item.url, { method: 'HEAD' }).catch(() => null);
      const size = head ? Number(head.headers.get('content-length') || 0) : 0;
      if (size && size > item.maxBytes) {
        console.log('skip  ' + item.file + ' (too large: ' + (size / 1024 / 1024).toFixed(1) + 'mb)');
        return true;
      }
    }
    const res = await fetch(item.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; site-replica)' } });
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

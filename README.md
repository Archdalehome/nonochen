# Extreme Lounging - Cloudflare Workers replica

A from-scratch Cloudflare Workers implementation of the extremelounging.com
storefront: server-rendered HTML views, D1 for the catalogue + carts, R2 (with a
static-asset fallback) for the product imagery. No framework, no bundler step -
just `wrangler.jsonc`, SQL migrations and tagged-template views.

> The copy, photography and trademarks belong to Extreme Lounging Ltd. This is a
> technical exercise (local `wrangler dev`, optional throwaway deploy), not a
> production storefront to point customers at.

## Stack

| piece | detail |
| --- | --- |
| runtime | Workers module syntax, built-in `fetch` only, no dependencies at runtime |
| routes | `src/index.js` - pages, `/cart/*`, `/checkout`, `/search`, `/sitemap.xml`, `/robots.txt`, `/images/*` |
| views | `src/views/*.js` tagged-template helpers (`src/lib/html.js`) |
| data | D1 `el_store`, created by `migrations/0001_schema.sql` + `0002_seed.sql` (+ `0003_cart_items_detail.sql`) |
| media | R2 `el-media` bound as `MEDIA`; `/images/*` streams the object with an `immutable` cache header and falls back to the mirrored copy in `public/images` |
| assets | `public/` (`css/site.css`, `js/site.js`, `images/`) served by the assets binding with `run_worker_first`, so dynamic routes always win |
| tooling | Node 18+ and Wrangler 4 (the only devDependency) |

## First run

```bash
npm install
npm run setup        # mirror ./images -> public/images, apply migrations to the local D1
npm run media:local  # optional: copy ./images into the local R2 bucket
npm run dev          # http://localhost:8787
```

With `npm run dev` running:

```bash
npm run smoke                # pages, static assets, 404s, /images/*, cart round trip
npm run check                # syntax-check every module, render views against the seed
```

`npm run smoke` takes an optional base URL, so the same script verifies the
deployed Worker: `npm run smoke -- https://extreme-lounging.<subdomain>.workers.dev`.
`_scratch/` holds the scraped reference dumps the views were authored from and is
git-ignored.

## Commands

| command | what it does |
| --- | --- |
| `npm run dev` | `wrangler dev` on http://localhost:8787 with local D1, R2 and assets |
| `npm run setup` | `scripts/setup.mjs` - mirror `./images` + `d1 migrations apply` |
| `npm run db:local` / `db:remote` | migrations only |
| `npm run media:local` / `media:remote` | upload `./images` to the `MEDIA` bucket |
| `npm run media:fetch` | re-download `./images` from the original CDN (manifest: `scripts/data/media.json`) |
| `npm run seed:build` | regenerate `migrations/0002_seed.sql` from `scripts/data/*` |
| `npm run check` | local sanity check (parse + render) |
| `npm run smoke` | HTTP smoke test against `wrangler dev` or a deployment |
| `npm run deploy` | publish with `wrangler deploy` |

Flags: `scripts/setup.mjs` takes `--local|--remote`, `--db-only`, `--media-only`,
`--with-media`, `--skip-copy`, `--reset`, `--dry-run`; `scripts/upload-media.mjs`
takes `--local|--remote`, `--only <glob>`, `--concurrency <n>`, `--retries <n>`,
`--dry-run`.

## Deploying

The bindings in `wrangler.jsonc` already point at provisioned resources on the
`chenfurnitureco@gmail.com` account:

- D1 `el_store` - `ddcc120e-87bc-408a-bbc4-9d2c7f36569a`
- R2 `el-media`

```bash
npx wrangler login
npx wrangler d1 create el_store         # only on a fresh account - copy the id into wrangler.jsonc
npx wrangler r2 bucket create el-media  # only on a fresh account
node scripts/setup.mjs --remote --with-media   # migrate D1 + push ./images to R2
npx wrangler deploy --dry-run           # inspect the bundle without publishing
npm run deploy                          # publishes extreme-lounging.<subdomain>.workers.dev
```

`npm run deploy` publishes scraped content to a public URL, so committing to
`main` (see below) is the intended way to release.

Two things to know when switching accounts:

1. local dev keeps its SQLite file and R2 objects under `.wrangler/state/v3`,
   keyed by `database_id`, so after changing the id re-run `npm run setup`;
2. `wrangler d1 migrations apply` can only reach the remote database once
   `database_id` is a real UUID - a placeholder id fails with
   `Invalid property: databaseId => Invalid uuid [code: 7400]`.

## Continuous deployment

`.github/workflows/deploy.yml` publishes the Worker on every push to `main`, and
can also be started by hand from the Actions tab (or `gh workflow run deploy.yml`):

1. `npm ci` then `npm run check` - nothing ships if a view stops parsing or rendering;
2. `node scripts/setup.mjs --remote --db-only` - mirrors `./images` into `public/`
   for the assets binding and applies any new `migrations/*.sql` to the remote D1;
3. `npm run deploy` - uploads the Worker, captures the `*.workers.dev` URL and
   runs `scripts/smoke.mjs` against it: home, `/products`, a product page,
   `/collections`, `/cart`, `/cart/drawer`, `/search`, `sitemap.xml`,
   `robots.txt`, the CSS/JS assets and `/images/*` all have to answer, the cart
   round trip has to work against the real D1, and `/wrangler.jsonc`,
   `/src/...`, `/migrations/...` have to keep returning 404;
4. if the push touched `images/`, `npm run media:remote` syncs the bucket (a push
   that only changes code skips it);
5. the Wrangler log is uploaded as a build artifact when a deploy fails.

The only secret it needs:

| secret | where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard -> My Profile -> API Tokens -> Create Token. The **Edit Cloudflare Workers** template covers Workers, D1 and R2; if you build it by hand you need *Account - Workers Scripts: Edit*, *Account - D1: Edit* and *Account - R2: Edit* |

`CLOUDFLARE_ACCOUNT_ID` is optional - the workflow falls back to the account in
this repo (`7357c2534797a4c04fc95ec58cc04a89`). Set it as a secret or variable if
you fork this onto another account. Add the secret with
`gh secret set CLOUDFLARE_API_TOKEN`, or in the repo under *Settings -> Secrets
and variables -> Actions*.

Deploys are serialised (`concurrency`) and a running deploy is never cancelled,
so two quick pushes queue up instead of racing each other. Until
`CLOUDFLARE_API_TOKEN` exists the job stops on the first step with a
`Missing CLOUDFLARE_API_TOKEN` annotation instead of failing inside Wrangler.

## Layout

```
wrangler.jsonc        bindings: DB (D1), MEDIA (R2), ASSETS, vars
.github/workflows/    deploy.yml - the auto-deploy pipeline described above
migrations/           D1 schema + generated seed
public/               css/site.css, js/site.js, images/ (generated by `npm run setup`)
images/               scraped product imagery (source of truth for R2 + assets)
scripts/              setup.mjs, upload-media.mjs, wrangler-cli.mjs (shared helpers),
                      fetch-media.mjs, build-seed.mjs, check.mjs, smoke.mjs, data/
src/index.js          router + request handlers
src/lib/              html.js (templates), db.js (queries), cart.js (cart + cookies)
src/views/            layout, chrome, home, product, collection, cart, cart-drawer, ...
_scratch/             scraped dumps used while writing the views (git-ignored)
```

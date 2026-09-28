# Chen Furniture - Cloudflare Workers storefront

A from-scratch Cloudflare Workers storefront for Chen Furniture: server-rendered
HTML views, D1 for the catalogue + carts, R2 (with a static-asset fallback) for
the product imagery. No framework, no bundler step - just `wrangler.jsonc`, SQL
migrations and tagged-template views.

> The demo catalogue, copy and photography were captured from a public storefront
> and stay the property of their original owner. Treat this as a technical
> exercise rather than a production shop to point customers at.

## Stack

| piece | detail |
| --- | --- |
| runtime | Workers module syntax, built-in `fetch` only, no dependencies at runtime |
| routes | `src/index.js` - pages, `/cart/*`, `/checkout`, `/search`, `/sitemap.xml`, `/robots.txt`, `/images/*` |
| views | `src/views/*.js` tagged-template helpers (`src/lib/html.js`) |
| data | D1 `el_store`, created by `migrations/0001_schema.sql` + `0002_seed.sql` (+ `0003_cart_items_detail.sql`, `0004_rebrand.sql`) |
| media | R2 `el-media` bound as `MEDIA`; `/images/*` streams the object with an `immutable` cache header and falls back to the mirrored copy in `public/images` |
| assets | `public/` (`css/site.css`, `js/site.js`, `images/`) served by the assets binding with `run_worker_first`, so dynamic routes always win |
| tooling | Node 22+ (Wrangler 4 refuses to run on less) and Wrangler 4 (the only devDependency) |

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
deployed Worker: `npm run smoke -- https://chen-furniture.<subdomain>.workers.dev`.
`_scratch/` holds the scraped reference dumps the views were authored from and is
git-ignored.

## Commands

| command | what it does |
| --- | --- |
| `npm run dev` | `wrangler dev` on http://localhost:8787 with local D1, R2 and assets |
| `npm run setup` | `scripts/setup.mjs` - mirror `./images` + `d1 migrations apply` |
| `npm run db:local` / `db:remote` | migrations only |
| `npm run media:local` / `media:remote` | upload `./images` to the `MEDIA` bucket |
| `npm run media:fetch` | re-download `./images` from the storefront they came from: `npm run media:fetch -- --origin https://example.com` (manifest: `scripts/data/media.json`, which keeps paths only) |
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
npm run deploy                          # publishes chen-furniture.<subdomain>.workers.dev
```

`npm run deploy` publishes the demo catalogue to a public URL, so committing to
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
2. `node scripts/setup.mjs --skip-db` - mirrors `./images` into `public/` so the
   assets binding always carries the local copies;
3. `npx wrangler d1 migrations list <db> --remote` probes whether the token may
   talk to D1 at all. If it may, `node scripts/setup.mjs --remote --db-only`
   applies any new `migrations/*.sql`; if it may not, that step is skipped with a
   warning telling you to run `npm run db:remote` from a machine with
   `npx wrangler login` (or to add *D1: Edit* to the token);
4. `npm run deploy` - uploads the Worker, captures the `*.workers.dev` URL and
   runs `scripts/smoke.mjs` against it: home, `/products`, a product page,
   `/collections`, `/cart`, `/cart/drawer`, `/search`, `sitemap.xml`,
   `robots.txt`, the CSS/JS assets and `/images/*` all have to answer, the cart
   round trip has to work against the real D1, the product categories have to
   render in the header row and in the mobile menu and one of their links has to
   answer, and the admin area has to sign in with `SMOKE_ADMIN_USER` /
   `SMOKE_ADMIN_PASSWORD`,
   add a hidden `smoke-<timestamp>` category, reject a duplicate slug and a bad
   slug, edit it, move it, delete it again and sign out - all against the live
   D1 (`/wrangler.jsonc`, `/src/...`, `/migrations/...` have to keep returning
   404 as well);
5. if the push touched `images/`, `npm run media:remote` syncs the bucket (a push
   that only changes code skips it);
6. the Wrangler log is uploaded as a build artifact when a deploy fails.

The only secret it needs:

| secret | where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard -> My Profile -> API Tokens -> Create Token. The **Edit Cloudflare Workers** template covers Workers, D1 and R2; if you build it by hand you need *Account - Workers Scripts: Edit*, *Account - D1: Edit* and *Account - R2: Edit* |

Without *Account - D1: Edit* the pipeline still deploys code: the probe above
fails, the migration step is skipped and the run prints a `D1 migrations were
skipped` warning instead of stopping.

`CLOUDFLARE_ACCOUNT_ID` is optional - the workflow falls back to the account in
this repo (`7357c2534797a4c04fc95ec58cc04a89`). Set it as a secret or variable if
you fork this onto another account. Add the secret with
`gh secret set CLOUDFLARE_API_TOKEN`, or in the repo under *Settings -> Secrets
and variables -> Actions*.

Deploys are serialised (`concurrency`) and a running deploy is never cancelled,
so two quick pushes queue up instead of racing each other. Until
`CLOUDFLARE_API_TOKEN` exists the job stops on the first step with a
`Missing CLOUDFLARE_API_TOKEN` annotation instead of failing inside Wrangler.

## Admin (`/admin`)

A small admin area manages the **product categories**: the row of links in the
header, next to the logo and the search/cart icons, on every page (they are
listed at the top of the mobile menu as well).

* `/admin/login` - sign in with **admin / admin** (see below to change it)
* `/admin/categories` - add, rename, reorder, hide and delete categories

Each row controls:

| field | meaning |
| --- | --- |
| name | the label shown in the header |
| slug | the unique key, also used for `/category/<slug>` |
| link override | optional - empty means the label links at `/category/<slug>`; set it to reuse an existing page such as `/collections/outdoor-range` |
| products shown | `collection` (everything in a collection), `tag` (products whose `cat_handle` / `cat_label` matches) or `all products` |
| order | position in the header row - the arrows move a row one step |
| visible | unchecked rows stay in the admin but leave the storefront |

Edits are written to the D1 `categories` table (created and seeded by
`migrations/0005_categories.sql`) and appear straight away: the storefront
memoises the list for 30 seconds per Worker isolate and the admin invalidates it
on every write. Only `position` is compared, so deleting a row can leave a gap
(the seeded ten may read 1..9, 11 after the deploy smoke test has created and
removed its own row) - the admin list and the storefront show the same order
either way.

The migration is idempotent (`create table if not exists`, `insert or ignore`),
so applying it twice - for example once by hand and once by the pipeline - is
harmless.

### Changing the password

```bash
npx wrangler secret put ADMIN_USER      # optional, defaults to admin
npx wrangler secret put ADMIN_PASSWORD  # defaults to admin - set this before sharing the URL
```

The session cookie is signed with the password, so changing it signs everybody
out. The admin screens are `noindex` and blocked in `robots.txt`, but the login
is the only protection there is - add the same values as `SMOKE_ADMIN_USER` /
`SMOKE_ADMIN_PASSWORD` repository secrets so the deploy smoke test (and
`npm run smoke`) keeps passing.

## Editing the content

Only the top categories have an admin UI; everything else lives in Cloudflare and
can be changed without a deploy:

| what | where |
| --- | --- |
| copy, menus, homepage blocks, products, carts | D1 `el_store` - Cloudflare dashboard -> *Workers & Pages -> D1 -> el_store -> Console*, or `npx wrangler d1 execute el_store --remote --command "select * from settings"` |
| the header categories | `/admin/categories` (see above), or the `categories` table directly |
| images and video | R2 `el-media` - dashboard -> *R2 -> el-media -> Objects*, or drop files into `./images` and run `npm run media:remote` |
| the defaults used to (re)seed a database | `scripts/data/content.mjs`, then `npm run seed:build`, then `npm run db:remote` |
| worker name, vars, bindings | `wrangler.jsonc` (a change there needs a `git push` to take effect) |
| deploy history, logs, secrets | GitHub -> *Actions*, and dashboard -> *Workers & Pages -> chen-furniture -> Deployments / Logs / Settings* |

## Layout

```
wrangler.jsonc        bindings: DB (D1), MEDIA (R2), ASSETS, vars
.github/workflows/    deploy.yml - the auto-deploy pipeline described above
migrations/           D1 schema + generated seed
public/               css/site.css, js/site.js, images/ (generated by `npm run setup`)
images/               scraped product imagery (source of truth for R2 + assets)
scripts/              setup.mjs, upload-media.mjs, wrangler-cli.mjs (shared helpers),
                      fetch-media.mjs, build-seed.mjs, check.mjs, smoke.mjs, data/
src/index.js          router + request handlers (storefront + /admin)
src/lib/              html.js (templates), db.js (queries), cart.js (cart + cookies),
                      cookies.js (cookie helpers), admin.js (login, session, category rules)
src/views/            layout, chrome (incl. the header categories), home, product,
                      collection, cart, cart-drawer, admin (login + category manager), ...
_scratch/             scraped dumps used while writing the views (git-ignored)
```

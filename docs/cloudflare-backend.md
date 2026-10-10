# Cloudflare backend

## Current state

The whole site runs on Cloudflare: journal, the photo library, food (+ AI analysis), workouts (+ AI analysis and stats), airport visits, books and recommendations, plus the public homepage, gallery, airports map and bookshelf. The Supabase code is gone from the app; Fits, AI request logs and the AI config page were dropped rather than migrated. The local Next.js app talks to the production Cloudflare backend. **Supabase itself is untouched** and still serves the currently deployed Vercel build until this branch ships; `scripts/migrate/` (read-only against Supabase) is kept for the final sync.

**One shared backend for the entire application**: one Worker, one D1 database, one private photo bucket. New features add tables (numbered SQL migrations) and routes to it — never a separate database or bucket.

## Code layout

| Path | Role |
| --- | --- |
| `cloudflare/` | The Worker: `src/index.ts`, D1 `migrations/`, `cloudflare.config.ts` |
| `shared/` | Request/response schemas used by both Next.js and the Worker |
| `lib/backend/` | Next.js side: owner auth (`api.ts`), config (`config.ts`), Worker client (`worker.ts`), private R2 upload URLs (`r2.ts`) |
| `app/api/admin/*` | Thin authenticated Next.js routes that proxy to the Worker |
| `app/admin/(app)/` | Admin pages inside `AdminShell` (tab bar on phones, top bar on desktop) |
| `components/admin/kit.tsx` | Shared admin pieces: page header, "+" button, record card, editor sheet, list loader, delete with undo |
| `components/admin/{journal,food,workouts,airports,books,photos}/` | One component per admin page, each a list plus an editor sheet |
| `lib/backend/public-data.ts` | Public pages' data, read on the server and cached under one tag that every admin change expires (`privateRoute`) |

| Resource | Production |
| --- | --- |
| Worker | `personal-website-backend` |
| API | `https://personal-website-backend.lakshyaag1202.workers.dev` |
| D1 | `personal-website-production` (`6302f028-7188-46d5-8077-8a7fbfd0cc95`) |
| Private photo bucket | `personal-website-production-private` |

**Workers Free plan.** Each request gets ~10–50 ms of CPU, so the Worker must never process images or other heavy payloads. It only does D1 queries, R2 metadata checks, streaming and waiting on the AI provider (wall-clock time, not CPU). There is no queue.

## AI analysis

Food and workout entries are analyzed by Prime Intellect (`z-ai/glm-5.3-flash`, the `AI_MODEL` value in `cloudflare.config.ts`; key in the `PRIME_API_KEY` secret) through its OpenAI-compatible API with a JSON schema response. `POST /v1/{food,workouts}/:id/analyze` runs it.

- **Photos** are sent as short-lived signed links (`/signed/photos/:id/:generation/display?expires=…&sig=…`, HMAC, 10 minutes) that the provider fetches itself. The Worker never downloads or encodes images.
- **When:** after a save that leaves an entry unanalyzed, the Next.js route runs analysis in `after()`, like the old Supabase webhook. A failure only leaves the "Analyze" button. Saving keeps the analysis unless the description/photos (food) or text (workout) changed.
- Results are written only if the entry wasn't edited during analysis. Total workout volume is computed, not taken from the model. Loose answers ("510 kcal", "8-10 reps", "bodyweight") are coerced.

## Photos

One library for every feature. `photos` holds the file plus library metadata; `photo_links(context, context_id, position)` attaches photos to journal, food, workout and visit records.

- **Uploads:** the browser (`components/admin/photo-variants.ts`) decodes the image, makes a 2048 px display and a 480 px thumbnail (WebP, or JPEG where the browser can't encode WebP), and reads capture time/GPS/camera with `shared/exif.ts`. It PUTs original + variants straight to R2 via presigned URLs, then `POST /photos/:id/complete` records the metadata after the Worker checks all three objects exist. Canvas encoding writes no EXIF, so GPS never reaches a served image.
- **Serving:** private variants only through the authenticated admin API. Public photos at `GET {worker}/public/photos/:id/:generation/(display|thumb)`, unauthenticated and cached forever. The URL contains the generation and only works while the photo is public.
- **Lifecycle:** private, unfeatured photos removed from their entry are deleted. Public or featured photos are library content and stay. Uploads abandoned for 24 hours are cleaned up by the 10-minute cron.
- **Location:** GPS is stored privately. The public gallery only exposes it when a photo's "show location" is on.

## Tooling: `cf` only

All Cloudflare commands go through **`cf`** and `cloudflare/cloudflare.config.ts`, which defines both modes:

- `production`: the resources above.
- `development`: local simulations named `personal-website-local*`.

There are no Wrangler config files and no `wrangler` commands. The `wrangler` package stays installed in `cloudflare/` only because `cf` calls it internally to bundle plain Workers. Don't run it or configure it directly.

| Command | What it does |
| --- | --- |
| `bun run worker:dev` | Local Worker on `http://localhost:8787` (`cf dev`, reads `cloudflare/.dev.vars`) |
| `bun run worker:migrate` | Apply D1 migrations to the local database |
| `bun run worker:check` | Production deploy dry run |
| `bun run worker:migrate:production` | Apply D1 migrations to production |
| `bun run worker:deploy` | Deploy to production (secrets from ignored `cloudflare/.secrets.production.json`) |

`cf dev` ignores forwarded flags such as `--port` and `--persist-to`. Local state always lives in `cloudflare/.wrangler/state`, which is why `worker:migrate` writes there.

## Run locally against production

`.env.local` is already configured. Saves, uploads, edits and deletes affect **production** Cloudflare. No local Worker is needed.

```sh
bun install && bun install --cwd cloudflare
bun run dev
```

Open `http://localhost:3000/admin/journal`. GitHub OAuth calls back to `http://localhost:3000/api/auth/callback/github`. The only allowed account is `lakshyaag` (numeric ID `10924399`).

```dotenv
AUTH_URL=http://localhost:3000
ADMIN_GITHUB_ID=10924399
CLOUDFLARE_WORKER_URL=https://personal-website-backend.lakshyaag1202.workers.dev
CLOUDFLARE_WORKER_SECRET=<matches WORKER_API_SECRET>
LOCAL_WORKER_UPLOADS=false
R2_ACCOUNT_ID=<Cloudflare account ID>
PRIVATE_R2_BUCKET=personal-website-production-private
PRIVATE_R2_ACCESS_KEY_ID=<key scoped to the private bucket>
PRIVATE_R2_SECRET_ACCESS_KEY=<secret for that key>
```

The private bucket has public access disabled. Upload CORS currently allows only `http://localhost:3000`; see `cloudflare/r2-cors.example.json` for adding the Vercel origin.

To work fully offline instead, run `bun run worker:migrate && bun run worker:dev`. Then point `CLOUDFLARE_WORKER_URL` at `http://localhost:8787` and set `LOCAL_WORKER_UPLOADS=true`.

## Migrations (done)

28 entries and 4 photos were copied from Supabase. On 2026-10-10 they were re-verified against live Supabase: every ID, date, content body and photo link matched, and all 8 R2 objects (original + display per photo) exist. Supabase was never modified.

Entries have no stored time zone (migration `0002`). `date` is the calendar day the entry is about. `createdAt`/`updatedAt` are UTC instants, displayed in the viewer's local zone. The pre-change D1 time-travel bookmark is `000003db-00000000-00005100-65352c34d5a4cd97da21458b4778728e`.

Photos (2026-10-10): 82 Supabase photos imported with `scripts/migrate/photos.ts` (journal photos were already migrated). Every row, link and original checksum was verified against Supabase. Variants were regenerated locally with sharp. Gallery photos became `featured`, `gps_public` became `show_location`, and the single Fits photo stays in the library unlinked. Pre-change D1 bookmarks: `000003e5-…372d` (0003), `000003e9-…88a9` (0004).

The journal's one-off scripts were removed after its migration; `scripts/migrate/` is deleted the same way once every feature has moved. Backups and the import snapshot are in gitignored `migration-artifacts/`.

Food, workouts, visits, books (2026-10-10): `scripts/migrate/records.ts plan|apply|verify` copied 73 food entries, 23 workouts, 101 visits and 18 books (0 recommendations); verify checks every column of every row against Supabase. It also **rebuilt the food/workout/visit photo links**: Supabase's `photo_attachments` are keyed by upload folder (a date or airport code), not entry, so the photo import had linked them to nothing. Links now come from each entry's own `photos` refs (67 links). Photos referenced by no entry stay in the library as unused. The import is idempotent, so re-run `apply` + `verify` right before cutover to pick up anything written on the live site since. Pre-change D1 bookmark: `000003f1-00000000-00005100-02ad51510cbac6977e50890d779815f8` (0005).

## Remaining

1. Hosted site: set the Worker URL/secret and private R2 keys on Vercel, register a production GitHub OAuth app, and add the Vercel origin to R2 CORS.
2. Cut over: re-run `scripts/migrate/records.ts apply` + `verify` (and the photo import) so nothing written on the live site is missed, then deploy this branch. There is no switch any more: deploying it is the cutover.
3. Per-page UI work and a "today" admin home.
4. Retiring Supabase itself (and `scripts/migrate/`) only when explicitly decided.

## Tests

```sh
bun run lint
bun run typecheck
bun run test        # Next.js unit tests
bun run test:worker # Worker tests in isolated in-memory bindings
bun run test:e2e    # browser tests; serves the cf-built Worker via Miniflare on :8788
```

Tests never use production credentials or an authentication bypass.

Private media is authenticated and uncached. Upload links expire after five minutes; size, MIME type and conditional writes are signed. Jobs validate image contents and dimensions, generate metadata-free WebP displays, use generation-fenced leases, and recover through ten-minute scheduled jobs. Unattached photos expire after 24 hours; deletion uses tombstones and scheduled object cleanup.

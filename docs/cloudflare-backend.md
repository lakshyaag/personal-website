# Cloudflare backend

## Current state

The admin backend is moving from Supabase to Cloudflare. **Journal is migrated**; food, workouts, books, visits and the rest still run on Supabase. The local Next.js app talks to the production Cloudflare backend. Vercel hosting, Supabase, and the public `site-assets` bucket are unchanged.

**One shared backend for the entire application**: one Worker, one D1 database, one private photo bucket. New features add tables (numbered SQL migrations) and routes to it — never a separate database or bucket.

## Code layout

| Path | Role |
| --- | --- |
| `cloudflare/` | The Worker: `src/index.ts`, D1 `migrations/`, `cloudflare.config.ts` |
| `shared/` | Request/response schemas used by both Next.js and the Worker |
| `lib/backend/` | Next.js side: owner auth (`api.ts`), config (`config.ts`), Worker client (`worker.ts`), private R2 upload URLs (`r2.ts`) |
| `app/api/admin/*` | Thin authenticated Next.js routes that proxy to the Worker |

`ADMIN_BACKEND=cloudflare` switches the whole admin to this backend. Features that haven't moved yet are blocked in that mode rather than silently writing to Supabase. Any other value keeps the legacy Supabase admin, which is what Vercel runs until every feature has moved. Once that happens, delete the switch and the legacy code.

| Resource | Production |
| --- | --- |
| Worker | `personal-website-backend` |
| API | `https://personal-website-backend.lakshyaag1202.workers.dev` |
| D1 | `personal-website-production` (`6302f028-7188-46d5-8077-8a7fbfd0cc95`) |
| Private photo bucket | `personal-website-production-private` |
| Photo queue / dead-letter queue | `personal-website-production-photos` / `-photos-dlq` |

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
ADMIN_BACKEND=cloudflare
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

## Journal migration (done)

28 entries and 4 photos were copied from Supabase. On 2026-10-10 they were re-verified against live Supabase: every ID, date, content body and photo link matched, and all 8 R2 objects (original + display per photo) exist. Supabase was never modified.

Entries have no stored time zone (migration `0002`). `date` is the calendar day the entry is about. `createdAt`/`updatedAt` are UTC instants, displayed in the viewer's local zone. The pre-change D1 time-travel bookmark is `000003db-00000000-00005100-65352c34d5a4cd97da21458b4778728e`.

The one-off export/import scripts were removed after the migration. Backups and the import snapshot are in gitignored `migration-artifacts/`.

## Remaining

1. Hosted site: set the Worker URL/secret and private R2 keys on Vercel, register a production GitHub OAuth app, and add the Vercel origin to R2 CORS.
2. Migrate the other admin features into the same backend, one at a time.
3. UI/copy polish for the admin pages.

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

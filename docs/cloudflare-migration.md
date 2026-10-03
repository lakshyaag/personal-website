# Test the Cloudflare journal migration

Branch: `migration/cloudflare-journal`.

This is the **journal slice**, not the full backend migration. Supabase and the live Cloudflare account have not been changed. Public pages still use the old backend. Migration mode disables the other admin features so they cannot silently write to Supabase.

## Run the tests without credentials

```sh
bun install
bunx playwright install chromium
bun run lint
bun run typecheck
bun run test
bun run test:worker
bun run test:e2e
bun run migration:rehearse
```

Browser tests use encrypted Auth.js test sessions, a local Worker, local D1/R2, and the real local Images binding. There is **no production authentication bypass**. Tests do not exercise the real GitHub OAuth exchange. The synthetic migration rehearsal imports and verifies text, historical timestamps, photo relationships, original checksums, and metadata-free variants without accessing Supabase or remote Cloudflare resources.

Tests use `cloudflare/test/wrangler.jsonc` and separate local persistence. They do not read `cloudflare/.dev.vars`. Lint currently checks the migration code, not the unrelated legacy code.

## Try the UI locally

Keep your existing `.env.local`. **Do not overwrite its Supabase or public asset settings.** Add the migration variables from `.env.example`, then set:

```dotenv
JOURNAL_BACKEND=cloudflare
AUTH_URL=http://localhost:3000
AUTH_SECRET=<random secret>
AUTH_GITHUB_ID=<OAuth client ID>
AUTH_GITHUB_SECRET=<OAuth client secret>
ADMIN_GITHUB_ID=<your numeric GitHub ID>
CLOUDFLARE_WORKER_URL=http://localhost:8787
CLOUDFLARE_WORKER_SECRET=<a different random secret>
LOCAL_WORKER_UPLOADS=true
```

Generate each secret separately with `openssl rand -hex 32`. Placeholder values intentionally fail closed. Get your numeric ID with `gh api users/YOUR_BROWSER_GITHUB_USERNAME --jq .id`, replacing the username with the account you use in the browser. Do not use `gh api user` unless the CLI and browser use the same account. Usernames and emails are not used for authorization.

Create a GitHub OAuth app with this callback:

`http://localhost:3000/api/auth/callback/github`

Copy `cloudflare/.dev.vars.example` to `cloudflare/.dev.vars`. Set `WORKER_API_SECRET` to the same value as `CLOUDFLARE_WORKER_SECRET`. Keep `LOCAL_UPLOADS=true` there for local development.

Then run:

```sh
bun run worker:migrate
bun run worker:dev
# In another terminal:
bun run dev
```

Open `http://localhost:3000/admin/journal`. Local uploads do not require R2 credentials. Private photos use authenticated, uncached image routes, not Next.js image optimization.

Check text save/edit/delete, a past date, multiple photos, removal from an existing entry, a failed upload, and sign-out. Unsaved drafts remain in memory only; they are not written to browser storage.

## Staging setup—not production cutover

1. Use a stable Vercel preview hostname and a separate GitHub OAuth app. Set `AUTH_URL` and the OAuth callback to that hostname.
2. Create `personal-journal-staging` in D1 and put its ID in `cloudflare/wrangler.jsonc`.
3. Create `personal-journal-staging-private` in R2. **Disable public access and custom public domains. Do not reuse `site-assets`.**
4. Create queues `personal-journal-staging-photos` and `personal-journal-staging-photos-dlq`.
5. Confirm Images and Queues access/billing. Actual deployed permissions have not been verified.
6. Set the Worker secret, apply the schema, and deploy:

```sh
bunx wrangler secret put WORKER_API_SECRET --config cloudflare/wrangler.jsonc --env staging
bunx wrangler d1 migrations apply personal-journal-staging --remote --config cloudflare/wrangler.jsonc --env staging
bunx wrangler deploy --config cloudflare/wrangler.jsonc --env staging
```

Set the preview's Worker URL/secret, `R2_ACCOUNT_ID`, `JOURNAL_R2_BUCKET`, `JOURNAL_R2_ACCESS_KEY_ID`, and `JOURNAL_R2_SECRET_ACCESS_KEY`. Scope the S3 credentials to the private bucket. Set `LOCAL_WORKER_UPLOADS=false`; do not deploy a `LOCAL_UPLOADS=true` Worker variable.

Replace the origin in `cloudflare/r2-cors.example.json` with the exact preview origin, then apply it:

```sh
bunx wrangler r2 bucket cors set personal-journal-staging-private --file cloudflare/r2-cors.example.json
```

R2 presigned uploads expire after five minutes. Their size, type, and conditional-write headers are signed. Worker processing validates actual image content and dimensions. Originals stay private. Display variants are WebP; the Worker rejects variants containing EXIF or XMP.

## Rehearse your real journal migration

The export is read-only. It needs the existing Supabase URL and service-role key. All output is private, gitignored data under `migration-artifacts/`. Keep a separate encrypted backup.

```sh
bun run migration:journal --mode export
bun run migration:journal --mode plan --time-zone Asia/Kolkata
```

Choose the correct historical time zone explicitly. The script preserves entry IDs, calendar dates, and timestamp instants. It stops on missing originals, unsupported files, oversized originals, and invalid entries instead of silently dropping them. Review `snapshot.json` and `manifest.json`. Shared old photos receive deterministic per-entry IDs; their original bytes are preserved.

Use a fresh local or staging journal by default. For a local journal with new entries you want to keep, add `--merge` to apply and verify. Merge checks entry and photo IDs for collisions and never overwrites existing records. It is not enabled for staging or production.

```sh
bun run migration:journal --mode apply --target local
# Or preserve your existing local entries:
# bun run migration:journal --mode apply --target local --merge
# Or, after staging resources and credentials are configured:
bun run migration:journal --mode apply --target staging --confirm-staging
# Set CLOUDFLARE_WORKER_URL/SECRET to the same target, then:
bun run migration:journal --mode verify
# Add --merge here too if the local target already contained entries.
```

The import does not overwrite existing entries. If a partial import fails, use fresh staging resources; do not retry over existing journal rows. Verification compares counts, fields, timestamps, photo order, original sizes/checksums, and variant checksums. Run it before adding test entries to the imported database. Production imports are deliberately disabled.

The final export must occur during a write freeze. Do not remove Supabase or enable migration mode in production yet. A D1 backup does not back up R2 objects. Retain the source export, original files, and manifest for recovery.

## Processing and implementation notes

- D1 state is the photo-job outbox. A scheduled recovery task runs every ten minutes; failed queue sends are retried. Delivery is at least once, not exactly once.
- Jobs use leases and generation fencing. Five failed processing attempts become a visible failure; the UI can retry.
- Unattached pending/ready/failed photos expire after 24 hours. Deletion uses tombstones and scheduled object cleanup. Private delivery stops immediately when a photo is marked for deletion.
- Trigger local cleanup with `curl http://localhost:8787/cdn-cgi/local/scheduled` while `worker:dev` runs. Local cron events do not run automatically.
- The first slice uses versioned native D1 SQL migrations rather than adding an ORM. Transactions and version conflicts are tested against local D1.
- Auth.js is pinned by the lockfile to its Next.js v5 beta. Its configuration follows the official Auth.js documentation. The app remains on the Next 16.0 patch line: the newer minor tested caused unrelated MDX build failures.
- Remaining live checks: real GitHub OAuth, deployed Images permissions, direct S3/R2 uploads and CORS, and migration of your actual records. Food, workouts, other features, AI jobs, publication, and final cutover are not part of this first slice.

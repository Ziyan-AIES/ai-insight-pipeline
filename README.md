# AI Insight Pipeline

A private team workspace that connects news capture, AI editorial review, monthly analysis planning, and a long-running thesis portfolio.

## Product flow

1. Capture a link from the dashboard or Browser Signal Watcher extension.
2. Store it once in the shared News stream.
3. Run the weekday editorial job to classify, summarize, and publish readouts.
4. Drag useful News cards into Topics as supporting evidence.
5. Move Topics across months or archive them under a long-range Thesis.

The default dashboard is a 2:1 News/Topics split. Either side can be maximized. Maximizing Topics adds the thesis portfolio beside the monthly pipeline.

## Stack

- React, TypeScript, and Vite
- Supabase Postgres, Auth, RLS, and Realtime
- Netlify hosting and Functions
- Cursor scheduled editorial workflow

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Without Supabase environment variables, the app runs against representative demo data. With them, users must sign in by magic link and belong to `team_members`.

## Database

Apply every file in `supabase/migrations` in timestamp order to a new Supabase
project. Then add the first admin after they have signed in:

```sql
insert into public.team_members (user_id, email, display_name, role)
select id, email, 'Admin', 'admin'
from auth.users
where email = 'your-team-email@example.com';
```

Provision additional authentication users through the Supabase admin console,
insert their `team_members` row, then use the dashboard's admin-only **Team**
panel to assign `member`, `editor`, or `admin`. The database prevents removal
of the final admin.

All browser-facing tables use RLS. The extension writes through Netlify Functions with a separate token and a server-side service-role key. Missing write-token configuration fails closed.

## Netlify environment

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CAPTURE_WRITE_TOKEN`
- `EDITORIAL_WRITE_TOKEN`
- `APP_ORIGIN` (exact allowed origin, or a comma-separated allowlist)

`CAPTURE_WRITE_TOKEN` / `EXTENSION_WRITE_TOKEN` authorize the Chrome extension
capture and status APIs. Those endpoints accept token-authenticated requests
even when the request `Origin` is a `chrome-extension://` ID or a news site,
so you do not need to list every website in `APP_ORIGIN`. Keep `APP_ORIGIN`
scoped to the dashboard web app for browser cookie/session calls.

`EXTENSION_WRITE_TOKEN` is accepted as a temporary fallback when either scoped
token is unset, so existing extension and local editorial clients can be
rotated without downtime.

Never commit real values.

## Historical migration

Set the target service credentials plus:

- `BSW_ARTICLES_JSON`: local Browser Signal Watcher `articles.json`
- `OLD_TOPIC_SUPABASE_URL`
- `OLD_TOPIC_SUPABASE_ANON_KEY`
- `LEGACY_MIGRATION_ACTOR_ID`: the approving admin's Supabase user ID

Then run `npm run migrate:legacy` once from an explicitly approved admin
operation. The database writes a durable migration marker and rejects replay;
the dashboard no longer launches migration from a browser session.

## Editorial automation

See `docs/editorial-automation.md`. The intended weekday 18:00 job exports pending news, edits it under the preserved Browser Signal Watcher editorial rules, posts the result to `/api/editorial-sync`, and verifies pending/processed counts.

## Quality and pilot

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
npx supabase test db
```

Pull requests run these checks in GitHub Actions. Local database tests require
Docker and the Supabase CLI. See `docs/pilot-runbook.md` before inviting
colleagues or considering replacement of the existing SharePoint list.

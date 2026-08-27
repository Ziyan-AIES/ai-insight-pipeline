# AI Insight Pipeline

A private team workspace that connects news capture, AI editorial review, monthly analysis planning, and a long-running thesis portfolio.

## Product flow

1. Capture a link from Daily, Weekly Discussion, or the Browser Signal Watcher extension.
2. Store it once as a shared Note / Signal (captured news and manual notes use the same table).
3. Scan Daily by category. Vote items for weekly discussion without copying them.
4. Open Weekly Discussion to prioritize, edit, and drag notes into Topics on the right.
5. Develop a Topic as Insight, POC, or Roadmap with related notes, analysis, and outputs.

The top-level navigation is **Daily | Weekly Discussion**. Topics are not a separate page. Daily is a category briefing. Weekly Discussion keeps the existing 2/3 notes + 1/3 topics split and drag-and-drop onto topic cards.

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

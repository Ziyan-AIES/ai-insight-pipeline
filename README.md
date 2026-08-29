# AI Insight Pipeline

> **AI Signals turns external signals into shared intelligence and Action Threads, helping the team move from “what changed” to “what matters” to “what we do with it.”**

A private team workspace that connects news capture, AI editorial review, and Action Threads. It is not a PMO or task tracker.

## Product flow

1. Capture a link from Live Signals, Intelligence Synthesis, or the AI Signals Chrome extension.
2. Scan **Live Signals** as a 2×3 category grid of what is happening now.
3. Vote to Discuss and add anonymous ideas for AI Daily Review.
4. Open **Intelligence Synthesis** to see Discussion Candidates (2/3) and **Action Threads** (1/3).
5. Drag a candidate onto an Action Thread to link it. Linked news stays visible one row per signal. Destination is POV / Insight / Strategy / Roadmap / POC. Status is Open / In Progress / Parked / Closed.

The top-level navigation is **Live Signals | Intelligence Synthesis**. Search News and + Add News stay in the global bar.

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

All browser-facing tables use RLS. The Chrome extension signs in with the
dashboard magic link and sends the user session. Capture is allowed only when
that user has a `team_members` row. The Netlify functions hold the service-role
key; the extension never receives it. `CAPTURE_WRITE_TOKEN` remains a temporary
fallback for older unpacked builds. Missing write-token configuration fails
closed for that fallback path. Editorial jobs keep a separate
`EDITORIAL_WRITE_TOKEN`.

## Netlify environment

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CAPTURE_WRITE_TOKEN`
- `EDITORIAL_WRITE_TOKEN`
- `APP_ORIGIN` (exact allowed origin, or a comma-separated allowlist)

`CAPTURE_WRITE_TOKEN` is a temporary fallback for older extension builds.
New extension versions sign in with the dashboard magic link and send the
Supabase user session. Capture still checks `team_members` on the server.

`EXTENSION_WRITE_TOKEN` is accepted as a temporary fallback when either scoped
token is unset, so existing extension and local editorial clients can be
rotated without downtime.

Never commit real values.

## Chrome extension

The canonical capture extension lives in `extension/` in this repository.
Load and develop this copy; standalone Browser Signal Watcher repositories are
historical mirrors and do not need to be kept in sync.

You **must reload the unpacked extension** in `chrome://extensions` after this
change, then refresh open tabs.

Sign-in flow:

1. In the extension, choose **Sign in** (work email). There is no name or token field.
2. The dashboard opens at `/?extension_auth=1&state=…`. Complete the magic link.
3. Authorized `team_members` get **Capture access enabled**. Contributor names come from the team profile, not a typed name.
4. Signed-in accounts that are not on `team_members` see **Access not enabled**. Capture stays blocked.

Default workspace URL: `https://aiinsightpipeline.netlify.app`.

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

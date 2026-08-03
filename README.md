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

Apply `supabase/migrations/202608030001_unified_schema.sql` to a new Supabase project. Then add the first admin after they have signed in:

```sql
insert into public.team_members (user_id, email, display_name, role)
select id, email, 'Admin', 'admin'
from auth.users
where email = 'your-team-email@example.com';
```

All browser-facing tables use RLS. The extension writes through Netlify Functions with a separate token and a server-side service-role key. Missing write-token configuration fails closed.

## Netlify environment

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXTENSION_WRITE_TOKEN`
- `APP_ORIGIN`

Never commit real values.

## Historical migration

Set the target service credentials plus:

- `BSW_ARTICLES_JSON`: local Browser Signal Watcher `articles.json`
- `OLD_TOPIC_SUPABASE_URL`
- `OLD_TOPIC_SUPABASE_ANON_KEY`

Then run `npm run migrate:legacy`. The migration upserts by canonical URL or legacy topic UUID and can be rerun.

## Editorial automation

See `docs/editorial-automation.md`. The intended weekday 18:00 job exports pending news, edits it under the preserved Browser Signal Watcher editorial rules, posts the result to `/api/editorial-sync`, and verifies pending/processed counts.

# Public Visitor workspace rollout

## Production status

The user approved production migration and publication. Migrations 202611130001 through 202611130003 were applied together in a transaction through the production Supabase SQL Editor. Readback confirmed both Visitor RPCs exist, anon cannot execute them directly, and service_role can execute them. SQL Editor execution is not registered in Supabase CLI migration history; reconcile that history before a future automated db push.

PUBLIC_WORKSPACE_ENABLED and VITE_PUBLIC_WORKSPACE_ENABLED are true in Netlify production. Deployment receipts: logs/public-production-deploy.json. Production URL: https://aiinsightpipeline.netlify.app.

## Behavior

- Visitors enter Signal Reference without email authentication. Local browser names persist; default Anonymous. Editor login explains requesting access from lizy76.
- Visitors read public news, Trends, Research content/products/source metadata, Radar and briefs. Explicit projections exclude team directories, audit/job data and restricted originals. Only contributor_name is retained from news metadata.
- Visitors capture news, create Trends, add/remove Trend evidence and submit Research sources. Reused sources preserve original content and attribution. No anonymous direct table write grants or shared auth identity.
- Editors retain news curation, source management, soft deletion/restoration. Permanent deletion remains Admin-only. Existing Research management rules and Chrome extension authentication remain intact.
- Visitor pages use paged cacheable requests without Realtime subscriptions. Authenticated non-members fall back to public requests. Identity changes remount the workspace to discard prior-role data.
- Browser checks identified and fixed lingering Signal actions/Recommend/Add thought controls; CSS explicitly respects hidden attributes.

## Verification

- 231 unit tests passed; build passed. Lint has five existing warnings.
- Three Chromium fixture flows passed: public entry/name/login explanation; Research exploration and document submission; news submission, Trend link/unlink and forbidden existing-Trend edits. Added explicit hidden news-control assertions.
- Isolated PostgreSQL validates the complete application migration chain with host Auth/publication stubs, actual capture triggers, RPC grants, duplicate preservation and Research null provenance.
- Production public reads returned news 122, topics 29, trends 16, sources 33 and briefs 8 at readback. Radar pagination returned a 250-row first page.
- Production duplicate-only submission preserved the existing news ID and attribution, without adding test content. Unsupported Visitor deletion is rejected.
- Production browser checks and screenshots: scripts/verify-public-production.mjs and logs/public-production-*.png. API results: logs/public-api-verification.json.
- Targeted production Research link scan found zero SharePoint/local/file links; this is not an exhaustive content audit.

## Boundaries

Public Research originals and summaries derived from restricted originals are excluded. No authenticated production Editor end-to-end session or new Chrome installation was exercised; extension authentication code was preserved and anonymous capture denial is checked separately. Capacity for a sustained 200-person load has not been benchmarked. New submissions/create/unlink are browser-fixture and isolated-database tested; production write smoke uses a duplicate existing URL to avoid polluting content.

No Git commit or push was performed. Existing unrelated workspace edits remain present.

## Rollback

Redeploy the prior production deployment to restore the old frontend and functions; turn off PUBLIC_WORKSPACE_ENABLED for subsequent deploys if needed. The additive RPCs remain inaccessible to anon/authenticated directly. Do not blindly reapply the three already-executed migrations.

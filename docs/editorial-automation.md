# Editorial automation

## Schedule

Run Monday through Friday at 18:00 in the team's operating timezone.

The production workflow is designed to run locally on the owner's Windows PC
through Windows Task Scheduler. It is not a shared Cursor Cloud Automation. The
PC must be powered on and online; the task uses `StartWhenAvailable` to catch up
after a missed start.

## Required secrets

- `CURSOR_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EDITORIAL_SYNC_URL`
- `EDITORIAL_WRITE_TOKEN` for the Netlify endpoint and local runner
- Optional `EDITORIAL_MODEL` (defaults to `grok-4.5`). Team admin settings may
  block Auto/`default`, so the runner uses an explicit model ID.

The endpoint uses `EDITORIAL_WRITE_TOKEN`, falling back to the server's
`EXTENSION_WRITE_TOKEN` only when the scoped token is not configured. It
accepts `x-editorial-token`; `EXTENSION_WRITE_TOKEN` remains a temporary
fallback during rotation. Do not give the editorial secret to the capture
extension.

Store these as Windows user environment variables. Never place their values in
the repository, logs, prompts, or task arguments.

## Local commands

- `npm run editorial:export` emits a read-only diagnostic queue snapshot with
  news IDs and versions. It does not claim a lease, so its output cannot be
  submitted directly to the guarded sync endpoint.
- `npm run editorial:check` validates the five variables, Cursor API access, and
  the pending Supabase queue without invoking a model or writing data.
- `npm run editorial:local` runs one editorial batch immediately.
- `npm run editorial:drain` processes five items per batch until the pending
  queue is empty or a batch produces no publishable items.
- `npm run editorial:schedule` creates or replaces the Windows task named
  `Signal Intelligence Editorial Review` for weekdays at 18:00 local time.
- Scheduled output is appended to `logs/local-editorial.log`, which is ignored
  by Git.

The registered Windows task uses `editorial:drain`, so a backlog larger than a
single model batch is cleared sequentially without overlapping runs. Each batch
is limited to five items to keep the model response and synchronization payload
reliable.

## Agent instructions

1. Use `npm run editorial:local` or `npm run editorial:drain`; the runner claims
   the queue and retains the trusted row versions and lease identity.
2. If the queue is empty, keep existing curation unchanged and still verify the current period readout.
3. For each pending item:
   - preserve deliberate human edits;
   - translate Chinese source material into concise English;
   - write a factual title and one 15-20-word English summary sentence;
   - state the direct impact, or use the article's single most important
     highlighted fact when an impact is not clearly supported;
   - assign one category from interaction, AI software, AI hardware, ecosystem, AI capability, or industry events;
   - keep hardware, devices, and form-factor stories in AI hardware even when interaction is prominent;
   - return at most one evidence-backed `Why it matters for Qira` sentence;
   - merge the directional implication and main watchpoint in that sentence;
   - leave implications empty when Qira relevance is generic, speculative, or
     only repeats the summary.
4. Generate or update the current week-to-date readout with a one- or two-sentence lede and two or three specific bullets.
5. Let the runner POST the validated payload to `EDITORIAL_SYNC_URL` with
   `x-editorial-token`. Do not handcraft the concurrency fields or copy them
   from model output. Never print the token.
6. Query Supabase after the write and verify:
   - every submitted URL is `processed`;
   - no existing Topic or News–Topic relation was removed;
   - pending items that were not submitted remain pending;
   - the current period readout exists.
7. Report counts, failures, and URLs that need manual review. Do not create editorial churn when no new signals exist.

## Reliability method

The local runner separates acquisition, reasoning, validation, and publication:

1. Code retrieves the pending queue and fetches page text when extension text is
   unavailable.
2. The model classifies and synthesizes the supplied evidence, but does not
   perform database writes.
3. Code validates exact URLs, categories, summaries, and evidence before
   accepting the model output.
4. Items without sufficient evidence remain pending and are reported instead
   of receiving an invented summary.
5. The sync endpoint merges AI fields into existing metadata so contributor,
   archive, and capture information remain intact.
6. The endpoint checks every claimed news ID, URL, row version, internal run
   UUID, lease owner, and lease expiry before writing. One mismatch returns
   `409 EDITORIAL_CONFLICT` and rolls back the complete batch.
7. A normalized request hash makes an identical retry idempotent. A different
   payload with an old run ID is rejected.

Each processed item records source-backed evidence, one optional Qira
directional implication, and an audit record containing the run identifier,
review time, source mode, and evidence count. News cards show the concise
**Why it matters for Qira** result; source evidence remains available in the
News editor when an audit is needed.

## Qira editorial lens

Lenovo describes Qira as a permission-based Personal Ambient Intelligence
System: one context-aware intelligence across Lenovo and Motorola PCs,
smartphones, tablets, wearables, apps, and services. It is intended to preserve
continuity, use multimodal and personal context selected by the user, and act
through a hybrid of local and cloud intelligence.

Use that positioning only as a directional lens. A signal is relevant when it
could materially affect cross-device continuity, ambient interaction,
permission and trust, hybrid local-cloud architecture, agentic action, service
integrations, or Lenovo/Motorola ecosystem differentiation. Do not force every
article into Qira. When relevance exists, write one plain sentence combining
the likely consequence and the key development to watch, and qualify
interpretation with `may` or `could`.

Primary background:

- [Lenovo Tech World @ CES 2026 announcement](https://news.lenovo.com/pressroom/press-releases/hybrid-ai-personalized-perceptive-proactive-ai-portfolio-tech-world-ces-2026/)
- [Lenovo Qira introduction](https://smbcommunity.lenovo.com/resources/post/introducing-lenovo-and-motorola-qira-a-personal-ambient-intelligence-bkwFUljRWdtPbXf)

Each synchronization also creates or updates an `editorial_job_runs` record
with status, processed/readout counts, timestamps, and a bounded error message.
The runner claims work through the service-only `claim_editorial_job` RPC using
`FOR UPDATE SKIP LOCKED` and expiring item leases before invoking a model.

## Concurrency migration rollout

Production status on 2026-09-08: phase 1 is applied and the guarded caller is
deployed from `main`. Phase 3 remains deferred until one controlled production
item completes through `apply_editorial_sync_guarded` and its job/lease state is
verified.

Do not apply both B05 migration phases to production before deploying the new
caller. Use this order:

1. Apply `20260908090000_editorial_concurrency_guards_phase1.sql`. It adds the
   guarded apply/failure RPCs and keeps the old RPCs available.
2. Deploy the updated `editorial-sync.mjs` and `run-local-editorial.ts` caller.
   Run `npm run editorial:check`, then process one controlled item and confirm
   the job completes through `apply_editorial_sync_guarded`.
3. Promote
   `supabase/deferred/20260908090100_editorial_concurrency_guards_phase3.sql`
   into `supabase/migrations` in a separate reviewed change, then apply it. It
   removes the old unguarded apply and failure RPCs so a stale runner fails
   closed. The file is intentionally deferred, preventing a normal `db push`
   from applying it before the caller is verified.

If step 2 must be rolled back, keep phase 1 and restore the previous caller.
Do not apply phase 3 until the guarded caller is verified in production.

## Payload shape

The sync endpoint accepts:

```json
{
  "news": [
    {
      "id": "claimed-news-uuid",
      "expected_version": 17,
      "url": "https://example.com/article",
      "title": "Edited title",
      "source": "Publisher",
      "summary": "Concise editorial summary.",
      "category": "ai_capability",
      "news_facts": ["Fact one"],
      "implications": ["This could affect Qira's cross-device service orchestration; watch whether the capability exposes a permission-aware integration path."],
      "evidence": [
        {
          "claim": "Source-backed claim",
          "source_url": "https://example.com/article",
          "support": "Short supporting excerpt"
        }
      ],
      "impact_paths": [],
      "open_questions": [],
      "captured_at": "2026-08-03T10:00:00Z"
    }
  ],
  "run_id": "trusted-external-run-id",
  "claim_run_id": "trusted-claim-uuid",
  "lease_owner": "trusted-runner-owner",
  "readouts": [
    {
      "period_type": "week",
      "period_key": "2026-W32",
      "lede": "Current synthesis.",
      "bullets": ["Specific takeaway"]
    }
  ]
}
```

The runner injects `id`, `expected_version`, `run_id`, `claim_run_id`, and
`lease_owner` from the claim snapshot after validating model output. They are
transport fields, not fields the model is allowed to choose.

# Editorial automation

Current pipeline entrypoints, shared policy, mail review and recommendation scheduling are documented in [daily-pipeline.md](daily-pipeline.md).

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
- Optional `EDITORIAL_MODEL` for direct commands; pipeline tasks use `EDITORIAL_SCHEDULED_MODEL` or the shared model in `config/daily-pipeline.json`. Team admin settings may
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
- Scheduled output is appended to `logs/pipeline/editorial.log`, which is ignored
  by Git.

The registered Windows task uses `editorial:drain`, so a backlog larger than a
single model batch is cleared sequentially without overlapping runs. Each batch
is limited to five items to keep the model response and synchronization payload
reliable.

## Agent instructions

1. Use `npm run editorial:local` or `npm run editorial:drain`; the runner claims
   the queue and retains the trusted row versions and lease identity.
2. If the queue is empty, leave curation unchanged. The wrapper still runs the independent Signal Reference briefing.
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
4. Do not generate a Selected Sources cross-news readout; submit an empty readouts array.
5. Let the runner POST the validated payload to `EDITORIAL_SYNC_URL` with
   `x-editorial-token`. Do not handcraft the concurrency fields or copy them
   from model output. Never print the token.
6. Query Supabase after the write and verify:
   - every submitted URL is `processed`;
   - no existing Topic or News–Topic relation was removed;
   - pending items that were not submitted remain pending;
   - the separate Signal Reference briefing reports its own result.
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

Production status on 2026-09-09: the guarded caller completed a controlled
production item through `apply_editorial_sync_guarded` with one processed item
and one readout. The validation exposed a production-only spelling drift in the
manually applied function (`jsonb_array_lements`); migration
`20260909080000_editorial_concurrency_guard_runtime_fix.sql` recreates the
reviewed definition. Phase 3 is now applied and the legacy unguarded RPCs are
removed. The controlled news, readout, and job rows were deleted after the
verification.

Do not apply both B05 migration phases to production before deploying the new
caller. Use this order:

1. Apply `20260908090000_editorial_concurrency_guards_phase1.sql`. It adds the
   guarded apply/failure RPCs and keeps the old RPCs available.
2. Deploy the updated `editorial-sync.mjs` and `run-local-editorial.ts` caller.
   Run `npm run editorial:check`, then process one controlled item and confirm
   the job completes through `apply_editorial_sync_guarded`.
3. Apply `20260909090000_editorial_concurrency_guards_phase3.sql`. It removes
   the old unguarded apply and failure RPCs so a stale runner fails closed. This
   step was promoted from the deferred migration only after step 2 passed.

The rollout is complete. Any future rollback must keep the guarded request
contract because the legacy RPCs are no longer present.

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
  "readouts": []
}
```

The runner injects `id`, `expected_version`, `run_id`, `claim_run_id`, and
`lease_owner` from the claim snapshot after validating model output. They are
transport fields, not fields the model is allowed to choose.

## Signal Reference briefing (2026-11-06)

The weekday 18:00 wrapper runs `node scripts/run-reference-brief.mjs` independently after editorial, even when the news queue is empty or fails. RSS runs daily at 00:00 / 08:00 / 16:00 Beijing; mail review starts daily at 16:15. The briefing uses a 17:00 cutoff to allow the 16:00 collection to finish. Late-arriving items enter the next daily brief by discovery time, retaining original publication dates. Monday continues from the last successful cutoff. Both daily and rolling seven-day snapshots publish together; failed synthesis advances neither.

The existing `editorial_readouts` JSON storage holds separate versioned Signal Reference snapshots with `generated_by=signal-reference-v1` and `period_key=radar-daily:YYYY-MM-DD` / `radar-weekly:YYYY-MM-DD`. `period_type=week` is a legacy storage compatibility field, not the UI period. `lede` holds versioned coverage metadata; `bullets` holds validated cards with evidence references. Existing team access policies apply. Old Selected Sources readouts remain archived and are no longer fetched or generated. No database schema change is needed.

### Period-wide synthesis, version 2

Collection retains RSS/API articles even without dictionary matches, with feed article content preferred over short descriptions. A refresh preserves original discovery time. The briefing reviews every collected article in bounded batches, including alternate accounts of the same event, classifies observations or explicit exclusions, then reduces all observations within topic areas before generating up to three cross-article themes. There is no newest-250 cap. Each final card must cite at least two distinct developments; a single company headline cannot be a takeaway. Repeated coverage does not count as distinct evidence. Investor arguments remain attributed theses, not evidence of broad adoption.

The version-2 metadata exposes collected/reviewed/distinct/excluded counts and topic-area count. Private audit files in `logs/reference-briefs` preserve every classification and all considered IDs. Feed excerpts are not full-article verification; missing sources and partial inbox reviews remain coverage warnings. `--rebuild-latest` explicitly revises the last successful coverage window using subsequently recovered articles with publication dates in that window; ordinary scheduled runs continue advancing from the previous successful cutoff.

## Recovery verified 2026-11-11

The Windows wrapper uses `grok-4.5`, overridable with `EDITORIAL_SCHEDULED_MODEL`, independently of the user-level `EDITORIAL_MODEL`. Direct commands share the configured default unless explicitly overridden; `gpt-5.6-sol` returned a provider-region availability error on this machine, not a quota error. The common runner loads `scripts/local-network.mjs` from the repository root with a relative import. This supplies bounded curl transport retries for Supabase and the Cursor authentication exchange; credentials are passed through stdin, never command arguments. The task retries failures twice at ten-minute intervals.

Reference extraction runs at most three independent batches concurrently, preserves input order, and still validates every article before publishing. Completed model steps are cached. A failed daily/weekly pair never advances the cutoff. Late ingestions after a cutoff enter the next daily period.

Daily and weekly extraction also share exact per-article caches keyed by model, prompt and the full article input, so overlapping windows do not pay for classification twice. Changed text or prompts invalidate the entry.

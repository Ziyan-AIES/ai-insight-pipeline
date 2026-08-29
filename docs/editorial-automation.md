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

- `npm run editorial:check` validates the five variables, Cursor API access, and
  the pending Supabase queue without invoking a model or writing data.
- `npm run editorial:local` runs one editorial batch immediately.
- `npm run editorial:schedule` creates or replaces the Windows task named
  `Signal Intelligence Editorial Review` for weekdays at 18:00 local time.
- Scheduled output is appended to `logs/local-editorial.log`, which is ignored
  by Git.

## Agent instructions

1. Run `npm run editorial:export` and parse the JSON queue.
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
5. POST the reviewed payload to `EDITORIAL_SYNC_URL` with
   `x-editorial-token`. The current local runner may use the compatibility
   `x-extension-token` path during rotation. Never print either token.
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

## Payload shape

The sync endpoint accepts:

```json
{
  "news": [
    {
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

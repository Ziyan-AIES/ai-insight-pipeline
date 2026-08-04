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
- `EXTENSION_WRITE_TOKEN`

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
   - write a factual title and short summary;
   - assign one category from interaction, AI software, AI hardware, ecosystem, AI capability, or industry events;
   - keep hardware, devices, and form-factor stories in AI hardware even when interaction is prominent;
   - return two or three concrete implications when evidence supports them.
4. Generate or update the current week-to-date readout with a one- or two-sentence lede and two or three specific bullets.
5. POST the reviewed payload to `EDITORIAL_SYNC_URL` with `x-extension-token`. Never print the token.
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

Each processed item records source-backed evidence, first- through third-order
impact paths, open research questions, and an audit record containing the run
identifier, review time, source mode, and evidence count. These fields appear
under **AI analysis trail** on the News card.

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
      "implications": ["Implication one"],
      "evidence": [
        {
          "claim": "Source-backed claim",
          "source_url": "https://example.com/article",
          "support": "Short supporting excerpt"
        }
      ],
      "impact_paths": [
        {
          "order": 1,
          "effect": "Direct effect",
          "rationale": "Mechanism"
        }
      ],
      "open_questions": ["What still requires verification?"],
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

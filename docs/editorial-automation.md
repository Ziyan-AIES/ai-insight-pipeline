# Editorial automation

## Schedule

Run Monday through Friday at 18:00 in the team's operating timezone.

## Required secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EDITORIAL_SYNC_URL`
- `EXTENSION_WRITE_TOKEN`

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

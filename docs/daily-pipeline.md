# Daily information pipeline

Current source of truth: `config/daily-pipeline.json` (model, Beijing schedules, batch size, recommendation limit and preference). Keep policy here rather than copying it into chat automations or ad-hoc scripts.

| Time (Beijing) | Owner | Work |
| --- | --- | --- |
| 00:00 / 08:00 / 16:00 daily | Existing Netlify collector | RSS/API collection and dictionary matching |
| 16:15 daily | Windows `Signal Intelligence Daily Intake` | Collect mail → Cursor extraction → deterministic publisher verification → validated import → source status → up to two Agent recommendations |
| 18:00 weekdays | Windows `Signal Intelligence Editorial Review` | Per-article editorial → daily synthesis; previous-calendar-week synthesis on Mondays only; optional Research worker stays opt-in |
| 18:30 daily | Codex exception monitor | Read receipts and report new failures; never duplicate ingestion or recommendations |

Both Windows tasks call `scripts/run-local-pipeline.ps1`, then `scripts/run-daily-pipeline.mjs`. They require the PC online, authenticated Agent Mail CLI and existing environment credentials. They do not require the Codex chat to be awake. Install/update both with `npm run pipeline:schedule` on a PC set to China Standard Time. Windows catches up missed starts and retries failed tasks twice, ten minutes apart.

## Operations

- `npm run pipeline:check`: verify credentials are present and the database is reachable; no model call or database write.
- `npm run pipeline:intake`: run the same production intake; `-- --mail-limit=1` bounds a recovery/smoke run.
- `npm run pipeline:intake -- --dry-run`: read/cache mail and model output and validate candidates, but do not import, promote, finalize sources or advance review checkpoints. Model usage still occurs.
- `npm run pipeline:editorial`: run the same production editorial/synthesis stages.
- Receipts: `logs/pipeline/intake-latest.json`, `editorial-latest.json`, immutable per-run receipts under `logs/pipeline/runs`; command logs under `logs/pipeline/*.log`.
- `complete`, `partial`, `failed` are distinct. Pending publisher verification is not imported content. Unknown/paused senders, dates missing from publisher metadata, paywalls/network errors and overlong newsletters remain pending for Codex/human review. No model-generated publication date is trusted.

Mail extraction is cached by full input, prompt, model and policy version. The model is instructed to treat content as untrusted and return JSON without tools; deterministic code validates the result and performs imports. No send/reply/delete mail operations are part of this workflow. The program follows only supplied article links or a uniquely matching already-collected title; verifies the original `datePublished`/`article:published_time`, title and canonical URL; then reuses `import-mail-review.mjs` in preview and apply modes. A multi-article mail advances only when all its extracted articles pass verification. `processed.json` remains the single completed-mail ledger; `review-state.json` stores only pending/retry diagnostics and extraction filenames, not a second success ledger. Previously verified files in ready-reviews.json are retried before collection and removed only after importer readback; manual verified imports remain supported through the same importer.

Intake processes at most ten mails per run, reserving up to two slots for old backlog. Pending verification retries after one day; processing errors after one hour. Daily selection uses one ranking request over today's collected candidates and reuses existing summaries; only nominated articles are fetched. Original publisher timestamps must establish the Beijing publication day. Date-only evidence can enter Reference but cannot qualify for same-day promotion.

## Invariants

- Import into `radar_items` is different from promoting into `news_items`.
- Existing source IDs, pauses, original publication dates and discovery times are preserved.
- Count all Agent additions for the Beijing day, including deleted records and other import routes. Maximum two; zero is valid.
- Check all existing canonical URLs, including deleted rows and trailing-slash variants. Inserts ignore duplicates; never update or resurrect an existing recommendation. Preserve `metadata.agent_review_status`.
- Contributor remains Agent; the existing captured-news/pending-editorial structure remains unchanged. No automatic Trend/Research creation.
- One local intake writer is enforced with an exclusive process lock; importer ledger writes have their own lock. This is a single-PC deployment. Do not add a second machine/writer without moving daily quota enforcement to a database transaction.
- Source finalization requires a fresh collection result. Unreadable or unreviewed mail never advances success timestamps.
- Independent stages retain successful work. A failed article-editorial phase does not suppress the Reference phase. Daily and weekly summaries publish together only after validation.

## Consolidation and maintenance

The old chat-owned daily ingestion/recommendation prompt is replaced by a read-only exception monitor. The duplicate PowerShell editorial wrapper/registration and draft-only mail model script are retired. `editorial:schedule` is a documented compatibility alias for `pipeline:schedule`, not a separate scheduler. Historical logs, ingestion receipts and dated design documents are audit evidence, not executable entrypoints.

When changing policy, edit the shared config, its tests and this runbook together. When changing source registration or the dictionary, retain their existing registries and monthly review workflow. Do not add parallel state files, a second recommendation writer, or a model-owned database write path. Dashboard schema, display and deployment are unaffected by this migration.

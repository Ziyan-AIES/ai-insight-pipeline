# Research redesign implementation status

2026-11-10. Production database migrations and twelve-product seed applied. Frontend and 12 Netlify functions deployed successfully to https://aiinsightpipeline.netlify.app. Deploy ID: 6af260819e13908057ab4e96.

## Implemented

- Products and Sources use cards; product launch sorting supports partial dates and puts unknown dates last.
- Product forms retain company background, founding date, launch date and launch event type.
- Unified New source entry supports news, podcast, video and document, with separate description and transcript fields.
- News capture and research linking use one atomic RPC. Non-news sources remain separate from the news database, can link to multiple topics, and can be unlinked without deleting their original content.
- Non-news cards support search, type/language filters, recommended/publication/added sorting, details, edits and unlinking. Paged loading avoids the default database response limit.
- Original transcripts have explicit full/excerpt scope and team/restricted visibility. Save uses version checks, immutable history and an explicit 2 MiB limit.
- Source summary jobs use leases, bounded retries, evidence-checked chunk summaries and hierarchical reduction. Chinese input is summarized in English. Empty content is blocked instead of invented. Exhausted expired leases become blocked.
- Products have versioned enrichment jobs and separate supplements. Save automatically queues a snapshot. The worker reads the supplied public website, extracts only quoted evidence, fills missing fields and never overwrites user input. Changed products do not show stale supplements.
- Research Topic terminology replaces visible Action Thread labels. Private Studio links and inspected northeast-arrow links are removed.
- Research worker is wired to the local editorial runner behind RESEARCH_ENRICHMENT_ENABLED. It remains disabled until migrations are installed.
- Twelve-product seed file includes the seven existing Studio profiles with provenance and five new official-source profiles: Wabi, Town, Grok Bot, Manus Cue and Claude Duet. Unknown facts remain empty.
- Idempotent product import defaults to dry-run, requires an exact Personal Agents topic ID, preserves existing products, backs up the topic before writing and checks its version.

## Verified

- Full application regression: 200 tests passed across 36 files before the additional local-image-path test; that test is checked separately.
- Source and product synthesis: 8 tests passed.
- All three migrations execute against isolated PGlite PostgreSQL. Database checks cover restricted reads, editor checks, long transcripts, source reuse/unlink, optimistic edits, immutable history, source-job supersession, final lease expiry, atomic news linking, product-job deduplication and stale completion. Product batch never changes original topic JSON.
- Production build passes. Lint has four existing warnings; build reports the existing large-chunk warning. Some asynchronous component tests emit act warnings.
- Production SQL Editor confirmed Personal Agents topic 46c0fc02-9233-4738-a051-d736c8cae7b8 contains twelve products. Import updated only that topic when its product array was empty. Evidence: logs/research-products-success.png.

## Remaining work and release blockers

- Applied migrations 202611090000 through 202611090003 in one production transaction through Supabase SQL Editor. Compatibility migration preserves the existing owner/editor check; membership calls use the production private schema. Evidence: logs/research-migration-success.png. SQL-editor execution is not yet registered in CLI migration history.
- Product editorial input intentionally remains in topic analysis JSON for compatibility; enrichment history is separate. This is a staged implementation, not the fully independent product registry described in the original plan.
- Existing Studio image requests failed. No broken cross-site image paths were imported. Local asset import and rendering support exist, but logos/screenshots still require successful retrieval and review.
- Verify remaining founding dates, company backgrounds and launch dates. Do not fill them from memory.
- Automatic YouTube/podcast transcript acquisition and the requested Xiaoyuzhou CLI adapter are not implemented. User-pasted transcript and description processing are implemented. Private SharePoint links remain links, not fetched documents.
- Non-news URL equivalence beyond exact URL, job retry controls and source-count aggregation on topic overview cards remain pending.
- Remaining validation: real-browser visual and role-based end-to-end checks, then an explicitly authorized real model batch before enabling the scheduled research worker. Frontend deployment and twelve-product import are complete.

## Rollout commands after database setup

Run npm run test:research-db (uses the pinned PGlite dependency installed by npm ci), npm test, npm run test:research-synthesis and npm run build.

Preview import: npm run research:import-products -- --topic=46c0fc02-9233-4738-a051-d736c8cae7b8

Apply reviewed import after migrations: append --apply. Enable RESEARCH_ENRICHMENT_ENABLED only after a successful manual research:drain run.

Preserve unrelated pre-existing working-tree edits. No commit or push has been performed. Automatic approval review blocked live model-batch validation because research content could be sent to an external model service; scheduled research processing remains disabled pending explicit approval.

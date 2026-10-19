# Sonata integration and preservation plan

19 October 2026

This document records the foundation. See `sonata-analysis-release.md` for the current implementation and limitations.

## Product model

Sonata extends the existing AI Insight Pipeline rather than replacing its data store. Its member-facing flow is Signal Reference → Selected Sources → Trends → Research. Workspace remains a separate entry for the editing process.

Signal Reference is deterministic RSS/API discovery and keyword/rule matching. It is reference material, not team endorsement. Selected Sources contains material intentionally saved by members; an intentional selection is immediately team visible without an owner-review gate. Personal listening history remains private until explicitly selected.

Trends collects perspectives with supporting and counter-evidence. A human decision commits a question to research. Research contains committed topics, historical work, source relationships, analysis and deliverables. Individual topics can later add products, timelines, comparisons, frameworks and annotated presentation pages. A universal module layout is not required.

## Implemented foundation

- Existing navigation destinations are relabeled and a dedicated Research reading view is added.
- Research uses existing topics, source relationships, trend relationships, analysis and output links; archived historical work is retained.
- Uncommitted ideas stay in the existing Workspace. Legacy topic URLs continue opening that workspace; the reader is distinguished with `reader=1`.
- A per-topic Workspace entry preserves existing editing and versioned save behavior.
- Source discovery includes the existing extension installation entry and access contact.
- Sonata applies Manrope headings/interface text, Source Sans 3 reading text, gray-lilac atmosphere and restrained orbital treatment.
- No schema migration, record deletion, bulk publication, access-policy change, or new digest automation is included.

## Research Studio migration: pending

The separate Research Studio is D1-backed; its records are not assumed to exist in Supabase. Before importing:

1. Export owner-authorized source data and record counts in a private backup location. Never commit research records, credentials or personal listening history to this repository.
2. Add additive Supabase tables for rich research modules, products, editions and origin mappings, protected by project/member policies.
3. Map every record using source system + original ID + revision. Preserve source URLs, original language, contributors, timestamps, visibility, annotations and edition snapshots.
4. Run a dry-run report with per-type counts, duplicate candidates and missing relationships. URL similarity can suggest a duplicate; it must not silently overwrite a record.
5. Import transactionally and idempotently. Preserve original versions, original IDs in provenance and old links. Reconcile counts and verify permissions before enabling the new reader view for imported records.
6. Keep both original stores recoverable until reconciliation passes. No destructive cleanup is planned.

## Remaining product work

Rich topic modules and per-topic private working notes; approved product screenshots/logo storage; drag ordering with keyboard alternatives and undo; typed company/product relationships; source type/language filtering across imported content; source-to-trend linking from Reference; activity digest configuration with delivery off; later local entity graphs.

The foundational reader is not a claim that the data migration or the full integrated research editor is finished. Existing capture endpoints, extension origin contracts, authentication and historical records remain authoritative.

## Workspace authorization rollout

The browser requests `can_access_research_workspace()` from Supabase. Missing authorization or RPC failure keeps the entry closed. The additive migration `202610190001_research_workspace_access.sql` resolves lizy76@lenovo.com to its Auth user ID, preserves any admin role, and protects the new private-note table with RLS. It must be applied to the existing Supabase project separately; committing this file does not execute it. If this account has not signed in and does not yet exist in Auth, its user ID must be enrolled after verification. Existing shared topic notes remain shared legacy records and are not automatically reclassified as private.

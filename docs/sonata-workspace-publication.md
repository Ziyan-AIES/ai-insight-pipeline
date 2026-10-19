# Sonata: private research workspace and member publication

19 October 2026

## Decision and current state

Retain the existing ChatGPT Sites Research Studio as the private editing environment. Retain the existing Netlify Sonata application and Supabase project as the approved-member platform. Do not recreate the private research workflow inside the legacy Action Threads editor.

Verified this session: Research Studio is owner-only, has a working MCP connection, and retains products, sources, analysis pages with history, and release records. The data API is live. Its current publication is version 13. The owner-only Workspace link now opens that existing Studio. The member reader and Studio publication stores are NOT synchronized yet.

The two websites are interfaces. They do not need identical hosting or authentication. Netlify continues using the existing approved-member Supabase login; Research Studio uses the owner's existing ChatGPT identity. Their user IDs are different and must be explicitly mapped on the server, never assumed equivalent because of a display name or email.

## Where work happens

| Stage | Interface | Persistent result | Visible to members? |
|---|---|---|---|
| Discover | Signal Reference | Objective feed results | Yes, according to existing member access |
| Select | Selected Sources / Chrome extension | A source intentionally selected by a contributor | Yes immediately; no owner review gate |
| Interpret | Trends with shared source library | Provisional trend and source relationships | Yes |
| Commit to research | Trend Edit: Promote to Research | Stable Sonata topic ID linked to a Studio project ID | Research metadata can be shared; working material stays private |
| Develop the outline | Private Studio | Ordered research pages, each with question, claim, evidence, draft, and next action | No |
| Discuss and revise | Codex / ChatGPT with the existing Research Studio MCP tools | Updates to the selected page and its revision history | No |
| Preview | Private Studio | A candidate publication with selected modules and pages | No |
| Publish | Explicit owner publication action | Immutable publication snapshot, version, author, source revision, and timestamp | Only that published snapshot |
| Revise | Private Studio | A new draft based on the previous publication | Previous publication stays visible until a replacement is published |

Creating a product or saving an analysis page is a database operation. It does not require editing React code or deploying Netlify. This is already how the existing Studio product and page tools operate. Adding a new renderer, changing UI behavior, or changing a database schema is software work and may require deployment.

## Publication bridge: recommended next implementation

Use one explicit, server-to-server publication path. Do not expose the Studio's complete state endpoint to members, and do not make its private audience public to simplify synchronization.

1. Create an explicit mapping between the Sonata topic ID and Studio project ID. Preserve both original IDs. Do not infer mappings from similar titles.
2. Provide a Studio publication preview selecting products, intentionally included sources, and analysis pages. Personal listening history, excluded/pending material, feedback, PMO messages, todo text, working notes, and draft histories are excluded by an allowlist serializer.
3. Generate a versioned snapshot in the Studio transaction. It has a stable publication ID, topic/project mapping, schema version, source revision, selected entity IDs, ordered modules/pages, author, language metadata, timestamp, and content hash.
4. Send the snapshot from the Studio server to a narrowly scoped authenticated Sonata endpoint. Keep credentials in runtime secrets. No service key in either browser and no broad read token for private Studio state.
5. Validate the sender, owner grant, schema, size, URLs, and expected latest version. Use an idempotency key based on publication ID/version/hash. Repeating the request does not duplicate sources or products.
6. Commit the publication atomically to an additive Supabase publication table. Keep historical versions; switch the latest-version pointer only after the complete write succeeds. On failure, keep the previous publication visible and offer retry.
7. The member reader fetches the latest published snapshot using its existing member authorization. Realtime invalidation or a refresh shows the new version without a site build. Never cache private or authenticated data publicly.

A snapshot table needs an additive migration and RLS. Existing news, trends, topic metadata, legacy PPT links, dates, and contributors are retained. Published sources should reference existing canonical source IDs where mapped; newly selected publication sources need an explicit import/provenance mapping. Do not silently merge by title or overwrite a member's source summary.

Withdrawal and rollback update the latest-publication pointer and preserve previous snapshots. File links retain their own access requirements. A private Studio URL by itself is not a usable member deliverable; assets selected for publication need a member-readable delivery path.

## Research Studio composition

- Outline: one row per analysis question/page; reorder with a drag handle and keyboard alternatives.
- Page: question, current claim, linked evidence, analysis body, figures, open questions, and revision history.
- Products: data forms for name, company, description, URL, logo, and screenshot; save without redeploying either UI. A product can be selected into a publication.
- Sources: select from the shared Sonata pool through an authenticated bridge, or capture a new source. Keep the shared source record separate from private annotations.
- Analysis: external PPT/document links; native article; native slide pages. Keep the supported formats explicit instead of displaying nonfunctional import options.
- Publications: preview exactly what members will see, publish a new version, inspect prior versions, and retry failed synchronization.
- PMO: later agent job/thread state belongs beside the outline, not in the published reader.

This turn does not add a second competing product store to Netlify or claim that these new Studio controls and the publication bridge are already implemented.

## AI discussions and PMO

A Site is a hosting surface, not an automatic connection to the currently open Codex desktop chat. The existing MCP tools already allow an authorized conversation to read the latest Studio state and save an individual page or product as data. Keep this path as the first usable workflow: choose a project/page, discuss it in Codex, save the result to that page, inspect it in Studio, then publish a selected snapshot.

For a later embedded PMO experience, run a separate authenticated agent service. OpenAI documents Codex SDK for programmatic workflows and Codex app-server for persistent conversations, streaming events, interruptions, and approvals. A PMO can maintain a project thread and child page tasks, but needs an actual runner, identity, task queue, stable thread/page mapping, failure handling, and an owner confirmation boundary for publication. Hosting the page on Sites alone does not create that runtime or delegate desktop chats.

Reference: https://developers.openai.com/blog/codex-as-a-platform

## Delivery sequence and acceptance

1. Repair the member UI and route Workspace to the existing private Studio. Verify independent pane scrolling, list/card behavior with the library open, aligned controls, native source drop targets, transient success feedback, and consistent removal actions.
2. Build one end-to-end publication bridge for one explicitly mapped topic. Test the complete cycle with an owner-approved sample: draft -> preview -> publish -> member read -> edit draft without changing published content -> publish a new version -> restore a prior version. Confirm zero Netlify builds for those content operations.
3. Reconcile existing Personal AI records with a private dry-run report, then migrate/link only the reviewed records. Preserve excluded/private items and historical editions.
4. Add the embedded PMO only after the data and publication cycle works. Do not replace a working Codex/MCP workflow with an inert chat box.

No existing Studio data was modified or published as part of this architecture review. No background content synchronization or AI job runner was enabled.

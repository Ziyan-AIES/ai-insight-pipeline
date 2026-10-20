# Company relationships and temporary source review

Company map defaults to Partnerships & integrations. An edge requires an exact-source evidence record or reviewed `metadata.company_relationships` with matching `evidence_url`, `verified: true`, explicit `from`/`to` company IDs and a supported kind. A raw co-mention cannot create this edge. Shared stories remains a separate view. Related companies in a multilateral announcement are explicitly paired; no complete clique is inferred.

The evidence registry activates only for news already in the current Selected Sources props. Researching a candidate never inserts that news into the workspace. Exact-source matching ignores tracking queries and a trailing slash; it does not trust an arbitrary article with similar keywords. This is a curated evidence mechanism, not general semantic relationship extraction. New unrelated URLs need review before becoming cooperation edges.

HP, Dell, Samsung, Plaud and Oura are pinned even with zero stories. Claude is a product alias of Anthropic, not a separate company. Dexcom, Salesforce and Broadcom are configured but remain hidden until news mentions them or has a reviewed relationship involving them. Layout height grows with company rows.

The temporary 22-source review was a one-time work artifact. On 2026-10-20, the user supplied the completed selection and explicitly authorized import. Ten selected sources were deduplicated against live data and inserted with Ziyan attribution, original publication dates, actual capture timestamps and reviewed explicit relationship metadata. The review link and its public files are removed from the deployed dashboard. Its old URL redirects to Signal Reference. Future discovery belongs to the existing source monitoring flow documented in `official-source-monitoring.md`.

After the user confirms a selection, recheck live canonical URLs for duplicates, use the requesting member as contributor, set published_at from the original day-precision date, and preserve the actual capture timestamp for per-user New semantics. Retain explicit relationship endpoints, kind and evidence URL in metadata. A publication date or documented case-study date must not be represented as a contract signature date. Later updates do not rewrite the original publication date.

Granola MCP original date: 2026-02-04 from article:published_time and JSON-LD. Plaud MCP original date: 2026-07-29 from JSON-LD datePublished; current displayed/modified date is 2026-10-19. Plaud expressly identifies ChatGPT/Claude compatibility without asserting sponsorship or affiliation. Capture that distinction as integration, not a bilateral strategic partnership.

The original review had no database write endpoint. The subsequent import was performed only after the user's explicit selection and instruction, and its live receipt was checked. Optional new companies remain hidden until a corresponding source exists.

The one-time research window was fixed as of 2026-10-20: prefer 2026-07-20 onward and reject anything before 2026-04-20. All ten selected imports satisfy that window. Weekly discovery now checks the preceding seven days. Historical Selected Sources are not deleted by either research window.

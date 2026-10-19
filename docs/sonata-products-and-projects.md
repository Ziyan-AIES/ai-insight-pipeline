# Sonata: products, source grouping, and Studio project scope

19 October 2026

## Delivered in this release

- Selected Sources explains deliberate team selection, the top-right Add News action, and one-click capture using the Chrome extension. The access-request link was removed because the page already requires approved membership.
- Every category panel has its own category-tinted top-to-bottom gradient, distinct top rule, and stronger heading. The second row repeats this grouping. The entire page has one continuous background.
- Research without the source library uses a centered reading canvas and normal page scrolling. The Sources control stays on the left. Opening the library restores the one-third / two-thirds layout and independent pane scrolling.
- Research topic Products has New product and Edit product for the authorized research editor. Name and description are enough to start; company, website, logo URL, and screenshot URL are optional. Name is the only required field.
- Saving a product updates the existing topic record through the database API; it does not create a deployment. The form closes only after success and retains its entries on failure. Version checks reject stale edits.
- Shared product data is stored under the existing topic analysis JSON document as a typed products collection. Parsing, initial loading, and realtime updates preserve it. Other research framing fields and output links remain intact. No schema change or migration is required for this release.
- These are topic-level product records. They are not automatically synchronized with the private Studio product directory; that publication bridge remains pending. No existing Studio product was imported or changed.
- The hosted private Site display title is now Sonata Research Studio. The existing URL is retained for compatibility. No audience or member access was changed.

## Studio scope and project model

Research Studio is the private application. Personal AI is one project within it. A project contains its own research outline, analysis pages, evidence selections, working notes, and publication versions. The current live state still contains only the Personal AI project; this release does not add project-management controls.

The next project-management increment should provide:

1. Project switcher with New project, Edit details, and Archive.
2. Project metadata: stable ID, title, description, category, research period, lifecycle status, and optional Sonata topic ID.
3. Explicit one-to-one topic-to-project mapping for the normal research flow. Bind an existing project rather than recreating it. Never map only by title.
4. Independent page, annotation, feedback, and publication collections per project. Shared sources/products may be linked into several projects through explicit relationships.
5. Open the mapped Studio project from a Sonata topic. If no mapping exists, show Create or link workspace, without silently opening Personal AI as though it were the requested project.
6. Preserve all current IDs, page history, product/source data, and existing edition links during rollout. Archive rather than delete.

Keep this project-management increment separate from the member UI corrections, as requested. It must be combined with the publication-bridge implementation, not presented as an already-working global multi-project editor.

## PMO feedback

The connected feedback tool saves discussion feedback with optional page and release IDs and leaves it pending for review. Saving feedback is not evidence that an agent has processed it, created a child chat, or revised a page. A future PMO requires a visible task state and completion records. Private feedback must not become member-visible publication content.

## Site address

Sites supports a URL-label change, but the available capability description does not establish old-host redirect behavior. The current private Site also has connected MCP operations and existing links. This release updates the display title only. A later address change must verify the new address, repair the member application's Workspace links, recheck the connector and callback/integration references, and verify old-link behavior before treating the migration as complete.

## Validation

Production build and automated regression checks cover product creation/editing, failed-save retention, safe URLs, persisted product/framing round-trip, and preservation through subsequent analysis edits. Browser checks use local demonstration data and verify source grouping, centered closed Research layout, restored independent open panes, and minimal product entry. No production content was added by QA.

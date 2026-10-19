# Sonata interaction corrections

19 October 2026

## Changes

- Selected Sources time controls share the title row at its right edge.
- Trends and Research use viewport-bounded, independently scrolling columns on desktop. Inner trend filters/cards no longer impose separate scroll areas. Narrow mobile screens retain normal stacked scrolling.
- Research List is explicitly one full-width row with or without the source library. Card grids have at most three columns and reduce the count on narrower screens.
- Category, Order, Cards, and List controls align by their actual boxes, not their labels.
- The source library toggle is a compact panel icon with a small label; close and source removal use the existing cross-button pattern.
- Shared sources can be filtered by no Trend, no Research, or neither relationship.
- A native source drag is accepted on drag-enter as well as drag-over at the new Trend target. The shared source library also reports drag state to the existing application handlers. Creating the Trend retains the selected source as evidence.
- Sources can be dropped onto an open research topic, not only a directory card. Successful persistence produces a transient One source added message; errors do not produce success feedback.
- Source titles open their originals. Research unlinks use a cross, preserve the shared source, and reuse the existing unlink handler.
- Trend card actions are reduced to compact Edit and View linked sources. Promote to Research remains in Edit. Obsolete meeting-review labels are hidden.
- Workspace entries open the existing owner-private ChatGPT Sites Research Studio. They no longer start the legacy Action Threads editor. Existing source/analysis editing and legacy records are retained.

## Verification

- Build succeeds.
- 145 tests passed, including regression coverage for native source payloads, source-preserving Trend creation, relationship filtering, topic-detail drops, removal actions, and time-control placement.
- Browser checks verified independent scroll positions, equal control bounds, one-column List with the library open, native drag into Create Trend, and a topic-detail source drop with success feedback.
- All browser content changes used local demonstration data. No production research record was modified or published.

## Scope boundary

Opening the existing private Studio is live functionality. Synchronizing its published products/pages with Sonata is not implemented in this release. The architecture, publication boundaries, and next acceptance test are documented in sonata-workspace-publication.md. Embedded PMO conversations also require a separate agent runtime and are not activated by this UI release.

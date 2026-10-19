# Sonata: Research lifecycle editing and view preferences

19 October 2026

## Delivered

- Research cards and list rows expose Edit research for the existing research-workspace grantee. Topic detail has the same editor entry.
- The editor saves title, category, research period, status, and research question. Products, existing outputs, source relationships, and other framing fields remain intact. Saving checks the expected topic version.
- Move to recycle bin uses the existing soft-delete API and an explicit confirmation within the editor. Original source records remain unchanged. Existing recycle-bin restoration remains available.
- Return to Trends opens the existing Trend editor for review. Cancel leaves the Research record unchanged. Saving the move adds an explicit trend workflow-stage marker while retaining the original Research ID and its content.
- An existing originating Trend is reused without replacing its independent title and framing. Missing source relationships are merged. If none exists, the editor creates one and retains the resulting ID for retry after subsequent-write failure.
- Returned records no longer appear in the Research directory even when they retain a historical output link. Legacy records without an explicit stage marker keep their previous visibility until an editor acts on them.
- Trends treats a retained relationship to returned research as history rather than an active Research commitment, so the returned Trend becomes visible again.
- Promoting a returned Trend reuses the original Research identity, including products, sources, dates, and analysis, instead of creating a second research record.
- Trend editor footer buttons now share Manrope, 13 px text, 40 px height, and a 9 px corner radius. Promote to Research uses the existing secondary button class.
- Research Cards/List choice is stored under a viewer-specific browser preference. Navigation, source-pane toggles, and page reload preserve it. This preference is browser-local, not cross-device synchronization. Storage failures do not block the page.

## Validation

- Production build succeeds.
- Regression checks cover view preferences and viewer separation, editing, soft deletion while retaining sources, explicit stage round-trip, and Research -> Trend -> original Research with products and period preserved.
- Browser checks verified List after navigation, both editor entries, Return to Trends, visibility of the returned Trend, and computed footer font/height/radius consistency.
- QA changes use local demo data only. No production topic was bulk reclassified, edited, or deleted. The examples named by the user are not automatically moved based on a title or an inferred completion status.

## Boundary

Lifecycle writes use existing version-checked record updates and relationship upserts. They are sequential operations, not a new database transaction. If a later write fails, the editor stays open and the Research record remains at its prior stage until the stage update succeeds. Source records and historical output content are never deleted by a return operation.

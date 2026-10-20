# Selected Sources map view

- Categories remains the default Selected Sources view, including the existing six-panel layout, time controls, cards, editing, recommendations and capture entry points.
- Map is an alternative news-only view of the same visibleNews collection. Topic and company circles open an adjacent news list; overlap lines show the underlying shared stories. Trend/Research records are not loaded into the map.
- The existing renderNoteCard function is reused, including its New badge and actions. Map receives the same isNewSignal callback as Categories; changing views does not call recordWorkspaceView or create another read cursor. New remains automatic, with no additional New checkbox.
- A versioned static topic configuration and bounded company aliases derive membership from current titles/summaries, not from a bundled experiment snapshot. Topic membership and co-mentions are navigation associations, not causal/business claims.
- Removed the darker three-pixel category top border while retaining each category's existing color gradient and ordinary one-pixel border.

Validation: production build succeeds; 158 tests pass; lint has no errors and four pre-existing warnings. Browser checks confirm six original category panels, identical top/side border widths and colors, preserved gradients, the original news cards in Map, automatic New badges, and no runtime errors. No database or permission changes.

Follow-up: the selected topic/company/overlap derives its membership from current live props, so newly arriving sources appear without reselecting the node. A regression test covers a source arriving while a topic is selected; four map tests and the production build pass.

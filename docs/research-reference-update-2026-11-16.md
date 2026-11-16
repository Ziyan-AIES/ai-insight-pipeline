# Research and Signal Reference update — 16 Nov 2026

## Published changes

- Edit research exposes Author and Description. Both are public display fields in `analysis`; they do not change membership, ownership or editing permissions. Description is distinct from the research question and analysis body. Existing descriptions fall back to the previous question until edited.
- Updated the 14 requested titles and descriptions, with optimistic version checks in one transaction. Exact copy is in `config/research-copy-2026-11-16.json`; readback verified every title, description and version advancement. Months, products, sources and outputs were retained.
- Research tabs now start with Sources, followed by Products and Analysis; Sources is the default for a fresh visit.
- Visitor radar source rows use their own three-column layout. Removed How it works.
- AI Takeaways shows concise update date and reviewed article count. Coverage diagnostics remain in the stored audit but are omitted from this reading view. Existing summaries are split at sentence boundaries without rewriting their content; new generation requests an introductory paragraph and 2–3 evidence-based bullets. Supporting article links use aligned rows.
- Past week is generated on Beijing Mondays for the preceding complete Monday–Sunday. A published week is skipped on subsequent normal runs. The existing weekday 18:00 local Editorial Review task calls this script; daily briefs retain their existing schedule. `--weekly-only` can run the due weekly publication independently.
- Browser batch opening attempts all selected URLs synchronously, clears each new tab's opener before navigation, and retains links for blocked tabs. Browser pop-up permission is still required when the browser blocks multiple tabs. Editor extension authentication is unchanged.
- Source language filters default to All and retain the chosen value in browser local storage. Original-language metadata and WeChat source URLs determine language independently of translated display text. Unknown languages stay unknown. Public news projection includes only the required language/content-type fields.

## Verification

- 234 tests passed in the full suite; an additional sentence-boundary regression test passed with the focused briefing tests.
- 3 public Visitor browser tests passed.
- Browser batch-opening test passed without the extension.
- Production build and Netlify deployment completed: `6afaac9204a08a050323adf6`.
- Production browser verification: source text column 623 px; 3 selected article tabs opened; research description/tab order and language preference after reload verified; no page JavaScript errors.
- Screenshots and deployment receipt are in `logs/*2026-11-16*`.
- No Git commit or push was performed. Existing unrelated workspace edits were retained.

## First calendar-week generation

The 16 Nov weekly run selected 967 articles for 9–15 Nov Beijing time. It did not publish: one classification batch failed completeness validation, then retries encountered Cursor/Supabase TLS connection resets. Valid completed classification results remain cached for the scheduled run. The previously published weekly briefing remains visible with its actual update date; no incomplete snapshot was written. The Monday-only scheduling change is implemented and tested, but this first new calendar-week briefing has not been verified as published.

## Follow-up: Research layout and output navigation

- Removed description width caps in research headers and topic cards; reduced description text to 16 px. List rows use the available width and place Explore research / Edit research side by side at the bottom right.
- Topic metadata shows linked output titles. External outputs open their URL; native outputs deep-link to their analysis reader. Empty output collections show `0 Outputs`.
- Extended extension response timeout to five seconds. Browser opening catches failed navigation, retains blocked articles, and offers Retry remaining using a fresh click gesture. Successful tabs are excluded from retries.
- Verification: 236 unit tests; three browser tests covering layout, unrestricted batch opening, and a simulated `window.open` blocker. Chromium automation may still allow multiple windows even without the default disable-popup-blocking flag, so the blocker test explicitly returns null after the first tab. This does not prove that a real user's popup permission is enabled; the UI explains that requirement.
- Published follow-up deployment: `6afaf9368f819ad96c114276`. Live verification at 20:38 Beijing: list description occupies 95% of its card width, detail description occupies the full header width, mobile has no horizontal overflow, and no page JavaScript errors were observed. Screenshots: `logs/research-layout-live-*.png`; receipt: `logs/research-layout-live.json`.

# AI Signals 0.4.9 candidate ledger

Status: **upload-ready; upload blocked on Google sign-in in the available browser session**
Prepared: 2026-09-09 (Asia/Shanghai)
Chrome Web Store item: `bgmhnlbjfdnbfpjgmcmedjebcpjoppjc` (unlisted)
Previous upload: 0.4.8, review/publication state not yet recorded

## Intended change

Version 0.4.9 implements the extension portions of B07 and B08:

- every background network request has a 15-second timeout and asynchronous message failures return a deterministic response;
- simultaneous refresh requests share one in-flight operation;
- a refresh or sign-in result that finishes after sign-out cannot restore the old session;
- expired or consumed dashboard handoffs stop polling, clear pending state, and show a restart instruction;
- authentication responses are validated before tokens reach extension storage.
- clicking the Qira orb now starts sign-in when signed out, resumes the dashboard while a handoff is pending, and exposes the normal actions after sign-in.

The companion production API uses the B07 atomic claim RPC, a 10-minute credential TTL, one-time state storage, and token scrubbing after claim. That API and migration must be deployed before the 0.4.9 store package is submitted.

## Package

Local artifact: `dist/ai-signals-0.4.9-b07-b08.zip`
Size: `17,430 bytes`
SHA-256: `06413a5949ed74e1ee2b0f8b5d16c03a0246e605c57f1744678e1ead38ed3ff6`

The ZIP root contains only `background.js`, `content.js`, `manifest.json`, `options.html`, `options.js`, `qira-mark.svg`, and `shared.js`.

| File | SHA-256 |
|---|---|
| `background.js` | `d9d87835c2b14ed2b48826b3d84611e89983e9ccee2e2bb7aec4b5e2bc04267a` |
| `content.js` | `5a4d295c4000bbd309fef59d5e67539a624434d291f5888ed37886c2c2def832` |
| `manifest.json` | `8e45e4deeb09003b4ac8176131662560d7216ab0f2d28fbd2716d3fa0e398d09` |
| `options.html` | `d41c178acce0a8f316f814290e277f6693248e3e3f352f03613e403b722fd52b` |
| `options.js` | `607bed8cca33be357f9aa98887c05acd993af58c40371fb62bf15def2e35ffe4` |
| `qira-mark.svg` | `6423e90fef690308518160006986c0a826b39b3c8a70e37e17c3a94fa040a6a5` |
| `shared.js` | `a4fadaf923a2f92fbc43a3cdd54a553527be10a23d15622caf1404b19497d5e8` |

## Validation

- `git diff --check`: passed.
- `npm run lint`: passed.
- `npm test -- --reporter=dot`: 15 test files and 125 tests passed.
- `npm run build`: passed.
- `npm run test:e2e`: 6 Chromium tests passed.
- ZIP root allowlist: exactly seven expected files; no nested repository paths or unrelated files.
- Manifest JSON parsed as `AI Signals` version `0.4.9`; the worker's local `./shared.js` import is present in the package.
- The content script now runs in jsdom with empty extension storage; the signed-out dock renders and clicking the Qira orb sends `bsw-sign-in`.
- A reusable real unpacked Manifest V3 worker regression covers the signed-out handoff, a failed Capture with thought preservation and successful retry, two background source tabs, and sign-out credential clearing. It runs through `npm run test:extension` and in GitHub Quality.
- Extension security regressions cover rejected network promises, concurrent refresh deduplication, and a refresh finishing after sign-out.
- Function regressions cover atomic claim, one-time replay rejection, credential TTL, and token scrubbing.
- GitHub Quality run `34269296267` passed both app and database jobs on commit
  `722c2db`: 125 unit tests, 6 Chromium E2E tests, the real worker regression,
  and 5 pgTAP files with 56 database assertions.

## Submission and installed-version acceptance

Web/API companion deployed: 2026-09-08, Netlify production deploy `6aa002ec96dbad0008c42c24`, state `ready`, commit `ebed8cc19642781bc8eda6f110461fb4498dd8d3`
Upload time: pending
Submission time: pending
Review state: not uploaded; developer dashboard requires an authenticated Google session
Published time: pending
Installed Chrome version verified: pending

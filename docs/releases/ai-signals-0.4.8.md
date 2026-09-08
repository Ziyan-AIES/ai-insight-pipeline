# AI Signals 0.4.8 candidate ledger

Status: **uploaded to Chrome Web Store; review/publication state not yet recorded**
Prepared: 2026-09-08 (Asia/Shanghai)
Chrome Web Store item: `bgmhnlbjfdnbfpjgmcmedjebcpjoppjc` (unlisted)
Upload reported by the user on 2026-09-08; exact developer-console timestamp was not recorded
Local Git base: `340ed5a` (`main`); the working tree is not committed or pushed

## Intended change

Version 0.4.8 implements B01/T23-A–C:

- the trusted Radar page can request up to five user-selected HTTP(S) URLs;
- the content script exposes an explicit 0.4.8 capability marker and relays request-scoped results;
- the background worker validates the exact configured workspace sender and URL list before opening ordered inactive tabs;
- duplicate URLs are opened once, unsafe schemes and oversized batches are rejected;
- older, disabled, or missing extensions use the Web fallback: one browser-open attempt plus direct links for remaining sources;
- partial or missing extension responses no longer produce a false “opened all” message.

The companion Web change must be deployed for the Radar button to use this capability. The B02/T35 Radar scrolling fix is Web-only and is not part of this extension ZIP.

## Package

Local artifact: `dist/ai-signals-0.4.8-b01.zip`
Size: `16,568 bytes`
SHA-256: `f94c48e308766fec2f23ea58b71ddf4ab3196df6aed501587643e32d41371511`

| File | SHA-256 |
|---|---|
| `background.js` | `c743dc889a3af7cbce52b5e84167b7d6db87a0f2f34ecbab06c51da8c2933d18` |
| `content.js` | `5638591215ead1c5acabed7066cf3a2ea49a0575d56b257e2abf1227db4be871` |
| `manifest.json` | `60826792babbb77ebd3779c74b04bb8f5fa71d38104e1d25eccac64dab46863d` |
| `options.html` | `d41c178acce0a8f316f814290e277f6693248e3e3f352f03613e403b722fd52b` |
| `options.js` | `9299fb16ebb615379b2d0184e36e325bbd17c374b331cfaba92a7b8f4e658d89` |
| `qira-mark.svg` | `6423e90fef690308518160006986c0a826b39b3c8a70e37e17c3a94fa040a6a5` |
| `shared.js` | `2f58c3f5eec7122c22e8146466e082ae95789331a2181eee13f56f6c18a04172` |

`npm run build` clears `dist/`. Run the Web build and all source-changing checks first, then generate this ZIP last. If any extension source changes, rebuild the ZIP and replace its size and hashes before review.

## Validation completed

- `npm run lint`: passed.
- `npm test -- --reporter=dot`: 15 test files and 120 tests passed.
- `npm run build`: passed.
- `npm run test:e2e`: 6 Chromium tests passed.
- A real unpacked Manifest V3 worker opened the two Radar-selected demo URLs as two background tabs while the Radar tab stayed active.
- The same worker opened five requested URLs as five inactive tabs in the requested order; the capability is capped at five.
- The no-extension browser path opened only the first source and rendered direct links for every remaining source.
- The extracted ZIP loaded in Playwright Chromium; `chrome.runtime.getManifest()` returned `AI Signals` version `0.4.8`, and the trusted local workspace received the 0.4.8 capability marker.

## Submission and installed-version acceptance

Web companion deployed: pending
Upload time: 2026-09-08 (exact time not recorded)
Submission time: not recorded
Review state: not recorded after upload
Published time: pending
Installed Chrome version verified: pending
Two selected sources: passed with local unpacked candidate; store build pending
Five selected sources: passed with local unpacked candidate; store build pending
Old/disabled/missing extension fallback: passed locally; deployed Web pending

# AI Signals 0.4.7 release ledger

Status: **submitted to Chrome Web Store; awaiting review**
Prepared: 2026-09-07 (Asia/Shanghai)
Chrome Web Store item: `bgmhnlbjfdnbfpjgmcmedjebcpjoppjc` (unlisted)
Store baseline verified from the public item page: version `0.4.6`, updated 2026-09-07
Local Git base: `340ed5a` (`main`); the submitted 0.4.7 ZIP remains the immutable artifact recorded below. After submission, the working tree advanced to the unsubmitted 0.4.8 candidate and is still not committed or pushed.

## Intended change

Version 0.4.7 closes the workspace handoff destination weakness found in F01/T01:

- production session operations accept only the exact `https://aiinsightpipeline.netlify.app` origin;
- explicit loopback origins remain available for local development;
- the background worker derives credential destinations from trusted extension storage and ignores page-supplied `apiBase` values;
- session-control messages validate their Chrome `MessageSender` before using credentials;
- the dashboard handoff completion request no longer includes the extension refresh token.

The patch does not include Radar batch-open support or other P1/P2 work.

## Package

Local artifact: `dist/ai-signals-0.4.7-p0-final.zip`
Size: `15,748 bytes`
SHA-256: `b8dc45b425f6666553968f3fa933f4ab28fdd64fd5913aaa32c7e8aa5fe4e669`

The ZIP root contains every extension runtime file and no repository configuration, environment file, test output, or credential:

| File | SHA-256 |
|---|---|
| `background.js` | `e3150d9d1f998a56ef12fbdc17d05a0c757098e04080f3cc7a6775d2de488e38` |
| `content.js` | `afc801efc9d74be9be7fb3a100d54076668e4ddba0d0a01fb0dadbb77e880465` |
| `manifest.json` | `758d734a2f2231d42866fa7e7f33213f3458a77626fdcfaaa2c72e8db9845358` |
| `options.html` | `d41c178acce0a8f316f814290e277f6693248e3e3f352f03613e403b722fd52b` |
| `options.js` | `9299fb16ebb615379b2d0184e36e325bbd17c374b331cfaba92a7b8f4e658d89` |
| `qira-mark.svg` | `6423e90fef690308518160006986c0a826b39b3c8a70e37e17c3a94fa040a6a5` |
| `shared.js` | `2f58c3f5eec7122c22e8146466e082ae95789331a2181eee13f56f6c18a04172` |

The artifact is generated under ignored `dist/`; it is not a tracked source file. Rebuild it if any listed source file changes, then replace all hashes in this ledger.

Do not upload the earlier draft `dist/ai-signals-0.4.7.zip`. Its hash is not the final hash above and it predates the final tab-origin binding check. The only approved candidate in this ledger is `ai-signals-0.4.7-p0-final.zip`.

## Validation completed

- `npm run lint`: passed.
- `npm test -- --reporter=dot`: 14 test files and 106 tests passed.
- `npm run build`: passed.
- `npm run test:e2e`: 4 Chromium tests passed.
- Extracted ZIP manifest parsed successfully as version 0.4.7 and its file list matched the seven-file allowlist above.
- Extracted ZIP loaded in Playwright Chromium with an active Manifest V3 service worker; `chrome.runtime.getManifest()` returned name `AI Signals`, version `0.4.7`.
- Behavior regression test used fake credentials and a mocked network: lookalike workspace senders received HTTP-style status 403 and caused zero outbound credential requests; a legitimate sender sent only to the trusted production origin.

Branded Chrome no longer loaded a command-line unpacked extension in the automated temporary profile, so the runtime package check used Playwright's Chromium build. This is separate from the required post-publication acceptance test in the user's installed Chrome.

## Before upload

1. Confirm `git diff --check`, the checks above, manifest version 0.4.7, and this ZIP SHA-256 still match.
2. Review the extension-only diff and ensure no later task entered the package.
3. Upload this exact complete ZIP to the existing item; do not create a new Chrome Web Store item.
4. Keep the item unlisted and leave listing metadata unchanged unless reviewed separately.
5. Record submission time and review state below. “Submitted” is not “published.”

## Submission and installed-version acceptance

Submission time: 2026-09-07 23:05 +08:00 (recorded when the user reported the upload; the Developer Dashboard timestamp has not been independently verified)
Review state: awaiting review (reported by the user)
Published time: pending
Installed Chrome version verified: pending
Sign in: pending
Capture: pending
Open Dashboard: pending
Sign out: pending
Lookalike-origin rejection in shipped build: pending

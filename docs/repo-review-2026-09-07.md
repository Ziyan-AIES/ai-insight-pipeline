# Repository review and small-task backlog — 2026-09-07

## Scope and verified baseline

- Reviewed local checkout `ai-insight-pipeline`, HEAD `340ed5a`; working tree initially clean. Reviewed React workspace/auth/data access, extension, Netlify endpoints, migrations/RLS, Radar ingestion/ranking, editorial runner, tests and release configuration.
- User confirms Chrome Web Store item `bgmhnlbjfdnbfpjgmcmedjebcpjoppjc` is published as **unlisted**, with manual updates and no GitHub-to-store publishing integration. This supersedes older unpacked-only guidance.
- The public Chrome Web Store listing was verified on 2026-09-08 as **0.4.6**, updated September 6, 2026. The user subsequently uploaded 0.4.8; review/publication and installed-version acceptance remain to be recorded. Package evidence is in `docs/releases/ai-signals-0.4.8.md`.
- Passed: lint, TypeScript/Vite production build, 101 tests in 13 suites, and all 4 Playwright demo/layout tests. Playwright initially failed to launch inside the sandbox (`spawn EPERM`); the permitted retry outside the sandbox passed.
- Coverage: statements 43.35%, lines 46.30%; `src/supabase.ts` lines 6.43%; `_radar.mjs` lines 23.03%. Extension JavaScript is excluded from coverage and its existing UI tests mostly assert source text.
- Database tests were not run: Docker was not available on PATH. Hosted migration state, production RLS behavior, actual scheduled runs, Chrome-installed extension behavior, and real account sessions were not verified. Passing local tests is not production acceptance.
- This review adds documentation only. No application fixes, commits, pushes, database writes, or store uploads were performed.

## Findings

### F01 — P0 priority: workspace handoff can send credentials to a lookalike origin

Evidence: `extension/content.js:564`, `extension/content.js:631`, `extension/background.js:28`, `extension/background.js:250`, `extension/background.js:321`.

`isWorkspacePage()` tests a hostname suffix without a leading boundary or exact origin comparison. A hostname such as `audit-aiinsightpipeline.netlify.app` therefore qualifies. On such a page the custom dashboard-session event forwards `window.location.origin` to the background. The background ignores `_sender`, accepts the requested origin, and sends its stored access token in Authorization and refresh token in the body to that origin.

Local reproduction executed the actual background source in a VM with fake Chrome storage and a mocked fetch. A lookalike sender received a simulated outbound request containing `FAKE_ACCESS` and `FAKE_REFRESH`. No real credentials or external request were used. This establishes the code path; it does not demonstrate an incident or confirm that the published package contains the same code.

Fix exact workspace origin validation in both surfaces, enforce sender/target validation in the background, derive credential destinations from trusted configuration, and remove the unused refresh token from the `complete` request. Verify legitimate login and reject lookalike hosts, HTTP, unexpected ports, and untrusted senders. Prioritize a dedicated patch release if the store package contains this code.

### F02 — P1: one-time session claim is not atomic

Evidence: `netlify/functions/extension-auth.mjs:261`.

Claim first SELECTs a handoff and then DELETEs it. Two requests can both read the same unclaimed row before either deletes it; DELETE success/returned rows are not used to decide ownership. Both can then return credentials or create dashboard sessions. This is a code-confirmed race, not a reproduced production incident. A session-issuance failure after DELETE also consumes the handoff before delivering a usable session.

Use an atomic database claim/consume operation restricted to service_role. Define retry semantics for issuance failure separately; avoid solving concurrency merely with a process-local lock. Add a two-caller test that permits one successful consumption only. The 24-hour TTL and lack of expired-record cleanup are additional hardening work, separate from the race fix.

### F03 — P1: editorial sync can overwrite deliberate human edits

Evidence: `supabase/migrations/20260830150000_editorial_review_state_and_team_context.sql:31`, `netlify/functions/editorial-sync.mjs`, `scripts/run-local-editorial.ts`.

The latest `apply_editorial_sync` overwrites title, summary, takeaway, category and synthesis by URL. It checks neither the exported row version nor current lease ownership. In particular, takeaway is assigned the summary. A reviewer can edit a signal while the model is working, and the later sync can replace the newer edits. Prompt guidance to preserve framing does not protect concurrent database writes.

Add version-aware apply semantics and explicit field provenance/override rules. Treat stale results as conflicts requiring re-export; do not silently clear a different run's lease. Separate the minimal concurrency fix from the later field-provenance migration.

### F04 — P1: pending recapture can reset a manually selected category

Evidence: `supabase/migrations/20260827140000_extension_session_auth.sql:126`, `src/supabase.ts:860`.

The latest capture upsert preserves category only when `editorial_status = 'processed'`. `updateNewsCategory` changes category without marking it as a deliberate override. Correct the category of a pending item, then capture its URL again: the incoming automatic category wins. Add persistent override provenance and honor it in capture and editorial paths.

### F05 — P1: unpaginated reads silently make the workspace and Radar incomplete

Evidence: `src/supabase.ts:192`, `src/supabase.ts:1494`, `netlify/functions/_radar.mjs:429`, `supabase/config.toml:8`.

Workspace reads news, topics, votes and ideas without pagination. Radar asks for 2,500 rows in one request, while the repository config caps API rows at 1,000. The ingestion dedup reference query is also unpaginated. Above the configured cap, old evidence disappears from local state, idea counts can be incomplete, and Radar comparisons operate on truncated windows. Hosted limits may differ and were not inspected; even a higher cap does not make this design complete.

Implement stable pagination and server-side count/aggregate queries where appropriate. Do not treat a larger single-request limit as a fix. Test more than 1,000 records, historical thread evidence, and both Radar comparison windows. Supabase documents the default cap and pagination: https://supabase.com/docs/reference/javascript/v1/select and https://supabase.com/docs/reference/javascript/using-modifiers-range.

### F06 — P1: discussion ordering ignores database errors and permits partial writes

Evidence: `src/supabase.ts:810`, `src/App.tsx:2136`.

`persistDiscussionOrder` awaits `Promise.all` but never checks each Supabase result's `error`. Normal PostgREST failures resolve as `{error}`, so the optimistic UI retains the new order while persistence fails. A local stub returning a database error reproduced a successful function return. Multiple row updates are also not transactional, and the UI catch does not restore authoritative ordering.

First surface errors and restore/reload order on failure; then move full-order persistence to an authorized transactional RPC. Keep the small visible-failure fix separate from the database change.

### F07 — P2: duplicate capture says a thought was added although it is not added to the discussion model

Evidence: `extension/content.js:426`, `netlify/functions/capture.mjs`, `supabase/migrations/20260827140000_extension_session_auth.sql:122`, `src/supabase.ts:1258`.

The extension returns “Already saved · thought added” based only on `already_existed` and local input. The upsert keeps an existing nonempty takeaway and merges the new thought into a single `metadata.capture.takeaway` value. It does not append a `news_ideas` record; later captures can replace that metadata value. Raw capture events retain submitted payloads, so this is not a claim of total data loss. The problem is misleading feedback and missing team-visible thought history.

Define thoughts as append-only discussion contributions, with retry deduplication, and return an explicit `thought_added` result. Test two contributors capturing the same URL and a retried request.

### F08 — P2: Radar misses near-duplicate stories across sources in the same ingestion run

Evidence: `netlify/functions/_radar.mjs:377`, `netlify/functions/_radar.mjs:436`.

Every source is processed against the same pre-run `existing` array. `assignExistingStoryKeys` copies that array, so near-duplicate new stories from other sources in the current run are absent. A local reproduction with title similarity 0.75 returned two keys when processed as separate sources but one when clustered together. Exact matching signatures can still deduplicate; the defect concerns near-title matches. Repeated runs do not guarantee stable convergence.

Fetch sources concurrently, normalize all successful results, then cluster across the combined batch with stable ordering before writes. Add a cross-source ingestion test, not just ranking tests on already-clustered fixtures.

### F09 — P2: extension auth transport lacks a consistent failure and concurrency boundary

Evidence: `extension/background.js:28`, `extension/background.js:336`.

Several message handlers call async functions with `.then(sendResponse)` and no rejection handler; refresh fetches have no timeout and no shared in-flight refresh promise. Network failure can leave a caller without a structured response; alarm/capture/dashboard requests may refresh the same session concurrently. The code gaps are verified; real browser refresh-token failure was not reproduced.

Add bounded requests, a consistent response envelope, and a shared refresh operation. Distinguish transient network errors from definitive revoked/expired sessions; prevent a delayed successful response from restoring a session after explicit sign-out.

## Additional improvement areas

- **Release traceability:** `.github/workflows/quality.yml` runs checks only. No extension ZIP/release workflow or store version ledger exists. README and extension README still lead with unpacked installation and reload instructions. Keep development and store-user instructions distinct.
- **Test realism:** the 4 E2E tests cover demo/layout, not real extension workers or authenticated database behavior. The 18 SQL assertions largely check schema/policy presence. Add actual role-based behavior tests for member/editor/admin and the critical races above.
- **Privacy wording:** “anonymous” ideas have `user_id` and team-readable RLS on `news_ideas`. This is presentation anonymity, not anonymity from team members querying the database. Clarify the product promise; if stronger anonymity is intended, expose a view/RPC without identity and restrict the base table.
- **Maintainability:** `App.tsx` is 7,072 lines; `App.css` is 8,002 lines. Extract one coherent panel or hook at a time with existing behavior tests. A whole-app rewrite would consume the budget and delay correctness fixes.
- **Operational visibility:** scheduled Radar logs completion even if source results contain failures. Add a concise health view covering latest successful ingestion/editorial run and backlog age. Verify actual production schedule separately before asserting availability.
- **Radar freshness:** the component reloads on mount or explicit actions; long-open tabs do not periodically reconcile Radar data. Add a bounded focus/visibility refresh if this matters for daily use.
- **Permission minimization:** after the origin fix, evaluate broad HTTPS host permissions and legacy shared-token fallbacks against the current store distribution. Broad permissions alone are not proof of an exploit; do not combine a permission redesign with the urgent patch.

## 补充需求 — 2026-09-07

### F10 — P1：Radar 批量打开新闻链接实际只打开一个

用户实测：一个 Radar trend 选中多个新闻来源，点击批量打开后只有一个标签页打开。`src/components/IndustryRadar.tsx:334` 中 `openEvidence` 循环调用 `window.open(..., 'noopener,noreferrer')`，然后无条件提示已打开全部链接。代码与浏览器弹窗限制相符；本轮没有复现用户浏览器的具体权限状态，不能把所有失败都归结为同一原因。

建议为安装了新版插件的用户接入受限的批量开标签消息，由 background 调用 `chrome.tabs.create`；对旧版/未安装插件保留明确的逐条打开、复制链接备用方式。不得自动修改用户弹窗设置。不能直接以 `window.open` 的 null 返回值判断失败，因为 noopener 也可能使成功调用返回 null。详细实现、兼容和真实浏览器验收分别见任务 T23-A/B/C。

修复进度（2026-09-08）：0.4.8 已实现受信来源、最多五个 HTTP(S) URL、去重和部分失败返回；真实 worker 已创建 2/5 个后台标签并保持 Radar 激活，无插件备用入口通过浏览器 E2E。用户已上传 0.4.8，商店审核/发布状态与安装版验证仍待记录。

依据：[MDN Window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)、[Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)。

### U01 — P2：双击 Synthesis 的 Trend 标题栏空白处最大化

用户要求：双击 Trend 栏上部空白处，缩小 Evidence 和 Action Threads，让 Trend 占据主要宽度。当前 `src/App.tsx:4963` 的 `workflow-column-heading` 尚无双击处理；已有 `evidenceInboxOpen`、`actionThreadsOpen` 及 `src/App.css:7874` 的左右 48px 收起布局可复用。

默认交互约定：双击进入，再次双击恢复进入前的左右栏状态；保留左右展开入口；新建/会议/筛选按钮不触发最大化；提供可见的最大化/恢复按钮与键盘入口。只影响本地布局，不写团队共享排序或数据库。详细步骤见 T24。

### F11 — P1：Radar 长 movement 列表底部不可滚动访问

用户截图显示：桌面宽屏下 Radar 已渲染至少 9 条 movement，但视口底部截断列表，无法继续向下滚动访问后续内容。这会使已加载数据实际不可用，因此按 P1 处理；它与 F05 的数据分页问题不同，本问题发生在已经渲染出来的列表布局。

当前 CSS 同时存在外层 `.app-shell` 固定视口高度并隐藏溢出、通用 `.dashboard` 固定高度、`.workspace-main` 内部滚动以及 Radar 页面最小高度规则。最终级联可能让滚动范围只按固定 dashboard 盒子计算，而较长的 Radar 子内容被截断。此处是基于截图和源码的高概率原因，执行时仍须用 computed style 和长列表 E2E 确认具体拦截滚动的祖先。

修复应为 Radar 明确一个主纵向滚动容器，处理 grid/flex 子项的 `min-height` 和 Radar 专属高度覆盖，同时保持右侧 sticky detail、顶部导航及其他工作区页面的现有滚动。详细复现、断点验证和验收见 T35。

修复进度（2026-09-08）：Radar 现在由 `.workspace-main` 统一承担纵向滚动，Radar dashboard 不再缩到固定视口高度后隐藏子内容；最后一条 movement 在 1847、980、720、540px 宽度均通过完整可见和选择验证。Web 部署待单独执行。

## 详细执行计划

后续执行以 [完整任务执行手册](implementation-plan-2026-09-07.md) 为准。该文件保留 T01–T22 编号、补充 T23–T35，拆成 **40 个独立执行单元**，按优先级列出范围、步骤、验收、依赖及发布要求。原简表已由这份手册替代，避免两个清单产生冲突。

新增的 Radar 批量打开问题对应 T23-A/B/C；Synthesis Trend 双击最大化对应 T24；Radar 长列表滚动问题对应 T35。第一优先序仍为 T01 → T02 → T03；商店审核等待期间可推进其他独立任务。

## Chrome Web Store workflow

Manual release is a valid workflow. Google documents uploading a new full ZIP, updating metadata when needed, and submitting for review: https://developer.chrome.com/docs/webstore/update.

Recommended near-term flow: focused code commit → automated checks → versioned ZIP/hash → human store submission → installed-version acceptance. Track Dashboard deployment, database migrations, and extension store release separately: a backend deployment can reach users before their extension updates. Any API change must state which currently shipped extension versions it supports.

For every task handoff, record: scope, changed files, reproduction/acceptance tests, validation result, deployment requirements and outstanding external verification. Avoid task titles such as “全面优化插件” or “重构整个 Dashboard”; use a single observable behavior per task.

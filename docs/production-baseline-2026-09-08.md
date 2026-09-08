# Production baseline — 2026-09-08

Read-only snapshot captured at 2026-09-08 09:08 CST (UTC+08:00). No deploy,
migration, schedule change, notification, or Chrome Web Store action was made.

## Confirmed

| Area | Observed production state | Read evidence |
| --- | --- | --- |
| Web deploy | Netlify production deploy `6a9aa8638350520008309008` is `ready`; published 2026-09-04 19:16:08 CST from `main` revision `c8e7c9e4cfd05a3e41dd3c24aca82b0a31307f0d` (`Add privacy file via uploads`). | Public Netlify `GET /api/v1/sites/aiinsightpipeline.netlify.app` and deploy history. The live page returned HTTP 200 and assets `index-BsI9lzHI.js` / `index-BEemkLSt.css`. |
| GitHub | Remote `main` is `c8e7c9e`; the latest Quality run `33867108431` completed successfully for that SHA on 2026-09-04. | `git ls-remote origin refs/heads/main`; `gh run list`; [workflow run](https://github.com/Ziyan-AIES/ai-insight-pipeline/actions/runs/33867108431). |
| Local checkout relation | The current working base is `340ed5a`; the remote-only `c8e7c9e` commit adds the privacy file. The working tree also contains the uncommitted B01–B05 changes. | `git rev-parse HEAD`, GitHub commit API, and `git status`. The local `origin/main` tracking ref is stale, so it was not used as remote evidence. |
| Editorial schedule | Windows task `Signal Intelligence Editorial Review` is `Ready`, runs weekdays at 18:00 local time, and points to this repo's `scripts/run-local-editorial.ps1`. Last run: 2026-09-07 21:09:09, result `0`; log ended 21:09:18 with an empty queue and exit code 0. Next run observed: 2026-09-08 18:00. | Read-only `Get-ScheduledTask`, `Get-ScheduledTaskInfo`, and `logs/local-editorial.log`. |
| Chrome Web Store | Public item `bgmhnlbjfdnbfpjgmcmedjebcpjoppjc` reports version `0.4.6`, updated September 6, 2026, size 19.57 KiB. The user reports the item is unlisted and 0.4.8 has now been uploaded; its review/publication state is not yet recorded. | Public [Chrome Web Store item](https://chromewebstore.google.com/detail/ai-signals/bgmhnlbjfdnbfpjgmcmedjebcpjoppjc?hl=en) plus the user's developer-console update. |

## Configuration present, runtime success not confirmed

| Area | Repository configuration | Current limit of evidence |
| --- | --- | --- |
| Radar schedule | `netlify/functions/radar-scheduled.mjs` declares `17 */4 * * *`. | The public deploy response returned `function_schedules: null`, and the authenticated functions/log endpoint returned 401. This does not prove that the schedule is disabled or enabled. No recent scheduled invocation was observable. |
| Radar source health | `radar_sources` stores `last_fetched_at`, `last_success_at`, and `last_error`; the UI requires an authenticated team session. | No signed-in browser session or linked Supabase CLI was available. Per-source success/error timestamps remain unknown. Do not infer health from source configuration or an HTTP 200 feed probe. |
| Database migrations | Local committed timeline ends at `20260902173000_industry_radar.sql`; B05 adds an unapplied phase-1 migration dated `20260908090000` and a separate deferred phase-3 cleanup SQL dated `20260908090100`. | `supabase migration list --linked` failed because this checkout is not linked to a project. The applied production migration list was not readable. |
| API row cap | Local `supabase/config.toml` sets `api.max_rows = 1000`. | Hosted PostgREST settings were not readable; 1,000 is a local configuration value, not a confirmed production value. |

## Deployment differences and compatibility window

- B01 extension 0.4.8, B02 Radar scrolling, B03 Trend maximize, and B05
  editorial concurrency guards exist only in the local working tree.
- The public Store path remained 0.4.6 at the snapshot time. Version 0.4.8 has
  since been uploaded; review/publication and installed-version acceptance are
  still pending evidence.
- Production currently runs the older editorial endpoint and unguarded
  `apply_editorial_sync`. For B05, apply phase 1, deploy the guarded caller,
  verify one run, and only then apply phase 3. Applying phase 3 before the Web
  deploy would make the current production endpoint fail.
- A privileged follow-up is needed to record the hosted migration list,
  PostgREST row cap, Netlify scheduled invocation, and every Radar source's
  latest success/error. That follow-up should remain read-only until its
  discrepancies are reviewed.

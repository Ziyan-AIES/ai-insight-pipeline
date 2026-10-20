# Official source monitoring

This is part of Signal Reference and its existing Sources manager. There is no additional dashboard page. The one-time partnership review is retired; its user-approved import receipt is retained outside the deployed app.

## Verified coverage (2026-10-20)

`config/official-sources.json` is the allowlisted registry. All RSS endpoints were fetched and parsed, including real entry titles and original publication dates. OpenAI and Google were already present; update rather than duplicate them. Microsoft, NVIDIA (newsroom and blog), Samsung, Amazon (corporate and AWS), and Dell (blog and press releases) have working RSS. APIs are not required where public RSS already supplies the contract.

Anthropic's `/news/rss.xml`, `/rss.xml`, and `/news/feed` returned 404; its newsroom did not advertise a usable official news feed. HP's guessed newsroom feed returned 404 and its investor RSS returned 403. These results mean no usable feed was verified, not a claim that none can exist. HP security advisories and Anthropic status feeds do not replace product news. HP Inc. is distinct from HPE.

## Collection and display

RSS retains the existing four-hour scheduled ingest. Website Agent sources have an empty feed URL and source_type=official. The existing database connector_type field retains its legacy default; the application derives website_agent from official + empty feed URL. Both the four-hour ingester and the manual Refresh exclude these website sources from RSS fetching, preserving their independently recorded weekly status. The UI labels the actual method and Monday noon Beijing schedule. Clicking a source name opens its original newsroom; the RSS link opens the actual feed.

Agent discoveries use the same radar_items table and topic metrics as RSS, with raw_metadata.acquisition_method=website_agent and original date evidence. URL deduplication prevents rescans from inflating story counts. Source pauses are respected. Failed or incomplete scans record an error and do not advance last_success_at.

## Monday workflow

The Codex thread automation **每周官网信号扫描** runs Mondays at 12:00 Asia/Shanghai. It requires the local Codex automation executor to be available. Next scheduled slot after setup is 2026-10-26 12:00 Beijing. Inspect the latest registry and source status first; do not duplicate this automation or create another dashboard.

1. Browse the original Anthropic and HP newsrooms for the previous seven days. Check RSS failures and uncovered channels of other registry companies as a fallback. Use the original article, not a search snippet, to establish the development and publication date. Record a successful empty scan only after checking the site; site unavailability is a failure, not zero news.
2. Exclude unrelated corporate, financial-results, sponsorship, evergreen tutorial and marketing material. Retain concrete AI capabilities, experiences, devices, product integration, distribution or partnership changes. Distinguish announcements, pilots, launches, expansions and customer cases. Never treat modification time as a fresh publication or co-mentions as cooperation.
3. Save factual English titles and summaries. Existing supported radar topic rules must match the article's actual content; do not inject generic keywords to create a topic. Unsupported but promising developments are reported as taxonomy candidates rather than forced into a trend.
4. Use `node scripts/import-official-scan.mjs <reviewed-file.json>` to validate. Use `--apply` only after verification. This work has standing user authorization. Use the already configured service environment; never print/store keys, bundle private rows, or put scan files into public/.
5. Relevant signals enter radar_items. A subset with a concrete evidence-backed importance reason may also enter news_items as Selected Sources, with contributor **Agent**, captured_by=null, captured_via=automation, source_type=captured_news and editorial_status=pending. Original published_at and actual captured_at stay separate. Existing Editorial Review refines these records; it must preserve attribution, dates, human decisions and verified relationship metadata. Do not automatically create Trend/Research topics.
6. Read back records and source status. Remain quiet on no actionable change; report worthwhile additions, failures or required user action.

Input contract:

```json
{"sources":[{"key":"anthropic","complete":true,"items":[{
  "url":"https://www.anthropic.com/news/actual-article",
  "publishedAt":"YYYY-MM-DD",
  "dateEvidence":"Original publisher date shown on the article, with the observed field or heading",
  "articleRead":true,
  "title":"Factual English title",
  "summary":"Factual English account of the development, scope and availability. Use enough detail to establish its supported intelligence topic.",
  "promote":false,
  "importanceReason":"Required for promotion: what changed, supporting evidence and why this matters",
  "category":"ai_capability",
  "relationships":[]
}]}]}
```

For explicit cooperation, optional relationships entries have `from` and `to` company IDs, kind (partnership/integration/cloud/hardware/distribution), and an evidence paraphrase. Never infer a complete clique from multiple companies in an article. Source config keys and URLs are fixed by the registry, article dates are restricted to the past seven days, and canonical URL uniqueness protects existing Selected Sources. Promoted entries do not inherit Ziyan's authorship; only the ten explicitly selected partnership imports do.

## Operations

`node scripts/sync-official-sources.mjs` previews registry changes. `--apply` updates/adds official source rows without re-enabling paused existing sources. `--refresh` additionally reads only fixed registry RSS endpoints and seeds relevant past-week items. Its local fixed-URL fetch supports the local network proxy; production's DNS pinning and private-network SSRF protection remain unchanged.

If an import is interrupted, reread live rows before rerunning. Never overwrite existing source editorial content or personal New/read cursors. Source publication and actual discovery/capture timestamps serve different purposes.

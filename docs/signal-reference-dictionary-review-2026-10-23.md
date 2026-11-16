# Signal Reference dictionary review — 2026-10-23

## Delivery state

Prepared locally; not deployed, committed or pushed. No production data was changed. Production Supabase reads failed at the TLS connection stage through both direct and proxy transports, so current topic ranking, source health and item counts could not be verified. Do not represent this review as a live data cleanup.

## Mail evidence

Agent Mail returned all 23 inbox messages since October 16, with no further page. Eleven messages were selected for body review: news newsletters, article previews and the NFX digest. Eight bodies were retrieved. Three remained unavailable after bounded retries: The Briefing: Blackstone Banks on AI Bottlenecks; Salesforce Customers Brace For New Fees to Use Claude in Its Apps; CoreWeave’s debt reckoning, Nscale’s unbuilt data centers and lenders getting pickier on AI. Their inbox snippets provide leads only, not full-article evidence. The other twelve messages were subscription confirmations, welcome/onboarding messages, promotional offers and event marketing, excluded from news ingestion.

The eight reviewed bodies included AI Agenda on video production and on proposed R&D compute caps; Applied AI on bank attacks; The Briefing on AI-discovered PHP vulnerabilities; the NFX digest; and three article promotions/previews. Promotion footers, recommended stories, advertisements and upcoming events were excluded from substantive evidence. Newsletter receipt dates must not become original article dates. NFX's curated older essays must not count as newly published developments. Paid-article teasers are excerpts, not full articles.

Mailbox bodies and identifiers stay in ignored local logs. No email was sent, forwarded or deleted.

## Dictionary changes

`config/radar-topics.json` now supplies both frontend labels/descriptions and ingestion keyword rules. It contains the 37 existing topic IDs plus three new topics. Existing IDs remain stable so historical tags remain valid. This is a shared code configuration, not a runtime database dictionary: future changes still require deployment.

| Topic | Decision and matching boundary |
| --- | --- |
| AI coding agents | Rename Autonomous software engineering. Means agents that inspect repositories, edit code and run tests, with human review. Does not establish fully autonomous engineering. No manual ranking boost or demotion. |
| AI video generation and production | Broaden the existing text-to-video topic to cover production workflows, rather than only model launches. The October 22 AI Agenda body discusses studios using multiple models and production economics. |
| AI cybersecurity and misuse | New. Separate AI-enabled attacks, defense and vulnerability discovery from coding and general model safety. Supported by the October 21 Applied AI and Briefing bodies and Anthropic's security reporting. |
| Agent access, permissions and pricing | New. Track agent identity, permissions, registration and external-agent access fees. The Salesforce snippet is a lead; administrative access controls in the official enterprise release notes independently support this category. Do not treat proposed fees as already enacted. |
| AI compute capacity and economics | New. Separate capacity, power, GPU-cloud financing and inference economics from chip design and funding rounds. The reviewed AI Agenda body discusses compute allocation; the infrastructure newsletter snippets require full follow-up before import. |
| Open-weight models | Tighten matching. A mention of Hugging Face, Llama or Mistral alone is insufficient evidence of a weight release. Require explicit open/downloadable weight or open-source model wording. |
| Other 34 existing topics | Retain stable IDs and keyword rules; add plain-language definitions. Lack of evidence in this small mailbox sample is insufficient reason to delete a topic. |

Official cross-checks: [Anthropic security newsroom](https://www.anthropic.com/news/security), including its October 8 Cyber Mission and September misuse reporting; [enterprise release notes](https://help.openai.com/en/articles/10128477-chatgpt-enterprise-and-edu-release-notes), October 16 administrative app and external-access controls. These support taxonomy coverage; they are not presented as newly imported past-week stories.

## Why coding may remain first

The implementation has no hard-coded first-place topic. It ranks by distinct developments, source diversity, bounded momentum and engagement. Current weights are 12 per development and 14 per source, plus momentum and engagement. Consequently the list measures observed coverage more than strategic priority. Source mix, repeated story coverage and overly broad summaries can affect the result. The exact reason coding is first today requires live rows; it has not been established here.

No weight changes were made without that evidence. Future ranking review should compare 7-day and 30-day windows, underlying story keys, publication dates, duplicated URLs and source concentration. Newsletter sidebars must never create extra coding, funding or model tags on unrelated main stories.

## Pending live work

1. Retrieve the three unavailable message bodies and inspect the current production source/item rows.
2. Deduplicate newsletter leads against canonical article URLs and existing story keys. Import only editorial summaries based on available text; keep excerpt status, original date basis and `email_newsletter` acquisition metadata. Do not promote automatically to Selected Sources.
3. Preview changed topic assignments for existing items before applying corrections. Preserve item text, provenance, publication/discovery dates, source pauses and personal read state. Never clear tags merely because a current rule misses older wording.
4. Record complete, successful mailbox scans separately from incomplete scans. Do not advance successful source timestamps while three relevant bodies are missing.
5. Deploy only if the local dictionary changes are to become visible and used for subsequent collection. Database-only item updates require no site deployment. New topic tags alone would be hidden by the old deployed frontend, so do not write those tags as though the UI already supports them.

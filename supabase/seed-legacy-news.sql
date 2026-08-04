-- Generated from Browser Signal Watcher curated agent view.
-- Idempotent: canonical_url is the conflict key.
insert into public.news_items (
  canonical_url,
  title,
  source,
  raw_text,
  summary,
  category,
  image_url,
  captured_at,
  captured_via,
  editorial_status,
  editorial_updated_at,
  metadata
)
select
  item.canonical_url,
  item.title,
  item.source,
  item.raw_text,
  item.summary,
  item.category::public.news_category,
  item.image_url,
  item.captured_at,
  item.captured_via,
  item.editorial_status::public.editorial_status,
  item.editorial_updated_at,
  item.metadata
from jsonb_to_recordset($legacy$
[
  {
    "canonical_url": "https://www.granola.ai/blog/granola-for-apple-watch",
    "title": "Granola turns Apple Watch into a meeting-capture surface",
    "source": "www.granola.ai",
    "raw_text": "Granola has launched a free Apple Watch app (watchOS 11+) for starting and stopping notes from the wrist during walking 1:1s, whiteboard sessions, and other laptop-free meetings. Notes sync to iPhone, Mac, and Windows within moments and can flow into connected AI tools through Granola MCP. The signal: AI meeting capture is moving from a visible desktop workflow to an ambient wearable surface, making consent cues, review, and context handoff more important than transcription alone.",
    "summary": "Granola has launched a free Apple Watch app (watchOS 11+) for starting and stopping notes from the wrist during walking 1:1s, whiteboard sessions, and other laptop-free meetings. Notes sync to iPhone, Mac, and Windows within moments and can flow into connected AI tools through Granola MCP. The signal: AI meeting capture is moving from a visible desktop workflow to an ambient wearable surface, making consent cues, review, and context handoff more important than transcription alone.",
    "category": "ai_hardware",
    "image_url": "https://www.granola.ai/blogImages/watch5.jpg",
    "captured_at": "2026-07-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "c9f1581d3c49f9c4",
      "legacy_week": "2026-W31",
      "news_facts": [
        "Granola has launched a free Apple Watch app (watchOS 11+) for starting and stopping notes from the wrist during walking 1:1s, whiteboard sessions, and other laptop-free meetings. Notes sync to iPhone, Mac, and Windows within moments and can flow into connected AI tools through Granola MCP. The sign..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://mp.weixin.qq.com/s/c7I2nI_tjthOs369K5kXrg",
    "title": "DataFlow-Harness cuts code-agent data-pipeline cost 72.5%",
    "source": "mp.weixin.qq.com",
    "raw_text": "DataFlow-Harness turns code-agent requests into editable DataFlow DAGs by combining a live operator registry via MCP, task-specific Skills, and a dual chat/canvas UI. In 12 data-engineering tasks, it reports a 93.3% end-to-end pass rate versus 91.7% for vanilla Claude Code, with $0.261 versus $0.950 per run (72.5% lower cost) and 95.5 versus 190.7 seconds (49.9% lower latency). On Textbook-to-VQA it reports 97.2% precision and 87.3% coverage; these are project-reported results, not independently verified. Signal:...",
    "summary": "DataFlow-Harness turns code-agent requests into editable DataFlow DAGs by combining a live operator registry via MCP, task-specific Skills, and a dual chat/canvas UI. In 12 data-engineering tasks, it reports a 93.3% end-to-end pass rate versus 91.7% for vanilla Claude Code, with $0.261 versus $0.950 per run (72.5% lower cost) and 95.5 versus 190.7 seconds (49.9% lower latency). On Textbook-to-VQA it reports 97.2% precision and 87.3% coverage; these are project-reported results, not independently verified. Signal:...",
    "category": "ai_capability",
    "image_url": "https://mmbiz.qpic.cn/sz_mmbiz_jpg/zJVQUll3YIZrjqnrufSddKWDb6T8A3NwYIpxXQzMd34bOtXMAjsA2sCCuhlWPx9DviaMgxvRgIicCTaewV6mglfcb9vI2NhZ4Lw1zrymqT84E/0?wx_fmt=jpeg",
    "captured_at": "2026-07-27T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "3f50de307331b44b",
      "legacy_week": "2026-W31",
      "news_facts": [
        "DataFlow-Harness turns code-agent requests into editable DataFlow DAGs by combining a live operator registry via MCP, task-specific Skills, and a dual chat/canvas UI. In 12 data-engineering tasks, it reports a 93.3% end-to-end pass rate versus 91.7% for vanilla Claude Code, with $0.261 versus $0.95..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/09/popular-open-source-ai-developer-tool-ollama-raises-65m-grows-to-nearly-9m-users/",
    "title": "Ollama raises $65M as local open-model use reaches 8.9M developers",
    "source": "techcrunch.com",
    "raw_text": "Ollama has raised a $65 million Series B, taking total funding to $88 million, as it reports more than 8.9 million monthly developers and use in 85% of the Fortune 500. Its free desktop runtime makes open-weight models practical on local machines, while subscriptions provide hosted compute for larger models that will not fit locally. The signal: open-model adoption is maturing into a hybrid infrastructure market where developers expect a portable local default and burst capacity when workloads demand it.",
    "summary": "Ollama has raised a $65 million Series B, taking total funding to $88 million, as it reports more than 8.9 million monthly developers and use in 85% of the Fortune 500. Its free desktop runtime makes open-weight models practical on local machines, while subscriptions provide hosted compute for larger models that will not fit locally. The signal: open-model adoption is maturing into a hybrid infrastructure market where developers expect a portable local default and burst capacity when workloads demand it.",
    "category": "ai_capability",
    "image_url": "https://techcrunch.com/wp-content/uploads/2026/07/Ollama-founders-Jeff-Morgan-left-and-Michael-Chiang-right.jpg?resize=1200,825",
    "captured_at": "2026-07-23T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "5d77deb799966360",
      "legacy_week": "2026-W30",
      "news_facts": [
        "Ollama has raised a $65 million Series B, taking total funding to $88 million, as it reports more than 8.9 million monthly developers and use in 85% of the Fortune 500. Its free desktop runtime makes open-weight models practical on local machines, while subscriptions provide hosted compute for larg..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/13/satya-nadella-has-issued-a-shocking-warning-to-companies-using-ai/",
    "title": "Nadella urges enterprises to retain ownership of AI usage data",
    "source": "techcrunch.com",
    "raw_text": "Microsoft CEO Satya Nadella argues that enterprises pay twice for proprietary AI: once in token spend and again by exposing prompts, agent-tool use, and corrections that encode institutional know-how. He calls for proprietary learning environments and model-switching orchestration; the article cites Vercel data showing open models handled 29% of gateway traffic last month. The signal: model choice is becoming an enterprise-control decision, with data ownership, portability, and on-prem deployment shaping the next...",
    "summary": "Microsoft CEO Satya Nadella argues that enterprises pay twice for proprietary AI: once in token spend and again by exposing prompts, agent-tool use, and corrections that encode institutional know-how. He calls for proprietary learning environments and model-switching orchestration; the article cites Vercel data showing open models handled 29% of gateway traffic last month. The signal: model choice is becoming an enterprise-control decision, with data ownership, portability, and on-prem deployment shaping the next...",
    "category": "ecosystem",
    "image_url": "https://techcrunch.com/wp-content/uploads/2023/11/GettyImages-1778706504.jpg?resize=1200,783",
    "captured_at": "2026-07-23T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "6fc155c9f7612184",
      "legacy_week": "2026-W30",
      "news_facts": [
        "Microsoft CEO Satya Nadella argues that enterprises pay twice for proprietary AI: once in token spend and again by exposing prompts, agent-tool use, and corrections that encode institutional know-how. He calls for proprietary learning environments and model-switching orchestration; the article cite..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcommunity.microsoft.com/blog/appsonazureblog/shared-agent-context-how-we-are-tackling-partner-agent-collaboration/4505714",
    "title": "Microsoft proposes shared context for collaborating partner agents",
    "source": "techcommunity.microsoft.com",
    "raw_text": "Microsoft's Azure SRE Agent team identifies a practical multi-agent failure mode: partner agents working on the same incident need to share context and retain it after the work is complete. The signal is that agent interoperability depends on persistent, transferable operational state—not simply connecting more tools or model endpoints.",
    "summary": "Microsoft's Azure SRE Agent team identifies a practical multi-agent failure mode: partner agents working on the same incident need to share context and retain it after the work is complete. The signal is that agent interoperability depends on persistent, transferable operational state—not simply connecting more tools or model endpoints.",
    "category": "ai_capability",
    "image_url": "https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTA1NzE0LU1ZTDkzbQ?revision=1",
    "captured_at": "2026-07-20T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "082eded01b1d0978",
      "legacy_week": "2026-W30",
      "news_facts": [
        "Microsoft's Azure SRE Agent team identifies a practical multi-agent failure mode: partner agents working on the same incident need to share context and retain it after the work is complete. The signal is that agent interoperability depends on persistent, transferable operational state—not simply co..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://mp.weixin.qq.com/s/lX5qxOZgVc-mFaXpQfzbrQ",
    "title": "Meshy raises nearly $400M Series B for AI-generated 3D",
    "source": "mp.weixin.qq.com",
    "raw_text": "Meshy has raised nearly $400 million in a Series B at a post-money valuation above RMB 10 billion, described by its investor as the largest single financing yet in AI 3D. The company says the capital will fund multimodal-model R&D and global expansion; it reports 12x annual recurring revenue growth, more than 12 million registered users, and over 100 million generated 3D models. The specific signal: text- and image-to-3D is moving from a creative demo toward a capital-intensive production market, where commercial....",
    "summary": "Meshy has raised nearly $400 million in a Series B at a post-money valuation above RMB 10 billion, described by its investor as the largest single financing yet in AI 3D. The company says the capital will fund multimodal-model R&D and global expansion; it reports 12x annual recurring revenue growth, more than 12 million registered users, and over 100 million generated 3D models. The specific signal: text- and image-to-3D is moving from a creative demo toward a capital-intensive production market, where commercial....",
    "category": "ecosystem",
    "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTdXaLCFnel1JvkLn2Py8fkc4pZubVbXxkwFh1ULWuDMbRpiMgngY-sEtX6&s=10",
    "captured_at": "2026-07-20T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "bf467d0f968b07db",
      "legacy_week": "2026-W30",
      "news_facts": [
        "Meshy has raised nearly $400 million in a Series B at a post-money valuation above RMB 10 billion, described by its investor as the largest single financing yet in AI 3D. The company says the capital will fund multimodal-model R&D and global expansion; it reports 12x annual recurring revenue growth..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/02/26/trace-raises-3-million-to-solve-the-agent-adoption-problem/",
    "title": "Trace raises $3M to map enterprise context for AI agents",
    "source": "techcrunch.com",
    "raw_text": "Trace raised a $3 million seed round to build a knowledge graph from systems such as email, Slack, and Airtable, then turn high-level requests into workflows delegated across people and AI agents. Its framing is a useful marker: enterprise agent adoption is being recast from prompt engineering to context engineering, where the differentiator is supplying the right permissions, process knowledge, and data to each sub-task.",
    "summary": "Trace raised a $3 million seed round to build a knowledge graph from systems such as email, Slack, and Airtable, then turn high-level requests into workflows delegated across people and AI agents. Its framing is a useful marker: enterprise agent adoption is being recast from prompt engineering to context engineering, where the differentiator is supplying the right permissions, process knowledge, and data to each sub-task.",
    "category": "ecosystem",
    "image_url": "https://techcrunch.com/wp-content/uploads/2026/02/Trace_TechCrunch.jpg?resize=1200,961",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "ea2a22594e77fd6a",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Trace raised a $3 million seed round to build a knowledge graph from systems such as email, Slack, and Airtable, then turn high-level requests into workflows delegated across people and AI agents. Its framing is a useful marker: enterprise agent adoption is being recast from prompt engineering to c..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/16/roblox-launches-an-ai-powered-game-creation-feature-in-its-mobile-app/",
    "title": "Roblox puts text-to-game creation into its mobile app",
    "source": "techcrunch.com",
    "raw_text": "Roblox is launching Build, a mobile feature that turns text prompts into editable starter games, including mechanics, environments, characters, visual style, and sound. The public alpha begins July 28 in New Zealand for verified users aged nine and above; Roblox plans to rank resulting games by player retention rather than simply generating more content. The sharp signal: generative creation is becoming a consumer platform feature, with discovery quality becoming the essential guardrail.",
    "summary": "Roblox is launching Build, a mobile feature that turns text prompts into editable starter games, including mechanics, environments, characters, visual style, and sound. The public alpha begins July 28 in New Zealand for verified users aged nine and above; Roblox plans to rank resulting games by player retention rather than simply generating more content. The sharp signal: generative creation is becoming a consumer platform feature, with discovery quality becoming the essential guardrail.",
    "category": "ai_software",
    "image_url": "https://techcrunch.com/wp-content/uploads/2026/07/Roblox-Build-feature.jpeg?w=1200",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "fdcdbc9b728ff22d",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Roblox is launching Build, a mobile feature that turns text prompts into editable starter games, including mechanics, environments, characters, visual style, and sound. The public alpha begins July 28 in New Zealand for verified users aged nine and above; Roblox plans to rank resulting games by pla..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://venturebeat.com/technology/chinas-moonshot-ai-releases-kimi-k3-the-largest-open-source-model-ever-rivaling-top-u-s-systems",
    "title": "Moonshot's Kimi K3 pushes open models toward frontier scale",
    "source": "venturebeat.com",
    "raw_text": "Moonshot AI has announced Kimi K3, a 2.8-trillion-parameter model with a one-million-token context window, native visual understanding, and an always-on reasoning mode; full weights are scheduled for July 27. The company claims near-frontier benchmark results and OpenAI-SDK-compatible APIs. The meaningful signal is that open-model competition is shifting from low-cost alternatives to large-scale, long-horizon agent capability, while deployment economics remain a serious constraint.",
    "summary": "Moonshot AI has announced Kimi K3, a 2.8-trillion-parameter model with a one-million-token context window, native visual understanding, and an always-on reasoning mode; full weights are scheduled for July 27. The company claims near-frontier benchmark results and OpenAI-SDK-compatible APIs. The meaningful signal is that open-model competition is shifting from low-cost alternatives to large-scale, long-horizon agent capability, while deployment economics remain a serious constraint.",
    "category": "ai_capability",
    "image_url": "https://images.ctfassets.net/jdtwqhzvc2n1/lrqUsUJocTIEaPB4SrQse/e8773a218e398efc6759ca6044672f81/Nuneybits_Vector_art_of_red_code_tsunami_over_servers_fear_of_C_1894f89b-b074-4e21-a0de-2f9a46cfdd32.webp?w=800&q=75",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "7275581a87ce3d87",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Moonshot AI has announced Kimi K3, a 2.8-trillion-parameter model with a one-million-token context window, native visual understanding, and an always-on reasoning mode; full weights are scheduled for July 27. The company claims near-frontier benchmark results and OpenAI-SDK-compatible APIs. The mea..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://aitoolly.com/ai-news/article/2026-07-17-hkuds-releases-vibe-trading-a-new-open-source-personal-ai-trading-agent-for-financial-markets",
    "title": "HKUDS releases Vibe-Trading, an open-source personal AI trading agent",
    "source": "aitoolly.com",
    "raw_text": "HKUDS has released Vibe-Trading, an open-source personal agent for financial-market analysis and trading workflows. The signal is not generic fintech automation: publishing the agent as open source turns trading research, data interpretation, and execution design into a reusable software stack that users can inspect and adapt, while leaving risk controls and real-money accountability as the hard unsolved layer.",
    "summary": "HKUDS has released Vibe-Trading, an open-source personal agent for financial-market analysis and trading workflows. The signal is not generic fintech automation: publishing the agent as open source turns trading research, data interpretation, and execution design into a reusable software stack that users can inspect and adapt, while leaving risk controls and real-money accountability as the hard unsolved layer.",
    "category": "ai_software",
    "image_url": "https://opengraph.githubassets.com/1/HKUDS/Vibe-Trading",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "bcc0eab9be811cad",
      "legacy_week": "2026-W29",
      "news_facts": [
        "HKUDS has released Vibe-Trading, an open-source personal agent for financial-market analysis and trading workflows. The signal is not generic fintech automation: publishing the agent as open source turns trading research, data interpretation, and execution design into a reusable software stack that..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://openai.com/index/introducing-gpt-live/",
    "title": "GPT-Live makes ChatGPT Voice continuous and full-duplex",
    "source": "openai.com",
    "raw_text": "OpenAI's GPT-Live voice models continuously listen and generate rather than waiting for discrete turns, allowing interruptions, acknowledgements, pauses, and live translation to feel more conversational. For deeper work, the voice layer delegates search and reasoning to a frontier model in the background while keeping the conversation moving. The signal is an architectural split between real-time interaction and asynchronous intelligence, not merely a smoother voice UI.",
    "summary": "OpenAI's GPT-Live voice models continuously listen and generate rather than waiting for discrete turns, allowing interruptions, acknowledgements, pauses, and live translation to feel more conversational. For deeper work, the voice layer delegates search and reasoning to a frontier model in the background while keeping the conversation moving. The signal is an architectural split between real-time interaction and asynchronous intelligence, not merely a smoother voice UI.",
    "category": "interaction",
    "image_url": "https://images.ctfassets.net/kftzwdyauwt9/3T8Bs213F18JY4q9COr0Fz/c14be1a666c713ad0a5cb0c6f4f15eb8/Grandma_Hero_Thumbnail_16x9.jpg?w=1920&q=50&fm=webp",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "c84f0489248c095a",
      "legacy_week": "2026-W29",
      "news_facts": [
        "OpenAI's GPT-Live voice models continuously listen and generate rather than waiting for discrete turns, allowing interruptions, acknowledgements, pauses, and live translation to feel more conversational. For deeper work, the voice layer delegates search and reasoning to a frontier model in the back..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://openai.com/index/gpt-5-6/",
    "title": "GPT-5.6 expands the model-efficiency and multi-agent frontier",
    "source": "openai.com",
    "raw_text": "OpenAI's GPT-5.6 family introduces Sol, Terra, and Luna tiers, with higher-effort settings and an ultra mode that coordinates four agents in parallel. The release emphasizes more useful work per token, stronger coding and computer-use performance, programmatic tool calling, and more predictable prompt caching. The specific strategic signal is that frontier progress is being productized as configurable orchestration and efficiency, not only as a single larger model.",
    "summary": "OpenAI's GPT-5.6 family introduces Sol, Terra, and Luna tiers, with higher-effort settings and an ultra mode that coordinates four agents in parallel. The release emphasizes more useful work per token, stronger coding and computer-use performance, programmatic tool calling, and more predictable prompt caching. The specific strategic signal is that frontier progress is being productized as configurable orchestration and efficiency, not only as a single larger model.",
    "category": "ai_capability",
    "image_url": "https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "caaa735c832bdb26",
      "legacy_week": "2026-W29",
      "news_facts": [
        "OpenAI's GPT-5.6 family introduces Sol, Terra, and Luna tiers, with higher-effort settings and an ultra mode that coordinates four agents in parallel. The release emphasizes more useful work per token, stronger coding and computer-use performance, programmatic tool calling, and more predictable pro..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://www.lobsterpack.com/blog/exo-distributed-ai-cluster-macs/",
    "title": "Exo pools Macs into a local AI inference cluster",
    "source": "www.lobsterpack.com",
    "raw_text": "Exo is an open-source system that combines multiple Apple Silicon Macs into one local inference cluster, using pipeline parallelism over ordinary networks and tensor parallelism with Thunderbolt 5 RDMA for lower-latency scaling. Reported throughput gains make larger local models possible, but long-context performance, fragile setup, and limited platform support remain practical constraints. The signal is that consumer hardware clusters are becoming a plausible, if still specialist, form factor for local frontier-m...",
    "summary": "Exo is an open-source system that combines multiple Apple Silicon Macs into one local inference cluster, using pipeline parallelism over ordinary networks and tensor parallelism with Thunderbolt 5 RDMA for lower-latency scaling. Reported throughput gains make larger local models possible, but long-context performance, fragile setup, and limited platform support remain practical constraints. The signal is that consumer hardware clusters are becoming a plausible, if still specialist, form factor for local frontier-m...",
    "category": "ai_hardware",
    "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKzzWvbLeWXOsZrA3VJFL9sitvWULJB3fue3_KJGqgNQ&s=10",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "773bd90f83c65ba1",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Exo is an open-source system that combines multiple Apple Silicon Macs into one local inference cluster, using pipeline parallelism over ordinary networks and tensor parallelism with Thunderbolt 5 RDMA for lower-latency scaling. Reported throughput gains make larger local models possible, but long-..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/16/yes-you-can-now-order-doordash-from-the-command-line/",
    "title": "DoorDash brings food ordering to the command line",
    "source": "techcrunch.com",
    "raw_text": "DoorDash has released a command-line interface that lets developers search menus, add items, and place delivery orders from a terminal. The specific signal is that agent-facing commerce is moving beyond chat integrations toward programmable interfaces: an AI coding agent can potentially complete a real-world purchase through the same tool surface it uses for software work. The limiting factor shifts from interface novelty to permissions, payment controls, and reliable confirmation flows.",
    "summary": "DoorDash has released a command-line interface that lets developers search menus, add items, and place delivery orders from a terminal. The specific signal is that agent-facing commerce is moving beyond chat integrations toward programmable interfaces: an AI coding agent can potentially complete a real-world purchase through the same tool surface it uses for software work. The limiting factor shifts from interface novelty to permissions, payment controls, and reliable confirmation flows.",
    "category": "ai_software",
    "image_url": "https://techcrunch.com/wp-content/uploads/2019/01/dasher_ps_horiz_5.jpg?w=1200",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "f40f21a3f6d4232b",
      "legacy_week": "2026-W29",
      "news_facts": [
        "DoorDash has released a command-line interface that lets developers search menus, add items, and place delivery orders from a terminal. The specific signal is that agent-facing commerce is moving beyond chat integrations toward programmable interfaces: an AI coding agent can potentially complete a..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://www.anthropic.com/claude/fable",
    "title": "Claude Fable 5 targets hard knowledge work and coding",
    "source": "www.anthropic.com",
    "raw_text": "Anthropic's Claude Fable 5 is positioned as a fifth-generation model for demanding knowledge work and coding, following a July 1 restoration of access. The practical signal is competitive pressure around durable frontier capability tiers: labs are packaging model progress around professional workflows where reliability, coding depth, and long-context work matter more than a single benchmark claim.",
    "summary": "Anthropic's Claude Fable 5 is positioned as a fifth-generation model for demanding knowledge work and coding, following a July 1 restoration of access. The practical signal is competitive pressure around durable frontier capability tiers: labs are packaging model progress around professional workflows where reliability, coding depth, and long-context work matter more than a single benchmark claim.",
    "category": "ai_capability",
    "image_url": "https://www.anthropic.com/_next/image?url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F1e65982497d7d4891219ed0e83141625a291b860-2600x2870.png&w=3840&q=75",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "e0f1ebb59adf2f6c",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Anthropic's Claude Fable 5 is positioned as a fifth-generation model for demanding knowledge work and coding, following a July 1 restoration of access. The practical signal is competitive pressure around durable frontier capability tiers: labs are packaging model progress around professional workfl..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://aitoolly.com/ai-news/article/2026-07-17-the-ai-agent-security-gap-54-of-enterprises-face-incidents-as-identity-and-isolation-controls-lag-be",
    "title": "Agent security gap exposes weak identity and isolation controls",
    "source": "aitoolly.com",
    "raw_text": "A reported 54% of enterprises have encountered AI-agent security incidents as identity, authorization, and isolation controls lag deployment. The important signal is operational: agents are expanding the software attack surface because they act across tools and data, so enterprise adoption now depends on scoped credentials, runtime isolation, audit trails, and revocation, not just model safety policies.",
    "summary": "A reported 54% of enterprises have encountered AI-agent security incidents as identity, authorization, and isolation controls lag deployment. The important signal is operational: agents are expanding the software attack surface because they act across tools and data, so enterprise adoption now depends on scoped credentials, runtime isolation, audit trails, and revocation, not just model safety policies.",
    "category": "ai_software",
    "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTP7sBF3oQcyNVU_AemzJ6qEZMw6k0fegXw6cfpsBf56A&s=10",
    "captured_at": "2026-07-17T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "02f52ce963a762c1",
      "legacy_week": "2026-W29",
      "news_facts": [
        "A reported 54% of enterprises have encountered AI-agent security incidents as identity, authorization, and isolation controls lag deployment. The important signal is operational: agents are expanding the software attack surface because they act across tools and data, so enterprise adoption now depe..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://openai.com/supply/co-lab/work-louder/",
    "title": "Supply Co. x Work Louder | OpenAI",
    "source": "openai.com",
    "raw_text": "Supply Co. x Work Louder | OpenAI Supply Co. Co-Lab Shop Archive About FAQ Cart (0) WORK LOUDER CO-LAB Codex Micro Your command center for agentic work <- -> Codex Micro $230.00 Designed with Work Louder, the kbd-1.0-codex-micro brings your agent workspace into reach. Keep active chats close, spot what every agent is doing through live RGB feedback, and map your most-used...",
    "summary": "Supply Co. x Work Louder | OpenAI Supply Co. Co-Lab Shop Archive About FAQ Cart (0) WORK LOUDER CO-LAB Codex Micro Your command center for agentic work <- -> Codex Micro $230.00 Designed with Work Louder, the kbd-1.0-codex-micro brings your agent workspace into reach. Keep active chats close, spot what every agent is doing through live RGB feedback, and map your most-used...",
    "category": "ai_hardware",
    "image_url": "https://images.ctfassets.net/kftzwdyauwt9/3bAzEozzzAWqy2f1BMvAuz/bcfc7a0e2e6ae625e055f1a5352e43ce/fb0af558aeefeb2028a846cc4f6c18a5ca7be532_1.png?w=1920&q=90&fm=webp",
    "captured_at": "2026-07-16T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "f58c86e8a774fc87",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Supply Co. x Work Louder | OpenAI Supply Co. Co-Lab Shop Archive About FAQ Cart (0) WORK LOUDER CO-LAB Codex Micro Your command center for agentic work <- -> Codex Micro $230.00 Designed with Work Louder, the kbd-1.0-codex-micro brings your agent workspace into reach. Keep active chats close, spot..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/14/openais-first-hardware-device-is-reportedly-a-screenless-speaker-that-can-move/",
    "title": "OpenAI's first hardware device is reportedly a screenless speaker that can move | TechCrunch",
    "source": "techcrunch.com",
    "raw_text": "OpenAI's first hardware device is reportedly a screenless speaker that can move",
    "summary": "OpenAI's first hardware device is reportedly a screenless speaker that can move",
    "category": "ai_hardware",
    "image_url": "https://techcrunch.com/wp-content/uploads/2026/05/GettyImages-2273246979.jpg?resize=1200,800",
    "captured_at": "2026-07-15T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "35994e21c94b28ee",
      "legacy_week": "2026-W29",
      "news_facts": [
        "OpenAI's first hardware device is reportedly a screenless speaker that can move"
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/14/the-real-ai-race-may-no-longer-be-at-the-frontier-open-models-hugging-face/",
    "title": "Open-weight Chinese models gain the volume layer of AI deployment",
    "source": "techcrunch.com",
    "raw_text": "Chinese open-weight models accounted for 41% of Hugging Face downloads this spring, ahead of U.S. models; the article says the top six models on OpenRouter were Chinese open models, while Anthropic's Claude Opus 4.7 ranked seventh. Vercel data adds the operating pattern: open models processed nearly one-third of AI requests in June, taking volume-heavy infrastructure work while closed models remain the premium, higher-cost tier. The signal: model competition is separating into an open, cost-efficient throughput la...",
    "summary": "Chinese open-weight models accounted for 41% of Hugging Face downloads this spring, ahead of U.S. models; the article says the top six models on OpenRouter were Chinese open models, while Anthropic's Claude Opus 4.7 ranked seventh. Vercel data adds the operating pattern: open models processed nearly one-third of AI requests in June, taking volume-heavy infrastructure work while closed models remain the premium, higher-cost tier. The signal: model competition is separating into an open, cost-efficient throughput la...",
    "category": "ai_capability",
    "image_url": "https://techcrunch.com/wp-content/uploads/2026/07/GettyImages-1849294862.jpg?w=1024",
    "captured_at": "2026-07-15T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "66220a2e8887df29",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Chinese open-weight models accounted for 41% of Hugging Face downloads this spring, ahead of U.S. models; the article says the top six models on OpenRouter were Chinese open models, while Anthropic's Claude Opus 4.7 ranked seventh. Vercel data adds the operating pattern: open models processed nearl..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/14/metas-adam-mosseri-says-ai-token-budgets-could-soon-be-capped-per-engineer/",
    "title": "Meta signals AI coding spend will become a managed engineering budget",
    "source": "techcrunch.com",
    "raw_text": "Instagram head Adam Mosseri says that within one or two years a strong engineer's AI token burn could approach their salary or total employment cost, making spend caps plausible. Meta reportedly removed an internal token-spend leaderboard as its 2026 AI costs headed toward billions; Uber and Microsoft are cited as further signs that unrestricted coding-agent use is meeting budget controls. The signal: AI-assisted development is becoming a FinOps and management-design problem, with teams likely to receive explicit...",
    "summary": "Instagram head Adam Mosseri says that within one or two years a strong engineer's AI token burn could approach their salary or total employment cost, making spend caps plausible. Meta reportedly removed an internal token-spend leaderboard as its 2026 AI costs headed toward billions; Uber and Microsoft are cited as further signs that unrestricted coding-agent use is meeting budget controls. The signal: AI-assisted development is becoming a FinOps and management-design problem, with teams likely to receive explicit...",
    "category": "ai_software",
    "image_url": "https://techcrunch.com/wp-content/uploads/2026/07/adam-mosseri-GettyImages-2239561007.jpg?w=1024",
    "captured_at": "2026-07-15T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "69ce0fd8251fbfc5",
      "legacy_week": "2026-W29",
      "news_facts": [
        "Instagram head Adam Mosseri says that within one or two years a strong engineer's AI token burn could approach their salary or total employment cost, making spend caps plausible. Meta reportedly removed an internal token-spend leaderboard as its 2026 AI costs headed toward billions; Uber and Micros..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://mp.weixin.qq.com/s/Kvr_rb6WnAlBQo9wqa3uSA",
    "title": "Glean founder: enterprise AI moats sit in workflows, permissions, and cost control",
    "source": "mp.weixin.qq.com",
    "raw_text": "A Chinese-language interview summary argues that frontier models are commoditising faster than enterprise application layers. Glean founder Arvind Jain argues that shallow vertical suites cannot replace the permissions, deep organisational context, and system integrations that make enterprise software sticky; the article also cites a Glean agent that handled 95% of alerts for a 15-person on-call team but incurred roughly one million dollars in monthly compute. The signal: enterprise AI value will be decided by gov...",
    "summary": "A Chinese-language interview summary argues that frontier models are commoditising faster than enterprise application layers. Glean founder Arvind Jain argues that shallow vertical suites cannot replace the permissions, deep organisational context, and system integrations that make enterprise software sticky; the article also cites a Glean agent that handled 95% of alerts for a 15-person on-call team but incurred roughly one million dollars in monthly compute. The signal: enterprise AI value will be decided by gov...",
    "category": "ai_software",
    "image_url": "https://techcrunch.com/wp-content/uploads/2026/02/GettyImages-2259183614.jpg",
    "captured_at": "2026-07-15T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "48e277b625c7d986",
      "legacy_week": "2026-W29",
      "news_facts": [
        "A Chinese-language interview summary argues that frontier models are commoditising faster than enterprise application layers. Glean founder Arvind Jain argues that shallow vertical suites cannot replace the permissions, deep organisational context, and system integrations that make enterprise softw..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/11/openai-bets-on-families-as-chatgpt-goes-deeper-into-households/",
    "title": "OpenAI prepares ChatGPT for family and caregiver use",
    "source": "techcrunch.com",
    "raw_text": "OpenAI is hiring a product manager for family, caregiver, and older-adult experiences as ChatGPT broadens beyond its early-user base. Sensor Tower estimates the global share of ChatGPT users aged 35+ rose from 26% to 31% year over year; among U.S. smartphone users who are parents, 24% used ChatGPT in Q2, up from 16%. The specific signal: consumer AI is moving from a personal productivity tool toward shared household infrastructure, which raises requirements for age-appropriate modes, parental controls, caregiver a...",
    "summary": "OpenAI is hiring a product manager for family, caregiver, and older-adult experiences as ChatGPT broadens beyond its early-user base. Sensor Tower estimates the global share of ChatGPT users aged 35+ rose from 26% to 31% year over year; among U.S. smartphone users who are parents, 24% used ChatGPT in Q2, up from 16%. The specific signal: consumer AI is moving from a personal productivity tool toward shared household infrastructure, which raises requirements for age-appropriate modes, parental controls, caregiver a...",
    "category": "ai_software",
    "image_url": "https://techcrunch.com/wp-content/uploads/2025/01/GettyImages-2170386424.jpg?w=1024",
    "captured_at": "2026-07-14T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "015c66f9892c3cd0",
      "legacy_week": "2026-W29",
      "news_facts": [
        "OpenAI is hiring a product manager for family, caregiver, and older-adult experiences as ChatGPT broadens beyond its early-user base. Sensor Tower estimates the global share of ChatGPT users aged 35+ rose from 26% to 31% year over year; among U.S. smartphone users who are parents, 24% used ChatGPT..."
      ],
      "implications": [],
      "save_count": 2,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://lite.ego.app/",
    "title": "ego lite: Fastest browser for AI agents to run web automation",
    "source": "lite.ego.app",
    "raw_text": "ego lite positions itself as a browser built for AI agents to run web automation using the user's logged-in browser state, with isolated spaces for agents. The signal is that browsers are becoming agent runtime surfaces, not just human interfaces.",
    "summary": "ego lite positions itself as a browser built for AI agents to run web automation using the user's logged-in browser state, with isolated spaces for agents. The signal is that browsers are becoming agent runtime surfaces, not just human interfaces.",
    "category": "interaction",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "0859c1268e5a55b8",
      "legacy_week": "2026-W27",
      "news_facts": [
        "ego lite positions itself as a browser built for AI agents to run web automation using the user's logged-in browser state, with isolated spaces for agents. The signal is that browsers are becoming agent runtime surfaces, not just human interfaces."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/02/yep-were-using-openclaw-to-date-now/",
    "title": "Yep, we're using OpenClaw to date now",
    "source": "techcrunch.com",
    "raw_text": "TechCrunch covers how users are repurposing OpenClaw-style agents for dating workflows, including automated content generation, date planning, and breakup messages. The signal is that consumer agents are spreading into intimate, high-context personal tasks where consent, privacy, and human-in-the-loop boundaries matter.",
    "summary": "TechCrunch covers how users are repurposing OpenClaw-style agents for dating workflows, including automated content generation, date planning, and breakup messages. The signal is that consumer agents are spreading into intimate, high-context personal tasks where consent, privacy, and human-in-the-loop boundaries matter.",
    "category": "ai_software",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "58c8298c3319f5d8",
      "legacy_week": "2026-W27",
      "news_facts": [
        "TechCrunch covers how users are repurposing OpenClaw-style agents for dating workflows, including automated content generation, date planning, and breakup messages. The signal is that consumer agents are spreading into intimate, high-context personal tasks where consent, privacy, and human-in-the-l..."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://mp.weixin.qq.com/s/XNOe0hPiFw3xdGiKSMek7A",
    "title": "Why AI visual generation still misses the point: a 500+ paper survey on consistency",
    "source": "mp.weixin.qq.com",
    "raw_text": "A Chinese article summarizing a major survey from USTC, Tsinghua, Cambridge, and others on consistency in diffusion-based visual generation. The key frame is that image quality alone no longer defines reliability: systems must maintain external consistency with prompts and references, internal consistency across identity, time, and views, and normative consistency with safety, preference, physics, and causal standards. The subtle signal is a shift from beautiful samples toward relationship-preserving generation sy...",
    "summary": "A Chinese article summarizing a major survey from USTC, Tsinghua, Cambridge, and others on consistency in diffusion-based visual generation. The key frame is that image quality alone no longer defines reliability: systems must maintain external consistency with prompts and references, internal consistency across identity, time, and views, and normative consistency with safety, preference, physics, and causal standards. The subtle signal is a shift from beautiful samples toward relationship-preserving generation sy...",
    "category": "ai_capability",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "20b98b3de6420c63",
      "legacy_week": "2026-W27",
      "news_facts": [
        "A Chinese article summarizing a major survey from USTC, Tsinghua, Cambridge, and others on consistency in diffusion-based visual generation. The key frame is that image quality alone no longer defines reliability: systems must maintain external consistency with prompts and references, internal cons..."
      ],
      "implications": [],
      "save_count": 2,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://mp.weixin.qq.com/s/wz3ojPY31qULawAwogRfWA",
    "title": "Terax: a 7MB AI-native terminal that bundles agent, editor, file manager, browser preview, and Git",
    "source": "mp.weixin.qq.com",
    "raw_text": "A Chinese write-up on Terax, a lightweight AI terminal that combines an agent sidebar, code editor, file manager, shell, web preview, Git panel, and provider-flexible model access. The interesting signal is not simply another coding assistant, but a compact interaction model where the terminal becomes a safe agent workbench with reviewable diffs, permission prompts, sub-agents, background tasks, and project memory via TERAX.md.",
    "summary": "A Chinese write-up on Terax, a lightweight AI terminal that combines an agent sidebar, code editor, file manager, shell, web preview, Git panel, and provider-flexible model access. The interesting signal is not simply another coding assistant, but a compact interaction model where the terminal becomes a safe agent workbench with reviewable diffs, permission prompts, sub-agents, background tasks, and project memory via TERAX.md.",
    "category": "ai_capability",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "2507bfc8ddc7211c",
      "legacy_week": "2026-W27",
      "news_facts": [
        "A Chinese write-up on Terax, a lightweight AI terminal that combines an agent sidebar, code editor, file manager, shell, web preview, Git panel, and provider-flexible model access. The interesting signal is not simply another coding assistant, but a compact interaction model where the terminal beco..."
      ],
      "implications": [],
      "save_count": 2,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/07/01/spacex-has-an-ai-device-prototype-and-it-sure-sounds-phone-ish/",
    "title": "SpaceX has an AI device prototype, and it sure sounds phone-ish",
    "source": "techcrunch.com",
    "raw_text": "TechCrunch reports on a SpaceX AI device prototype that sounds phone-like. The signal is that AI-native consumer hardware may be moving toward communication devices that blend phone, assistant, and network capabilities.",
    "summary": "TechCrunch reports on a SpaceX AI device prototype that sounds phone-like. The signal is that AI-native consumer hardware may be moving toward communication devices that blend phone, assistant, and network capabilities.",
    "category": "ai_hardware",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "372624dec7e9fff7",
      "legacy_week": "2026-W27",
      "news_facts": [
        "TechCrunch reports on a SpaceX AI device prototype that sounds phone-like. The signal is that AI-native consumer hardware may be moving toward communication devices that blend phone, assistant, and network capabilities."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://arxiv.org/abs/2606.29537",
    "title": "OSWorld2.0: Benchmarking Computer Use Agents on Long-Horizon Real-World Tasks",
    "source": "arxiv.org",
    "raw_text": "An arXiv paper introducing OSWorld2.0, a benchmark for computer-use agents on long-horizon real-world tasks. The signal is that evaluation is moving toward longer, messier desktop workflows instead of short isolated tasks.",
    "summary": "An arXiv paper introducing OSWorld2.0, a benchmark for computer-use agents on long-horizon real-world tasks. The signal is that evaluation is moving toward longer, messier desktop workflows instead of short isolated tasks.",
    "category": "ai_capability",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "63374b3706f4b123",
      "legacy_week": "2026-W27",
      "news_facts": [
        "An arXiv paper introducing OSWorld2.0, a benchmark for computer-use agents on long-horizon real-world tasks. The signal is that evaluation is moving toward longer, messier desktop workflows instead of short isolated tasks."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://www.microsoft.com/en-us/research/blog/memora-a-harmonic-memory-representation-balancing-abstraction-and-specificity/",
    "title": "Memora: A harmonic memory representation balancing abstraction and specificity",
    "source": "microsoft.com",
    "raw_text": "Microsoft Research introduces Memora, a memory representation designed to balance abstract patterns with specific facts. The signal is that long-term agent memory is becoming a core capability layer rather than an application feature.",
    "summary": "Microsoft Research introduces Memora, a memory representation designed to balance abstract patterns with specific facts. The signal is that long-term agent memory is becoming a core capability layer rather than an application feature.",
    "category": "ai_capability",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "9f650cfc114d055b",
      "legacy_week": "2026-W27",
      "news_facts": [
        "Microsoft Research introduces Memora, a memory representation designed to balance abstract patterns with specific facts. The signal is that long-term agent memory is becoming a core capability layer rather than an application feature."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://addyosmani.com/blog/loop-engineering/",
    "title": "Loop Engineering",
    "source": "addyosmani.com",
    "raw_text": "Addy Osmani frames a software development workflow where humans, AI coding tools, evaluation, and iteration form a tight loop. The signal is that engineering practice is moving from one-shot prompting toward managed loops of generation, review, testing, and refinement.",
    "summary": "Addy Osmani frames a software development workflow where humans, AI coding tools, evaluation, and iteration form a tight loop. The signal is that engineering practice is moving from one-shot prompting toward managed loops of generation, review, testing, and refinement.",
    "category": "ai_capability",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "7134d3eeadba582a",
      "legacy_week": "2026-W27",
      "news_facts": [
        "Addy Osmani frames a software development workflow where humans, AI coding tools, evaluation, and iteration form a tight loop. The signal is that engineering practice is moving from one-shot prompting toward managed loops of generation, review, testing, and refinement."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://korben.info/en/google-agents-cli-ai-agent-creates-agents.html",
    "title": "Google agents-cli: When your AI agent creates other AI agents",
    "source": "korben.info",
    "raw_text": "A developer-facing article about Google's agents-cli and the emerging pattern of agents that can create or coordinate other agents. The signal is a shift from single-agent tools to agent factories and composable agent workflows.",
    "summary": "A developer-facing article about Google's agents-cli and the emerging pattern of agents that can create or coordinate other agents. The signal is a shift from single-agent tools to agent factories and composable agent workflows.",
    "category": "ai_software",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "b10a4de21187cd91",
      "legacy_week": "2026-W27",
      "news_facts": [
        "A developer-facing article about Google's agents-cli and the emerging pattern of agents that can create or coordinate other agents. The signal is a shift from single-agent tools to agent factories and composable agent workflows."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://mp.weixin.qq.com/s/qNtbYjdg3K0gALtw5ZYuuQ",
    "title": "Figma Config 2026: the canvas expands into code, motion, shaders, generative plugins, Weave, and agents",
    "source": "mp.weixin.qq.com",
    "raw_text": "A Chinese recap of Figma Config 2026. The main signal is that Figma is repositioning the canvas from a design-file container into a creative workbench: Code Layers put runnable code on the canvas, Motion makes animation part of the design system, shader fills and effects become editable materials, generative plugins let teams build custom tools by description, Weave connects creative workflows, and Figma Agent brings skills, connectors, and attachments into team context.",
    "summary": "A Chinese recap of Figma Config 2026. The main signal is that Figma is repositioning the canvas from a design-file container into a creative workbench: Code Layers put runnable code on the canvas, Motion makes animation part of the design system, shader fills and effects become editable materials, generative plugins let teams build custom tools by description, Weave connects creative workflows, and Figma Agent brings skills, connectors, and attachments into team context.",
    "category": "interaction",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "f9a8dfb607540e88",
      "legacy_week": "2026-W27",
      "news_facts": [
        "A Chinese recap of Figma Config 2026. The main signal is that Figma is repositioning the canvas from a design-file container into a creative workbench: Code Layers put runnable code on the canvas, Motion makes animation part of the design system, shader fills and effects become editable materials,..."
      ],
      "implications": [],
      "save_count": 2,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://arxiv.org/abs/2606.23449",
    "title": "AOHP: An Open-Source OS-Level Agent Harness for Personalized, Efficient and Secure Interaction",
    "source": "arxiv.org",
    "raw_text": "An arXiv paper on an open-source OS-level agent harness for personalized, efficient, and secure interaction. The signal is that OS-level agents need infrastructure for personalization, safety boundaries, and practical interaction with user environments.",
    "summary": "An arXiv paper on an open-source OS-level agent harness for personalized, efficient, and secure interaction. The signal is that OS-level agents need infrastructure for personalization, safety boundaries, and practical interaction with user environments.",
    "category": "ai_capability",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "d27d36e61b8d10fc",
      "legacy_week": "2026-W27",
      "news_facts": [
        "An arXiv paper on an open-source OS-level agent harness for personalized, efficient, and secure interaction. The signal is that OS-level agents need infrastructure for personalization, safety boundaries, and practical interaction with user environments."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://mem0.ai/blog/state-of-ai-agent-memory-2026",
    "title": "AI Agent Memory 2026: Progress Benchmark Report Evaluations",
    "source": "mem0.ai",
    "raw_text": "Mem0 summarizes the 2026 state of AI agent memory, including LoCoMo, LongMemEval, and BEAM benchmarks, gains in temporal and multi-hop reasoning, and the growing integration layer around agent memory. The signal is that memory is becoming measurable infrastructure for production agents.",
    "summary": "Mem0 summarizes the 2026 state of AI agent memory, including LoCoMo, LongMemEval, and BEAM benchmarks, gains in temporal and multi-hop reasoning, and the growing integration layer around agent memory. The signal is that memory is becoming measurable infrastructure for production agents.",
    "category": "ai_capability",
    "image_url": "",
    "captured_at": "2026-06-29T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "fafd08eb7b8483df",
      "legacy_week": "2026-W27",
      "news_facts": [
        "Mem0 summarizes the 2026 state of AI agent memory, including LoCoMo, LongMemEval, and BEAM benchmarks, gains in temporal and multi-hop reasoning, and the growing integration layer around agent memory. The signal is that memory is becoming measurable infrastructure for production agents."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://claude.com/product/tag?utm_source=google_brand&utm_campaign={campaign}&utm_medium=cpc&utm_content=813802089583&utm_term=claude%20slack&targetid=kwd-449074633403&gad_source=1&gad_campaignid=23970557680&gbraid=0AAAAAqwcL8lPYMLM_fkF3Gcw-q9J54ENj&gclid=Cj0KCQjwguLSBhDLARIsAH-yPrHEDS36euoJIUhwsP31N-XkQUNYugZ-rOUso7u1PXp5DyFX-yItPncaAvi_EALw_wcB",
    "title": "Claude in Slack: Tag @Claude in any thread | Claude by Anthropic",
    "source": "claude.com",
    "raw_text": "Meet Claude Platform Solutions Pricing Resources Login Contact sales Contact sales Try Claude Try Claude @Claude Explore here Beta Next Introducing @Claude @Claude reacts in real time, where the work is happening. Available today for Claude Enterprise and Team in Slack. Tag it in, and it tags you back. Read more Read more @Claude beta Tag Claude in Slack @Claude reads threads, understands full context, and reacts in real time so your team moves forward together. Bring Claude into your channel. Add to Slack Add to....",
    "summary": "Meet Claude Platform Solutions Pricing Resources Login Contact sales Contact sales Try Claude Try Claude @Claude Explore here Beta Next Introducing @Claude @Claude reacts in real time, where the work is happening. Available today for Claude Enterprise and Team in Slack. Tag it in, and it tags you back. Read more Read more @Claude beta Tag Claude in Slack @Claude reads threads, understands full context, and reacts in real time so your team moves forward together. Bring Claude into your channel. Add to Slack Add to....",
    "category": "interaction",
    "image_url": "https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/68dc371e7b6d3e2cb2ec6230_og-claude-slack.jpg",
    "captured_at": "2026-06-23T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "edd180b369c8e4f5",
      "legacy_week": "2026-W26",
      "news_facts": [
        "Meet Claude Platform Solutions Pricing Resources Login Contact sales Contact sales Try Claude Try Claude @Claude Explore here Beta Next Introducing @Claude @Claude reacts in real time, where the work is happening. Available today for Claude Enterprise and Team in Slack. Tag it in, and it tags you b..."
      ],
      "implications": [],
      "save_count": 3,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://www.youtube.com/watch?si=Jw7wq1vxuz4oGuJW&v=ZK3JhU73W18&feature=youtu.be",
    "title": "Show Codex a workflow once. Reuse it as a skill.",
    "source": "youtube.com",
    "raw_text": "A short demo of Codex Record & Replay: users can record a recurring workflow, such as filing an expense report or submitting time off, and Codex turns the demonstration into an inspectable, editable skill. The signal is that skill creation is moving from hand-written instructions toward demonstration-based automation where users control when recording starts and stops.",
    "summary": "A short demo of Codex Record & Replay: users can record a recurring workflow, such as filing an expense report or submitting time off, and Codex turns the demonstration into an inspectable, editable skill. The signal is that skill creation is moving from hand-written instructions toward demonstration-based automation where users control when recording starts and stops.",
    "category": "interaction",
    "image_url": "",
    "captured_at": "2026-06-22T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "931c87a7a6ed1017",
      "legacy_week": "2026-W26",
      "news_facts": [
        "A short demo of Codex Record & Replay: users can record a recurring workflow, such as filing an expense report or submitting time off, and Codex turns the demonstration into an inspectable, editable skill. The signal is that skill creation is moving from hand-written instructions toward demonstrati..."
      ],
      "implications": [],
      "save_count": 2,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://moge.ai/product/marvis-ma-wei-si",
    "title": "Marvis: OS-level personal assistant from Tencent",
    "source": "moge.ai",
    "raw_text": "MOGE describes Marvis as a Tencent OS-level personal assistant that understands files, controls the PC, and coordinates multi-agent tasks through natural language on Windows and Android. The signal is that assistant products are moving deeper into operating-system control.",
    "summary": "MOGE describes Marvis as a Tencent OS-level personal assistant that understands files, controls the PC, and coordinates multi-agent tasks through natural language on Windows and Android. The signal is that assistant products are moving deeper into operating-system control.",
    "category": "ai_software",
    "image_url": "",
    "captured_at": "2026-06-22T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "52424ed109576fb9",
      "legacy_week": "2026-W26",
      "news_facts": [
        "MOGE describes Marvis as a Tencent OS-level personal assistant that understands files, controls the PC, and coordinates multi-agent tasks through natural language on Windows and Android. The signal is that assistant products are moving deeper into operating-system control."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/06/24/if-you-want-to-cut-your-screen-time-just-get-a-brick/",
    "title": "If you want to cut your screen time, just get a Brick",
    "source": "techcrunch.com",
    "raw_text": "TechCrunch covers Brick, a physical product for reducing screen time. The signal is that interaction design is expanding beyond software nudges into tangible controls for attention and device boundaries.",
    "summary": "TechCrunch covers Brick, a physical product for reducing screen time. The signal is that interaction design is expanding beyond software nudges into tangible controls for attention and device boundaries.",
    "category": "ai_hardware",
    "image_url": "",
    "captured_at": "2026-06-22T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "e2c0f254fd96b6bb",
      "legacy_week": "2026-W26",
      "news_facts": [
        "TechCrunch covers Brick, a physical product for reducing screen time. The signal is that interaction design is expanding beyond software nudges into tangible controls for attention and device boundaries."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://techcrunch.com/2026/06/25/google-finance-gets-a-dedicated-app-for-android/",
    "title": "Google Finance gets a dedicated app for Android",
    "source": "techcrunch.com",
    "raw_text": "TechCrunch reports that Google Finance is getting a dedicated Android app. The signal is that financial information experiences are being rebuilt as mobile-first, assistant-adjacent surfaces.",
    "summary": "TechCrunch reports that Google Finance is getting a dedicated Android app. The signal is that financial information experiences are being rebuilt as mobile-first, assistant-adjacent surfaces.",
    "category": "ai_software",
    "image_url": "",
    "captured_at": "2026-06-22T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "b2d68dc4771f270c",
      "legacy_week": "2026-W26",
      "news_facts": [
        "TechCrunch reports that Google Finance is getting a dedicated Android app. The signal is that financial information experiences are being rebuilt as mobile-first, assistant-adjacent surfaces."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  },
  {
    "canonical_url": "https://openai.com/index/personal-finance-chatgpt/?__cf_chl_rt_tk=xfJrqbda.yJdA5B0OoJRBQ506X5anjvmHTWm0ET6j2A-1782472299-1.0.1.1-wO8D.vPJTPJvdtrJPC8FMgKe3Yhx1ip6ciaKStdYo2M",
    "title": "A new personal finance experience in ChatGPT",
    "source": "openai.com",
    "raw_text": "OpenAI introduces a personal finance experience in ChatGPT for Pro users in the U.S., connecting financial accounts, dashboards, and grounded questions through partners like Plaid and Intuit. The signal is that AI assistants are moving into high-trust personal decision domains with connected data.",
    "summary": "OpenAI introduces a personal finance experience in ChatGPT for Pro users in the U.S., connecting financial accounts, dashboards, and grounded questions through partners like Plaid and Intuit. The signal is that AI assistants are moving into high-trust personal decision domains with connected data.",
    "category": "ai_software",
    "image_url": "",
    "captured_at": "2026-06-22T04:00:00Z",
    "captured_via": "migration",
    "editorial_status": "processed",
    "editorial_updated_at": "2026-08-04T04:05:17.267Z",
    "metadata": {
      "legacy_article_id": "d65b4769ae6e35af",
      "legacy_week": "2026-W26",
      "news_facts": [
        "OpenAI introduces a personal finance experience in ChatGPT for Pro users in the U.S., connecting financial accounts, dashboards, and grounded questions through partners like Plaid and Intuit. The signal is that AI assistants are moving into high-trust personal decision domains with connected data."
      ],
      "implications": [],
      "save_count": 1,
      "comment_count": 0,
      "latest_comment": "",
      "imported_from": "browser-signal-watcher"
    }
  }
]
$legacy$::jsonb) as item(
  canonical_url text,
  title text,
  source text,
  raw_text text,
  summary text,
  category text,
  image_url text,
  captured_at timestamptz,
  captured_via text,
  editorial_status text,
  editorial_updated_at timestamptz,
  metadata jsonb
)
on conflict (canonical_url) do update set
  title = excluded.title,
  source = excluded.source,
  raw_text = excluded.raw_text,
  summary = excluded.summary,
  category = excluded.category,
  image_url = excluded.image_url,
  captured_at = excluded.captured_at,
  captured_via = excluded.captured_via,
  editorial_status = excluded.editorial_status,
  editorial_updated_at = excluded.editorial_updated_at,
  metadata = excluded.metadata;

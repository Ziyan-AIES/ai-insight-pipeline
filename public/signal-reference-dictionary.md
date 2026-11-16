# Signal Reference 词典

版本：2026-11；复核：2026-11-06；维护：每月至少一次。共 42 个具体话题。

## 如何分级分类

第一层是阅读用的领域分组，第二层是具体可观察话题，第三层是被归入话题的原始文章／事件。一篇文章可以属于多个话题。领域不是优先级；话题不是团队确认的趋势。来源类型（官方、行业媒体、投资人、社区等）是另一个独立维度。

匹配依据为标题与正文摘要中的明确词组；相似报道合并为同一发展事件。当前排名按独立事件数、来源广度、动量和有限互动指标计算，不固定置顶任何话题，也不表示战略价值。

AI coding agents 原名称 Autonomous software engineering：指能查看代码仓库、修改代码并运行测试的编程代理，仍需要人的检查，不代表完全自主的软件工程。单独出现 vibe coding 不再足以归入该话题。

## 本次调整

保留已有 40 个稳定 ID；新增 AI industrial robotics 与 Model efficiency and distillation。代理身份、权限和访问控制单独定义，避免与攻击防御混为一类。新邮件正文支持这些边界；newsletter 中推荐的旧文不能当成当天新闻。此次不会自动清除已有文章标签。

## Agent 系统 / Agent systems

### Browser agents

- 稳定 ID：`browser-agents`
- 定义与边界：Agents that operate websites and complete tasks through browser interfaces.
- 匹配规则（不区分大小写）：`\b(browser agents?|agentic browsers?|agents? (?:in|for) (?:the )?browser|browser-based agents?)\b`

### Multi-agent orchestration

- 稳定 ID：`agent-orchestration`
- 定义与边界：Systems that delegate tasks between multiple agents and coordinate their work.
- 匹配规则（不区分大小写）：`\b(agent orchestration|multi-agent|agent-to-agent|agentic workflow|orchestrat(?:e|ion).{0,30}agents?)\b`

### AI coding agents

- 稳定 ID：`autonomous-coding`
- 定义与边界：Agents that inspect a codebase, edit code and run tests. Human review is still needed; ordinary code completion is outside this topic.
- 匹配规则（不区分大小写）：`\b(coding agents?|agentic coding|autonomous (?:coding|software)|software engineering agents?|repository.{0,24}agents?|agents?.{0,24}repositories)\b`

### Agent evaluation and reliability

- 稳定 ID：`agent-evaluation`
- 定义与边界：Testing, tracing and measuring whether agents complete real tasks reliably.
- 匹配规则（不区分大小写）：`\b(agent evals?|agent evaluation|evaluat(?:e|ing|ion).{0,25}agents?|agent reliability|agent observability)\b`

### Agent development platforms

- 稳定 ID：`agent-platforms`
- 定义与边界：Tools and managed services for building, deploying and operating agents.
- 匹配规则（不区分大小写）：`\b(managed agents?|agent platforms?|agents? sdk|agent development platforms?|build.{0,18}production-ready agents?)\b`

### Agent identity, permissions and access

- 稳定 ID：`agent-access-governance`
- 定义与边界：Agent ownership, identity, least-privilege permissions, runtime access controls and external-agent access fees. Ordinary SaaS pricing and general cybersecurity are outside this topic.
- 匹配规则（不区分大小写）：`\b(agent(?:ic)? (?:identity|identities|permissions?|governance|runtime security)|(?:external|outside|third.party) (?:ai )?agents?.{0,70}(?:fees?|charg|register|access|permissions?)|(?:fees?|charg|register).{0,70}(?:external|outside|third.party) (?:ai )?agents?|agents?.{0,30}(?:access controls?|temporary permissions|least.privilege|ownership)|non.human identit)`

## 模型能力与媒体生成 / Models and media

### Speech and audio models

- 稳定 ID：`speech-models`
- 定义与边界：Models for speech recognition, synthesis, cloning and audio understanding.
- 匹配规则（不区分大小写）：`\b(speech models?|text.to.speech|speech.to.text|tts\b|voice cloning|audio models?)\b`

### AI video generation and production

- 稳定 ID：`text-to-video`
- 定义与边界：AI video generation and its use in film, advertising and production workflows.
- 匹配规则（不区分大小写）：`\b(text.to.video|video (?:generation|ai)|generative video|ai video models?|ai.generated (?:video|film)|ai film(?:making)?|video ai models?)\b`

### Image generation models

- 稳定 ID：`image-generation`
- 定义与边界：Models and tools that generate or edit images.
- 匹配规则（不区分大小写）：`\b(image generation|image creation|generative image|ai image models?|diffusion models?)\b`

### Open-weight models

- 稳定 ID：`open-weight-models`
- 定义与边界：Models released with downloadable weights; a vendor mention alone is insufficient.
- 匹配规则（不区分大小写）：`\b(open weights?|open-weight|open.source (?:ai |video |language |speech )?models?|downloadable model weights)\b`

### Reasoning models

- 稳定 ID：`reasoning-models`
- 定义与边界：Models and inference methods that spend additional computation on reasoning.
- 匹配规则（不区分大小写）：`\b(reasoning models?|test-time compute|chain.of.thought|reasoning benchmarks?)\b`

### Multimodal models

- 稳定 ID：`multimodal-models`
- 定义与边界：Models that combine vision, text, audio or other input and output modalities.
- 匹配规则（不区分大小写）：`\b(multimodal models?|vision.language models?|vlms?\b|omnimodal)\b`

### Long-context models

- 稳定 ID：`long-context-models`
- 定义与边界：Changes in how much context models can process and use reliably.
- 匹配规则（不区分大小写）：`\b(long context|context windows?|million.token|extended context)\b`

### Model evaluation and benchmarks

- 稳定 ID：`model-evaluation`
- 定义与边界：Benchmarks and evaluations of model capabilities and limitations.
- 匹配规则（不区分大小写）：`\b(model evals?|model evaluation|ai benchmarks?|llm evaluation|benchmarking (?:ai )?models?)\b`

### Model efficiency and distillation

- 稳定 ID：`model-efficiency`
- 定义与边界：Distillation, compression and task-specific small models that reduce inference cost. Separate technical efficiency from cloud capacity and financing.
- 匹配规则（不区分大小写）：`\b(model distillation|distill(?:ation|ing).{0,35}(?:models?|llms?)|(?:models?|llms?).{0,35}distill|model quantization|model compression|small language models?)\b`

## 基础设施与设备 / Infrastructure and devices

### In-browser model inference

- 稳定 ID：`browser-model-inference`
- 定义与边界：Models executed inside a web browser rather than a remote inference service.
- 匹配规则（不区分大小写）：`\b(webllm|in-browser (?:llm|model|ai|inference)|browser-based (?:llm|model) inference)\b`

### AI wearables and smart glasses

- 稳定 ID：`ai-wearables`
- 定义与边界：Glasses, pendants and other wearable devices with concrete AI capabilities.
- 匹配规则（不区分大小写）：`\b(ai wearables?|ai pins?|smart glasses|ai glasses|ambient devices?)\b`

### AI inference chips

- 稳定 ID：`inference-chips`
- 定义与边界：Processors and accelerators used to execute AI models.
- 匹配规则（不区分大小写）：`\b(inference chips?|ai accelerators?|gpus?.{0,24}inference|npus?|ai semiconductors?)\b`

### On-device AI

- 稳定 ID：`on-device-ai`
- 定义与边界：AI inference on local phones, PCs and edge devices.
- 匹配规则（不区分大小写）：`\b(on-device ai|edge ai|local inference|offline (?:ai|llm)|models? run locally)\b`

### AI compute capacity and economics

- 稳定 ID：`ai-compute-infrastructure`
- 定义与边界：AI data-center capacity, power constraints, GPU-cloud financing and inference costs. Distinct from chip designs and generic corporate earnings.
- 匹配规则（不区分大小写）：`\b(ai (?:data.cent(?:er|re)s?|compute|infrastructure)|gpu cloud|neoclouds?|(?:compute|inference).{0,25}(?:bottlenecks?|financing|costs?|capacity)|data.cent(?:er|re).{0,35}(?:ai|gpu))\b`

## 机器人与物理 AI / Robotics and physical AI

### Humanoid robotics

- 稳定 ID：`humanoid-robotics`
- 定义与边界：Human-shaped robots and their real deployments.
- 匹配规则（不区分大小写）：`\b(humanoid robots?|humanoid robotics)\b`

### Robot foundation models

- 稳定 ID：`robot-learning`
- 定义与边界：Models that learn perception and actions for robots in the physical world.
- 匹配规则（不区分大小写）：`\b(robot learning|robot foundation models?|vision.language.action|vla models?|physical ai)\b`

### AI industrial robotics

- 稳定 ID：`industrial-robotics`
- 定义与边界：AI-controlled industrial arms, flexible factories and manufacturing robots. Do not infer humanoid deployment from general robotics news.
- 匹配规则（不区分大小写）：`\b(physical ai|ai.powered robots?|autonomous factories|ai.{0,35}(?:industrial robots?|manufacturing robots?)|robotic.{0,25}manufacturing)\b`

## 产品与工作流 / Products and workflows

### Collaborative AI workspaces

- 稳定 ID：`ai-workspaces`
- 定义与边界：Shared workspaces where people and AI collaborate on projects and documents.
- 匹配规则（不区分大小写）：`\b(ai-powered (?:project |team )?(?:workspace|collaboration)|agentic workspace|collaborative ai workspace)\b`

### AI search and answer engines

- 稳定 ID：`ai-search-engines`
- 定义与边界：Search products that generate answers or conduct research from retrieved sources.
- 匹配规则（不区分大小写）：`\b(ai search|answer engines?|perplexity|search copilots?|generative search|ai-powered search|ai mode.{0,48}search|search.{0,48}ai mode)\b`

### Real-time voice agents

- 稳定 ID：`voice-agents`
- 定义与边界：Interactive agents that listen and respond through live speech.
- 匹配规则（不区分大小写）：`\b(voice agents?|voice assistants?|conversational voice|real-time voice ai)\b`

### Clinical AI systems

- 稳定 ID：`clinical-ai`
- 定义与边界：AI used in clinical diagnosis, treatment and medical workflows.
- 匹配规则（不区分大小写）：`\b(medical ai|clinical ai|ai (?:diagnosis|diagnostics)|clinical.{0,24}ai|ai.{0,24}clinical consultation)\b`

### AI marketing workflows

- 稳定 ID：`ai-marketing`
- 定义与边界：AI used in marketing production, campaigns and measurement, including ads explicitly designed for AI agents.
- 匹配规则（不区分大小写）：`\b(ai marketing|ads? for ai agents?|advertis(?:ing|ements?).{0,30}ai agents?|marketing copilots?|marketing.{0,24}ai tools?|ai.{0,24}marketing workflow)\b`

### AI customer-service agents

- 稳定 ID：`enterprise-customer-service`
- 定义与边界：Agents and automation for customer support and contact centers.
- 匹配规则（不区分大小写）：`\b(ai customer service|customer service agents?|contact cent(?:er|re).{0,24}ai|support agents?.{0,24}ai)\b`

### AI sales copilots

- 稳定 ID：`enterprise-sales-ai`
- 定义与边界：AI used in prospecting, sales assistance and revenue workflows.
- 匹配规则（不区分大小写）：`\b(ai sales agents?|sales copilots?|ai-powered sales|revenue intelligence.{0,20}ai)\b`

### Enterprise AI workflow automation

- 稳定 ID：`enterprise-workflow-automation`
- 定义与边界：AI agents that carry out enterprise processes, including legal and recruiting workflows. Ordinary non-AI business software is excluded.
- 匹配规则（不区分大小写）：`\b(ai workflow automation|enterprise automation.{0,20}ai|agentic process automation|business workflow agents?|legal ai agents?|(?:legal|recruiting|hiring) (?:ai )?(?:agents?|assistants?))\b`

### AI companions

- 稳定 ID：`ai-companions`
- 定义与边界：AI products designed for ongoing social or emotional companionship.
- 匹配规则（不区分大小写）：`\b(ai companions?|companion bots?|virtual companions?)\b`

### AI shopping assistants

- 稳定 ID：`ai-shopping-assistants`
- 定义与边界：Agents that discover products, assist purchases or conduct commerce.
- 匹配规则（不区分大小写）：`\b(ai shopping|shopping assistants?|commerce agents?|agentic commerce)\b`

### AI creator tools

- 稳定 ID：`ai-creator-tools`
- 定义与边界：AI production tools used by creators across media formats.
- 匹配规则（不区分大小写）：`\b(ai creator tools?|creator copilots?|generative creator tools?)\b`

## 可信、安全与治理 / Trust and governance

### Model observability and guardrails

- 稳定 ID：`model-observability`
- 定义与边界：Monitoring model behavior, detecting failures and applying runtime guardrails.
- 匹配规则（不区分大小写）：`\b(model observability|llm observability|hallucination monitoring|ai monitoring|guardrails?)\b`

### AI content authenticity

- 稳定 ID：`content-authenticity`
- 定义与边界：Provenance, watermarking and verification of AI-generated media.
- 匹配规则（不区分大小写）：`\b(ai provenance|content credentials|ai watermark|watermarking ai|detect(?:ing|ion).{0,25}ai.generated|made with (?:claude|chatgpt|gemini))\b`

### AI regulation

- 稳定 ID：`ai-regulation`
- 定义与边界：Proposed and enacted AI regulation; distinguish proposals from binding rules.
- 匹配规则（不区分大小写）：`\b(ai regulation|ai act|regulat(?:e|ing|ion).{0,24}(?:ai|models?)|lawmakers?.{0,24}ai)\b`

### AI copyright disputes

- 稳定 ID：`ai-copyright`
- 定义与边界：Disputes over copyright, training data and AI-generated works.
- 匹配规则（不区分大小写）：`\b(ai copyright|copyright.{0,24}(?:ai|training data)|ai training.{0,24}copyright)\b`

### Frontier-model safety

- 稳定 ID：`model-safety`
- 定义与边界：Research and controls addressing harmful or misaligned frontier-model behavior.
- 匹配规则（不区分大小写）：`\b(model safety|ai safety testing|alignment research|frontier model safety|responsible ai)\b`

### AI cybersecurity and misuse

- 稳定 ID：`ai-cybersecurity`
- 定义与边界：AI used to discover vulnerabilities, defend systems or automate attacks. Distinct from ordinary coding agents and general model safety.
- 匹配规则（不区分大小写）：`\b(ai.powered cyber|ai.enabled cyber|ai.driven cyber|ai.orchestrated cyber|ai.{0,25}(?:cyberattacks?|cybersecurity|vulnerabilit)|(?:claude|grok|agents?).{0,45}(?:hack(?:ers?|ing)?|cyberattacks?|attacks? on banks)|cyber verification|cyber mission)\b`

## 资本与市场结构 / Capital and market structure

### AI funding rounds

- 稳定 ID：`ai-funding-rounds`
- 定义与边界：Financing of AI companies; funding is context rather than proof of product adoption.
- 匹配规则（不区分大小写）：`\b(?:ai|artificial intelligence).{0,45}(?:funding|raises? \$|seed round|series [a-f]|valuation)|(?:funding|raises? \$|seed round|series [a-f]).{0,45}(?:ai|artificial intelligence)\b`

### AI acquisitions

- 稳定 ID：`ai-acquisitions`
- 定义与边界：Acquisitions and mergers involving AI products or companies.
- 匹配规则（不区分大小写）：`\b(?:ai|artificial intelligence).{0,45}(?:acqui(?:res|red|sition)|merger)|(?:acqui(?:res|red|sition)|merger).{0,45}(?:ai|artificial intelligence)\b`

## 每月维护

每月 1 日北京时间 10:00 检查近 30 天原文与邮件，抽样复核漏匹配、误匹配、来源集中和重复报道。新增话题必须有明确证据与独立边界；只有一条线索时可先记候选。更新版本、定义、规则、回归测试和本文件，部署并读回确认。保留 ID 与历史标签；合并、删除或批量重标历史文章先给出影响预览。月度复核允许结论为无需变更。

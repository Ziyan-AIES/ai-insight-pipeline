# Research 专题研究库改版执行方案

版本：讨论稿 v1.0
日期：2026-11-09，北京时间
项目：ai-insight-pipeline / Sonata
状态：仅方案。本文不代表已实施、已迁移、已部署或已启用新任务。

阅读顺序：先看第 1、3、4 节确认产品行为，再看第 6–10 节确认实现规则，最后用第 12、14–16 节安排交付和验收。第 16 节将待核实事项与可直接采用的实施默认值分开。

## 1. 目标与产品边界

将当前 Sonata 的 Research 建设为可以独立录入、维护和浏览的专题研究库。每个 Research Topic 下有 Products、Sources、Analysis 三个模块：同事先了解研究覆盖哪些产品，再阅读相关材料，最后打开已发布的分析成果。

本次以 Personal Agents 为首个完整案例，但页面、字段和处理机制适用于其他 Research Topic。十二个产品是这个专题的初始内容，不是系统数量限制。

本次采用以下边界：

1. 产品和资料在当前站点录入、保存、补全及展示；保存内容不触发网站重新部署。
2. Studio 仅作为产品卡片及资料组织方式的参考，以及明确选定历史内容的一次性来源。日常工作不依赖 Studio，不建立自动同步、发布桥接或项目绑定。
3. 新闻继续进入现有共享新闻库及 Selected Sources；播客、视频、文档只在其关联的 Research Topic 中展示。
4. 保留原始内容和来源，给未来专题 AI 问答提供数据基础；本次不实现聊天框、向量检索、自动跨材料推论或 PMO。
5. 去除本站 Workspace / Open private workspace 入口，研究编辑直接在 Research 内完成；保留历史数据与旧链接兼容。
6. Analysis 以已发布成果链接为本次新增内容的默认形式，保留已有原生文章和幻灯片的阅读、编辑与分享功能。

### 1.1 本次明确不包含

- Studio 的双向同步、全库迁移、私有收听历史迁移。
- 自动扫描个人播客收听历史并公开给同事。
- 自动将播客、视频、文档推入 Selected Sources 或 Signal Reference。
- SharePoint 登录集成、受限 PDF 自动抓取、音视频下载与通用语音转写服务。
- 新的组织权限体系、全球产品百科、研究执行管理系统。
- 将当前本地 editorial 调度整体迁到云端。

### 1.2 与旧方案的关系

本方案替代 2026-10-19 文档中“通过 Studio 工作区及发布桥接完成后续 Research 建设”的下一阶段方向。旧文档仍保留作为历史记录，其中的数据保留、并发保护、现有访问边界仍有效。实施时应在相关旧文档顶部补充本方案链接和被替代范围，不能把尚未实现的桥接描述成已上线功能。

## 2. 已核实的现状与差距

以下结论来自当前工作区文件及本次对话中读取的 Studio 数据；仓库状态不等于线上数据库部署状态。

| 领域 | 当前实现 | 本次差距 |
|---|---|---|
| Research 页面 | 已有 Products / Sources / Analysis 三个标签，默认 Analysis | 统一卡片、排序、过滤和录入方式；默认进入 Products |
| 产品 | 放在 `topics.analysis.products` JSON；有名字、公司、简介、官网、Logo、截图 | 缺少公司背景、日期、出处、独立版本和补全状态 |
| Research Sources | 由 `topic_news` 关联 `news_items` 得出 | 没有独立承载研究音视频及文档的路径 |
| Sources 筛选 | SharedSources 侧栏有部分类型和语言识别，主要依赖 metadata 和 URL 推断 | 不等于完整的持久化多类型 Source 模型 |
| 新增 Source | Research 的 New source 打开现有 Add News 弹窗 | 名称不一致，也没有完整的研究资料表单 |
| 原文 | 现有 capture 请求限制 256 KiB，正文写入截断为 60,000 字符 | 不能直接复用来保存长 transcript |
| 新闻摘要 | 现有 editorial 生成很短的英文摘要，保护人工修改 | 长访谈需要另设摘要模板和全文处理流程 |
| 调度 | 仓库脚本为工作日主机当地时间 18:00；先新闻，再独立 Reference briefing | 新增 Research 阶段，并核对主机时区与实际任务注册状态 |
| 命名 | Promote to Research 后仍可打开 New/Edit Action Thread | 可见文案需要统一为 Research Topic |
| Analysis | 支持链接、原生文章及简单原生 slides | 新建默认链接；旧格式继续兼容 |
| 权限 | `canEdit` 对应 editor/admin；Research 编辑另有指定能力授权 | 新 API 和数据库也要执行同等权限，不能只隐藏按钮 |

重要参考文件：

- `docs/sonata-research-management.md`
- `docs/sonata-products-and-projects.md`
- `docs/sonata-integration.md`
- `docs/sonata-workspace-publication.md`
- `docs/sonata-analysis-release.md`
- `docs/editorial-automation.md`
- `src/components/ResearchLibrary.tsx`、`ProductEditor.tsx`、`SharedSources.tsx`、`AnalysisContent.tsx`
- `src/types.ts`、`src/products.ts`、`src/supabase.ts`、`src/AuthGate.tsx`
- `netlify/functions/capture.mjs`
- `scripts/run-local-pipeline.ps1`、`scripts/register-pipeline-tasks.ps1`

## 3. 统一术语和不可破坏的规则

### 3.1 术语

| 术语 | 含义 | 界面名称 |
|---|---|---|
| Research Topic | 一个已进入研究阶段的话题 | Research topic |
| Product | 此话题研究的产品对象 | Products；New product；Edit product |
| Source | 支撑话题的外部材料，统一包含四种类型 | Sources；New source；Edit source；Save source |
| News | 进入共享新闻库的新闻或新闻类文章 | News |
| Podcast | 音频播客节目的一期 | Podcast |
| Video | 视频，包括在 YouTube 播放的视频播客 | Video |
| Document | 报告、PDF、文档等链接 | Document |
| Analysis | 我们已经发布的分析成果 | Analysis；New analysis；Edit analysis |
| Selected Sources | 团队选择进入共享新闻流程的材料 | 保持 Selected Sources，不用 Selective Sources |

Type 描述材料形态，Platform 描述来源平台；两者分开。YouTube 属于 Platform，不成为第五种 Type。同一期节目若用户保存的是 YouTube 视频，默认 Video；保存音频节目页，默认 Podcast。人工选择优先于自动识别。

现有 `NewsItem.sourceType` 的 `captured_news / manual_note` 属于历史采集类型，不得直接替换为上述四种 Type。旧手工笔记仍保留原有用途，不能批量误分类为新闻或文档。

### 3.2 必须始终成立的规则

1. Research 中的 News 和 Selected Sources 中的 News 是同一条 `news_items` 记录，不复制标题、摘要为另一份独立新闻。
2. 新建 Podcast / Video / Document 不产生 `news_items` 行，不进入新闻投票、新闻编辑队列、新闻地图或 Reference briefing 输入。
3. Source 与 Topic 的关联可以解除，解除关联不删除 Source 原记录。
4. 原文、人工简介、AI 摘要分别保存；AI 不覆盖原文或人工锁定字段。
5. 原始语言与展示语言分开；中文原文配英文摘要后，Language 仍为 Chinese。
6. 未取得证据的信息保持缺失；产品录入时间不是发布时间，标题不是完整视频内容。
7. 自动补全失败不影响用户已保存的记录，也不影响另两条处理流程。
8. 保存内容与 AI 处理是两个状态：保存成功即可浏览已提供的信息，补全可以稍后完成。
9. 前端、API、数据库权限一致；原文与由其派生的摘要不得扩大可见范围。
10. 所有新增导入和后台处理可重复执行而不重复创建、不覆盖较新人工修改。

## 4. 页面与交互规格

### 4.1 Research 目录与专题页

- Research 总目录保留已有 Cards/List、分类、研究期排序及浏览偏好。
- 专题页上方保留标题、研究问题、研究期、负责人、分类和 Edit research topic。
- 专题页三个标签为 `Products (n)`、`Sources (n)`、`Analysis (n)`，默认 Products。
- URL 带指定 analysis ID 时直接进入 Analysis 并定位成果；普通标签切换写入 URL，支持刷新、返回和分享。
- Products 数量为该 Topic 未删除产品数；Sources 数量为有效关联的 News 和非新闻 Source 去重后的总数；Analysis 数量为可展示成果数，不重复计算同一个 legacy outcome 链接。
- 产品和资料在专题内采用卡片，不另加 Cards/List 开关。与 Research 总目录的 Cards/List 是两个不同层级。
- 页面使用现有字体、浅紫色系及间距规范；桌面端通常三列，中等宽度两列，窄屏一列。按可用宽度断点适配，不依赖固定设备型号。

### 4.2 Products

工具栏：New product、Sort。排序提供 Launch date: newest / oldest，默认 newest。

卡片固定信息顺序：

1. Logo、产品名、公司名。
2. 产品简介，建议 40–70 个英文单词；卡片最多显示约四行，详情可读完整内容。
3. 一句公司背景，建议 15–30 个英文单词。
4. Founded 与 Launch 两个独立日期标签。
5. Website 文字链接；有截图时在详情展示，避免卡片高度被不同截图拉开。
6. 有权限者可 Edit product；补全状态只向编辑者显示。

无 Logo 使用产品首字母占位；缺少公司背景或日期时不显示空白大区域。缺失日期的产品在任何时间排序下都排最后。

New/Edit product：Name 必填；Description、Website 建议填写至少一个以帮助识别，其余可选。只有名字也允许保存，但无法唯一识别时进入待补充状态，不根据同名产品猜测官网。

### 4.3 Sources

工具栏：New source、Add existing news、Search、Type、Language、Sort。

- New source 新建材料，默认关联当前 Topic。
- Add existing news 打开现有 Selected Sources 侧栏，明确这是共享新闻池，避免与本专题四类型 Sources 混淆。
- 全站右上角 Add News 改为 New source，使用同一套表单。从非专题页面添加非新闻时，必须选择至少一个有效 Research Topic。
- 全站入口添加 News 不要求 Topic；从专题内添加 News 自动关联当前 Topic。
- 侧栏在本期继续只提供共享新闻，不扩展为跨话题私人资料总库。
- Search 匹配原始标题、英文标题、发布者、可见简介和摘要；本期不搜索整篇 transcript。

Source 卡片：类型与原始语言标签、英文标题、发布者/频道/节目名、发布日期、可选时长、英文摘要、View source 文字链接和 Details。

卡片标题打开本站详情；View source 打开外部原始链接。详情显示原始标题、完整摘要、关键观点、人工说明、原文折叠区及证据范围。让“浏览摘要”和“打开外部内容”成为两个明确操作。

摘要尚未生成时显示人工简介；没有简介时显示真实的来源信息及编辑者可见的处理状态。不得显示编造的简介。

New/Edit source 表单：

| 字段 | 行为 |
|---|---|
| Type | 默认 News；识别到 YouTube/播客/文档链接可建议切换，在保存前明确展示最终类型 |
| URL | 新建四类型 Source 均要求有效 HTTP(S) 链接；旧无链接笔记保持兼容 |
| Title | 可填；只有 URL 也可先保存，暂用域名和“标题待补全”作为明确占位 |
| Publisher | 可填，允许后台补全 |
| Language | 自动识别、English、Chinese、Mixed、Other、Unknown；人工值优先 |
| Published date | 可填；允许未知，不用添加日期冒充 |
| Description | 原样保存人工说明，可中文或英文 |
| Transcript / Original content | 可选，多行长文本；标记完整正文或片段，默认片段，全文选项明确可见 |
| Research topics | 非新闻必选；专题内预填当前话题 |

外部识别或抓取不得阻塞基础保存。失败时保留全部表单内容。重复点击 Save 使用同一个请求 ID；成功后才关闭表单。

### 4.4 Analysis

- 新建默认 Link：Title、Description、Date、URL。
- 保持明确的 Publish to members 操作；输入草稿不自动公开，发布成功后同事可见。
- 本期无排序控件，新成果追加在现有顺序末尾，不重新排列历史成果。
- 既有 Article / Slides 支持原有阅读和编辑，不删除功能、不强制转换为链接。
- 同一个 URL 可以同时作为 Document Source 和 Analysis 链接：前者是证据，后者是我们的分析成果，语义不同，不进行跨模块强制去重。

### 4.5 统一文案及外链样式

- 所有研究流程中的 New/Edit Action Thread 改为 New/Edit Research Topic，包含弹窗标题、eyebrow、按钮、提示、错误和可访问性标签。
- Promote to Research 保留；返回 Trends 继续保留原研究身份、产品、资料及分析。
- 去除 Workspace / Open private workspace 可见入口。内部变量、数据库旧字段及 URL 参数可以保留兼容，不为改名称重建记录。
- 旧 `workspace=threads`、`edit=1` 和已分享的研究链接进入当前 Research 阅读页；有研究/分析 ID 的保留定位。不能把旧 URL 导向已移除入口或绕过权限。
- 全站去除向右上的外链箭头，包括 Unicode 字符、SVG 图标、CSS 伪元素和 aria 文案中的残留；覆盖 Signal Reference、Selected Sources、Trends、Research、Analysis。
- 外部链接使用文字、颜色和 hover/focus 下划线表达可点击性；保留清晰键盘焦点。普通翻页和展开按钮不属于外链箭头，按功能保留。

## 5. 时间、语言及排序的精确定义

### 5.1 产品日期

公司成立时间支持年、年月、年月日；产品发布时间支持同样精度，并记录 `launch_kind = initial / major_release / public_beta / announcement`。

一个产品第一版先选择一个与此次研究对应的发布事件作为排序基准，在 UI 上显示事件类型。不能把“2026 年版本发布”写成“公司首次成立”。已有产品的新版本可选 major_release，但必须与首次发布区分。

日期保存为原始精度字符串和 `precision = year / month / day`。内部排序可使用该时间段起始日作为确定性键，但页面不显示补出的 1 月 1 日。日期相同按产品名、ID 排序；未知始终最后。实施时只补有出处的日期。

### 5.2 Sources 默认排序

采用下表明确优先级，数值越小越靠前。同组按原始发布日期降序；发布日期未知的在组内最后；再按关联到当前 Topic 的时间降序、稳定 ID 排序。

| 优先级 | 条件 |
|---|---|
| 10 | Video 且 Platform 为 YouTube，不区分语言 |
| 20 | Podcast 且原始语言为 English |
| 30 | News 且原始语言为 English |
| 40 | Podcast 且原始语言为 Chinese |
| 50 | News 且原始语言为 Chinese |
| 60 | 其他平台的 Video，任意语言 |
| 70 | 其余语言或未知语言的 Podcast / News |
| 80 | Document，任意语言 |

60–80 为本方案提出的补充默认值，用于覆盖用户尚未明确的类型，不是此前已确认的偏好。

其他 Sort：Latest published（全部按发布日期降序，未知最后）、Recently added（按关联到本 Topic 的时间降序）。Type 和 Language 筛选先执行，排序后执行；筛选不会自动改变排序模式。

Language 基于内容，不按域名猜测。Mixed 是独立筛选值，不自动同时归入 English 和 Chinese。未知语言保留 Unknown；原文后来补齐后可以自动识别，但不覆盖人工选择。

## 6. 数据结构：统一展示，分开存储和处理

本期采用“保留共享新闻模型，新增非新闻研究材料模型”的方案。原因是新闻已经关联筛选、投票、地图、Trends、editorial 和扩展采集，若直接把所有材料塞进 `news_items`，每个旧消费者都可能意外读取播客和文档。

统一 Source 是前端及 API 的展示协议，不要求所有材料存在同一张表。

### 6.1 保留的记录

| 现有表/字段 | 用途及本次处理 |
|---|---|
| `news_items` | News 的唯一事实记录，保留现有 ID、新闻状态及人工锁 |
| `topic_news` | Topic 与 News 的关联，继续复用 |
| `topics` | Topic 基本信息、研究状态及现有 outputs |
| `topics.analysis.products` | 迁移前旧产品数据，切换后只作为历史兼容备份，不再双写 |
| `topics.outputs` 对应的现有存储 | 继续承载 Analysis；以当前序列化实现为准，不另建第二份分析记录 |

### 6.2 新增实体（名称为实施建议）

| 实体 | 主要字段 | 约束与目的 |
|---|---|---|
| `research_products` | id、topic_id、name、company_name、product_description、company_description、website_url、logo_asset、screenshot_asset、founded_date/precision、launch_date/precision/kind、version、created/updated/deleted_at | 每个 Topic 的产品独立维护；本期不建设跨 Topic 全局产品主档 |
| `research_sources` | id、type、original_url、canonical_key、platform、original_title、english_title、publisher、language、published_at、duration_seconds、user_description、user_description_en、current_content_id、current_summary_id、version、created_by、created/updated/deleted_at | type 仅 podcast/video/document；有效 canonical_key 去重，原始 URL 单独保留 |
| `research_topic_sources` | topic_id、source_id、linked_by、linked_at、unlinked_at | 同一 Topic 与 Source 只有一个关系；解除后可恢复，不复制 Source |
| `research_source_contents` | id、source_id、revision、body、segments、content_hash、basis、scope、visibility、created_by、created_at | 原文独立保存，按需读取；不塞入 Topic JSON 或卡片列表响应 |
| `research_source_summaries` | id、source_id、content_revision、input_hash、summary_en、key_points、evidence_refs、basis、scope、visibility、version、created_at | 摘要与原文版本绑定；保留旧摘要，切换当前版本指针 |
| `research_field_provenance` | entity_type/id、field、origin、source_url、checked_at、is_locked | 区分 user、AI、import，保护人工编辑并保留事实出处 |
| `research_jobs` | id、kind、entity_id、input_hash、expected_version、status、lease_owner/expires_at、attempts、next_attempt_at、error_code、run_id | 两种工作：product_enrichment、source_enrichment；不替代新闻作业 |
| `research_import_map` | origin_system、origin_id、origin_revision、target_kind、target_id、import_batch_id | 可追踪、可重试的一次性导入，避免按名字盲目覆盖 |

产品和资料可有轻量关联表 `research_source_products(source_id, product_id)`；News 使用独立的 `research_news_products(news_id, product_id)`，均通过真实外键约束。该关联可选，不阻塞第一版录入；未来问答可复用。

原文内容与摘要分表的直接收益是：列表不加载长文本、受限正文不随卡片泄露、更新 transcript 不改写旧证据、后台任务可以检查输入版本。摘要记录同时覆盖“只有节目说明”的情况，content_revision 可以指向保存的节目说明内容版本。

`visibility` 采用 team / restricted；restricted 的允许读取者为内容提交者和指定 Research 编辑者。Source 元数据另有 `access_mode = public / login_required / unknown`，表达外部链接访问条件，两者不能混为一谈。link_only 是“只有共享元数据、没有共享正文/摘要”的呈现状态，不是第三种正文权限。当前版本指针必须引用同一 Source 的内容/摘要，数据库函数校验这一约束。

### 6.3 News 的字段兼容

新闻继续使用原有 title、summary、raw_text 和 editorial 流程。新增表单中的原始标题、人工说明、语言、发布日期写入约定的 metadata/已有日期字段，并在适配器里转换为 SourceView。

AI 新闻摘要仍写 summary；人工说明另存，不能塞进 summary 后又被覆盖。现有手工编辑 summary 的锁定逻辑继续有效。四类型中的 `news` 由适配器给出，不修改旧 `source_type` 的枚举含义。

本期完整长 transcript 入口仅用于 Podcast / Video / Document；News 原文继续遵循现有新闻流程长度边界，并在界面显式校验，不能静默截断。若用户贴入长访谈，应选择对应类型；不通过 News 入口伪装长材料。

### 6.4 统一读取与数量

SourceView 使用稳定键 `news:<id>` 或 `research:<id>`，包含类型、语言、平台、标题、可见简介/摘要、发布时间、topicLinkedAt、外链和权限能力。

可见说明的优先级为：有权访问且有效的英文 AI 摘要；人工简介的英文版本；人工原始简介。最后一种可在补全之前暂时显示原语言，不假装已经翻译。人工简介修改后，其旧英文译文立即标记过期，不能继续无提示展示。没有可读正文但有人工简介时，只翻译简介，不把它标注成全文摘要。

Topic Sources = 有效 `topic_news` 关联的新闻 + 有效 `research_topic_sources` 关联的非新闻。默认不因共享新闻归档而丢失研究证据；全局软删除的来源不显示正文，可向编辑者提示关联缺失。Sources 总数与筛选后结果数分别显示。

列表分页按完整排序键进行；全文详情按需加载。不得先截断前 100 条再执行全局排序或筛选。

## 7. 保存、关联、去重与编辑规则

### 7.1 新增 News

1. 校验用户权限和 URL，生成稳定请求 ID。
2. 在现有新闻规范化规则下查找 canonical URL；存在则复用，不覆盖原贡献者及人工字段。
3. 新记录按现有规则进入新闻队列和 Selected Sources。
4. 如指定 Topic，同一数据库事务完成创建/复用和 `topic_news` 关联；新增一个组合 RPC，而不是前端先创建后链接却对用户只报告整体失败。
5. 重复请求返回同一记录和关系。已有软删除记录提示恢复/处理，不静默复活。

### 7.2 新增非新闻 Source

1. 校验 Type、URL、Topic 和正文大小。
2. 生成 canonical_key；保留 original_url 为实际打开链接。
3. 同一 canonical_key 存在时复用；用户输入与旧记录不同，提示更新已有资料或只关联，不静默覆盖。
4. 事务内保存 Source、Topic 关系、用户提供的内容版本及待处理作业。
5. 立即显示已保存卡片；后台补全失败不回滚人工保存。

并发去重使用数据库唯一约束和冲突后读取，不能只靠前端查询。请求幂等键绑定调用者与请求体 hash；同一键不同请求体应拒绝。

### 7.3 URL 规则

- YouTube 的短链接和 watch 链接按视频 ID 去重；时间戳可保留为定位信息，不创建第二个视频记录。
- 小宇宙按 episode ID 去重，不把节目首页当一期节目。
- 普通网页移除明确的跟踪参数，不随意删除业务参数。
- SharePoint 保留完整原始链接；未核实参数语义前不删除授权或资源参数。不同分享链接可能是同一文档，只提示重复候选，不自动合并。
- canonical_key 的日志只记录 hash 或脱敏形式，避免输出分享链接中的访问参数。
- 同一个 URL 同时存在于旧新闻库和新非新闻表时给出迁移/重复提示。第一版不跨库自动合并，不凭 URL 判断历史新闻一定是误录。
- 若既有 `news_items` 中已经保存了视频/播客，先单列历史例外清单，保持原记录及关系可访问。它们不构成本次新建非新闻的存储方式；需要迁移时逐项核对并按明确的数据修正流程处理，不靠全站过滤突然隐藏历史记录。

### 7.4 编辑与解除关联

- 产品、Source 采用 expected_version 乐观锁；冲突保留用户草稿，提示重新加载并比较。
- 非新闻三种 Type 可以更正，重新计算排序并触发需要的补全。
- News 与非新闻跨存储类型转换不作为普通下拉框直接保存；第一版不提供自动转换。误录由明确的数据修正流程处理，核查原有 Trends、投票和 Topic 关系后迁移，不能静默删除旧新闻。
- Unlink 仅作用于当前 Topic；剩余 Topic 继续可见。无关联 Source 保留为未关联记录，供研究编辑者恢复，不进入 Selected Sources。
- Topic 返回 Trends 或进入回收站时，产品和非新闻关联随原 Topic ID 保留。重新 Promote 复用原身份。

## 8. 自动补全与内容处理

### 8.1 产品补全

输入：名字、可选官网、人工介绍、已有字段及人工锁。

处理步骤：先确认产品身份，再读取官方产品/公司介绍和发布资料，提取字段，验证结构及证据，最后只提交可补充字段。允许可靠的非官方资料作为补充，但需保留来源且不能把推断写成事实。

输出：英文产品介绍、公司背景、公司名、官网、Logo、可选截图、成立时间、带事件类型的发布时间、逐字段出处和核查日期。

确定不了身份时 `blocked: identity_ambiguous`；未找到成立日期等非必填字段不使整项失败，标记该字段 unavailable，完成其他字段。保存成功与信息齐全是两件事。

后台只填空白或更新未被人工锁定的 AI 字段。人工清空字段表示有意留空，仍保留锁，不能下一次又自动填回。提供编辑者可见的“允许自动补全此字段”解除方式。

### 8.2 按类型取得内容

| 输入情况 | 获取方式 | 摘要依据与边界 |
|---|---|---|
| 用户提供完整 transcript | 保存全文，按段落/时间戳切分 | 全文均处理通过后，才能标记 full |
| 用户提供片段 | 保存片段，记录 excerpt | 仅总结片段，不使用“整期节目结论”措辞 |
| YouTube 仅有 URL | 尝试可用字幕和视频说明 | 字幕成功可按覆盖范围总结；只有说明则标记 creator_notes |
| 英文播客仅有 URL | 尝试官方 episode 页面、公开 transcript、show notes | 优先 transcript；否则只总结节目说明 |
| 小宇宙仅有 URL | 用经核实的直接工具/CLI 获取节目元数据和可获取转写 | 当前站点的 worker 直接处理，不转写到 Studio |
| 公开 Document URL | 可安全读取时提取文本，保留页码 | 无法提取则保留链接和人工简介，不假定全文可读 |
| SharePoint/需登录 Document | 不自动使用用户登录态抓取 | 只保存链接及人工简介；用户主动提供正文另按可见范围处理 |
| 只有标题，没有可读内容 | 不生成内容摘要 | 保持链接卡片，任务 blocked: content_unavailable |

自动获取原文不可用时不将“下载音频再 ASR”作为隐式兜底；该能力本期不承诺。小宇宙直接工具尚未确认，因此适配器设计和手工粘贴路径可以先做，但验收不能把未验证适配器写成已完成。

### 8.3 长文本与摘要规格

- 为研究正文新增专用保存路径，不经现有 60,000 字符截断逻辑。第一版明确支持单条 UTF-8 原文至 2 MiB，超出时保存前明确报错并保留输入；实施前验证托管请求上限，必要时使用同等总量的分块提交，不能静默降低容量。
- 原文首次保存计算 hash；有段落、说话人、时间戳或页码时结构化保留，没有时不编造。
- 以模型上下文预算分段处理并保留稳定 chunk ID。记录每段成功/失败，不允许只读开头却标注全文。
- 全部分段处理后汇总：卡片英文摘要建议 60–100 词，详情关键观点 3–6 条；材料很短时可更短，不凑条数。
- 关键观点关联 chunk ID、时间戳、页码或可验证原文片段。事实与受访者观点保留归属，避免把节目里的观点改成已核实事实。
- 附带 `basis`（provided_transcript / platform_captions / public_transcript / creator_notes / provided_excerpt / document_text）和 `scope`（full / excerpt / notes）。
- 中文默认生成英文标题、摘要和观点，原文保持中文。不默认逐字翻译整篇 transcript，避免重复存储和无必要成本。
- 人工 Description 可单独生成英文译文并存入 user_description_en；这属于忠实翻译，不属于全文总结。即使自动抓取失败，也可以完成标题/简介翻译等有证据的字段，任务同时记录未完成的正文获取原因。
- 自动摘要与人工 Description 独立。用户可编辑最终英文摘要并锁定；新 transcript 到来时保留旧人工摘要并提示其依据已过期，不自动覆盖。
- 内容更新期间读者继续看到上一版有效摘要；无新证据时不重新生成。

### 8.4 防止自动处理污染研究资料

模型只处理指定材料和可追溯证据，不能因外部网页中的指令修改 Topic、发消息或扩散抓取。抓取器沿用项目的 URL/网络安全约束，对重定向、文件类型和响应大小校验。API 密钥只在服务端或本地 worker 环境使用。

产品事实补全允许查找证据；Source 摘要必须总结该 Source 本身。另行找到相关视频或播客只能成为新的候选材料，不能冒充原 URL 的内容，也不自动公开添加。

## 9. 作业状态、调度与可靠性

### 9.1 作业状态机

| 状态 | 含义 | 下一步 |
|---|---|---|
| pending | 输入已保存，等待领取 | worker 领取后 running |
| running | 持有效 lease 处理中 | succeeded / blocked / failed / superseded |
| succeeded | 本次输入已完成可验证处理 | 输入变化创建新作业 |
| blocked | 缺正文、身份不明确、需要权限等，不宜重复请求 | 补资料或显式重试后 pending |
| failed | 临时网络/服务/校验失败 | 到达 next_attempt_at 后可重试；累计三次失败转 blocked |
| superseded | 输入版本已变化，结果过期 | 针对最新输入另建 pending 作业 |

UI 可归并为 Pending、Processing、Ready、Needs input、Retry available；这些细节仅向有编辑权限的人显示。

### 9.2 领取和提交

- 用数据库原子领取、租约和独占作业，避免同一记录被两个 worker 同时处理。
- 唯一任务键为 kind + entity_id + input_hash + pipeline_version；输入 hash 包括实际原文/URL/编辑字段及摘要策略版本，不包括排序等无关字段。
- 提交检查 lease、输入 hash、实体版本及人工锁；不匹配不强行合并旧结果，转 superseded 后处理新版本。
- 服务端保存结果与任务完成状态在同一事务中；重复提交同一结果幂等。
- worker 中断后租约可过期回收；已完成 chunk 可按输入 hash 复用。
- 每条材料独立提交；一条不可读材料不阻塞其他资料。新闻继续使用现有受保护提交机制。
- 记录处理数量、失败原因、证据范围、耗时及可获得的模型用量；日志不包含完整 transcript、密钥或受限分享参数。

### 9.3 调度

沿用现有工作日 editorial 执行入口，不创建第二个无关的提醒或 ChatGPT Automation。

执行顺序：现有 News editorial；现有独立 Signal Reference briefing；新增 Research enrichment。每个阶段均在独立错误处理内执行，前一阶段失败后仍尝试后续阶段，最终聚合退出状态。

Research 阶段内部先领取少量产品和资料任务交替处理，避免产品队列耗尽全部预算。初始每轮领取两项、阶段预算 20 分钟，超出预算不再领取新项；长任务通过 lease 心跳和分段检查点续跑。预算是可配置的实施默认值，不是已实测性能。

确认实际 Windows Task Scheduler 的时区、触发器、StartWhenAvailable 和执行时限。用户侧约定为北京时间工作日 18:00；若主机不是中国时区，应修正注册策略，不只改文档中的时间标签。

电脑关机或离线时不能保证按点执行；沿用恢复可用时补跑。周末新增材料默认下个工作日处理，编辑者可以在站点点 Retry/Queue processing 入队，实际仍需 worker 运行；不得把“入队”显示成“正在处理”或“已完成”。本期不承诺站点按钮能远程唤醒电脑。

## 10. 权限和可见范围

### 10.1 能力分工

| 身份/能力 | 可用操作 |
|---|---|
| 已批准 member | 浏览当前共享 Research、产品、资料摘要及 Analysis；按原系统权限打开外链 |
| 现有 canEdit（editor/admin） | New source、关联/解除关联；编辑本人提交的非新闻资料 |
| 现有 Research 编辑授权 | 编辑 Research Topic、产品、Analysis；维护研究资料、处理重试、恢复未关联资料 |
| 后台 worker | 领取有限作业，写入经过验证的补全字段与状态；无权更改可见范围或人工锁 |

非新闻编辑本人记录是本方案对新增表的规则；旧新闻权限保持现状，不借本次改版重写全站授权。普通 admin 不因身份自动获得指定 Research 编辑能力；以现有授权能力为准。

新表通过数据库 RLS 和写入 RPC 强制执行，API service role 调用也必须先校验实际调用者权限。前端 capability 仅用于决定是否显示按钮。若现有能力 RPC 尚未在生产部署，应先完成等效数据库授权，不能只依赖 UI fallback。

给同一 Source 增加另一个 Topic 关系不会扩大 restricted 内容的读者范围。去重查询也只返回调用者有权看到的记录信息；无权访问的正文、摘要和未关联私有记录不得通过“已存在”提示泄露。

### 10.2 原文及派生摘要

公开来源或用户选择共享的 transcript 可以供现有批准成员阅读。Document 标记为需登录时默认 link_only：读者看到链接和用户面向团队写的简介，打开后由源系统认证。

若为受限 Document 粘贴正文，默认仅提交者和指定 Research 编辑者可读，其派生摘要保持相同范围。需要让团队阅读时由资料编辑明确选择共享内容；后台不能自动扩大范围。此处只处理实际受限文档的可见性，不为普通公开播客引入额外发布审批。

全文和受限摘要不进入公共 CDN，不通过列表 API 顺便返回。未来 AI 问答也必须继承同一范围。

## 11. Personal Agents 初始内容与历史迁移

### 11.1 十二个产品清单

| 产品 | 依据 | 执行处理 |
|---|---|---|
| Ambi | Studio 当前存在 | 读取现有字段，核实后导入 |
| ChatGPT Dots | Studio 中名称为 Dots | 统一展示名，保留原始 ID 和名称映射 |
| Google CC | Studio 当前存在 | 读取现有字段，核实后导入 |
| Today.AI | Studio 当前存在 | 统一拼写，保留原始映射 |
| Muse | Studio 当前存在 | 读取现有字段，核实后导入 |
| Instinct | Studio 当前存在 | 读取现有字段，核实后导入 |
| Underdog AI | Studio 当前存在 | 读取现有字段，核实后导入 |
| Wabi | 此前研究对话列出 | 名单已于 2026-11-09 获用户确认，实施时建立 |
| Town | 此前研究对话列出 | 名单已于 2026-11-09 获用户确认，实施时建立 |
| Grok Bot | 此前研究对话列出 | 名单已于 2026-11-09 获用户确认，实施时建立 |
| Manus Cue | 此前研究对话列出 | 名单已于 2026-11-09 获用户确认，实施时建立 |
| Claude Duet | 此前研究对话列出 | 名单已于 2026-11-09 获用户确认，实施时建立 |

不自行加入 Rewind、Q、Tom 或 ColaOS 补数量。后五个已于 2026-11-09 获用户确认，十二项名单已锁定；各产品事实、官网及发布时间仍须以来源核实。

### 11.2 内容迁移规则

1. 对当前 Sonata 的 Topic、产品 JSON、新闻关联和 Analysis 做只读盘点；精确绑定目标 Topic ID，不按相似标题自动选取。
2. 对现有产品 JSON 按原 Topic ID + 原产品 ID 迁移到 `research_products`。合法且不冲突的 ID 保留，其余建立映射；保留所有旧字段和缺失情况。
3. 现有 Sonata 产品与 Studio 产品同名时先比对官网和公司；同名只是重复候选，不能直接覆盖。
4. Studio 的 `/product-media/...` 是相对路径，不能直接当本站图片地址。读取实际资源并迁至批准的图片存储路径，或使用经验证可访问的来源；失败使用占位，不显示断图。
5. 已有介绍可作为 imported 内容保留，但上线前核查官网身份、事实与时间；不将旧简介视为最新事实。新补充的字段逐项保存出处。
6. Studio Sources 只做选定条目的迁移清单：记录来源 ID、标题、类型、语言、内容完整度、目标 Topic、可见范围。pending/inbox、个人收听历史、私有注释、反馈、草稿分析不默认进入团队站点。
7. Studio 中部分现有摘要只基于 opening excerpt；如果有完整 transcript，重新按全文处理，不把旧摘要重新标成 full。
8. 同一内容在本站已存在时优先关联；迁移不制造第二条新闻或材料。重复执行 import map 返回原目标 ID。
9. 迁移脚本默认 dry-run，输出数量、映射、缺字段、重复候选和无法访问图片；明确执行导入时才写数据库。
10. 原始导出、transcript 和迁移备份不提交到公共或共享代码历史，放入现有授权的私有备份位置；备份可恢复性必须在切换前验证。

本期不会自动搜集无限数量的新视频和播客。首批资料来自明确选入的旧资料及用户新增链接；寻找补充材料可另建候选清单，不能为填满页面随意加入研究范围之外的内容。

## 12. 实施阶段与依赖

每阶段应交付可检查结果；不把“界面出现了按钮”作为后台能力完成的证据。

| 阶段 | 工作 | 交付物 | 完成标准/依赖 |
|---|---|---|---|
| A：基线与契约 | 核对实际库结构、RLS、Topic ID、现有数据、调度和未提交改动；固定字段和 API 契约 | 基线清单、迁移映射草案、能力矩阵 | 已有改动归属清楚；不覆盖 Signal Reference 等进行中的工作 |
| B：数据与 API | 新表、RLS、保存/关联 RPC、统一 SourceView、独立原文路径、版本与幂等 | 增量 migration、数据适配器及 API 测试 | 四类型持久化正确；未授权访问失败；新闻流程不变 |
| C：界面 | 产品卡片、资料卡片、表单、筛选排序、Analysis 默认链接、命名与箭头清理、旧 URL 兼容 | 可用的专题页和浏览器验证 | 不依赖 AI 也能完整新增、查看、编辑、关联资料 |
| D：补全 worker | 产品补全、长文本处理、翻译、证据范围、队列、重试、人工锁、三阶段调度 | worker、适配器、运行记录 | 长 transcript 不截断；失败隔离；并发冲突不覆盖人工修改 |
| E：首批内容 | 核实十二项清单；导入七个已有产品及其余五项；迁移选定资料 | dry-run 报告、可回溯的实际内容批次 | 目标 Topic 内容齐全，数量、来源和可见性核对通过 |
| F：发布与观察 | 本地/测试库回归、预览环境检查、迁移部署、启用功能、观察首次真实 batch | 发布记录、验收结果、回退说明 | 关键用例通过，至少一次真实保存到补全再展示闭环成功 |

依赖：A 后做 B；C 使用 B 的接口；D 使用 B 的版本和任务机制；E 依赖名单及目标 Topic 核实；F 必须通过 B/C/D 的关键验收。小宇宙适配器若不可用，保留明确限制并使用粘贴 transcript 路径，不伪造通过记录。

## 13. 代码改动范围

以下是建议的责任分布，实施可按现有代码结构调整命名，但不可把所有逻辑继续堆进 App.tsx。

| 文件/模块 | 修改方向 |
|---|---|
| `src/App.tsx` | 连接统一 SourceEditor、Research 路由、旧 URL 转向和统一文案 |
| `src/components/ResearchLibrary.tsx` | 三模块呈现、数量、标签 URL 状态、排序与筛选 |
| `src/components/ProductEditor.tsx` | 产品字段、日期精度、人工锁状态及冲突处理 |
| 新 `SourceEditor.tsx` / `ResearchSourceCard.tsx` / `SourceDetail.tsx` | 四类型录入、卡片及按需原文详情 |
| `src/components/SharedSources.tsx` | 作为 Add existing news 面板；保持现有 Trends 引用能力 |
| `src/components/ResearchEditor.tsx` / `AnalysisContent.tsx` | 统一名称，Analysis 新建默认 Link，保留旧格式 |
| `src/types.ts` / 新 source 适配器模块 | SourceView、内容版本、产品日期、排序纯函数 |
| `src/products.ts` / `src/supabase.ts` | 新产品读取、旧数据映射、新持久化接口及实时刷新 |
| `src/App.css` | 卡片布局、响应式、筛选条、链接状态和外链箭头清理 |
| `netlify/functions/` | 研究内容保存/读取与可选抓取入口，复用身份校验 |
| `scripts/` | research worker、适配器、dry-run/import/校验脚本 |
| `scripts/run-local-pipeline.ps1` | 三阶段独立执行和聚合状态，不破坏 Reference briefing |
| `supabase/migrations/` | 增量表、索引、RLS、事务函数、迁移标记及任务租约 |
| `tests/`、`e2e/`、`supabase/tests/` | 按验收矩阵补充有意义的回归 |

新增命令建议：`research:check`、`research:drain`、`research:import --dry-run`、`research:verify`。这些仅是计划名称，尚未添加到 package.json。

## 14. 验收矩阵

| ID | 场景 | 必须观察到的结果 |
|---|---|---|
| P01 | 名字加官网保存产品，刷新页面 | 同一记录仍在，不依赖部署 |
| P02 | 产品只有年份/月份/缺日期 | 展示不伪造精确日，排序稳定，未知最后 |
| P03 | 人工修改或清空简介后 batch | 人工值与清空意图不被覆盖 |
| P04 | 两处同时编辑产品 | 旧版本保存被拒绝，草稿仍在 |
| S01 | Topic 内新增 News | 一条共享新闻、一条 Topic 关系，进入既有新闻流程 |
| S02 | 已有新闻再次添加及并发添加 | 不新增第二条新闻或第二条关系 |
| S03 | 分别新增 Podcast/Video/Document | Topic 可见，Selected Sources/新闻队列/Reference 输入均不新增 |
| S04 | 全站添加非新闻但未选 Topic | 提示必选；补选后成功，Topic 内入口已预填 |
| S05 | 同一个非新闻 Source 关联两个 Topic，移除一个 | 第二个 Topic 仍可见，原文不丢 |
| S06 | YouTube 短链接和 watch 链接 | 复用同一视频，保留原链接/时间定位 |
| S07 | 默认排序含中英文、Mixed、未知、文档 | 严格按第 5 节，筛选和分页不破坏全局顺序 |
| S08 | 发布时间未知及后补发布时间 | 不用添加日期冒充；后补后排序更新 |
| C01 | 超过 60,000 字符的完整 transcript，且小于 2 MiB | 保存读取 hash 一致，无静默截断 |
| C02 | 超出允许正文大小 | 保存前明确报错，输入保留 |
| C03 | 中文全文生成英文摘要 | 原文中文不变，Language=Chinese，英文观点可定位原文 |
| C04 | 只有开头片段或节目说明 | scope=excerpt/notes，不声称全文摘要 |
| C05 | 标题存在但没有可读内容 | 不生成猜测性摘要，显示简介或待补资料 |
| C06 | SharePoint link_only | 外链保留参数，平台不泄露或假装已读取正文 |
| C07 | 受限原文及其摘要 | 普通成员 API 与 UI 均读不到受限正文和摘要 |
| J01 | batch 中途断网或进程退出 | 人工保存仍在，租约恢复后重试，无重复记录 |
| J02 | 模型处理期间修改 transcript | 旧结果不覆盖新输入，生成新作业 |
| J03 | News/Reference 之一失败 | 其他阶段仍被尝试，分别记录状态 |
| J04 | 队列无变化 | 不反复生成相同摘要或触发部署 |
| J05 | 长资料中间某段失败 | 不标 full，能按检查点重试 |
| A01 | 新建 Analysis 链接并发布 | 同事可打开；无新增排序控件；原有文章/slides 仍可用 |
| U01 | 从 Trends Promote，编辑 Research | 全流程显示 Research Topic，无 Action Thread 混称 |
| U02 | 全站链接外观 | 不存在右上外链箭头，键盘焦点及文字链接可用 |
| U03 | 移除 Workspace 入口后访问历史链接 | 正确进入 Research/指定 Analysis，不丢 ID 或权限 |
| U04 | Research 返回 Trends 后再 Promote | 产品、两类 Source 关系和 Analysis 均保留 |
| M01 | 重复运行产品/资料导入 | 数量不增长，不覆盖人工修改，映射可查 |
| M02 | Studio 相对路径图片 | 本站可访问或显示占位，不出现错误域名或断图 |
| M03 | 导入范围核对 | 未选入的 inbox、收听历史、反馈和私有草稿未公开 |
| R01 | 未登录、普通成员、editor、Research 编辑者分别访问 | API 与 RLS 均执行第 10 节权限 |
| R02 | 构建与既有流程回归 | build/lint 通过；原新闻采集、Selected Sources、Trends、Reference 关键测试通过 |

验证组合：纯函数测试覆盖日期和排序；组件测试覆盖录入和错误保留；数据库测试覆盖权限、幂等及并发；集成测试覆盖真实 transcript 及补全闭环；浏览器检查桌面和窄屏卡片、链接与旧路由。外部适配器须用至少一个可验证真实样本，不只用 mock 宣称接通。

## 15. 迁移、发布与回退

### 15.1 发布顺序

1. 记录当前未提交改动基线和实际线上版本。当前工作区已存在 Signal Reference、采集和 editorial 的大量改动；不能 reset、覆盖或当成本次修改一起无说明提交。
2. 完成只读数据盘点、迁移 dry-run 和备份恢复验证。
3. 先部署向后兼容的新表/RLS/RPC，旧 UI 继续工作；暂不开放新写入口。
4. 部署支持新模型的 API 和 UI，但功能开关保持关闭；验证实际环境的新接口及身份授权。
5. 进行短暂产品编辑冻结，迁移最后一版产品 JSON 并核对 ID/字段/数量。采用明确的按 Topic 迁移标记决定读取新表；不能因新表暂时为空而回退显示已删除的旧产品。
6. 切换产品写入到新表，所有修改 Topic 的旧路径保留旧 products JSON 但不再更新它。禁止长期双写。
7. 开启四类型 Sources 及界面新入口，验证新闻与非新闻的实际存储分流。
8. 导入已核实初始内容，检查成员视角显示及受限内容隔离。
9. 先手动运行一个有界 Research batch，检查内容、状态和并发保护；再接入既有调度。
10. 观察首次计划运行，分别核对 News、Reference、Research 三阶段结果，记录真实完成/限制项。

### 15.2 回退规则

- 数据库只做增量迁移，本期不删除旧表、旧产品 JSON、历史 Analysis 或 Studio 数据。
- 新功能出现故障时，先暂停 research worker 和新写入口，保留已保存内容，旧新闻与 Reference 继续运行。
- 已切换到新产品表并产生新编辑后，不得简单回滚到只读旧 JSON 的前端。优先关闭有问题功能并使用兼容新数据的上一可用构建；若确需旧构建，先导出新表最新内容并验证兼容投影恢复。
- 导入回退按 import_batch_id 精确处理。仅撤销该批创建且未被用户修改的关系/记录；已经编辑的内容保留并列入人工核对报告。
- 调度回退只移除 Research 阶段，不改变已有 News 与 Reference 的配置。

## 16. 待核实项与交付判定

| 项目 | 当前状态 | 对实施的影响 |
|---|---|---|
| Personal Agents 新增五项是否为 Wabi/Town/Grok Bot/Manus Cue/Claude Duet | 用户已确认，2026-11-09 | 按此清单实施，产品事实仍逐项核实 |
| 小宇宙“CY/COO”具体指哪个直接工具/CLI | 名称和可调用能力未核实 | 阻塞自动抓取验收；手工 transcript 路径正常实施 |
| Studio 哪些旧 Sources 本次选入 | 尚无逐条导入清单 | 不导入私有 inbox；先列候选及现有 included 条目供核对 |
| 实际生产 Topic ID、RLS、迁移状态、计划任务时区 | 本文依据代码，尚未逐项核对生产 | 阶段 A 通过只读检查解决，不能假定已部署 |
| 其他视频和文档的排序、摘要长度、队列预算 | 本方案已给出明确默认值 | 可直接据此实现，后续按反馈调整，不要求逐项确认 |

交付分为三个可独立核对的结果：

1. **功能交付**：三模块可用，四类型 Source 正确分流，命名和链接样式一致，保存/编辑/权限/旧链接通过验收。
2. **内容交付**：最终核实的十二个产品和明确选定资料已正确归属 Personal Agents，出处、图片、语言和时间可核对。
3. **自动处理交付**：产品补全、长资料英文摘要、人工保护和独立调度均通过真实闭环；不可用适配器单独标注，不以手工导入替代接通证明。

完成报告必须分别说明这三个结果及实际限制。仅完成页面不能宣称研究库建设完成；仅保存 transcript 也不能宣称 AI 问答或自动抓取已经实现。

import fs from 'node:fs'
import dictionary from '../config/radar-topics.json' with { type: 'json' }
const groupNames = {'Agent systems':'Agent 系统','Models and media':'模型能力与媒体生成','Infrastructure and devices':'基础设施与设备','Robotics and physical AI':'机器人与物理 AI','Products and workflows':'产品与工作流','Trust and governance':'可信、安全与治理','Capital and market structure':'资本与市场结构'}
let text = `# Signal Reference 词典\n\n版本：${dictionary.version}；复核：${dictionary.reviewedAt}；维护：每月至少一次。共 ${dictionary.topics.length} 个具体话题。\n\n## 如何分级分类\n\n第一层是阅读用的领域分组，第二层是具体可观察话题，第三层是被归入话题的原始文章／事件。一篇文章可以属于多个话题。领域不是优先级；话题不是团队确认的趋势。来源类型（官方、行业媒体、投资人、社区等）是另一个独立维度。\n\n匹配依据为标题与正文摘要中的明确词组；相似报道合并为同一发展事件。当前排名按独立事件数、来源广度、动量和有限互动指标计算，不固定置顶任何话题，也不表示战略价值。\n\nAI coding agents 原名称 Autonomous software engineering：指能查看代码仓库、修改代码并运行测试的编程代理，仍需要人的检查，不代表完全自主的软件工程。单独出现 vibe coding 不再足以归入该话题。\n\n## 本次调整\n\n保留已有 40 个稳定 ID；新增 AI industrial robotics 与 Model efficiency and distillation。代理身份、权限和访问控制单独定义，避免与攻击防御混为一类。新邮件正文支持这些边界；newsletter 中推荐的旧文不能当成当天新闻。此次不会自动清除已有文章标签。\n\n`
for (const group of dictionary.groups) {
  text += `## ${groupNames[group.label]} / ${group.label}\n\n`
  for (const t of dictionary.topics.filter(t => t.group === group.label)) text += `### ${t.label}\n\n- 稳定 ID：\`${t.slug}\`\n- 定义与边界：${t.description}\n- 匹配规则（不区分大小写）：\`${t.pattern}\`\n\n`
}
text += '## 每月维护\n\n每月 1 日北京时间 10:00 检查近 30 天原文与邮件，抽样复核漏匹配、误匹配、来源集中和重复报道。新增话题必须有明确证据与独立边界；只有一条线索时可先记候选。更新版本、定义、规则、回归测试和本文件，部署并读回确认。保留 ID 与历史标签；合并、删除或批量重标历史文章先给出影响预览。月度复核允许结论为无需变更。\n'
fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('docs/signal-reference-dictionary.md', text)
fs.writeFileSync('public/signal-reference-dictionary.md', text)
console.log(`Exported ${dictionary.topics.length} topics in ${dictionary.groups.length} groups.`)

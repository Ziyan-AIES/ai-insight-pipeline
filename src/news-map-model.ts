import type { NewsItem } from './types'
import { companyRelationships } from './company-relationships'
export const newsMapTopics = [
  {
    "id": "topic-0",
    "title": "Agent memory & context",
    "pattern": "memory|knowledge graphs?|shared context|context layer|long.conversation|ownership of AI usage data",
    "subtopics": [
      {
        "id": "topic-0-sub-0",
        "title": "Persistent memory & context",
        "pattern": "memory|shared context|context layer|long.conversation"
      },
      {
        "id": "topic-0-sub-1",
        "title": "Knowledge & retrieval",
        "pattern": "knowledge graphs?|retrieval|knowledge base"
      }
    ]
  },
  {
    "id": "topic-1",
    "title": "Agent harness & reliability",
    "pattern": "harness|Loop Engineering|coding loops|OSWorld|code.agent|coding agent|agent.*token|token.*agent|harness(?:es)?|coding agents?|agents.cli|reusable skills",
    "subtopics": [
      {
        "id": "topic-1-sub-0",
        "title": "Coding harnesses & skills",
        "pattern": "harness(?:es)?|coding agents?|code.agent|skills?|Codex|Claude Code|agents.cli"
      },
      {
        "id": "topic-1-sub-1",
        "title": "Evaluation & reliability",
        "pattern": "OSWorld|evaluat(?:e|ion)|benchmark|reliability|Loop Engineering|coding loops"
      }
    ]
  },
  {
    "id": "topic-2",
    "title": "Agent security & governance",
    "pattern": "security|permission|safeguard|credential|isolation|copyright|watermark|C2PA|governance|authorization|parental control|transparency rules|private modes",
    "subtopics": [
      {
        "id": "topic-2-sub-0",
        "title": "Permissions & isolation",
        "pattern": "permissions?|authorization|credentials?|isolation|private modes"
      },
      {
        "id": "topic-2-sub-1",
        "title": "Safety & content provenance",
        "pattern": "safeguards?|copyright|watermarks?|C2PA|parental controls?|transparency rules"
      }
    ]
  },
  {
    "id": "topic-3",
    "title": "Commerce & agent payments",
    "pattern": "commerce|shopping|payment|SkillPay|WeChat Pay|Alipay|orders|ordering|check out|bookings|outcome.based|result.based|monetization|Shop the Scene",
    "subtopics": [
      {
        "id": "topic-3-sub-0",
        "title": "Shopping & booking",
        "pattern": "commerce|shopping|orders?|ordering|check out|bookings?|Shop the Scene"
      },
      {
        "id": "topic-3-sub-1",
        "title": "Payments & monetization",
        "pattern": "payments?|SkillPay|WeChat Pay|Alipay|outcome.based|result.based|monetization"
      }
    ]
  },
  {
    "id": "topic-4",
    "title": "Personal devices & embodiment",
    "pattern": "speaker|keypad|AI companion|Muse Charm|AI device|AI Hardware|Embodied|robot|glasses|AI ring|NFC|Watch|core devices|MHS|factory hardware",
    "subtopics": [
      {
        "id": "topic-4-sub-0",
        "title": "Wearables & companions",
        "pattern": "glasses|AI ring|Watch|Muse Charm|AI companion|NFC"
      },
      {
        "id": "topic-4-sub-1",
        "title": "Robotics & connected hardware",
        "pattern": "robots?|Embodied|speakers?|keypads?|MHS|factory hardware"
      }
    ]
  },
  {
    "id": "topic-5",
    "title": "Local AI & compute",
    "pattern": "on.prem|local inference|local AI|local.first|local computing|Macs|Mac mini|DGX|RTX|Ollama|Exo|Go Abacus",
    "subtopics": [
      {
        "id": "topic-5-sub-0",
        "title": "Local deployment",
        "pattern": "on.prem|local inference|local AI|local.first|Ollama|Exo|Go Abacus"
      },
      {
        "id": "topic-5-sub-1",
        "title": "Compute & devices",
        "pattern": "Macs|Mac mini|DGX|RTX|local computing"
      }
    ]
  },
  {
    "id": "topic-6",
    "title": "Interaction & interfaces",
    "pattern": "full.duplex|voice|audio.visual|realtime|real.time voice|speech|Gemini Live|GPT.Live|Seeduplex|screen|browser|Chrome|computer.use|GenUI|Artifacts|interfaces?|Record & Replay|demonstrat|Cowork|chat merge|Copilot apps",
    "subtopics": [
      {
        "id": "topic-6-sub-0",
        "title": "Voice & live conversation",
        "pattern": "full.duplex|voice|speech|Gemini Live|GPT.Live|Seeduplex|audio.visual"
      },
      {
        "id": "topic-6-sub-1",
        "title": "Screen & browser interaction",
        "pattern": "screen|browser|Chrome|computer.use|GenUI|Artifacts|interactive|interface"
      },
      {
        "id": "topic-6-sub-2",
        "title": "Demonstration & workflow interaction",
        "pattern": "Record & Replay|demonstrat|Cowork|chat merge|Copilot apps"
      }
    ]
  },
  {
    "id": "topic-7",
    "title": "Cross-app agent workflows",
    "pattern": "cross.app|cross.device|Workspace|connected apps|connectors|MCP|Slack|browser|OS.level|OS-level|workplace|WorkBuddy|agent collaboration|MHS|Cowork|Microsoft 365|meeting note.taker|scheduling|Calendly",
    "subtopics": [
      {
        "id": "topic-7-sub-0",
        "title": "App connections & orchestration",
        "pattern": "cross.app|cross.device|connected apps|connectors|MCP|agent collaboration|MHS"
      },
      {
        "id": "topic-7-sub-1",
        "title": "Work & productivity",
        "pattern": "Workspace|Slack|workplace|WorkBuddy|Cowork|Microsoft 365|meeting|scheduling|Calendly"
      }
    ]
  },
  {
    "id": "topic-8",
    "title": "Consumer domain experiences",
    "pattern": "families|family|household|caregiver|Teens|dating|Home|health|healthcare|personal finance|Google Finance|Vibe.Trading|personal.*trading|financial market analysis|personal agents?",
    "subtopics": [
      {
        "id": "topic-8-sub-0",
        "title": "Family & caregiving",
        "pattern": "families|family|household|caregiver|Teens|parental|Home"
      },
      {
        "id": "topic-8-sub-1",
        "title": "Health & wellbeing",
        "pattern": "health|healthcare|wellbeing"
      },
      {
        "id": "topic-8-sub-2",
        "title": "Personal finance",
        "pattern": "personal finance|Google Finance|Vibe.Trading|personal.*trading|financial market analysis"
      },
      {
        "id": "topic-8-sub-3",
        "title": "Relationships & personal assistance",
        "pattern": "dating|personal agents?|AI companion"
      }
    ]
  },
  {
    "id": "topic-9",
    "title": "Creation & generative interfaces",
    "pattern": "3D|game|visual generation|diffusion|Firefly|Photoshop|creation|Creator|Artifacts|GenUI|generated Agent|flash apps|text.to.game|games?",
    "subtopics": [
      {
        "id": "topic-9-sub-0",
        "title": "Games & interactive worlds",
        "pattern": "3D|games?|text.to.game|Roblox"
      },
      {
        "id": "topic-9-sub-1",
        "title": "Visual & creative tools",
        "pattern": "visual generation|diffusion|Firefly|Photoshop|creation|Creator|Artifacts|GenUI|flash apps"
      }
    ]
  },
  {
    "id": "topic-10",
    "title": "Model competition & economics",
    "pattern": "open.weight|open model|model market|model.efficiency|token cost|API cost|2.4T|2.8.trillion|Qwen3|Kimi K3|model selection|Muse Spark|Fable|open.source releases|open models?|API costs?|token burn|spend caps|App Store|downloads",
    "subtopics": [
      {
        "id": "topic-10-sub-0",
        "title": "Models & releases",
        "pattern": "open.weight|open.source releases|open models?|Qwen3|Kimi K3|Muse Spark|Fable|2.4T|2.8.trillion"
      },
      {
        "id": "topic-10-sub-1",
        "title": "Costs & adoption",
        "pattern": "model market|model.efficiency|token cost|API costs?|model selection|token burn|spend caps|App Store|downloads"
      }
    ]
  },
  {
    "id": "topic-11",
    "title": "Enterprise AI & data ownership",
    "pattern": "enterprise|regulated|financial services|Glean|usage data|proprietary|on.prem|company context",
    "subtopics": [
      {
        "id": "topic-11-sub-0",
        "title": "Enterprise deployment & control",
        "pattern": "enterprise|regulated|financial services|on.prem"
      },
      {
        "id": "topic-11-sub-1",
        "title": "Organizational knowledge & ownership",
        "pattern": "Glean|usage data|proprietary|company context"
      }
    ]
  }
] as const
export const newsMapCompanies = [
  {
    "id": "entity:OpenAI",
    "title": "OpenAI",
    "aliases": "OpenAI|Open AI|开放人工智能|ChatGPT"
  },
  {
    "id": "entity:Anthropic",
    "title": "Anthropic / Claude",
    "aliases": "Anthropic|Claude"
  },
  {
    "id": "entity:Google",
    "title": "Google",
    "aliases": "Google|谷歌"
  },
  {
    "id": "entity:Microsoft",
    "title": "Microsoft",
    "aliases": "Microsoft|微软"
  },
  {
    "id": "entity:Meta",
    "title": "Meta",
    "aliases": "Meta|Facebook"
  },
  {
    "id": "entity:Apple",
    "title": "Apple",
    "aliases": "Apple|苹果"
  },
  {
    "id": "entity:Tencent",
    "title": "Tencent",
    "aliases": "Tencent|腾讯"
  },
  {
    "id": "entity:Alibaba",
    "title": "Alibaba",
    "aliases": "Alibaba|阿里巴巴"
  },
  {
    "id": "entity:ByteDance",
    "title": "ByteDance",
    "aliases": "ByteDance|字节跳动"
  },
  {
    "id": "entity:Amazon",
    "title": "Amazon",
    "aliases": "Amazon|亚马逊|AWS|Amazon Web Services"
  },
  {
    "id": "entity:NVIDIA",
    "title": "NVIDIA",
    "aliases": "NVIDIA|Nvidia|英伟达"
  },
  {
    "id": "entity:Hugging Face",
    "title": "Hugging Face",
    "aliases": "Hugging Face"
  },
  {
    "id": "entity:HP",
    "title": "HP",
    "aliases": "HP|Hewlett.Packard|惠普"
  },
  {
    "id": "entity:Dell",
    "title": "Dell",
    "aliases": "Dell|戴尔"
  },
  {
    "id": "entity:Samsung",
    "title": "Samsung",
    "aliases": "Samsung|三星"
  },
  {
    "id": "entity:Perplexity",
    "title": "Perplexity",
    "aliases": "Perplexity"
  },
  {
    "id": "entity:Plaud",
    "title": "Plaud",
    "aliases": "Plaud|PLAUD AI"
  },
  {
    "id": "entity:Oura",
    "title": "Oura Ring",
    "aliases": "Oura|ŌURA|Oura Ring"
  },
  {
    "id": "entity:Cloudflare",
    "title": "Cloudflare",
    "aliases": "Cloudflare"
  },
  {
    "id": "entity:Ollama",
    "title": "Ollama",
    "aliases": "Ollama"
  },
  {
    "id": "entity:Mem0",
    "title": "Mem0",
    "aliases": "Mem0"
  },
  {
    "id": "entity:Block",
    "title": "Block",
    "aliases": "Block"
  },
  {
    "id": "entity:Adobe",
    "title": "Adobe",
    "aliases": "Adobe"
  },
  {
    "id": "entity:Runway",
    "title": "Runway",
    "aliases": "Runway"
  },
  {
    "id": "entity:Roblox",
    "title": "Roblox",
    "aliases": "Roblox"
  },
  {
    "id": "entity:Meshy",
    "title": "Meshy",
    "aliases": "Meshy"
  },
  {
    "id": "entity:Moonshot",
    "title": "Moonshot",
    "aliases": "Moonshot"
  },
  {
    "id": "entity:Writer",
    "title": "Writer",
    "aliases": "Writer"
  },
  {
    "id": "entity:Calendly",
    "title": "Calendly",
    "aliases": "Calendly"
  },
  {
    "id": "entity:Granola",
    "title": "Granola",
    "aliases": "Granola"
  },
  {
    "id": "entity:DoorDash",
    "title": "DoorDash",
    "aliases": "DoorDash"
  },
  {
    "id": "entity:Glean",
    "title": "Glean",
    "aliases": "Glean"
  },
  {
    "id": "entity:Trace",
    "title": "Trace",
    "aliases": "Trace"
  },
  {
    "id": "entity:Go Abacus",
    "title": "Go Abacus",
    "aliases": "Go Abacus"
  },
  {
    "id": "entity:SpaceX",
    "title": "SpaceX",
    "aliases": "SpaceX"
  },
  {
    "id": "entity:KiWear",
    "title": "KiWear",
    "aliases": "KiWear"
  },
  {
    "id": "entity:Dexcom",
    "title": "Dexcom",
    "aliases": "Dexcom|Stelo"
  },
  {
    "id": "entity:Salesforce",
    "title": "Salesforce",
    "aliases": "Salesforce"
  },
  {
    "id": "entity:Broadcom",
    "title": "Broadcom",
    "aliases": "Broadcom|博通"
  },
  {"id":"entity:CrowdStrike","title":"CrowdStrike","aliases":"CrowdStrike|Falcon Guardian"},
  {"id":"entity:Atlassian","title":"Atlassian","aliases":"Atlassian|Rovo"}
] as const
export function topicNews(items: NewsItem[], pattern: string) {
 const regex = new RegExp('(?<![a-z0-9])(?:'+pattern+')(?![a-z0-9])','i')
 return items.filter(item => !(pattern.startsWith('memory|') && /memory glasses/i.test(item.title)) && regex.test(item.title+' '+item.summary))
}
export function companyNews(items: NewsItem[], aliases: string) {
 const regex = new RegExp('(?<![a-z0-9])(?:'+aliases+')(?![a-z0-9])','i')
 const company=newsMapCompanies.find(c=>c.aliases===aliases)
 return items.filter(item => regex.test(item.title+' '+item.summary) || (company && companyRelationships(item).some(r=>r.from===company.id||r.to===company.id)))
}
export function companyGroup(item: NewsItem) {
 const mentions = newsMapCompanies.filter(c=>companyNews([item],c.aliases).length)
 return mentions.find(c=>companyNews([{...item,summary:''}],c.aliases).length)?.title || mentions[0]?.title || 'Other / not identified'
}

export type NewsMapOverride = { topicId: string; subtopicId?: string; editedAt?: string }
export function manualMapPlacement(item: NewsItem): NewsMapOverride | undefined {
 const value=item.metadata?.news_map_override
 if(!value || typeof value!=='object' || Array.isArray(value))return
 const row=value as Record<string,unknown>
 const topic=newsMapTopics.find(t=>t.id===row.topicId)
 if(!topic)return
 return {topicId:topic.id,subtopicId:topic.subtopics.find(t=>t.id===row.subtopicId)?.id}
}
export function mapTopicNews(items: NewsItem[], topicId: string) {
 const topic=newsMapTopics.find(t=>t.id===topicId)
 if(!topic)return []
 return items.filter(item=>manualMapPlacement(item)?.topicId===topicId || topicNews([item],topic.pattern).length>0)
}
export function mapSubtopicNews(items: NewsItem[], topicId: string, subtopicId: string) {
 const topic=newsMapTopics.find(t=>t.id===topicId),sub=topic?.subtopics.find(t=>t.id===subtopicId)
 if(!sub)return []
 return items.filter(item=>{
  const manual=manualMapPlacement(item)
  if(manual?.topicId===topicId && manual.subtopicId)return manual.subtopicId===subtopicId
  return topicNews([item],sub.pattern).length>0
 })
}
const categoryTopics: Record<NewsItem['category'], string[]> = {
 interaction:['topic-6','topic-7','topic-9'],
 ai_hardware:['topic-4','topic-5'],
 ai_software:['topic-8','topic-9','topic-7','topic-3','topic-6'],
 ai_capability:['topic-0','topic-1','topic-2','topic-5','topic-10','topic-6'],
 ecosystem:['topic-7','topic-3','topic-11','topic-10'],
 industry_events:['topic-10','topic-11'],
}
export function mapPlacement(item: NewsItem) {
 const manual=manualMapPlacement(item)
 const matches=newsMapTopics.filter(t=>mapTopicNews([item],t.id).length>0)
 const preferences=categoryTopics[item.category]||[]
 const ranked=matches.map(t=>{
  const titleMatch=topicNews([{...item,summary:''}],t.pattern).length>0
  const categoryRank=preferences.indexOf(t.id)
  return {topic:t,score:(titleMatch?100:0)+(categoryRank>=0?30-categoryRank*3:0)}
 }).sort((a,b)=>b.score-a.score)
 const primary=newsMapTopics.find(t=>t.id===manual?.topicId)||ranked[0]?.topic
 const subtopic=primary?.subtopics.find(t=>t.id===manual?.subtopicId)||primary?.subtopics.find(t=>mapSubtopicNews([item],primary.id,t.id).length>0)
 return {primary,subtopic,manual:!!manual,related:matches.filter(t=>t.id!==primary?.id)}
}

export const pinnedMapCompanies = ['entity:HP','entity:Dell','entity:Samsung','entity:Plaud','entity:Oura']

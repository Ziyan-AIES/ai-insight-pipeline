import type { NewsItem } from './types'
export const newsMapTopics = [
  {
    "id": "topic-0",
    "title": "Agent memory & context",
    "pattern": "memory|knowledge graphs?|shared context|context layer|long.conversation|ownership of AI usage data"
  },
  {
    "id": "topic-1",
    "title": "Agent harness & reliability",
    "pattern": "harness|Loop Engineering|coding loops|OSWorld|code.agent|coding agent|agent.*token|token.*agent"
  },
  {
    "id": "topic-2",
    "title": "Agent security & governance",
    "pattern": "security|permission|safeguard|credential|isolation|copyright|watermark|C2PA|governance|authorization|parental control|transparency rules"
  },
  {
    "id": "topic-3",
    "title": "Commerce & agent payments",
    "pattern": "commerce|payment|SkillPay|WeChat Pay|Alipay|orders|ordering|check out|bookings|outcome.based|result.based|monetization|Shop the Scene"
  },
  {
    "id": "topic-4",
    "title": "Personal devices & embodiment",
    "pattern": "speaker|keypad|AI companion|Muse Charm|AI device|AI Hardware|Embodied|robot|glasses|AI ring|NFC|Watch|core devices"
  },
  {
    "id": "topic-5",
    "title": "Local AI & compute",
    "pattern": "on.prem|local inference|local AI|local.first|local computing|Macs|Mac mini|DGX|RTX|Ollama|Exo|Go Abacus"
  },
  {
    "id": "topic-6",
    "title": "Voice & live interaction",
    "pattern": "full.duplex|voice|audio.visual|realtime|real.time voice|speech|Gemini Live|GPT.Live|Seeduplex"
  },
  {
    "id": "topic-7",
    "title": "Cross-app agent workflows",
    "pattern": "cross.app|cross.device|Workspace|connected apps|connectors|MCP|Slack|browser|OS.level|OS-level|workplace|WorkBuddy|agent collaboration"
  },
  {
    "id": "topic-8",
    "title": "Family & personal life",
    "pattern": "families|family|household|caregiver|Teens|dating|Home|health|healthcare|personal finance"
  },
  {
    "id": "topic-9",
    "title": "Creation & generative interfaces",
    "pattern": "3D|game|visual generation|diffusion|Firefly|Photoshop|creation|Creator|Artifacts|GenUI|generated Agent|flash apps|text.to.game"
  },
  {
    "id": "topic-10",
    "title": "Model competition & economics",
    "pattern": "open.weight|open model|model market|model.efficiency|token cost|API cost|2.4T|2.8.trillion|Qwen3|Kimi K3|model selection|Muse Spark|Fable"
  },
  {
    "id": "topic-11",
    "title": "Enterprise AI & data ownership",
    "pattern": "enterprise|regulated|financial services|Glean|usage data|proprietary|on.prem|company context"
  }
] as const
export const newsMapCompanies = [
  {
    "id": "entity:OpenAI",
    "title": "OpenAI",
    "aliases": "OpenAI|Open AI|开放人工智能"
  },
  {
    "id": "entity:Anthropic",
    "title": "Anthropic",
    "aliases": "Anthropic"
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
    "aliases": "Amazon|亚马逊"
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
    "id": "entity:Perplexity",
    "title": "Perplexity",
    "aliases": "Perplexity"
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
  }
] as const
export function topicNews(items: NewsItem[], pattern: string) {
 const regex = new RegExp('(?<![a-z0-9])(?:'+pattern+')(?![a-z0-9])','i')
 return items.filter(item => !(pattern.startsWith('memory|') && /memory glasses/i.test(item.title)) && regex.test(item.title+' '+item.summary))
}
export function companyNews(items: NewsItem[], aliases: string) {
 const regex = new RegExp('(?<![a-z0-9])(?:'+aliases+')(?![a-z0-9])','i')
 return items.filter(item => regex.test(item.title+' '+item.summary))
}
export function companyGroup(item: NewsItem) {
 const mentions = newsMapCompanies.filter(c=>companyNews([item],c.aliases).length)
 return mentions.find(c=>companyNews([{...item,summary:''}],c.aliases).length)?.title || mentions[0]?.title || 'Other / not identified'
}

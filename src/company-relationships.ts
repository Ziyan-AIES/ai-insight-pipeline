import type { NewsItem } from './types'

const evidence: {url:string;pairs:string[][];kind:string}[] = [
  {
    "url": "https://openai.com/index/openai-and-apple-announce-partnership/",
    "pairs": [
      [
        "entity:OpenAI",
        "entity:Apple"
      ]
    ],
    "kind": "partnership"
  },
  {
    "url": "https://www.apple.com/newsroom/2024/12/apple-intelligence-now-features-image-playground-genmoji-and-more/",
    "pairs": [
      [
        "entity:OpenAI",
        "entity:Apple"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://www.apple.com/newsroom/2025/03/apple-intelligence-features-expand-to-new-languages-and-regions-today/",
    "pairs": [
      [
        "entity:OpenAI",
        "entity:Apple"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://www.granola.ai/blog/granola-mcp",
    "pairs": [
      [
        "entity:Granola",
        "entity:OpenAI"
      ],
      [
        "entity:Granola",
        "entity:Anthropic"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://uk.plaud.ai/blogs/news/plaud-mcp-for-chatgpt-and-claude",
    "pairs": [
      [
        "entity:Plaud",
        "entity:OpenAI"
      ],
      [
        "entity:Plaud",
        "entity:Anthropic"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://www.plaud.ai/blogs/news/plaud-brings-conversation-intelligence-to-field-sales-teams-with-new-salesforce-integration",
    "pairs": [
      [
        "entity:Plaud",
        "entity:Salesforce"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://www.microsoft.com/en/customers/story/26496-plaud-azure-speech-in-foundry-tools",
    "pairs": [
      [
        "entity:Plaud",
        "entity:Microsoft"
      ]
    ],
    "kind": "cloud"
  },
  {
    "url": "https://news.samsung.com/us/samsung-launches-first-ever-perplexity-ai-powered-tv-app-further-elevating-samsung-vision-ai-companion-experience/",
    "pairs": [
      [
        "entity:Samsung",
        "entity:Perplexity"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://news.samsung.com/us/samsung-advances-galaxy-ai-connected-ecosystem-mwc-2026/",
    "pairs": [
      [
        "entity:Samsung",
        "entity:Google"
      ],
      [
        "entity:Samsung",
        "entity:Perplexity"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://news.samsung.com/sg/samsung-and-google-cloud-join-forces-to-bring-generative-ai-to-samsung-galaxy-s24-series",
    "pairs": [
      [
        "entity:Samsung",
        "entity:Google"
      ]
    ],
    "kind": "partnership"
  },
  {
    "url": "https://www.hp.com/us-en/newsroom/press-releases/2026/computex.html",
    "pairs": [
      [
        "entity:HP",
        "entity:NVIDIA"
      ]
    ],
    "kind": "hardware"
  },
  {
    "url": "https://www.dell.com/en-us/dt/corporate/newsroom/announcements/detailpage.press-releases~usa~2025~03~corp.htm",
    "pairs": [
      [
        "entity:Dell",
        "entity:NVIDIA"
      ]
    ],
    "kind": "hardware"
  },
  {
    "url": "https://www.perplexity.ai/ca/hub/blog/perplexity-collaborates-with-amazon-web-services-to-launch-enterprise-pro",
    "pairs": [
      [
        "entity:Perplexity",
        "entity:Amazon"
      ]
    ],
    "kind": "partnership"
  },
  {
    "url": "https://www.anthropic.com/news/anthropic-amazon-trainium",
    "pairs": [
      [
        "entity:Anthropic",
        "entity:Amazon"
      ]
    ],
    "kind": "partnership"
  },
  {
    "url": "https://www.anthropic.com/news/google-broadcom-partnership-compute",
    "pairs": [
      [
        "entity:Anthropic",
        "entity:Google"
      ],
      [
        "entity:Anthropic",
        "entity:Broadcom"
      ]
    ],
    "kind": "cloud"
  },
  {
    "url": "https://investors.dexcom.com/news/news-details/2024/Dexcom-and-URA-Announce-Strategic-Partnership/default.aspx",
    "pairs": [
      [
        "entity:Oura",
        "entity:Dexcom"
      ]
    ],
    "kind": "partnership"
  },
  {
    "url": "https://ouraring.com/blog/introducing-metabolic-health/",
    "pairs": [
      [
        "entity:Oura",
        "entity:Dexcom"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://ouraring.com/blog/oura-amazon-announcement/",
    "pairs": [
      [
        "entity:Oura",
        "entity:Amazon"
      ]
    ],
    "kind": "distribution"
  },
  {
    "url": "https://blogs.microsoft.com/blog/2026/04/27/the-next-phase-of-the-microsoft-openai-partnership/",
    "pairs": [
      [
        "entity:Microsoft",
        "entity:OpenAI"
      ]
    ],
    "kind": "partnership"
  },
  {
    "url": "https://openai.com/index/amazon-partnership/",
    "pairs": [
      [
        "entity:OpenAI",
        "entity:Amazon"
      ]
    ],
    "kind": "partnership"
  },
  {
    "url": "https://www.granola.ai/blog/granola-for-apple-watch",
    "pairs": [
      [
        "entity:Granola",
        "entity:Apple"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://openai.com/index/health-in-chatgpt/",
    "pairs": [
      [
        "entity:OpenAI",
        "entity:Apple"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://help.openai.com/en/articles/20001036-health-in-chatgpt",
    "pairs": [
      [
        "entity:OpenAI",
        "entity:Apple"
      ]
    ],
    "kind": "integration"
  },
  {
    "url": "https://venturebeat.com/infrastructure/perplexity-partners-with-nvidia-to-launch-portable-computer-a-fully-local-ai-agent-with-zero-token-costs",
    "pairs": [
      [
        "entity:Perplexity",
        "entity:NVIDIA"
      ]
    ],
    "kind": "partnership"
  }
]
export function relationshipUrl(value: string) {
 try {const u=new URL(value);return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'')}catch{return ''}
}
export function companyRelationships(item: NewsItem) {
 const source=relationshipUrl(item.url)
 if(!source)return []
 const curated=evidence.filter(row=>relationshipUrl(row.url)===source).flatMap(row=>row.pairs.map(pair=>({from:pair[0],to:pair[1],kind:row.kind})))
 const manual=item.metadata?.company_relationships
 if(!Array.isArray(manual))return curated
 const accepted=manual.flatMap(row=>{
  if(!row||typeof row!=='object'||row.verified!==true||relationshipUrl(String(row.evidence_url||''))!==source)return []
  if(typeof row.from!=='string'||typeof row.to!=='string'||row.from===row.to||!['partnership','integration','cloud','hardware','distribution'].includes(row.kind))return []
  return [{from:row.from,to:row.to,kind:String(row.kind)}]
 })
 return [...curated,...accepted]
}
export function companyRelationshipNews(items:NewsItem[],a:string,b:string) {
 return items.filter(item=>companyRelationships(item).some(r=>(r.from===a&&r.to===b)||(r.from===b&&r.to===a)))
}

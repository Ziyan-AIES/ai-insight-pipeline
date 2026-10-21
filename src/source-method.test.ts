import { describe, expect, it } from 'vitest'
import { sourceConnector } from './source-method'

describe('source acquisition methods', () => {
  it('distinguishes email subscriptions, website agents and RSS even with legacy RSS storage', () => {
    expect(sourceConnector({domain:'bvp.com',sourceType:'investor',feedUrl:'',connectorType:'rss'})).toBe('agent_email')
    expect(sourceConnector({domain:'anthropic.com',sourceType:'official',feedUrl:'',connectorType:'rss'})).toBe('website_agent')
    expect(sourceConnector({domain:'a16z.news',sourceType:'investor',feedUrl:'https://www.a16z.news/feed',connectorType:'rss'})).toBe('rss')
    expect(sourceConnector({domain:'unknown.example',sourceType:'investor',feedUrl:'',connectorType:'rss'})).toBe('rss')
    expect(sourceConnector({domain:'producthunt.com',sourceType:'product_discovery',feedUrl:'',connectorType:'producthunt'})).toBe('producthunt')
  })
})

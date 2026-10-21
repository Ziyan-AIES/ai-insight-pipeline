import investorSources from '../config/investor-sources.json'
import type { RadarConnectorType, RadarSourceType } from './types'

export function sourceSetup(domain: string) {
  return investorSources.find(source => source.domain === domain.replace(/^www\./, ''))
}

export function sourceConnector(source: {domain: string; sourceType: RadarSourceType; feedUrl: string; connectorType: RadarConnectorType}): RadarConnectorType {
  if (source.connectorType !== 'rss' || source.feedUrl) return source.connectorType
  if (source.sourceType === 'official') return 'website_agent'
  if (sourceSetup(source.domain)?.method === 'agent_email') return 'agent_email'
  return source.connectorType
}

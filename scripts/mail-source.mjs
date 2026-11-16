import registry from '../config/investor-sources.json' with { type: 'json' }

export function resolveMailSource(sender, sources) {
  const address = sender.toLowerCase().trim()
  const alias = registry.find(entry => entry.senderEmails?.some(value => value.toLowerCase() === address))
  if (alias) return sources.find(source => source.enabled && source.domain === alias.domain)
  return sources.filter(source => source.enabled && (address.endsWith('@' + source.domain) || address.endsWith('.' + source.domain)))
    .sort((a, b) => b.domain.length - a.domain.length)[0]
}

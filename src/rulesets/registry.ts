import type { RulesetAdapter, RulesetId } from './contracts'

const adapters = new Map<RulesetId, RulesetAdapter>()

export function registerRulesetAdapter(adapter: RulesetAdapter): void {
  const existing = adapters.get(adapter.id)
  if (existing && existing !== adapter) {
    throw new Error(`Ruleset adapter already registered: ${adapter.id}`)
  }
  adapters.set(adapter.id, adapter)
}

export function getRulesetAdapter(id: RulesetId): RulesetAdapter {
  const adapter = adapters.get(id)
  if (!adapter) throw new Error(`Ruleset adapter is not registered: ${id}`)
  return adapter
}

export function registeredRulesetAdapters(): readonly RulesetAdapter[] {
  return [...adapters.values()]
}

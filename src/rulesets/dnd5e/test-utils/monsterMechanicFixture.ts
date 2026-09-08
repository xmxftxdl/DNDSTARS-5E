import { getDnd5eSrdMonsterBySlug, type Dnd5eMonsterStatBlock } from '../monsters'

/**
 * Unit-only fixture for a structured sub-rule of a currently DM-gated ability.
 * It has a distinct identity and never replaces the published SRD definition.
 * Passing these tests proves only the selected mechanic, not the complete prose.
 */
export function monsterMechanicFixture(slug: string, actionIds: readonly string[]): Dnd5eMonsterStatBlock {
  const source = getDnd5eSrdMonsterBySlug(slug)
  if (!source) throw new Error(`Missing source monster: ${slug}`)
  const enable = (actions: Dnd5eMonsterStatBlock['actions']) => actions.map(action => actionIds.includes(action.id)
    ? { ...action, automation: 'headless' as const, automationReason: undefined } : action)
  return { ...source, id: `test:mechanic:${slug}`, slug: `test-mechanic-${slug}`,
    actions: enable(source.actions), legendaryActions: enable(source.legendaryActions ?? []) }
}

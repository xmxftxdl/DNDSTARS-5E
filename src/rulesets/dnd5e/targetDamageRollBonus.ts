import { effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'

/** Match the credited damage source, not the combatant executing a granted Activity. */
export function dnd5eTargetDamageRollBonus(effects: readonly Dnd5eActiveEffectInstance[] | undefined, sourceId: string | undefined): number {
  if (!sourceId) return 0
  const byDefinition = new Map<string, number>()
  for (const effect of effectiveDnd5eActiveEffects(effects)) {
    const bonus = effect.modifiers?.damageRollsBySourceBonus
    if (effect.source.actorId !== sourceId || typeof bonus !== 'number' || !Number.isInteger(bonus) || Math.abs(bonus) > 1000) continue
    byDefinition.set(effect.definitionId, Math.max(byDefinition.get(effect.definitionId) ?? bonus, bonus))
  }
  return [...byDefinition.values()].reduce((sum, bonus) => sum + bonus, 0)
}

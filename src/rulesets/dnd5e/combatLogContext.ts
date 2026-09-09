import type { Dnd5eAction, Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import { dnd5ePluginRegistryStore } from './plugins/pluginRegistryStore'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'

export interface Dnd5eCombatLogContext {
  names?: Readonly<Record<string, string>>
  activityTrigger?: { activityName: string; outcomeId: string; operationId: string; conditions: readonly string[] }
  actionType?: string
  sourceActorId?: string
  sourceName?: string
  effect?: Pick<Dnd5eActiveEffectInstance, 'label' | 'source' | 'duration' | 'standardCondition'>
  /** Facts from the same target's preceding authoritative events; no inferred causal link. */
  precedingOutcomes?: readonly string[]
}

export function registeredCombatLogName(id: string): string | undefined {
  return DND5E_SRD_SPELL_NAMES_ZH[id] ?? DND5E_SRD_SPELL_NAMES_ZH[id.replace(/^spell:/, '')] ?? dnd5ePluginRegistryStore.features.get(id)?.name
    ?? dnd5ePluginRegistryStore.spells.get(id)?.name ?? dnd5ePluginRegistryStore.items.get(id)?.name
    ?? dnd5ePluginRegistryStore.monsters.get(id)?.name ?? dnd5ePluginRegistryStore.resources.get(id)?.label
}

export function effectCombatLogContext(effect: Dnd5eActiveEffectInstance): Dnd5eCombatLogContext {
  return { effect: structuredClone({ label: effect.label, source: effect.source, duration: effect.duration, standardCondition: effect.standardCondition }) }
}

/** Capture registered names before plugin unloads or future state changes. */
export function snapshotCombatLogContext(
  events: readonly Dnd5eCombatEvent[], before: Dnd5eHeadlessCombatState,
  after: Dnd5eHeadlessCombatState, action: Dnd5eAction,
): Dnd5eCombatEvent[] {
  return events.map((event, index) => {
    const names: Record<string, string> = { ...event.logContext?.names }
    for (const [field, value] of Object.entries(event)) {
      if (typeof value !== 'string' || !['featureId','abilityId','definitionId','spellId','activityId','sourceId','actionId','resourceKey','stateKey','weaponId','monsterId'].includes(field)) continue
      const label = registeredCombatLogName(value)
      if (label) names[value] = label
    }
    const context: Dnd5eCombatLogContext = { ...event.logContext, names }
    if (event.type === 'active-effect-applied' || event.type === 'active-effect-refreshed' || event.type === 'active-effect-removed' || event.type === 'class-state-changed') {
      const targetId = 'targetId' in event && event.targetId ? event.targetId : 'actorId' in event ? event.actorId : undefined
      if ('effectId' in event && targetId && !context.effect) {
        const effect = [...(after.combatants[targetId]?.classState.activeEffects ?? []), ...(before.combatants[targetId]?.classState.activeEffects ?? [])].find(item => item.id === event.effectId)
        if (effect) Object.assign(context, effectCombatLogContext(effect))
      }
      context.actionType = action.type
      context.sourceActorId = context.effect?.source.actorId ?? action.actorId
      const sourceId = context.effect?.source.rulesId ?? ('spellId' in action && typeof action.spellId === 'string' ? action.spellId : 'featureId' in action ? action.featureId : undefined)
      context.sourceName = context.effect?.source.label ?? (sourceId ? registeredCombatLogName(sourceId) : undefined)
      // Keep outcomes, never dice or hidden target numbers, in shared effect provenance.
      context.precedingOutcomes = events.slice(0, index).filter(candidate => 'targetId' in candidate && candidate.targetId === targetId).flatMap(candidate =>
        candidate.type === 'saving-throw-resolved' ? [`豁免${candidate.success ? '成功' : '失败'}`] :
        candidate.type === 'attack-resolved' ? [candidate.hit ? '攻击命中' : '攻击未命中'] :
        candidate.type === 'damage-applied' ? [`受到 ${candidate.amount} 点伤害`] : []).slice(-3)
    }
    return Object.keys(names).length || Object.keys(context).some(key => key !== 'names') ? { ...event, logContext: context } : event
  })
}

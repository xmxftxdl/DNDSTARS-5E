import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { dnd5eDamageReactionSpellEntryIssues, type Dnd5eReactionSpellMetadata } from '../damageReactionSpellContract'

/** Explains entry rejection without changing grants, automation claims or source data. */
export function dnd5eSpellActivityEntryAudit(activities: readonly Dnd5eActivityDefinitionV1[], spellId: string, spell?: Dnd5eReactionSpellMetadata) {
  const candidates = activities.filter(activity => activity.legacySource?.kind === 'spell' && activity.legacySource.id === spellId).map(activity => {
    const capability = dnd5eActivityAutomationAnalysisV1(activity).capability
    const active = !activity.invocation || activity.invocation.kind === 'active'
    const reasons: string[] = []
    if (activity.requiresEffectGrant) reasons.push('requires-effect-grant')
    if (activity.authorityBinding) reasons.push('native-authority-binding')
    if (capability.level !== 'full') reasons.push('automation-not-full')
    if (!active) reasons.push(...(spell ? dnd5eDamageReactionSpellEntryIssues(activity, spell,
      activity.invocation?.kind === 'triggered' && activity.invocation.event === 'creature-died'
        ? 'creature-died' : 'before-damage') : ['reaction-spell-metadata-missing']))
    return { activityId: activity.id, entryKind: active ? 'active' as const : 'reaction' as const,
      eligible: reasons.length === 0, reasons, automationLevel: capability.level,
      limitations: [...capability.limitations] }
  })
  // Preserve the runtime's preference for an ordinary cast over a reaction entry.
  const selected = candidates.find(candidate => candidate.eligible && candidate.entryKind === 'active') ?? candidates.find(candidate => candidate.eligible)
  return { spellId, selectedActivityId: selected?.activityId, candidates }
}

/** Follows the active cast, or a contracted damage-checkpoint entry, through real grants/calls. */
export function dnd5eSpellActivityReachabilityIssues(activities: readonly Dnd5eActivityDefinitionV1[], spellId: string, spell?: Dnd5eReactionSpellMetadata): string[] {
  const bound = activities.filter(activity => activity.legacySource?.kind === 'spell' && activity.legacySource.id === spellId)
  const audit = dnd5eSpellActivityEntryAudit(activities, spellId, spell)
  const root = bound.find(activity => activity.id === audit.selectedActivityId)
  if (!root) return bound.length ? [`法术 ${spellId} 缺少无需效果授权的完整施放入口；需要主动入口或符合伤害前反应与法术位契约的事件入口，孤立触发和 requiresEffectGrant 后续活动不能替代初始施法。`] : []
  const byId = new Map(activities.map(activity => [activity.id, activity]))
  const reached = new Set<string>()
  // A guarded listener cannot bootstrap its own authorization merely by declaring an event.
  const queue = [root.id, ...bound.filter(activity => activity.invocation?.kind === 'triggered' && !activity.requiresEffectGrant).map(activity => activity.id)]
  while (queue.length) {
    const id = queue.shift()!
    if (reached.has(id)) continue
    reached.add(id)
    const activity = byId.get(id)
    if (!activity) continue
    if (activity.continuation) {
      if (activity.continuation.nextActivityId) queue.push(activity.continuation.nextActivityId)
      if (activity.continuation.finishActivityId) queue.push(activity.continuation.finishActivityId)
    }
    for (const outcome of activity.outcomes) for (const operation of outcome.operations) {
      if (operation.kind === 'apply-effect') {
        const effect = activity.effects?.find(effect => effect.id === operation.effectId)
        queue.push(...effect?.grants ?? [], ...effect?.completionGrant?.activityIds ?? [])
      } else if (operation.kind === 'invoke-activity') queue.push(operation.activityId)
      else if (operation.kind === 'create-persistent-area') queue.push(...(operation.grantedActivities ?? []).map(grant => grant.activityId))
      else if (operation.kind === 'summon' && operation.persistent && operation.bondKey) {
        queue.push(...operation.bondActivityIds ?? [])
        if (operation.bondDismissActivityId) queue.push(operation.bondDismissActivityId)
      }
    }
  }
  return bound.filter(activity => (!activity.invocation || activity.invocation.kind === 'active' || activity.requiresEffectGrant) && !reached.has(activity.id))
    .map(activity => `Activity ${activity.id} 未从法术施放入口授予或调用，玩家无法通过后续活动入口使用；请在可达施放分支 apply-effect 实际授予 grants，或连接区域授予/持续契约/调用/续段。仅同属 legacySource 不会创建玩家按钮。`)
}

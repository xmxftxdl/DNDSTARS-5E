import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { collectDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityHeadlessCompiler'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { withDnd5eIncapacitatedActivityAuthority } from '../incapacitatedActivityAuthority'
import { dnd5eBoundHpRetaliationGrant } from './dnd5eAutonomousRetaliationContract'

/** No-choice hit retaliation is due before the hit's damage can incapacitate
 * its owner. Resolve through normal Activity authority, not an HP bypass. */
export function settleDnd5eAutomaticHitRetaliation(
  state: Dnd5eHeadlessCombatState,
  event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>,
  events: Dnd5eCombatEvent[],
): void {
  if (!event.hit) return
  const eventBatchId = `automatic-hit:${globalThis.crypto.randomUUID()}`
  const windows = listDnd5eActivityTriggerWindowsV1({ state, events: [event], eventBatchId })
  for (const window of windows) {
    if (window.triggerContext.event !== 'reaction-window') continue
    for (const available of window.available) {
      const activity = available.activity
      if (available.confirmation !== 'automatic' ||
          !['special', 'free'].includes(activity.activation.kind) ||
          activity.target.kind !== 'creature' || activity.target.count !== 1 ||
          activity.checks?.length || activity.choices?.length || activity.consumption?.length ||
          !activity.outcomes.length || activity.outcomes.some(outcome =>
            !outcome.operations.length || outcome.operations.some(operation =>
              operation.kind !== 'damage' || operation.target !== 'target'))) continue
      // Dice and player choices must still use their interrupt workflow.
      try {
        if (collectDnd5eActivityFormulaRollDeclarationsV1(activity).length) continue
      } catch { continue }
      const grant = dnd5eBoundHpRetaliationGrant(state.combatants[event.targetId], available.packageId, activity)
      const result = withDnd5eIncapacitatedActivityAuthority(state, available.packageId, activity,
        window.triggerContext, event.targetId, () => resolveRegisteredDnd5eActivityInCombatV1({
        state, combatRevision: 0, authoritativeRolls: {}, triggerContext: window.triggerContext, confirmedBy: 'system',
        command: { schemaVersion: 1, commandId: `${eventBatchId}:${available.packageId}:${activity.id}`.slice(0, 160),
          actorId: event.targetId, targetIds: [event.actorId], expectedRevision: 0,
          triggerEventId: window.triggerContext.eventId,
          grantEffectId: grant?.id, castLevel: grant?.source.spellLevel,
          packageId: available.packageId, packageVersion: available.packageVersion, activityId: activity.id },
      }))
      if (!result.result.ok || result.phase !== 'commit') continue
      // Attack resolvers hold references to their combatants. Preserve those
      // references while accepting the authoritative nested transaction.
      const combatants = state.combatants
      for (const [id, next] of Object.entries(result.result.state.combatants)) {
        if (combatants[id]) Object.assign(combatants[id], next)
        else combatants[id] = next
      }
      Object.assign(state, result.result.state, { combatants })
      events.push(...result.result.events)
      event.handledHitActivities = [...(event.handledHitActivities ?? []),
        { packageId: available.packageId, activityId: activity.id }]
    }
  }
}

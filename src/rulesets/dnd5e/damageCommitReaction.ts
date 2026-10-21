import { collectDnd5eDeferredDamageEffects } from './damageCommitCheckpoint'
import type { Character } from '../../types/character'
import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { Dnd5eDamageCommitCheckpoint, Dnd5eDamageCommitReaction } from './damageCommitCheckpoint'
import type { Dnd5eExecuteActivityCommandV1 } from './activities/dnd5eActivityCommand'
import type { Dnd5eFormulaRollResult } from './activities/dnd5eFormula'
import type { Dnd5eActivityConfirmedByV1 } from './activities/dnd5eActivityInvocation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import type { Dnd5eActivityRollMode } from './activities/dnd5eActivityExecutor'
import { listDnd5ePersonalDamageCheckpointActivitiesV1 } from './activities/dnd5eActivityTriggerWindows'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { prepareDnd5eDamageReactionSpell } from './damageReactionSpellPreparation'
import type { createDnd5eDamageReactionMaterialLedger } from './damageReactionMaterialLedger'
import type { Dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'

/** The command is player data; everything else must be supplied by the Host. */
export interface Dnd5eDamageReactionSelection {
  command: Dnd5eExecuteActivityCommandV1
  combatRevision: number
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  confirmedBy: Dnd5eActivityConfirmedByV1
  dmApproved?: boolean
  actorCharacter?: Character
}

export type Dnd5eDamageReactionResolution =
  | { ok: true; reaction: Dnd5eDamageCommitReaction; definitionSignature: string }
  | { ok: false; reason: 'ineligible-reaction' | 'unsupported-reaction' | 'reaction-rejected' | 'changed-reaction'; details?: readonly string[] }

export function dnd5eDamageCheckpointActivitySupported(activity: Dnd5eActivityDefinitionV1, checkpoint: Dnd5eDamageCommitCheckpoint): boolean {
  // Personal grants only persist authority for a later Activity; they do not
  // execute that Activity inside this damage checkpoint. Suspension keeps a
  // stored follow-up dormant until its linked defensive effect has ended.
  const lifetimeKeys = new Set(['schemaVersion', 'id', 'name', 'disposition', 'duration', 'stacking', 'modifiers', 'grants', 'grantsSingleUse', 'suspendWhileEffectId', 'concentration'])
  const delayedIds=new Set(activity.outcomes.flatMap(outcome=>outcome.operations.flatMap(operation=>operation.kind==='apply-effect' && operation.timing==='after-triggering-damage'?[operation.effectId]:[])))
  const defenseKinds = new Set(['damage-resistance','conditional-damage-resistance','damage-immunity','damage-vulnerability'])
  return !activity.authorityBinding && activity.activation.kind === 'reaction' &&
    activity.outcomes.every(outcome=>outcome.operations.every(operation=>operation.kind!=='apply-effect' || !delayedIds.has(operation.effectId) || operation.timing==='after-triggering-damage')) &&
    activity.outcomes.every(outcome => outcome.operations.every(operation =>
      ((operation.kind === 'temporary-hit-points' || operation.kind === 'apply-effect') && operation.target === 'actor') ||
      (operation.kind === 'remove-effect' && operation.target === 'actor' && operation.source === 'self' &&
        activity.requirements?.some(requirement => requirement.kind === 'active-effect' &&
          requirement.subject === 'actor' && requirement.source === 'self' && requirement.present &&
          requirement.effectId === operation.effectId) === true))) &&
    (activity.effects ?? []).every(effect => (effect.modifiers ?? []).every(modifier =>
      ((delayedIds.has(effect.id) || checkpoint.phase === 'raw-typed-damage-before-defenses') && defenseKinds.has(modifier.kind)) ||
      (delayedIds.has(effect.id) && modifier.kind === 'speed')) &&
      Object.keys(effect).every(key => lifetimeKeys.has(key) || (delayedIds.has(effect.id) && key === 'conditions')))
}

/** Apply an eligible registered Activity at the actual damage boundary. The
 * Typed defense changes require a resolver that preserves raw components.
 * Older adjusted-damage checkpoints accept only temporary HP/lifetime effects.
 * Personal deferred effects activate after the triggering damage; redirection remains unsupported.
 */
export function resolveDnd5eDamageCheckpointReaction(input: {
  state: Dnd5eHeadlessCombatState
  checkpoint: Dnd5eDamageCommitCheckpoint
  selection: Dnd5eDamageReactionSelection
  eventBatchId: string
  expectedDefinitionSignature?: string
  materialLedger?: ReturnType<typeof createDnd5eDamageReactionMaterialLedger>
}): Dnd5eDamageReactionResolution {
  const { state, checkpoint, selection } = input
  const command = selection.command
  const actorCharacter = input.materialLedger ? input.materialLedger.character(command.actorId) : selection.actorCharacter
  if (command.actorId !== checkpoint.targetId || command.targetIds.length !== 1 || command.targetIds[0] !== checkpoint.targetId) {
    return { ok: false, reason: 'ineligible-reaction' }
  }
  const windows = listDnd5ePersonalDamageCheckpointActivitiesV1({
    state, checkpoint, eventBatchId: input.eventBatchId, character: actorCharacter, allowMaterialWrites: !!input.materialLedger,
  })
  const window = windows.find(value => value.available.some(entry =>
    entry.packageId === command.packageId && entry.packageVersion === command.packageVersion && entry.activity.id === command.activityId))
  const entry = window?.available.find(value => value.packageId === command.packageId && value.activity.id === command.activityId)
  if (!window || !entry) return { ok: false, reason: 'ineligible-reaction' }
  const activity = entry.activity
  let materialPlan: Dnd5eSpellMaterialConsumptionPlan | undefined
  if (activity.consumption?.some(cost => cost.kind === 'spell-slot')) {
    const preparation = prepareDnd5eDamageReactionSpell({ packageId: entry.packageId, activity,
      actor: state.combatants[checkpoint.targetId], character: actorCharacter, choices: command.choices })
    if (!preparation.ok || (preparation.requiresInventoryWrite && (!input.materialLedger || preparation.componentCheck.materialPlan?.consumptionTiming === 'spell-end')) || command.castLevel == null || !preparation.availableCastLevels.includes(command.castLevel))
      return { ok: false, reason: 'ineligible-reaction' }
    materialPlan = preparation.componentCheck.materialPlan
  }
  const definitionSignature = JSON.stringify(activity)
  if (input.expectedDefinitionSignature && input.expectedDefinitionSignature !== definitionSignature) {
    return { ok: false, reason: 'changed-reaction' }
  }
  // Explicit capability boundary, not a spell-name allowlist. Lifetimes may
  // own the temporary-HP pool but cannot change this damage's defenses.
  if (!dnd5eDamageCheckpointActivitySupported(activity, checkpoint)) {
    return { ok: false, reason: 'unsupported-reaction' }
  }
  const {result,effects:deferredEffects} = collectDnd5eDeferredDamageEffects(()=>resolveRegisteredDnd5eActivityInCombatV1({
    state, command, combatRevision: selection.combatRevision,
    authoritativeRolls: selection.authoritativeRolls, confirmedBy: selection.confirmedBy,
    checkRollModes: selection.checkRollModes,
    dmApproved: selection.dmApproved, actorCharacter,
    triggerContext: window.triggerContext,
    allowInactiveDamageReactionCommit: true,
  }))
  if (result.phase !== 'commit' || !result.result.ok) return { ok: false, reason: 'reaction-rejected', details: [
    result.result.ok ? result.phase : result.result.reason,
    ...(result.phase === 'resolve' ? result.result.details ?? [] : []),
  ] }
  const next = result.result.state
  const target = next.combatants[checkpoint.targetId]
  // This continuation must not discard unrelated changes (summons, inventory,
  // turn order, another target). Expand the state adapter before enabling them.
  const remainder = (value: Dnd5eHeadlessCombatState) => ({
    ...value, combatants: { ...value.combatants, [checkpoint.targetId]: null },
  })
  if (!target || JSON.stringify(remainder(next)) !== JSON.stringify(remainder(state)) ||
      target.currentHp !== state.combatants[checkpoint.targetId].currentHp) {
    return { ok: false, reason: 'unsupported-reaction' }
  }
  if (materialPlan && input.materialLedger) {
    try { input.materialLedger.settle(`${input.eventBatchId}:${checkpoint.occurrence}`, command.actorId, materialPlan) }
    catch { return { ok: false, reason: 'ineligible-reaction' } }
  }
  return { ok: true, definitionSignature, reaction: { target, events: result.result.events, deferredEffects } }
}

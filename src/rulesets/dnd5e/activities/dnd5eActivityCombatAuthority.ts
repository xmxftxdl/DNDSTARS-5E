import type { Character } from '../../../types/character'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import {
  dnd5eHeadlessTurnKey,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import type { Dnd5eActivityAuthorityInput, Dnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import {
  resolveAndCommitDnd5eActivityCommand,
  type Dnd5eActivityHeadlessAuthorityBridgeResult,
} from './dnd5eActivityHeadlessAuthorityBridge'
import type { Dnd5eActivityActorSnapshot, Dnd5eActivityRollMode } from './dnd5eActivityExecutor'
import type { Dnd5eActivityTriggerContextV1 } from './dnd5eActivityContracts'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import type { Dnd5eActivityConfirmedByV1 } from './dnd5eActivityInvocation'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { dnd5eCombatantEntitledToActivityV1 } from './dnd5eActivityEntitlements'

const STANDARD_CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

/**
 * Builds an Activity snapshot exclusively from the current Host combat state.
 * Callers never submit ability scores, defenses, resources, or current HP.
 */
export function dnd5eActivityActorSnapshotFromCombatantV1(
  combatant: Dnd5eCombatant,
): Dnd5eActivityActorSnapshot {
  return {
    id: combatant.id,
    controller: combatant.controller,
    level: combatant.level,
    proficiencyBonus: combatant.proficiencyBonus,
    abilities: { ...combatant.abilities },
    classLevels: combatant.classLevels ? Object.fromEntries(
      Object.entries(combatant.classLevels)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ) : undefined,
    currentHp: combatant.currentHp,
    maxHp: combatant.maxHp,
    armorClass: combatant.armorClass,
    conditions: combatant.conditions.filter((condition): condition is Dnd5eStandardConditionId =>
      STANDARD_CONDITIONS.has(condition)),
    savingThrowModifiers: { ...combatant.savingThrowBonuses },
    resources: Object.fromEntries(Object.entries(combatant.classResources).map(([id, resource]) => [id, {
      current: resource.current,
      maximum: resource.max,
    }])),
  }
}

export interface Dnd5eRegisteredActivityCombatAuthorityInputV1 {
  state: Dnd5eHeadlessCombatState
  command: Dnd5eExecuteActivityCommandV1
  /** Revision of the authoritative combat resource that produced `state`. */
  combatRevision: number
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  areaPlacementDistanceFeet?: number
  areaTargetIds?: readonly string[]
  parentDamageType?: Dnd5eActivityAuthorityInput['parentDamageType']
  triggerContext?: Dnd5eActivityTriggerContextV1
  confirmedBy?: Dnd5eActivityConfirmedByV1
  dmApproved?: boolean
  inventoryOwner?: Character
  /** Host-owned character projection used for race/background/feat/item entitlement. */
  actorCharacter?: Character
}

/**
 * The single authoritative runtime entry for registered Activities. It derives
 * every mutable rule snapshot and distance from combat state, resolves the
 * registered recipe, and commits costs/effects atomically.
 */
export function resolveRegisteredDnd5eActivityInCombatV1(
  input: Dnd5eRegisteredActivityCombatAuthorityInputV1,
): Dnd5eActivityHeadlessAuthorityBridgeResult {
  const actor = input.state.combatants[input.command.actorId]
  const targets = input.command.targetIds.map((id) => input.state.combatants[id])
  if (!actor || targets.some((target) => !target)) {
    return {
      phase: 'resolve',
      result: {
        ok: false,
        reason: !actor ? 'unauthorized-actor' : 'target-snapshot-mismatch',
        details: [!actor ? 'actor is absent from Host combat state' : 'target is absent from Host combat state'],
      },
    }
  }
  const activity = getRegisteredDnd5eActivity(input.command.packageId, input.command.activityId)
  if (!activity || !dnd5eCombatantEntitledToActivityV1({
    packageId: input.command.packageId,
    activity,
    combatant: actor,
    character: input.actorCharacter ?? input.inventoryOwner,
  })) {
    return {
      phase: 'resolve',
      result: {
        ok: false,
        reason: 'unauthorized-actor',
        details: ['actor is not entitled to the registered Activity'],
      },
    }
  }
  const distanceFeetByTargetId = Object.fromEntries(targets.map((target) => [
    target!.id,
    target!.id === actor.id
      ? 0
      : input.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actor.id, target!.id)] ?? Number.POSITIVE_INFINITY,
  ]))
  const turnKey = dnd5eHeadlessTurnKey(input.state, actor.id)
  const usedTurnKeys = new Set(Object.entries(actor.classState.declarativeUsedTurnKeys ?? {})
    .filter(([, appliedTurnKey]) => appliedTurnKey === turnKey)
    .map(([key]) => key))

  return resolveAndCommitDnd5eActivityCommand(input.state, {
    command: input.command,
    currentRevision: input.combatRevision,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(actor),
    targets: targets.map((target) => dnd5eActivityActorSnapshotFromCombatantV1(target!)),
    authoritativeRolls: input.authoritativeRolls,
    checkRollModes: input.checkRollModes,
    distanceFeetByTargetId,
    areaPlacementDistanceFeet: input.areaPlacementDistanceFeet,
    areaTargetIds: input.areaTargetIds,
    parentDamageType: input.parentDamageType,
    usedTurnKeys,
    dmApproved: input.dmApproved,
    triggerContext: input.triggerContext,
    confirmedBy: input.confirmedBy,
    inventoryOwner: input.inventoryOwner,
  })
}

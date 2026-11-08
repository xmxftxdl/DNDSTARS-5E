import{replayPactSeparation,type PactSeparationTrace}from'./pactWeaponSeparation'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import { mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import { normalizeDnd5eInventory } from '../../rulesets/dnd5e/items'
import { dnd5eClassDefinitionForCharacter } from '../../rulesets/dnd5e/classes'
import { dnd5eCharacterHasDeferredRageDeath } from '../../rulesets/dnd5e/pluginApi'
import { dnd5eConditionIncapacitated } from '../../rulesets/dnd5e/conditions'
import { dnd5eConditionsFromActiveEffects, normalizeDnd5eActiveEffects } from '../../rulesets/dnd5e/activeEffects'
import { dnd5eMapTokenDistanceFeet, dnd5eTokenToPointDistanceFeet } from '../../rulesets/dnd5e/verticalCombatGeometry'
import { tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { transitionPactWeapon, type PactWeaponState } from './pactWeaponBinding.mjs'
import { planPactWeaponInventoryTransaction, type PactInventoryDocument } from './pactWeaponInventoryTransaction'

/** Host plan only. Movement and clock adapters must commit its complete result
 * alongside the authority state using the same original document revisions. */
export function planPactWeaponLifecycle(input: {
  state: PactWeaponState; document: PactInventoryDocument; characters: readonly Character[]
  map: BattleMap; geometry?: MapGeometryState; expectedRevision: number
  expectedInventoryRevisions: Readonly<Record<string, number>>
  hostClockRevision?:number
  worldSecond: number; transactionId: string; kind: 'advance' | 'dismiss'
  lifecycleTrace?:PactSeparationTrace
  /** Attestation from the actual Host ritual tracker, never a player field. */
  ritualContinuity?: { ritualId: string; uninterrupted: boolean }[]
}) {
  const fail = (reason: string) => ({ ok: false as const, reason })
  const owners = input.characters.filter(actor => actor.id === input.state.ownerId)
  if (owners.length !== 1 || input.document.ownerId !== input.state.ownerId) return fail('pact-owner-unavailable')
  if(input.expectedRevision!==input.state.revision)return fail('owner-or-revision-mismatch')
  const owner = owners[0]
  const level = owner.dnd5eClassLevels?.warlock ?? (dnd5eClassDefinitionForCharacter(owner)?.id === 'warlock' ? owner.level : 0)
  const hasBladePact = level >= 3 && owner.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon']?.includes('blade') === true
  // Being unconscious is not death, including while death saving throws remain.
  const ownerDead = owner.currentHp <= 0 && (owner.deathSaveFailures ?? 0) >= 3 && !dnd5eCharacterHasDeferredRageDeath(owner)
  if (input.kind === 'dismiss' && !ownerDead && (owner.currentHp <= 0 || dnd5eConditionIncapacitated({ conditions: [
    ...(owner.conditions ?? []), ...dnd5eConditionsFromActiveEffects(normalizeDnd5eActiveEffects(owner.dnd5eCombatState?.activeEffects)),
  ] }))) return fail('pact-owner-incapacitated')
  const boundId = input.state.binding?.inventoryInstanceId
  const ownerTokens = input.map.tokens.filter(token => token.characterId === owner.id)
  const carried = boundId ? input.characters.flatMap(actor => normalizeDnd5eInventory(actor).entries
    .filter(entry => entry.instanceId === boundId).map(entry => ({ actor, entry }))) : []
  const ground = boundId ? input.map.tokens.filter(token => token.dnd5eObjectState?.inventoryItem?.instance?.instanceId === boundId) : []
  const stowed = input.document.stowed.filter(entry => entry.instanceId === boundId)
  const nested = input.map.tokens.some(token => token.dnd5eCarriedObjects?.some(held =>
    held.objectState.inventoryItem?.instance?.instanceId === boundId || held.objectState.inventoryItem?.contents?.some(entry => entry.instanceId === boundId)) ||
    token.dnd5eObjectState?.inventoryItem?.contents?.some(entry => entry.instanceId === boundId))
  if (boundId && (carried.length + ground.length + stowed.length > 1 || nested)) return fail('pact-instance-conflict-or-unsupported-location')
  const positioned = (token: Token) => [token.x, token.y, token.elevationFeet ?? 0].every(Number.isFinite)
  let distance: number | undefined
  const origin = ownerTokens.length === 1 && positioned(ownerTokens[0]) ? ownerTokens[0] : undefined
  if (origin && carried.length === 1) {
    if (carried[0].actor.id === owner.id) distance = 0
    else {
      const carriers = input.map.tokens.filter(token => token.characterId === carried[0].actor.id)
      if (carriers.length === 1 && positioned(carriers[0])) distance = dnd5eMapTokenDistanceFeet({
        map: input.map, geometry: input.geometry, left: origin, right: carriers[0],
      })
    }
  } else if (origin && ground.length === 1 && positioned(ground[0])) {
    // A dropped weapon is a point at the object elevation, not a five-foot tall creature.
    distance = dnd5eTokenToPointDistanceFeet({ geometry: input.geometry, token: origin,
      pointElevationFeet: mapGeometryTokenElevation(input.geometry, ground[0]),
      horizontalDistanceFeet: tokenFootprintDistanceCells(origin, { ...ground[0], creatureSize: '微型' }, input.map) * Math.max(1, input.map.feetPerCell ?? 5),
    })
  }
  const replay=replayPactSeparation(input.state,input.lifecycleTrace,hasBladePact,input.worldSecond)
  if(!replay.ok)return replay
  const state=replay.state,operations=replay.inventoryOperations
  const transition = transitionPactWeapon(state, { ownerId: owner.id, expectedRevision: state.revision, kind: input.kind==='dismiss'&&!state.binding&&operations.length?'advance':input.kind }, {
    ownerId: owner.id, hasBladePact, ownerDead, worldSecond: input.worldSecond,
    ritualContinuity: input.ritualContinuity,
    bindingLocations: boundId && distance != null ? [{ inventoryInstanceId: boundId, distanceFromOwnerFeet: distance }] : [],
  })
  if (!transition.ok) return transition
  const plan = planPactWeaponInventoryTransaction({ hostClock:{worldSecond:input.worldSecond,revision:input.hostClockRevision??-1}, document: input.document, expectedRevision: input.document.revision,
    expectedInventoryRevisions: input.expectedInventoryRevisions, transactionId: input.transactionId,
    characters: input.characters, map: input.map, operations: [...operations,...transition.inventoryOperations] })
  // Internal history transitions are one atomic Host lifecycle command.
  // Only that publication advances the externally guarded Pact revision.
  return plan.ok ? { ...plan, state: {...transition.state,revision:input.state.revision+1},
    lifecycleUnknown: transition.lifecycleUnknown, ritualInterrupted: transition.ritualInterrupted } : plan
}

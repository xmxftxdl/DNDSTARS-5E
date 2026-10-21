import type { BattleMap } from '../../store/maps'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeDnd5eObjectFlightDeparture, planDnd5eObjectFlightArrival, completeDnd5eObjectFlightDeparture, captureDnd5eObjectFlightDeparture } from './mapObjectFlightDeparture'
import type { Character } from '../../types/character'
import { planDnd5eMapResultApplication } from './mapBridge'
import { applyDnd5eActivityMapHandoffsV1 } from './activities/dnd5eActivityMapInteraction'
import { pixelToCell } from '../../lib/gridCombat'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivitySequentialCheckModesV1 } from './activities/dnd5eActivitySequentialCheckModes'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import type { Dnd5eFormulaRollResult } from './activities/dnd5eFormula'
import { commitDnd5eActivityExecution, reconcileDnd5eSummonSourceDeathState, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'

/** Pure Host staging. The caller must atomically apply the map handoff and complete
 * the source receipt before publishing any resulting damage or success message. */
type ObjectFlightArrivalInput = {
  sourceMap: BattleMap; receiptId: string; destinationMap: BattleMap; geometry?: MapGeometryState
  point: { x: number; y: number; elevationFeet: number }
  state: Dnd5eHeadlessCombatState; rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
}

export function prepareDnd5eObjectFlightArrival(input: Omit<ObjectFlightArrivalInput, 'rolls'>) {
  const entry = normalizeDnd5eObjectFlightDeparture(input.sourceMap.dnd5eObjectFlightDepartures?.find(candidate => candidate.id === input.receiptId))
  if (!entry || entry.sourceMapId !== input.sourceMap.id || entry.status !== 'pending' || entry.damageType !== 'bludgeoning') return { ok: false as const, reason: 'invalid-flight-receipt' }
  const arrival = planDnd5eObjectFlightArrival({ entry, map: input.destinationMap, geometry: input.geometry, point: input.point })
  const actor = input.state.combatants[entry.actorId]
  if (!arrival || !actor) return { ok: false as const, reason: 'invalid-flight-context' }
  const targetIds = arrival.plan.creatures.map(contact => contact.tokenId)
  if (targetIds.some(id => !input.state.combatants[id])) return { ok: false as const, reason: 'missing-flight-target' }
  const limits = { ...entry.limits, distanceFeet: entry.remainingFeet }
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'object-flight-arrival', name: '物件飞行延续',
    legacySource: { kind: 'spell', id: entry.activityId, magical: true }, activation: { kind: 'free' },
    target: { kind: 'area', origin: 'point', relation: 'any', shape: 'rect', widthFeet: 5, lengthFeet: 5, heightFeet: 5, rotatable: true },
    checks: [{ id: 'save', kind: 'saving-throw', ability: entry.saveAbility, rollId: 'save', scope: 'per-target',
      rollMode: 'host-derived', stopAfterFirstFailure: true, dc: { kind: 'constant', value: entry.saveDc } }],
    outcomes: [
      { id: 'hit', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [{
        id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: entry.damage }, damageType: 'bludgeoning',
      }] },
      { id: 'flight', when: { kind: 'always' }, operations: [{ id: entry.operationId, kind: 'launch-map-object',
        limits, savingThrowCheckId: 'save', amount: { kind: 'constant', value: entry.damage }, damageType: 'bludgeoning' }] },
    ], automation: automationCapabilityFromLegacyStatus('full'),
  }
  const areaPlacement = { ...input.point, angleDegrees: entry.angleDegrees, objectLaunchPitchDegrees: entry.pitchDegrees }
  return { ok: true as const, entry, arrival, activity, areaPlacement, actor, targetIds }
}

export function resolveDnd5eObjectFlightArrival(input: ObjectFlightArrivalInput) {
  const prepared = prepareDnd5eObjectFlightArrival(input)
  if (!prepared.ok) return prepared
  const { entry, arrival, activity, areaPlacement, actor, targetIds } = prepared
  const actorSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, input.state)
  const targets = targetIds.map(id => dnd5eActivityActorSnapshotFromCombatantV1(input.state.combatants[id], actor, input.state))
  const resolution = resolveDnd5eActivity({ activity, actor: actorSnapshot, targets, castLevel: entry.slotLevel,
    areaPlacement, areaPlacementDistanceFeet: 0, rolls: input.rolls,
    resolveSequentialCheckRollModes: dnd5eActivitySequentialCheckModesV1({ activity, actor, combatants: input.state.combatants,
      sourceDistanceFeet: () => undefined }),
  })
  if (!resolution.ok) return { ok: false as const, reason: resolution.reason, details: resolution.details }
  if (resolution.consumptions.length) return { ok: false as const, reason: 'flight-cannot-consume-resources' }
  const committed = commitDnd5eActivityExecution(input.state, { actorId: entry.actorId, activityId: entry.activityId,
    castLevel: entry.slotLevel, targetIds, resolution, allowObjectFlightContinuationCommit: true,
    source: { kind: 'spell', id: entry.activityId, packageId: entry.packageId },
  })
  if (!committed.ok) return { ok: false as const, reason: committed.reason }
  const lifecycle = reconcileDnd5eSummonSourceDeathState(committed.state)
  return { ok: true as const, entry, arrival, activity, areaPlacement, resolution,
    committed: { ...committed, state: lifecycle.state, events: [...committed.events, ...lifecycle.events] } }
}

/** Build both scene updates together. No store writes happen here: resources,
 * geometry and these maps must be persisted using one fixed-revision transaction. */
export type Dnd5eObjectFlightArrivalTransactionInput = Parameters<typeof resolveDnd5eObjectFlightArrival>[0] & {
  settlementId: string; characters: readonly Character[]; characterIdByCombatantId: Readonly<Record<string, string>>
  sourceGeometry?: MapGeometryState | null
}

export function planDnd5eObjectFlightArrivalTransaction(input: Dnd5eObjectFlightArrivalTransactionInput) {
  const staged = resolveDnd5eObjectFlightArrival(input)
  if (!staged.ok) return staged
  return planDnd5eResolvedObjectFlightArrivalTransaction(input, staged)
}

/** Host-only continuation after the normal damage follow-up pipeline. */
export function planDnd5eResolvedObjectFlightArrivalTransaction(input: Dnd5eObjectFlightArrivalTransactionInput,
  staged: Extract<ReturnType<typeof resolveDnd5eObjectFlightArrival>, { ok: true }>) {
  if (!input.settlementId || input.settlementId.length > 200) return { ok: false as const, reason: 'invalid-flight-settlement-id' }
  if (input.sourceMap.id === input.destinationMap.id && JSON.stringify(input.sourceMap) !== JSON.stringify(input.destinationMap)) return { ok: false as const, reason: 'conflicting-flight-scene-snapshots' }
  const { entry, arrival, committed, activity, areaPlacement } = staged
  if (input.sourceMap.tokens.some(token => token.id === entry.object.id)) return { ok: false as const, reason: 'flight-object-still-on-source-map' }
  const destinationIds = new Set(arrival.map.tokens.map(token => token.id))
  const sourceIds = new Set(input.sourceMap.tokens.map(token => token.id))
  const changedOutsideDestination = Object.keys(committed.state.combatants).filter(id => !destinationIds.has(id) &&
    JSON.stringify(committed.state.combatants[id]) !== JSON.stringify(input.state.combatants[id]))
  if (changedOutsideDestination.some(id => !sourceIds.has(id))) return { ok: false as const, reason: 'flight-changed-participant-map-missing' }
  const projectedState = structuredClone(committed.state)
  projectedState.combatants = Object.fromEntries(Object.entries(projectedState.combatants).filter(([id]) => destinationIds.has(id)))
  const events = [...committed.events]
  const mapped = planDnd5eMapResultApplication({ state: projectedState, map: arrival.map,
    characters: input.characters, characterIdByCombatantId: input.characterIdByCombatantId,
    geometry: input.geometry, events })
  const launch = committed.activityHandoffs?.mapObjectLaunches?.[0]
  if (!launch) return { ok: false as const, reason: 'missing-flight-handoff' }
  const completed = completeDnd5eObjectFlightDeparture(entry, input.settlementId)!
  let destinationMap: BattleMap
  let characters = mapped.characters
  let geometryEntityPatches: { entityId: string; patch: import('../../lib/mapGeometry').MapGeometryEntityPatch }[] = []
  if (!launch.impactTargetId && arrival.plan.stop?.kind === 'map-boundary') {
    const next = captureDnd5eObjectFlightDeparture({ map: mapped.map, geometry: input.geometry, objectId: entry.object.id,
      limits: { ...entry.limits, distanceFeet: entry.remainingFeet }, slotLevel: entry.slotLevel,
      angleDegrees: entry.angleDegrees, pitchDegrees: entry.pitchDegrees,
      actionId: entry.actionId, operationId: entry.operationId, actorId: entry.actorId, packageId: entry.packageId, activityId: entry.activityId,
      saveDc: entry.saveDc, saveAbility: entry.saveAbility, damage: entry.damage, damageType: entry.damageType,
      // Capture validates every local contact; previous successes are already
      // excluded from the new save list, then retained for any following scene.
      successfulTargetIds: arrival.localContactIds,
    })
    if (!next) return { ok: false as const, reason: 'invalid-next-flight-departure' }
    next.id = `object-flight:${entry.actionId}:${entry.operationId}:${input.settlementId}`
    next.successfulTargetIds = [...new Set([...entry.successfulTargetIds, ...next.successfulTargetIds])]
    if (!normalizeDnd5eObjectFlightDeparture(next) || mapped.map.dnd5eObjectFlightDepartures?.some(receipt => receipt.id === next.id)) return { ok: false as const, reason: 'conflicting-flight-departure' }
    destinationMap = { ...mapped.map, tokens: mapped.map.tokens.filter(token => token.id !== entry.object.id),
      dnd5eObjectFlightDepartures: [...mapped.map.dnd5eObjectFlightDepartures ?? [], next] }
  } else {
    const anchorCell = pixelToCell(input.point.x, input.point.y, mapped.map)
    const applied = applyDnd5eActivityMapHandoffsV1({ map: mapped.map, characters: mapped.characters,
      activity, packageId: entry.packageId, actionId: entry.actionId,
      // The physical handoff uses the arriving object as its map anchor. The
      // Headless damage above retains the original caster and spell attribution.
      actorId: entry.object.id, round: committed.state.round, castLevel: entry.slotLevel,
      sourceSaveDc: entry.saveDc, objectFlightGeometry: input.geometry ?? null,
      handoffs: { movements: [], summons: [], persistentAreas: [], invocations: [], mapObjectLaunches: [launch] }, selection: {},
      areaSelection: { anchorCell, cells: [anchorCell], targetIds: arrival.plan.creatures.map(contact => contact.tokenId),
        areaPlacement, areaPlacementDistanceFeet: 0 },
    })
    if (!applied.ok) return applied
    destinationMap = applied.map
    characters = applied.boundCharacters ? [...applied.boundCharacters] : mapped.characters
    geometryEntityPatches = [...applied.geometryEntityPatches ?? []]
  }
  let updatedSourceMap = input.sourceMap
  if (input.sourceMap.id !== destinationMap.id && changedOutsideDestination.length) {
    const sourceState = structuredClone(committed.state)
    sourceState.combatants = Object.fromEntries(Object.entries(sourceState.combatants).filter(([id]) => sourceIds.has(id)))
    const sourceResult = planDnd5eMapResultApplication({ state: sourceState, map: input.sourceMap,
      characters, characterIdByCombatantId: input.characterIdByCombatantId, geometry: input.sourceGeometry ?? null, events })
    const changed = new Set(changedOutsideDestination)
    updatedSourceMap = { ...sourceResult.map, tokens: input.sourceMap.tokens.map(token => changed.has(token.id)
      ? sourceResult.map.tokens.find(candidate => candidate.id === token.id)! : token) }
    const changedCharacterIds = new Set(changedOutsideDestination.map(id => input.characterIdByCombatantId[id]).filter(Boolean))
    characters = characters.map(character => changedCharacterIds.has(character.id)
      ? sourceResult.characters.find(candidate => candidate.id === character.id)! : character)
    for (const id of changedOutsideDestination) projectedState.combatants[id] = sourceState.combatants[id]
  }
  const receiptMap = input.sourceMap.id === destinationMap.id ? destinationMap : updatedSourceMap
  const sourceMap = { ...receiptMap, dnd5eObjectFlightDepartures: receiptMap.dnd5eObjectFlightDepartures!.map(receipt => receipt.id === entry.id ? completed : receipt) }
  if (sourceMap.id === destinationMap.id) destinationMap = sourceMap
  return { ok: true as const, sourceMap, destinationMap, characters, geometryEntityPatches,
    state: { ...committed.state, combatants: { ...committed.state.combatants, ...projectedState.combatants } },
    events, completedReceipt: completed }
}

import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eMapResultPlan } from './mapBridge'
import type { Dnd5eActivityAuthorityHandoffs } from './headlessCombatEngine'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { applyDnd5eActivityMapHandoffsV1 } from './activities/dnd5eActivityMapInteraction'
import { resolveDnd5eCreatureSensorTarget, type Dnd5eCreatureSensorTargetReceipt } from './creatureSensorTarget'

type Lookup = Parameters<typeof resolveDnd5eCreatureSensorTarget>[0]
export interface Dnd5eCreatureSensorProjection { map: BattleMap; actorId: string; targetId: string; receipt: Dnd5eCreatureSensorTargetReceipt }
const projections = new WeakMap<Dnd5eCreatureSensorProjection, { lookup: Lookup; roomSnapshot: string; projectionSnapshot: string }>()
const fail = (reason: string) => ({ ok: false as const, reason })

/** Call at resolution time, after the long cast. The added participant exists
 * only in the calculation snapshot; it must never be persisted in this scene. */
export function prepareDnd5eCreatureSensorProjection(input: Lookup) {
  const found = resolveDnd5eCreatureSensorTarget(input)
  if (!found.ok) return found
  if (found.phase === 'ethereal') return fail('sensor-plane-overlay-required')
  const remote = found.actorMap.id !== found.targetMap.id
  const map = structuredClone(found.actorMap)
  if (remote) map.tokens.push(structuredClone(found.target))
  const projection = { map, actorId: found.actor.id, targetId: found.target.id, receipt: input.receipt }
  projections.set(projection, { lookup: { ...input, choices: { ...input.choices } },
    roomSnapshot: JSON.stringify(input.room), projectionSnapshot: JSON.stringify([map, projection.actorId, projection.targetId]) })
  return { ok: true as const, projection }
}

/** Prepare the casting marker for publication without leaking the calculation
 * participant into the source scene. The caller still owns atomic publication. */
export function planDnd5eCreatureSensorCastingPublication(input: {
  projection: Dnd5eCreatureSensorProjection; room: Lookup['room']; application: Dnd5eMapResultPlan
}) {
  const saved = projections.get(input.projection)
  if (!saved || JSON.stringify(input.room) !== saved.roomSnapshot ||
    JSON.stringify([input.projection.map, input.projection.actorId, input.projection.targetId]) !== saved.projectionSnapshot) return fail('sensor-resolution-conflict')
  const found = resolveDnd5eCreatureSensorTarget({ ...saved.lookup, room: input.room })
  if (!found.ok) return found
  if (input.application.map.id !== found.actorMap.id) return fail('invalid-sensor-source')
  const ids = new Set(found.actorMap.tokens.map(token => token.id))
  // The remote participant is a calculation-only copy. Publishing the casting
  // marker must preserve the real source scene's membership.
  if (input.application.map.tokens.some(token => !ids.has(token.id) && token.id !== found.target.id) ||
    found.actorMap.tokens.some(token => !input.application.map.tokens.some(value => value.id === token.id))) return fail('invalid-sensor-casting-map')
  return { ok: true as const, application: { ...input.application,
    map: { ...input.application.map, tokens: input.application.map.tokens.filter(token => ids.has(token.id)) },
    changedTokenIds: input.application.changedTokenIds.filter(id => ids.has(id)),
  } }
}

/** Pending writes only: caller commits all maps, characters, resources and rest
 * receipt together with room revision checks, or publishes none of them. */
export function planDnd5eCreatureSensorResolution(input: {
  projection: Dnd5eCreatureSensorProjection; room: { maps: readonly BattleMap[]; characters: readonly Character[] }
  application: Dnd5eMapResultPlan; handoffs: Dnd5eActivityAuthorityHandoffs; round: number; worldMinute: number
}) {
  const saved = projections.get(input.projection)
  if (!saved || JSON.stringify(input.room) !== saved.roomSnapshot ||
    JSON.stringify([input.projection.map, input.projection.actorId, input.projection.targetId]) !== saved.projectionSnapshot) return fail('sensor-resolution-conflict')
  const found = resolveDnd5eCreatureSensorTarget({ ...saved.lookup, room: input.room })
  if (!found.ok) return found
  if (found.phase === 'ethereal') return fail('sensor-plane-overlay-required')
  const activity = getRegisteredDnd5eActivity(saved.lookup.packageId, saved.lookup.activityId)!
  const concentrationId = activity.spellInvocation!.spellId
  const areas = input.handoffs.persistentAreas
  if (!Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0 || input.application.map.id !== found.actorMap.id ||
    areas.length > 1 || areas.some(area => !area.effectToken?.followSelectedTarget || area.sensorTargetId !== found.target.id) ||
    Object.entries(input.handoffs).some(([key, value]) => key !== 'persistentAreas' && Array.isArray(value) && value.length > 0)) return fail('invalid-sensor-resolution')
  const settledActor = input.application.map.tokens.find(token => token.id === found.actor.id)
  const calculatedTarget = input.application.map.tokens.find(token => token.id === found.target.id)
  if (!settledActor || !calculatedTarget) return fail('missing-sensor-participant')
  const remote = found.actorMap.id !== found.targetMap.id
  const target = { ...calculatedTarget, x: found.target.x, y: found.target.y, elevationFeet: found.target.elevationFeet,
    movementAnimation: found.target.movementAnimation }
  const changed = new Map<string, Set<string>>()
  let maps: BattleMap[] = input.room.maps.map(original => {
    const map = original.id === found.actorMap.id ? input.application.map : original
    const removed = (map.dnd5ePluginAreas ?? []).filter(area => area.concentrationId === concentrationId &&
      (found.actor.characterId ? area.sourceCharacterId === found.actor.characterId : area.sourceTokenId === found.actor.id))
    const ids = new Set(removed.map(area => area.id))
    const anchors = new Set(removed.flatMap(area => area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : []))
    const removedTokens = map.tokens.filter(token => anchors.has(token.id) && token.dnd5eSpellEffect?.concentrationId === concentrationId &&
      (found.actor.characterId ? token.dnd5eSpellEffect.sourceCharacterId === found.actor.characterId : token.dnd5eSpellEffect.sourceTokenId === found.actor.id))
    if (removedTokens.length || removed.length) changed.set(map.id, new Set(removedTokens.map(token => token.id)))
    const removedIds = new Set(removedTokens.map(token => token.id))
    return { ...map, tokens: map.tokens.flatMap(token => removedIds.has(token.id) ? [] : token.id === found.target.id ?
      remote && map.id === found.actorMap.id ? [] : [target] : [token]),
      dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(area => !ids.has(area.id)) }
  })
  let destination = maps.find(map => map.id === found.targetMap.id)!
  if (areas.length) {
    const calculationMap = remote ? { ...destination, tokens: [...destination.tokens, settledActor] } : destination
    const placed = applyDnd5eActivityMapHandoffsV1({ map: calculationMap, activity, packageId: saved.lookup.packageId,
      actionId: saved.lookup.actionId, actorId: found.actor.id, characters: input.application.characters,
      round: input.round, worldMinute: input.worldMinute, concentrationId, selection: {}, handoffs: input.handoffs })
    if (!placed.ok) return placed
    destination = { ...placed.map, tokens: placed.map.tokens.filter(token => !remote || token.id !== found.actor.id) }
    const ids = changed.get(destination.id) ?? new Set<string>()
    placed.changedTokenIds.forEach(id => ids.add(id))
    changed.set(destination.id, ids)
    maps = maps.map(map => map.id === destination.id ? destination : map)
  }
  const primary: Dnd5eMapResultPlan = { ...input.application, map: maps.find(map => map.id === found.actorMap.id)!,
    changedTokenIds: [...new Set([...input.application.changedTokenIds.filter(id => !remote || id !== target.id), ...(changed.get(found.actorMap.id) ?? [])])],
    tokenPatches: input.application.tokenPatches ? Object.fromEntries(Object.entries(input.application.tokenPatches).filter(([id]) => !remote || id !== target.id)) : undefined }
  const applications: Dnd5eMapResultPlan[] = [primary]
  for (const map of maps) if (map.id !== primary.map.id && (map.id === destination.id || changed.has(map.id))) {
    applications.push({ map, characters: input.application.characters, changedCharacterIds: [],
      changedTokenIds: [...new Set([...(map.id === destination.id ? [target.id] : []), ...(changed.get(map.id) ?? [])])] })
  }
  return { ok: true as const, applications }
}

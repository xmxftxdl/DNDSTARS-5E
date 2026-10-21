import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import type { Dnd5eMapResultPlan } from './mapBridge'
import { resolveDnd5eRoomCompanionTarget } from './roomCompanionTarget'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction, type PreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'

type Request = Parameters<typeof prepareDnd5ePluginFeatureAction>[0]
export interface Dnd5eRoomCompanionRestPreparation {
  prepared: PreparedDnd5ePluginFeatureAction
  actorMap: BattleMap
  targetMap: BattleMap
  target: Token
  characters: readonly Character[]
  lookup: Parameters<typeof resolveDnd5eRoomCompanionTarget>[0]
}

export function dnd5eRoomCompanionRestPreparationIsCurrent(base: Dnd5eRoomCompanionRestPreparation,
  room: { maps: readonly BattleMap[]; characters: readonly Character[] }): boolean {
  const found = resolveDnd5eRoomCompanionTarget({ ...base.lookup, ...room })
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  return found.ok && same(found.actorMap, base.actorMap) && same(found.targetMap, base.targetMap) && same(room.characters, base.characters)
}

/** A narrowly scoped projection for a rest transfer, never a persisted scene.
 * Spatial effects and unrelated operations cannot enter this adapter. */
export function prepareDnd5eRoomCompanionRestAction(input: Request & {
  roomMaps: readonly BattleMap[]; targetMapId: string; activity: Dnd5eActivityDefinitionV1; packageId: string
}): { ok: true; value: Dnd5eRoomCompanionRestPreparation } | { ok: false; reason: string } {
  const activity = getRegisteredDnd5eActivity(input.packageId, input.activity.id)
  if (!activity) return { ok: false, reason: 'activity-missing' }
  const target = activity.target
  if (target.kind !== 'creature' || !target.roomCompanion || target.count !== 1 || target.rangeFeet != null ||
    target.requiresLineOfSight || target.requiresLineOfEffect || activity.activation.kind !== 'free' ||
    activity.invocation?.kind !== 'triggered' || activity.invocation.event !== 'long-rest-complete' ||
    !activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'transfer-hit-point-maximum')) ||
    activity.outcomes.some(outcome => outcome.operations.some(operation =>
      !['apply-effect', 'transfer-hit-point-maximum'].includes(operation.kind)))) return { ok: false, reason: 'unsupported-room-companion-action' }
  const lookup = { maps: input.roomMaps, characters: input.characters, actorMapId: input.map.id,
    actorTokenId: input.action.actorTokenId, targetMapId: input.targetMapId, targetTokenId: input.action.targetTokenId ?? '',
    packageId: input.packageId, sourceActivityId: target.roomCompanion.sourceActivityId, bondKey: target.roomCompanion.bondKey }
  const found = resolveDnd5eRoomCompanionTarget(lookup)
  if (!found.ok) return found
  // Token IDs are Headless identities; never silently alias a remote creature.
  const remote = found.actorMap.id !== found.targetMap.id
  if (remote && found.actorMap.tokens.some(token => token.id === found.target.id)) return { ok: false, reason: 'ambiguous-target-id' }
  const projectedTarget = { ...found.target, dnd5eSummon: { ...found.target.dnd5eSummon!, sourceTokenId: found.actor.id } }
  const projectedMap = { ...found.actorMap, tokens: remote ? [...found.actorMap.tokens, projectedTarget]
    : found.actorMap.tokens.map(token => token.id === projectedTarget.id ? projectedTarget : token) }
  // This is a rest-only calculation participant, not a new room initiative slot.
  const initiativeOrder = input.initiativeOrder.some(entry => entry.tokenId === projectedTarget.id)
    ? input.initiativeOrder : [...input.initiativeOrder, { tokenId: projectedTarget.id,
      label: projectedTarget.label, roll: 0, color: projectedTarget.color, emoji: projectedTarget.emoji }]
  const prepared = prepareDnd5ePluginFeatureAction({ ...input, map: projectedMap, initiativeOrder })
  if (!prepared.ok) return prepared
  if (prepared.prepared.headlessAction.pluginId !== input.packageId || prepared.prepared.headlessAction.actionId !== activity.id) {
    return { ok: false, reason: 'activity-mismatch' }
  }
  return { ok: true, value: { prepared: prepared.prepared, actorMap: structuredClone(found.actorMap),
    targetMap: structuredClone(found.targetMap), target: structuredClone(found.target), characters: structuredClone(input.characters), lookup } }
}

/** Produces both maps as a single pending write set. The caller must publish
 * it together with characters and the rest receipt using one room transaction. */
export async function resolveDnd5eRoomCompanionRestAction(input: Omit<Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0], 'prepared'> & {
  preparation: Dnd5eRoomCompanionRestPreparation
  currentRoom: { maps: readonly BattleMap[]; characters: readonly Character[] }
}): Promise<{ ok: false; reason: string } | { ok: true; applications: Dnd5eMapResultPlan[]; characters: Character[] }> {
  const base = input.preparation
  const found = resolveDnd5eRoomCompanionTarget({ ...base.lookup, ...input.currentRoom })
  if (!found.ok) return found
  // Includes scene plane, identities and effect state. Reject changes while
  // dice are pending rather than merge half of a maximum-HP transfer.
  if (!dnd5eRoomCompanionRestPreparationIsCurrent(base, input.currentRoom)) return { ok: false, reason: 'plugin-commit-conflict' }
  const resolved = await resolvePreparedDnd5ePluginFeatureAction({ ...input, prepared: base.prepared })
  if (!resolved.result.ok || !resolved.application) return { ok: false, reason: resolved.result.ok ? 'missing-application' : resolved.result.reason }
  const application = resolved.application
  const target = application.map.tokens.find(token => token.id === base.target.id)
  if (!target) return { ok: false, reason: 'missing-target-result' }
  // Restore its true scene position and summon identity, never the projection's.
  const settledTarget = { ...target, x: base.target.x, y: base.target.y, dnd5eSummon: base.target.dnd5eSummon }
  const remote = base.actorMap.id !== base.targetMap.id
  const primary: Dnd5eMapResultPlan = { ...application,
    map: { ...application.map, tokens: application.map.tokens.flatMap(token => token.id !== target.id ? [token] : remote ? [] : [settledTarget]) },
    changedTokenIds: application.changedTokenIds.filter(id => !remote || id !== target.id),
    tokenPatches: application.tokenPatches ? Object.fromEntries(Object.entries(application.tokenPatches).filter(([id]) => !remote || id !== target.id)) : undefined }
  if (!remote) return { ok: true, applications: [primary], characters: application.characters }
  const secondary: Dnd5eMapResultPlan = { map: { ...base.targetMap, tokens: base.targetMap.tokens.map(token => token.id === target.id ? settledTarget : token) },
    characters: application.characters, changedCharacterIds: [], changedTokenIds: [target.id],
    tokenPatches: application.tokenPatches?.[target.id] ? { [target.id]: { ...application.tokenPatches[target.id], dnd5eSummon: base.target.dnd5eSummon } } : undefined }
  return { ok: true, applications: [primary, secondary], characters: application.characters }
}

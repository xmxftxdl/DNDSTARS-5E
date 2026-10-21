import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eActivePlanarPhase, effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eMapPlaneRelation } from './mapPlane'
import { registerDnd5eHostReceipt } from './hostTransactionClone'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eRestSpellSensorActivity } from './activities/dnd5eRestSpellSensor'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from './activities/dnd5eActivityMapInteraction'
import type { Dnd5eActivityAuthorityHandoffs } from './headlessCombatEngine'
import type { PreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'

type Room = { maps: readonly BattleMap[]; characters: readonly Character[] }
export interface Dnd5eRemoteSensorLocation {
  mapId: string
  col: number
  row: number
  elevationFeet: number
}
interface Request { actorMapId: string; actorTokenId: string; actionId: string; packageId: string; activityId: string; grantEffectId?: string; location: Dnd5eRemoteSensorLocation }
export interface Dnd5eRemoteSensorPlacementReceipt { readonly request: Readonly<Request>; readonly snapshot: string; readonly maximumDistanceFeet?: number }
const receipts = new WeakSet<Dnd5eRemoteSensorPlacementReceipt>()
const snapshot = (room: Room) => JSON.stringify([room.maps, room.characters])

function locate(room: Room, request: Request): { ok: true; source: BattleMap; destination: BattleMap; actor: Token } | { ok: false; reason: string } {
  const sources = room.maps.filter(map => map.id === request.actorMapId)
  const destinations = room.maps.filter(map => map.id === request.location.mapId)
  if (sources.length !== 1 || destinations.length !== 1) return { ok: false, reason: 'sensor-map-missing-or-ambiguous' }
  const source = sources[0], destination = destinations[0]
  const actors = source.tokens.filter(token => token.id === request.actorTokenId)
  if (actors.length !== 1 || actors[0].type === 'obstacle') return { ok: false, reason: 'invalid-sensor-source' }
  const actor = actors[0]
  const character = actor.characterId ? room.characters.find(entry => entry.id === actor.characterId) : undefined
  if (actor.characterId && !character) return { ok: false, reason: 'invalid-sensor-source' }
  const effects = character?.dnd5eCombatState?.activeEffects ?? actor.dnd5eCombatState?.activeEffects
  if (effectiveDnd5eActiveEffects(effects).some(effect => effect.legacyCondition === 'banished')) return { ok: false, reason: 'plane-unknown' }
  // Location refers to the mapped scene, not an unmodelled ethereal overlay.
  if (dnd5eActivePlanarPhase(effects).plane === 'ethereal') return { ok: false, reason: 'sensor-plane-overlay-required' }
  const relation = dnd5eMapPlaneRelation(source, destination)
  if (relation !== 'same') return { ok: false, reason: relation === 'unknown' ? 'plane-unknown' : 'different-plane' }
  const { col, row, elevationFeet } = request.location
  const x = destination.gridOffsetX + (col + 0.5) * destination.gridSize
  const y = destination.gridOffsetY + (row + 0.5) * destination.gridSize
  if (!Number.isSafeInteger(col) || !Number.isSafeInteger(row) || !Number.isFinite(elevationFeet) || elevationFeet < -1000 || elevationFeet > 10000 ||
    !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= destination.width || y >= destination.height) return { ok: false, reason: 'invalid-sensor-location' }
  if (source.id !== destination.id && destination.tokens.some(token => token.id === actor.id)) return { ok: false, reason: 'ambiguous-sensor-source' }
  return { ok: true, source, destination, actor }
}

/** Host-only collection of the narrative memory fact. No JSON receipt is trusted. */
export async function authorizeDnd5eRemoteSensorPlacement(input: {
  room: Room; request: Request
  confirmMemory: (location: Readonly<Dnd5eRemoteSensorLocation>, mapName: string) => Promise<boolean>
  /** Separate scenes have no shared spatial coordinates. A bounded spell must
   * obtain this Host ruling rather than treating scene pixels as world distance. */
  crossMapRange?: { maximumFeet: number; confirmWithinRange: (maximumFeet: number, sourceMapName: string, destinationMapName: string) => Promise<boolean> }
}): Promise<{ ok: true; receipt: Dnd5eRemoteSensorPlacementReceipt } | { ok: false; reason: string }> {
  const request = structuredClone(input.request), found = locate(input.room, request)
  if (!found.ok) return found
  const before = snapshot(input.room)
  const maximumDistanceFeet = input.crossMapRange?.maximumFeet
  if (input.crossMapRange) {
    if (maximumDistanceFeet == null || !Number.isFinite(maximumDistanceFeet) || maximumDistanceFeet <= 0) return { ok: false, reason: 'invalid-sensor-range' }
    if (found.source.id === found.destination.id) return { ok: false, reason: 'sensor-local-range-check-required' }
    if (!await input.crossMapRange.confirmWithinRange(maximumDistanceFeet, found.source.name, found.destination.name)) {
      return { ok: false, reason: 'sensor-out-of-range' }
    }
    if (snapshot(input.room) !== before) return { ok: false, reason: 'sensor-placement-conflict' }
  }
  if (!await input.confirmMemory(Object.freeze({ ...request.location }), found.destination.name)) return { ok: false, reason: 'sensor-location-not-known' }
  if (snapshot(input.room) !== before) return { ok: false, reason: 'sensor-placement-conflict' }
  const receipt = registerDnd5eHostReceipt(Object.freeze({ request: Object.freeze({ ...request, location: Object.freeze(request.location) }), snapshot: before,
    ...(maximumDistanceFeet != null ? { maximumDistanceFeet } : {}) }))
  receipts.add(receipt)
  return { ok: true, receipt }
}

/** Produces a pending write set only. The caller must atomically commit all
 * maps and character/resource changes, or commit none of them. */
export function planDnd5eRemoteSensorPlacement(input: {
  room: Room; receipt: Dnd5eRemoteSensorPlacementReceipt; activity: Dnd5eActivityDefinitionV1
  sourceApplication: Dnd5eMapResultPlan; handoffs: Dnd5eActivityAuthorityHandoffs
  round: number; worldMinute: number; combatId?: string
  /** Host spell adapter supplies its already-resolved concentration identity. */
  concentrationId?: string
}): { ok: true; applications: Dnd5eMapResultPlan[] } | { ok: false; reason: string } {
  const receipt = input.receipt
  if (!Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0) return { ok: false, reason: 'sensor-clock-required' }
  if (!receipts.has(receipt) || snapshot(input.room) !== receipt.snapshot) return { ok: false, reason: 'sensor-placement-conflict' }
  const request = receipt.request
  if (request.activityId !== input.activity.id || (!input.activity.requiresEffectGrant && !dnd5eRestSpellSensorActivity(input.activity)) || input.sourceApplication.map.id !== request.actorMapId) return { ok: false, reason: 'invalid-sensor-activity' }
  const declarations = input.activity.outcomes.flatMap(outcome => outcome.operations)
  const declaration = declarations[0]
  if (declarations.length !== 1 || input.activity.target.kind !== 'self' || declaration?.kind !== 'create-persistent-area' ||
    !declaration.effectToken?.remotePlacement) return { ok: false, reason: 'invalid-sensor-activity' }
  const found = locate(input.room, request)
  if (!found.ok) return found
  const areas = input.handoffs.persistentAreas
  if (areas.length !== 1 || areas[0].operationId !== declaration.id || !areas[0].effectToken?.visionFromSource || !areas[0].concentration || areas[0].permanent ||
    Object.entries(input.handoffs).some(([key, value]) => key !== 'persistentAreas' && Array.isArray(value) && value.length > 0)) return { ok: false, reason: 'invalid-sensor-handoff' }
  const sourceActor = input.sourceApplication.map.tokens.find(token => token.id === request.actorTokenId)
  if (!sourceActor) return { ok: false, reason: 'invalid-sensor-source' }
  let linkedProjection: NonNullable<Token['dnd5eSpellEffect']>['linkedTargetProjection']
  if (declaration.effectToken.linkedTargetProjection) {
    // Use the pre-consumption receipt snapshot: the final charge may already
    // have removed the controller from sourceApplication.
    const owner = found.actor.characterId ? input.room.characters.find(character => character.id === found.actor.characterId) : undefined
    const grants = effectiveDnd5eActiveEffects(owner?.dnd5eCombatState?.activeEffects ?? found.actor.dnd5eCombatState?.activeEffects)
      .filter(effect => (request.grantEffectId === undefined || effect.id === request.grantEffectId) &&
        effect.source.pluginId === request.packageId && effect.grantedActivities?.includes(input.activity.id) &&
        (effect.grantedActivityCharges?.current ?? 1) >= (input.activity.effectGrantChargeCost ?? 1))
    if (grants.length !== 1 || grants[0].linkedTargetSnapshots?.length !== 1) return { ok: false, reason: 'sensor-linked-target-ambiguous' }
    const saved = grants[0].linkedTargetSnapshots[0]
    if (!saved.presentation) return { ok: false, reason: 'sensor-linked-presentation-missing' }
    linkedProjection = { name: saved.name, presentation: structuredClone(saved.presentation) }
  }
  const concentrationId = input.concentrationId ?? (input.activity.requiresEffectGrant ? `activity:${input.activity.id}` : input.activity.spellInvocation?.spellId ?? `activity:${input.activity.id}`)
  const sourceState = (sourceActor.characterId
    ? input.sourceApplication.characters.find(character => character.id === sourceActor.characterId)?.dnd5eCombatState
    : sourceActor.dnd5eCombatState)
  if (sourceState?.concentrationSpellId !== concentrationId) return { ok: false, reason: 'sensor-concentration-missing' }
  // Replacement is part of the same pending write set as the new charge and
  // sensor. Never clear an old location before the new placement succeeds.
  const removedByMap = new Map<string, string[]>()
  const preparedMaps = input.room.maps.map(original => {
    const map = original.id === found.source.id ? input.sourceApplication.map : original
    const removed = (map.dnd5ePluginAreas ?? []).filter(area => area.pluginId === request.packageId &&
      area.featureId === request.activityId && area.concentrationId === concentrationId &&
      (sourceActor.characterId ? area.sourceCharacterId === sourceActor.characterId : area.sourceTokenId === sourceActor.id))
    if (!removed.length) return map
    const removedIds = new Set(removed.map(area => area.id))
    const anchors = new Set(removed.flatMap(area => area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : []))
    const removedTokens = map.tokens.filter(token => anchors.has(token.id) && token.dnd5eSpellEffect?.concentrationId === concentrationId &&
      (sourceActor.characterId ? token.dnd5eSpellEffect.sourceCharacterId === sourceActor.characterId : token.dnd5eSpellEffect.sourceTokenId === sourceActor.id))
    const removedTokenIds = removedTokens.map(token => token.id)
    removedByMap.set(map.id, removedTokenIds)
    return { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(area => !removedIds.has(area.id)),
      tokens: map.tokens.filter(token => !removedTokenIds.includes(token.id)) }
  })
  const destination = preparedMaps.find(map => map.id === found.destination.id)!
  const { col, row, elevationFeet } = request.location
  const proxy = { ...sourceActor, x: destination.gridOffsetX + (col + 0.5) * destination.gridSize,
    y: destination.gridOffsetY + (row + 0.5) * destination.gridSize }
  const proxyMap = { ...destination, tokens: [...destination.tokens.filter(token => token.id !== proxy.id), proxy] }
  const mappedActivity: Dnd5eActivityDefinitionV1 = { ...input.activity,
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'circle', radiusFeet: 5, placeRangeFeet: 0 } }
  const selection = resolveDnd5eActivityAreaMapSelectionV1({ activity: mappedActivity, map: proxyMap, actorToken: proxy, anchorCell: { col, row }, targetElevationFeet: elevationFeet })
  if (!selection) return { ok: false, reason: 'invalid-sensor-location' }
  const placed = applyDnd5eActivityMapHandoffsV1({ map: proxyMap, activity: mappedActivity, packageId: request.packageId,
    actionId: request.actionId, actorId: proxy.id, round: input.round, worldMinute: input.worldMinute, combatId: input.combatId,
    concentrationId, characters: input.sourceApplication.characters, sourceLimitMaps: preparedMaps, selection: {}, areaSelection: selection,
    handoffs: { ...input.handoffs, persistentAreas: [{ ...areas[0], areaInstance: { ...selection.areaPlacement, origin: 'point', shape: 'circle' } }] } })
  if (!placed.ok) return placed
  const remote = found.source.id !== found.destination.id
  const createdIds = new Set(placed.changedTokenIds)
  const map = { ...placed.map, tokens: placed.map.tokens.flatMap(token => {
    if (token.id === proxy.id) return remote ? [] : [sourceActor]
    if (!linkedProjection || !createdIds.has(token.id) || token.dnd5eSpellEffect?.sourceTokenId !== sourceActor.id) return [token]
    return [{ ...token, dnd5eSpellEffect: { ...token.dnd5eSpellEffect, linkedTargetProjection: linkedProjection } }]
  }) }
  const changedTokenIds = [...new Set([...(remote ? [] : input.sourceApplication.changedTokenIds), ...(removedByMap.get(map.id) ?? []), ...placed.changedTokenIds.filter(id => id !== proxy.id)])]
  // Do not copy the source scene geometry or character patches into a remote
  // scene application. Those belong exclusively to the primary write.
  const destinationApplication: Dnd5eMapResultPlan = remote
    ? { map, characters: input.sourceApplication.characters, changedCharacterIds: [], changedTokenIds }
    : { ...input.sourceApplication, map, changedTokenIds }
  const sourceApplication = { ...input.sourceApplication, map: preparedMaps.find(map => map.id === found.source.id)!,
    changedTokenIds: [...new Set([...input.sourceApplication.changedTokenIds, ...(removedByMap.get(found.source.id) ?? [])])] }
  const previousLocations = preparedMaps.filter(entry => entry.id !== found.source.id && entry.id !== found.destination.id && removedByMap.has(entry.id))
    .map(entry => ({ map: entry, characters: input.sourceApplication.characters, changedCharacterIds: [], changedTokenIds: removedByMap.get(entry.id)! }))
  return { ok: true, applications: [...(remote ? [sourceApplication, destinationApplication] : [destinationApplication]), ...previousLocations] }
}

/** Only stationary, exclusive-sense sensor spells can use the bounded scene
 * adapter. Ordinary area spells must retain their normal geometry pipeline. */
export function dnd5eBoundedRemoteSpellSensor(prepared: PreparedDnd5ePluginSpellCast): boolean {
  const activity = prepared.activity
  if (activity?.target.kind !== 'area' || activity.target.origin !== 'point' ||
    activity.target.shape !== 'circle' || activity.target.radiusFeet !== 5 ||
    !activity.target.placementQualification || !Number.isFinite(activity.target.placeRangeFeet) ||
    !(Number(activity.target.placeRangeFeet) > 0)) return false
  return activity.outcomes.length > 0 && activity.outcomes.every(outcome => outcome.operations.length === 1 &&
    outcome.operations.every(operation => operation.kind === 'create-persistent-area' &&
      operation.concentration === true && operation.anchorMode === 'fixed' &&
      operation.effectToken?.hiddenBody === true && operation.effectToken.visionFromSource === true &&
      operation.effectToken.hearingFromSource === true &&
      ['sight', 'hearing'].includes(operation.effectToken.sensorSense ?? '')))
}

export function planDnd5eRemoteSpellSensorPlacement(input: {
  prepared: PreparedDnd5ePluginSpellCast
  room: Room; receipt: Dnd5eRemoteSensorPlacementReceipt; sourceApplication: Dnd5eMapResultPlan
  handoffs: Dnd5eActivityAuthorityHandoffs; round: number; worldMinute: number; combatId?: string
}): ReturnType<typeof planDnd5eRemoteSensorPlacement> {
  const { prepared, receipt } = input
  const activity = prepared.activity
  if (!dnd5eBoundedRemoteSpellSensor(prepared) || activity?.target.kind !== 'area' ||
    !receipts.has(receipt) || receipt.maximumDistanceFeet !== activity.target.placeRangeFeet ||
    receipt.request.actorMapId !== prepared.map.id || receipt.request.actorTokenId !== prepared.actorToken.id ||
    receipt.request.actionId !== prepared.action.id || receipt.request.packageId !== prepared.spell.ownerPluginId ||
    receipt.request.activityId !== activity.id) return { ok: false, reason: 'invalid-sensor-spell-receipt' }
  const areas = input.handoffs.persistentAreas
  if (areas.length !== 1) return { ok: false, reason: 'invalid-sensor-handoff' }
  const operation = activity.outcomes.flatMap(outcome => outcome.operations).find(entry => entry.id === areas[0].operationId)
  if (operation?.kind !== 'create-persistent-area' || !operation.effectToken) return { ok: false, reason: 'invalid-sensor-handoff' }
  const remotePlacement = { memoryPrompt: activity.target.placementQualification!.prompt }
  const adapted: Dnd5eActivityDefinitionV1 = { ...activity, requiresEffectGrant: true, target: { kind: 'self' },
    outcomes: [{ id: 'remote-sensor', when: { kind: 'always' }, operations: [{ ...operation,
      effectToken: { ...operation.effectToken, remotePlacement } }] }] }
  const planned = planDnd5eRemoteSensorPlacement({ ...input, activity: adapted, concentrationId: prepared.spell.id,
    handoffs: { ...input.handoffs, persistentAreas: [{ ...areas[0], effectToken: { ...areas[0].effectToken!, remotePlacement } }] } })
  if (!planned.ok) return planned
  // The ordinary spell pipeline may already have materialized a pending local
  // sensor. Its relocation is a structural change, not a patch to an entity
  // that still exists in the source scene.
  return { ok: true, applications: planned.applications.map(application => {
    const ids = new Set(application.map.tokens.map(token => token.id))
    return { ...application, changedTokenIds: application.changedTokenIds.filter(id => ids.has(id)),
      tokenPatches: application.tokenPatches ? Object.fromEntries(Object.entries(application.tokenPatches).filter(([id]) => ids.has(id))) : undefined }
  }) }
}

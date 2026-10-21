import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedCombatState } from '../../lib/sharedCombatTypes'
import { normalizeSharedMapGeometry, type SharedMapGeometryState } from '../../lib/mapGeometry'
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'
import { prepareDnd5eObjectFlightArrival } from '../../rulesets/dnd5e/mapObjectFlightArrivalSettlement'
import type { Dnd5eFormulaRollResult } from '../../rulesets/dnd5e/activities/dnd5eFormula'
import { settleDnd5eObjectFlightArrival } from './settleObjectFlightArrival'
import { publishDnd5eObjectFlightArrival } from './publishObjectFlightArrival'
import * as shared from '../../composition/browserSharedRoomResources'
import { getRoomSession } from '../../lib/roomSession'
import { appRoomAuthorityScheduler } from '../../lib/roomAuthorityScheduler'

type Revisioned<T> = T & { _sync?: { revision?: number } }
type Maps = { maps: BattleMap[]; selectedId?: string | null }
type Actors = { characters: Character[]; selectedId?: string | null }

export async function readObjectFlightArrivalContext(sourceMapId: string, destinationMapId: string,
  read = shared.loadSharedResource) {
  const [actors, maps, rawGeometry, combat] = await Promise.all([
    read<Revisioned<Actors>>('characters'), read<Revisioned<Maps>>('maps'),
    read<Revisioned<SharedMapGeometryState>>('map-geometry'), read<Revisioned<SharedCombatState>>('combat'),
  ])
  const revision = (name: string, value: { _sync?: { revision?: number } } | null) => {
    const n = value == null ? 0 : value._sync?.revision
    if (!Number.isSafeInteger(n) || n! < 0) throw Error(`flight-snapshot-revision-required:${name}`)
    return n!
  }
  const expectedRevisions = { characters: revision('characters', actors), maps: revision('maps', maps),
    'map-geometry': revision('map-geometry', rawGeometry), combat: revision('combat', combat) }
  if (!actors || !maps) throw Error('flight-snapshot-unavailable')
  const sourceMaps = maps.maps.filter(map => map.id === sourceMapId)
  const destinationMaps = maps.maps.filter(map => map.id === destinationMapId)
  if (sourceMaps.length !== 1 || destinationMaps.length !== 1) throw Error('flight-map-snapshot-missing')
  const sourceMap = sourceMaps[0], destinationMap = destinationMaps[0]
  const mapGeometry = rawGeometry ? normalizeSharedMapGeometry(rawGeometry) : { schemaVersion: 3 as const, maps: [], updatedAt: 0 }
  if (!mapGeometry) throw Error('flight-geometry-invalid')
  const geometry = mapGeometry.maps.find(map => map.mapId === destinationMapId)
  const sourceGeometry = mapGeometry.maps.find(map => map.mapId === sourceMapId) ?? null
  const snapshot = (map: BattleMap) => {
    const order = combat?.mapId === map.id ? combat.initiativeOrder ?? [] : []
    const listed = new Set(order.map(entry => entry.tokenId))
    const missing = map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type) && !listed.has(token.id))
      .map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 }))
    return createDnd5eMapCombatSnapshot({ map, characters: actors.characters,
    geometry: mapGeometry.maps.find(row => row.mapId === map.id) ?? null,
    combatId: combat?.combatId ?? `flight:${map.id}`, round: combat?.round ?? 1,
    initiativeOrder: [...order, ...missing],
  })
  }
  const destination = snapshot(destinationMap)
  if (sourceMapId !== destinationMapId) {
    const source = snapshot(sourceMap)
    if (Object.keys(source.state.combatants).some(id => destination.state.combatants[id])) throw Error('flight-ambiguous-participant')
    destination.state.combatants = { ...source.state.combatants, ...destination.state.combatants }
    Object.assign(destination.characterIdByCombatantId, source.characterIdByCombatantId)
  }
  destination.state.active = combat?.active === true && combat.mapId === destinationMapId
  return { ...destination, sourceMap, destinationMap, maps: maps.maps, characters: actors.characters,
    geometry, sourceGeometry, mapGeometry, expectedRevisions,
    characterSelectedId: actors.selectedId, mapSelectedId: maps.selectedId }
}

/** UI supplies the existing Host dice/interrupt adapters. No player-provided
 * damage, DC or actor snapshot is accepted by this command. */
export function runObjectFlightArrival(input: {
  sourceMapId: string; destinationMapId: string; receiptId: string
  point: { x: number; y: number; elevationFeet: number }
  collectRolls: (request: Extract<ReturnType<typeof prepareDnd5eObjectFlightArrival>, { ok: true }>,
    context: Awaited<ReturnType<typeof readObjectFlightArrivalContext>>) => Promise<Readonly<Record<string, Dnd5eFormulaRollResult>>>
  followups: Parameters<typeof settleDnd5eObjectFlightArrival>[1]
}) {
  const session = getRoomSession()
  if (session && session.role !== 'dm') throw Error('flight-host-required')
  const guard = () => {
    const current = getRoomSession()
    if (current?.roomId !== session?.roomId || (current && current.role !== 'dm')) throw Error('flight-room-changed')
  }
  return appRoomAuthorityScheduler.run(`object-flight:${input.receiptId}`, async () => {
    guard()
    const context = await readObjectFlightArrivalContext(input.sourceMapId, input.destinationMapId)
    guard()
    const prepared = prepareDnd5eObjectFlightArrival({ ...context, receiptId: input.receiptId, point: input.point })
    if (!prepared.ok) throw Error(prepared.reason)
    const rolls = await input.collectRolls(prepared, context)
    guard()
    const completion = await settleDnd5eObjectFlightArrival({ ...context, receiptId: input.receiptId,
      point: input.point, rolls, settlementId: crypto.randomUUID() }, input.followups)
    guard()
    if (!completion.ok) throw Error(completion.reason)
    const saved = await publishDnd5eObjectFlightArrival({ ...context, completion, geometry: context.mapGeometry,
      updatedAt: Date.now(), gateway: {
        saveResourcesAtomically: (writes, options) => { guard(); return shared.saveSharedResourcesAtomically(writes, options) },
        loadResource: name => { guard(); return shared.loadSharedResource<Maps>(name) },
      } })
    return { ...saved, completion }
  })
}

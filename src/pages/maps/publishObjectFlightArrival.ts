import type { BattleMap } from '../../store/maps'
import type { SharedMapGeometryState } from '../../lib/mapGeometry'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import type { planDnd5eObjectFlightArrivalTransaction } from '../../rulesets/dnd5e/mapObjectFlightArrivalSettlement'

type Completion = Extract<ReturnType<typeof planDnd5eObjectFlightArrivalTransaction>, { ok: true }>
const resources = ['characters', 'maps', 'map-geometry'] as const

/** Publish both scenes and impact durability together, against the pre-roll snapshots. */
export async function publishDnd5eObjectFlightArrival(input: {
  completion: Completion
  maps: readonly BattleMap[]
  geometry: SharedMapGeometryState
  characterSelectedId?: string | null
  mapSelectedId?: string | null
  updatedAt: number
  expectedRevisions: Readonly<Record<typeof resources[number] | 'combat', number>>
  gateway: Pick<SharedRoomGatewayPort, 'saveResourcesAtomically'> & {
    loadResource: (name: 'maps') => Promise<{ maps: BattleMap[] } | null>
  }
}): Promise<{ recovered: boolean }> {
  for (const name of [...resources, 'combat'] as const) {
    if (!Number.isSafeInteger(input.expectedRevisions[name]) || input.expectedRevisions[name] < 0) {
      throw new Error(`flight-snapshot-revision-required:${name}`)
    }
  }
  const { completion } = input
  const record = completion.completedReceipt
  if (record.status !== 'completed' || !record.settlementId || record.sourceMapId !== completion.sourceMap.id) {
    throw new Error('invalid-flight-completion')
  }
  const replacements = new Map([completion.sourceMap, completion.destinationMap].map(map => [map.id, map]))
  for (const id of replacements.keys()) {
    if (input.maps.filter(map => map.id === id).length !== 1) throw new Error('flight-map-snapshot-missing')
  }
  const geometry = structuredClone(input.geometry)
  if (completion.geometryEntityPatches.length) {
    const scenes = geometry.maps.filter(scene => scene.mapId === completion.destinationMap.id)
    if (scenes.length !== 1) throw new Error('flight-geometry-snapshot-missing')
    const scene = scenes[0]
    const entities = [...scene.walls, ...scene.doors, ...scene.windows ?? [], ...scene.obstacles]
    const patched = new Set<string>()
    for (const { entityId, patch } of completion.geometryEntityPatches) {
      const matches = entities.filter(entity => entity.id === entityId)
      if (matches.length !== 1 || patched.has(entityId)) throw new Error('flight-geometry-entity-mismatch')
      Object.assign(matches[0], structuredClone(patch))
      patched.add(entityId)
    }
    scene.updatedAt = input.updatedAt
  }
  geometry.updatedAt = input.updatedAt
  const data = {
    maps: { maps: input.maps.map(map => replacements.get(map.id) ?? map), selectedId: input.mapSelectedId ?? null, updatedAt: input.updatedAt },
    characters: { characters: completion.characters, selectedId: input.characterSelectedId ?? null, updatedAt: input.updatedAt },
    'map-geometry': geometry,
  }
  const transactionId = `object-flight:${record.id}:${record.settlementId}`
  try {
    await input.gateway.saveResourcesAtomically(resources.map(name => ({ name, data: data[name], expectedRevision: input.expectedRevisions[name] })), {
      transactionId, undoGroupId: transactionId, undoLabel: '结算物件飞行', readRevisions: { combat: input.expectedRevisions.combat },
    })
    return { recovered: false }
  } catch (error) {
    if (!/failed to fetch|fetch failed|networkerror|network request failed|load failed|(?:shared-)?state-transaction-(?:conflict|unavailable|502|503|504)/i.test(String(error))) throw error
    try {
      const saved = await input.gateway.loadResource('maps')
      const records = saved?.maps.filter(map => map.id === record.sourceMapId)
        .flatMap(map => map.dnd5eObjectFlightDepartures ?? []).filter(row => row.id === record.id)
      // Compare the full receipt, including the original flight and fixed dice,
      // before treating a lost response as success. Never retry with new revisions.
      if (records?.length === 1 && JSON.stringify(records[0]) === JSON.stringify(record)) return { recovered: true }
    } catch { /* Retain the transaction error if durable recovery is inconclusive. */ }
    throw error
  }
}

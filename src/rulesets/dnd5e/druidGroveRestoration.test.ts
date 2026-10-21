import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { prepareDnd5eDruidGroveGuardians } from './druidGroveGuardians'
import { reconcileDnd5eGroveGuardians, settleDnd5eGroveRooting } from './druidGroveRestoration'
import { removePersistentAreaByDm } from './persistentAreaRemoval'
import { expireDnd5ePluginAreasAtWorldMinute } from './pluginAreas'
import { reconcileDnd5eAreaCaptivesAcrossMaps } from './persistentAreaEnd'
import { initiativeCreatureTokenIds, pruneInitiativeForValidTokens } from '../../lib/initiativeRoster'
function fixture() {
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'oak', type: 'obstacle', label: 'Oak', x: 125, y: 125, size: 1, color: '', emoji: '', dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' } }] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.environment = 'outdoors'
  geometry.obstacles.push({ id: 'house', kind: 'obstacle', label: 'House', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }],
    baseHeightFeet: 0, heightFeet: 10, blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, cover: 'total', createdAt: 1 })
  map.tokens.push({ id: 'caster', characterId: 'owner', type: 'player', label: 'Caster', x: 25, y: 275, size: 1, color: '', emoji: '' })
  return { source: { castId: 'cast', pluginId: 'grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100, map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [{ col: 1, row: 0 }], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: ['oak'] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: ['house'], treeTokenIds: ['oak'] } }
}



function activeMap() {
  const input = fixture(), result = prepareDnd5eDruidGroveGuardians(input)
  if (!result.ok) throw Error(result.reason)
  const guardian = { ...result.plans[0].guardian, x: 225, y: 175, hp: 20 }
  return migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, tokens: [guardian], dnd5ePluginAreas: [result.boundary] }] }))).maps[0]
}

it.each(['dm-removal', 'world-expiry', 'reload'] as const)('ends animation at current location via actual %s path', mode => {
  const map = activeMap(), before = JSON.stringify(map)
  expect(reconcileDnd5eGroveGuardians(map)).toBe(map)
  const ended = mode === 'dm-removal' ? removePersistentAreaByDm({ map, characters: [], areaId: map.dnd5ePluginAreas![0].id })!.map
    : mode === 'world-expiry' ? expireDnd5ePluginAreasAtWorldMinute(map, 1540)
      : reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [{ ...map, dnd5ePluginAreas: [] }], characters: [], round: 1 }).maps[0]
  expect(ended.tokens[0]).toMatchObject({ id: 'oak', type: 'obstacle', label: 'Oak', x: 225, y: 175, hp: 20,
    dnd5eObjectState: { vegetation: 'living' }, dnd5eGroveRooting: 'pending' })
  expect(ended.tokens[0].dnd5eGroveGuardian).toBeUndefined()
  expect(ended.tokens[0].poolId).toBeUndefined()
  expect(ended.tokens[0].dnd5eCombatState).toBeUndefined()
  expect(reconcileDnd5eGroveGuardians(ended)).toBe(ended)
  expect(JSON.stringify(map)).toBe(before)
  const ally = { ...fixture().map.tokens[1], id: 'ally' }
  const order = ['oak', 'ally', 'oak'].map(tokenId => ({ tokenId, label: tokenId, emoji: '', color: '', roll: 10 }))
  expect(pruneInitiativeForValidTokens(order, 0, initiativeCreatureTokenIds([...map.tokens, ally])).removedTokenIds).toEqual([])
  const validIds = initiativeCreatureTokenIds([...ended.tokens, ally])
  const pruned = pruneInitiativeForValidTokens(order, 0, validIds)
  expect(pruned).toMatchObject({ order: [order[1]], index: 0, activeEntryRemoved: true, wrappedToStart: false, removedTokenIds: ['oak'] })
  expect(pruneInitiativeForValidTokens(order, 2, validIds).wrappedToStart).toBe(true)
  expect(pruneInitiativeForValidTokens([order[0]], 0, initiativeCreatureTokenIds(ended.tokens)).order).toEqual([])
  for (const canRoot of [false, true]) {
    expect(settleDnd5eGroveRooting({ ...ended, tokens: ended.tokens.map(t => ({ ...t, hp: 0 })) }, 'oak', canRoot)).toBeUndefined()
    const rooted = settleDnd5eGroveRooting(ended, 'oak', canRoot)!
    const reloaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [rooted] }))).maps[0]
    expect(reloaded.tokens[0].type).toBe('obstacle')
    expect(reloaded.tokens[0].dnd5eGroveRooting).toBe(canRoot ? 'rooted' : 'unrooted')
    expect(settleDnd5eGroveRooting(reloaded, 'oak', canRoot)).toBeUndefined()
  }
})

it('does not revive a dead guardian or restore an unrelated tree', () => {
  const map = activeMap()
  map.tokens[0].hp = 0
  const ended = expireDnd5ePluginAreasAtWorldMinute(map, 1540)
  expect(ended.tokens[0]).toMatchObject({ hp: 0, type: 'obstacle', dnd5eObjectState: { vegetation: 'dead' } })
  expect(ended.tokens[0].dnd5eGroveRooting).toBeUndefined()
  expect(settleDnd5eGroveRooting(ended, 'oak', true)).toBeUndefined()
  const plain = fixture().map
  expect(reconcileDnd5eGroveGuardians(plain)).toBe(plain)
})

it('does not treat historical death metadata as current death after HP was restored', () => {
  const map = activeMap()
  map.tokens[0].dnd5eCombatState = { ...map.tokens[0].dnd5eCombatState, deathRound: 1 }
  const ended = expireDnd5ePluginAreasAtWorldMinute(map, 1540)
  expect(ended.tokens[0]).toMatchObject({ hp: 20, dnd5eObjectState: { vegetation: 'living' }, dnd5eGroveRooting: 'pending' })
})

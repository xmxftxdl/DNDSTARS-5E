import { expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { dnd5eEntityDestructionTerrain, validDnd5eEntityDestructionTerrain } from './entityDestructionTerrain'
import { removePersistentAreaByDm, resolvePersistentAreaEntityAttackByDm } from './persistentAreaRemoval'

function fixture(): BattleMap {
  const area: Dnd5ePluginArea = {
    id: 'pillar', pluginId: 'test', featureId: 'raise-pillar', label: 'Pillar', color: '#888888',
    sourceCharacterId: 'source', sourceTokenId: 'source', cells: [{ col: 5, row: 5 }],
    anchorCell: { col: 5, row: 5 }, anchorMode: 'fixed', permanent: true,
    createdRound: 1, expiresAfterRound: 2, vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 30 },
    entityProfile: { armorClass: 5, hitPoints: 30, strength: 10, cannotAttack: true, invisible: false,
      destructionTerrain: { radiusFeet: 10, squareFeetPerMinute: 25 } },
  }
  return { id: 'map', name: 'test', width: 1000, height: 1000, gridSize: 50, gridOffsetX: 0,
    gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [], dnd5ePluginAreas: [area, { ...area, id: 'other-pillar' }] }
}

it('creates permanent clearable ground rubble only on lethal damage, leaving independent pillars intact', () => {
  const map = fixture(), before = structuredClone(map)
  const input = { map, characters: [], areaId: 'pillar', attackTotal: 5, damage: 29 }
  const missed = resolvePersistentAreaEntityAttackByDm({ ...input, attackTotal: 4, damage: 100 })!
  expect(missed.map).toBe(map)
  const hit = resolvePersistentAreaEntityAttackByDm(input)!
  expect(hit.map.dnd5ePluginAreas![0].entityCurrentHitPoints).toBe(1)
  expect(hit.map.dnd5ePluginAreas).toHaveLength(2)
  const destroyed = resolvePersistentAreaEntityAttackByDm({ ...input, map: hit.map, damage: 1 })!
  expect(destroyed.outcome).toBe('destroyed')
  const debris = destroyed.map.dnd5ePluginAreas!.find(a => a.id === 'pillar:debris')!
  expect(debris).toMatchObject({ permanent: true, vertical: { mode: 'ground' }, movementCostMultiplier: 2,
    terrainClearing: { squareFeetPerMinute: 25 } })
  expect(debris.cells).toHaveLength(13)
  expect(debris.cells).toContainEqual({ col: 7, row: 5 })
  expect(debris.cells).not.toContainEqual({ col: 7, row: 7 })
  expect(debris.entityProfile).toBeUndefined()
  expect(debris.concentrationId).toBeUndefined()
  expect(debris.grantedActivities).toBeUndefined()
  expect(destroyed.map.dnd5ePluginAreas!.find(a => a.id === 'other-pillar')).toBe(map.dnd5ePluginAreas![1])
  expect(resolvePersistentAreaEntityAttackByDm({ ...input, map: destroyed.map })).toBeUndefined()
  expect(map).toEqual(before)
})

it('explicit removal does not manufacture debris', () => {
  const result = removePersistentAreaByDm({ map: fixture(), characters: [], areaId: 'pillar' })!
  expect(result.map.dnd5ePluginAreas!.map(a => a.id)).toEqual(['other-pillar'])
})

it('retains the declaration and clearable rubble through JSON save/reload, rejecting invalid saved declarations', () => {
  const map = fixture()
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0]
  expect(restored.dnd5ePluginAreas![0].entityProfile?.destructionTerrain).toEqual({ radiusFeet: 10, squareFeetPerMinute: 25 })
  const destroyed = resolvePersistentAreaEntityAttackByDm({ map: restored, characters: [], areaId: 'pillar', attackTotal: 5, damage: 30 })!
  const reloaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [destroyed.map] }))).maps[0]
  expect(reloaded.dnd5ePluginAreas!.find(a => a.id === 'pillar:debris')).toMatchObject({
    permanent: true, movementCostMultiplier: 2, terrainClearing: { squareFeetPerMinute: 25 },
  })
  const invalid = JSON.parse(JSON.stringify({ maps: [map] }))
  invalid.maps[0].dnd5ePluginAreas[0].entityProfile.destructionTerrain.radiusFeet = -1
  expect(migrateMapsState(invalid).maps[0].dnd5ePluginAreas!.map(a => a.id)).toEqual(['other-pillar'])
})

it('does not inherit magic or executable rules in the physical debris', () => {
  const map = fixture(), area = map.dnd5ePluginAreas![0]
  Object.assign(area, { concentrationId: 'test', coreSpellId: 'test', expiresAtWorldMinute: 10,
    grantedActivities: [{ activityId: 'old' }], triggers: [{ id: 'old' }], movement: { economy: 'action' } })
  const debris = dnd5eEntityDestructionTerrain(area, map)!
  for (const key of ['concentrationId', 'coreSpellId', 'expiresAtWorldMinute', 'grantedActivities', 'triggers', 'movement']) {
    expect(debris).not.toHaveProperty(key)
  }
})

it('rejects malformed and unbounded declarations and invalid map scale', () => {
  for (const value of [null, {}, { radiusFeet: 0, squareFeetPerMinute: 25 },
    { radiusFeet: 10, squareFeetPerMinute: -1 }, { radiusFeet: 101, squareFeetPerMinute: 25 },
    { radiusFeet: 10, squareFeetPerMinute: 25, script: 'anything' }]) {
    expect(validDnd5eEntityDestructionTerrain(value)).toBe(false)
  }
  const map = fixture()
  expect(dnd5eEntityDestructionTerrain(map.dnd5ePluginAreas![0], { ...map, feetPerCell: 0 })).toBeUndefined()
})

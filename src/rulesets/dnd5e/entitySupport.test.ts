import { expect, it } from 'vitest'
import { persistentAreaBlocksRay } from '../../../shared/persistent-area-ray.mjs'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { dnd5eEntitySupportElevation } from './entitySupport'
import { createDnd5eMapCombatSnapshot, refreshDnd5eMapSpatialRelations } from './mapBridge'
import { resolvePersistentAreaEntityAttackByDm } from './persistentAreaRemoval'
import { createDnd5eConditionEffect } from './activeEffects'
import { mapGeometryMovementBlocked, mapGeometryPlacementBlocked, createEmptyMapGeometry } from '../../lib/mapGeometry'
import { createMapGeometryPathTree, findMapGeometryPath } from '../../lib/mapPathfinding'
import { previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange } from './headlessCombatEngine'

function fixture() {
  const token: Token = { id: 'goblin', type: 'enemy', label: 'Goblin', emoji: '', color: '',
    poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7, size: 1, x: 125, y: 125, elevationFeet: 30 }
  const area: Dnd5ePluginArea = { id: 'pillar', pluginId: 'test', featureId: 'pillar', label: 'Pillar', color: '#888888',
    sourceTokenId: 'source', sourceCharacterId: 'source', createdRound: 1, expiresAfterRound: 1, permanent: true,
    cells: [{ col: 2, row: 2 }], anchorCell: { col: 2, row: 2 }, vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 30 },
    entityProfile: { armorClass: 5, hitPoints: 30, cannotAttack: true, invisible: false, supportsStanding: true,
      destructionTerrain: { radiusFeet: 10, squareFeetPerMinute: 25 } } }
  const map: BattleMap = { id: 'support', name: 'Support', width: 1000, height: 1000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [token], dnd5ePluginAreas: [area] }
  return { map, token, area }
}

it('supports a whole footprint on authored solid earth and stone tops, not below or on narrow ledges', () => {
  const { map, token } = fixture()
  map.dnd5ePluginAreas = []
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'rock', kind: 'obstacle', label: 'Rock', surfaceMaterial: 'stone',
    points: [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 150 }, { x: 100, y: 150 }],
    baseHeightFeet: 0, heightFeet: 30, blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
    cover: 'total', createdAt: 1 })
  const support = (elevationFeet = 30, size = 1) => dnd5eEntitySupportElevation({ map, token: { ...token, size },
    geometry, terrainElevationFeet: 0, elevationFeet })
  expect(support()).toBe(30)
  expect(support(29)).toBe(0)
  expect(support(40)).toBe(30)
  expect(support(30, 2)).toBe(0)
  geometry.obstacles[0].surfaceMaterial = 'earth'
  expect(support()).toBe(30)
  geometry.obstacles[0].blocksMovement = false
  expect(support()).toBe(0)
})

it('projects a living pillar as support, then removes support after destruction or stepping off', () => {
  const { map, token } = fixture()
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0]
  const { state } = createDnd5eMapCombatSnapshot({ map: restored, characters: [], combatId: 'support',
    initiativeOrder: [{ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 10 }] })
  expect(state.combatants.goblin).toMatchObject({ groundElevationFeet: 30, airborne: false })
  const destroyed = resolvePersistentAreaEntityAttackByDm({ map: restored, characters: [], areaId: 'pillar', attackTotal: 5, damage: 30 })!
  refreshDnd5eMapSpatialRelations(state, destroyed.map, [])
  expect(state.combatants.goblin).toMatchObject({ groundElevationFeet: 0, airborne: true })
  refreshDnd5eMapSpatialRelations(state, restored, [])
  expect(state.combatants.goblin.airborne).toBe(false)
  state.combatants.goblin.position = { x: 400, y: 400 }
  refreshDnd5eMapSpatialRelations(state, restored, [])
  expect(state.combatants.goblin).toMatchObject({ groundElevationFeet: 0, airborne: true })
})

it('does not support creatures below the surface, larger footprints, or undeclared/dead entities', () => {
  const { map, token, area } = fixture()
  const support = (elevationFeet: number, size = 1) => dnd5eEntitySupportElevation({ map, token: { ...token, size }, elevationFeet, terrainElevationFeet: 0 })
  expect(support(0)).toBe(0)
  expect(support(29)).toBe(0)
  expect(support(30)).toBe(30)
  expect(support(50)).toBe(30)
  expect(support(30, 2)).toBe(0)
  area.entityCurrentHitPoints = 0
  expect(support(30)).toBe(0)
  area.entityCurrentHitPoints = 30
  delete area.entityProfile!.supportsStanding
  expect(support(30)).toBe(0)
})

it('settles a destroyed supporting pillar through the authoritative fall boundary exactly once', () => {
  const { map, token } = fixture()
  token.hp = token.maxHp = 30
  const { state: before } = createDnd5eMapCombatSnapshot({ map, characters: [], combatId: 'support-fall',
    initiativeOrder: [{ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 10 }] })
  const destroyed = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: 'pillar', attackTotal: 5, damage: 30 })!
  const after = structuredClone(before)
  refreshDnd5eMapSpatialRelations(after, destroyed.map, [])
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after)).toEqual([
    expect.objectContaining({ combatantId: token.id, fallDistanceFeet: 30, fallingDamageDice: 3 }),
  ])
  expect(resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, {}).ok).toBe(false)
  expect(before.combatants.goblin).toMatchObject({ currentHp: 30, elevationFeet: 30, airborne: false })
  const landed = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, { goblin: [2, 3, 4] })
  expect(landed.ok).toBe(true)
  expect(landed.state.combatants.goblin).toMatchObject({ currentHp: 21, elevationFeet: 0, airborne: false })
  expect(landed.state.combatants.goblin.conditions).toContain('prone')
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(after, landed.state)).toEqual([])
  const edited = structuredClone(before)
  edited.combatants.goblin.elevationFeet = 40
  edited.combatants.goblin.airborne = true
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, edited)).toEqual([])
  const flying = structuredClone(after)
  flying.combatants.goblin.movementSpeeds = { walk: 30, fly: 30 }
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, flying)).toEqual([])
  const steppedOff = structuredClone(before)
  steppedOff.combatants.goblin.position = { x: 400, y: 400 }
  refreshDnd5eMapSpatialRelations(steppedOff, map, [])
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, steppedOff)).toEqual([
    expect.objectContaining({ combatantId: token.id, fallingDamageDice: 3 }),
  ])
})

it('releases only the destroyed pillar restraint in the entity attack transaction', () => {
  const { map, token, area } = fixture()
  const bound = (id: string, areaId: string, mapId = map.id) => ({
    ...createDnd5eConditionEffect({ id, condition: 'restrained', targetId: token.id,
      source: { kind: 'plugin', actorId: area.sourceTokenId }, duration: { type: 'permanent' },
      tags: [`persistent-area:${areaId}`] }),
    areaLifetime: { mapId, areaId, sourceActorId: area.sourceTokenId },
  })
  token.dnd5eCombatState = { activeEffects: [bound('pinned', area.id), bound('other-pillar', 'other'),
    bound('other-map', area.id, 'other-map')] }
  const before = structuredClone(map)
  const damaged = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: area.id, attackTotal: 5, damage: 1 })!
  expect(damaged.map.tokens[0].dnd5eCombatState?.activeEffects).toHaveLength(3)
  const destroyed = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: area.id, attackTotal: 5, damage: 30 })!
  expect(destroyed.map.tokens[0].dnd5eCombatState?.activeEffects?.map(effect => effect.id)).toEqual(['other-pillar', 'other-map'])
  expect(destroyed.map.tokens[0].elevationFeet).toBe(30)
  expect(map).toEqual(before)
})

it('blocks movement through the pillar body but permits its top surface and the destroyed space', () => {
  const { map, token, area } = fixture()
  area.blocking = { movement: true }
  const at = { x: 125, y: 125 }
  expect(mapGeometryPlacementBlocked({ map, token, at, elevationFeet: 0 }).blocked).toBe(true)
  expect(mapGeometryPlacementBlocked({ map, token, at, elevationFeet: 29 }).blocked).toBe(true)
  expect(mapGeometryPlacementBlocked({ map, token, at, elevationFeet: 30 }).blocked).toBe(false)
  const crossing = { ...token, x: 75, y: 125, elevationFeet: 0 }
  expect(mapGeometryMovementBlocked({ map, token: crossing, to: { x: 175, y: 125 } }).blocked).toBe(true)
  const destroyed = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: area.id, attackTotal: 5, damage: 30 })!
  expect(mapGeometryMovementBlocked({ map: destroyed.map, token: crossing, to: { x: 175, y: 125 } }).blocked).toBe(false)
})

it('keeps direct paths and reachability previews on adjacent supported tops', () => {
  const { map, token, area } = fixture()
  area.blocking = { movement: true }
  map.dnd5ePluginAreas!.push({ ...area, id: 'next', cells: [{ col: 3, row: 2 }], anchorCell: { col: 3, row: 2 } })
  const to = { x: 175, y: 125 }
  const direct = findMapGeometryPath({ map, token, to })
  const preview = createMapGeometryPathTree({ map, token, maximumMovementCostFeet: 5 }).pathTo(to)
  expect(direct).toMatchObject({ movementCostFeet: 5, elevationsFeet: [30, 30] })
  expect(preview).toMatchObject({ movementCostFeet: 5, elevationsFeet: [30, 30] })
})

it('retains the cylinder radius on reload and rejects malformed geometry', () => {
  const { map, area } = fixture()
  area.circularGeometry = { radiusFeet: 2.5 }
  const reload = (circularGeometry: unknown) => migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...map,
    dnd5ePluginAreas: [{ ...area, circularGeometry }],
  }] }))).maps[0].dnd5ePluginAreas
  expect(reload({ radiusFeet: 2.5 })?.[0].circularGeometry).toEqual({ radiusFeet: 2.5 })
  for (const value of [{ radiusFeet: 0 }, { radiusFeet: -2.5 }, { radiusFeet: '2.5' }, { radiusFeet: 2.5, extra: true }]) {
    expect(reload(value) ?? []).toHaveLength(0)
  }
})

it.each([5,10])('does not extend a 5-foot pillar support across a %s-foot map cell', feetPerCell => {
  const {map,token,area}=fixture()
  map.feetPerCell=feetPerCell
  area.circularGeometry={radiusFeet:2.5}
  // Keep the creature physically five feet wide when the grid scale changes.
  token.size=5/feetPerCell
  const support=(x:number,size=token.size)=>dnd5eEntitySupportElevation({map,token:{...token,x,size},elevationFeet:30,terrainElevationFeet:0})
  expect(support(125)).toBe(30)
  expect(support(145)).toBe(0)
  expect(support(125,10/feetPerCell)).toBe(0)
})

it('does not turn a narrow cylinder into a full ten-foot blocking square',()=>{
  const {map,token,area}=fixture()
  map.feetPerCell=10
  token.size=0.5
  area.circularGeometry={radiusFeet:2.5}
  area.blocking={movement:true}
  expect(mapGeometryPlacementBlocked({map,token,at:{x:125,y:125},elevationFeet:0}).blocked).toBe(true)
  expect(mapGeometryPlacementBlocked({map,token,at:{x:149,y:149},elevationFeet:0}).blocked).toBe(false)
  expect(mapGeometryMovementBlocked({map,token:{...token,x:75,y:125,elevationFeet:0},to:{x:175,y:125}}).blocked).toBe(true)
})

it('uses the actual circle for movement rays instead of the containing grid square',()=>{
  const {map,area}=fixture()
  map.feetPerCell=10
  area.circularGeometry={radiusFeet:2.5}
  area.blocking={movement:true}
  const ray=(from:{x:number;y:number},to:{x:number;y:number},height=0)=>persistentAreaBlocksRay({map,purpose:'movement',from,to,fromElevationFeet:height,toElevationFeet:height,fromEyeHeightFeet:0,toEyeHeightFeet:0,overlapsHeight:(_area,z,h)=>z<30&&z+h>0})
  expect(ray({x:75,y:125},{x:175,y:125})).toBe(area.id)
  expect(ray({x:100,y:170},{x:170,y:100})).toBeUndefined()
  expect(ray({x:75,y:125},{x:175,y:125},30)).toBeUndefined()
})

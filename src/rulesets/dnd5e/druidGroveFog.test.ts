import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryCanSeeToken, mapGeometryCanSeePoint, mapGeometryVisibilityPolygon } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, expireDnd5ePluginAreasAtWorldMinute } from './pluginAreas'
import { prepareDnd5eDruidGroveFog } from './druidGroveFog'
import { removePersistentAreaByDm } from './persistentAreaRemoval'

function fixture() {
  const caster: Token = { id: 'caster', characterId: 'owner', label: 'Caster', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const target: Token = { ...caster, id: 'target', characterId: undefined, type: 'enemy', x: 125, y: 25 }
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, target] }
  const geometry = createEmptyMapGeometry(map.id, 1); geometry.environment = 'outdoors'
  return { map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [{ col: 1, row: 0 }], undergrowthCells: [], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [] as string[], treeTokenIds: [] },
    source: { castId: 'cast-1', pluginId: 'test.grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100 }
}

it('projects real persisted fog: triple movement inside ten feet, heavy sight blockage and exact world expiry', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveFog(input)
  expect(result.ok).toBe(true); if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }], selectedId: input.map.id }))).maps[0]
  expect(map.dnd5ePluginAreas).toHaveLength(1)
  const viewer = map.tokens[0], target = map.tokens[1]
  expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token: viewer, position: { x: 75, y: 25 } })).toBe(3)
  expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token: { ...viewer, elevationFeet: 10 }, position: { x: 75, y: 25 } })).toBe(1)
  expect(mapGeometryCanSeeToken({ map, geometry: input.geometry, viewer, target, forceEnabled: true })).toBe(false)
  expect(mapGeometryCanSeeToken({ map, geometry: input.geometry, viewer: { ...viewer, elevationFeet: 15 }, target: { ...target, elevationFeet: 15 }, forceEnabled: true })).toBe(true)
  expect(expireDnd5ePluginAreasAtWorldMinute(map, 1539).dnd5ePluginAreas).toHaveLength(1)
  expect(expireDnd5ePluginAreasAtWorldMinute(map, 1540).dnd5ePluginAreas).toHaveLength(0)
})

it('clips fog beneath a classified overhead structure without extending through it', () => {
  const input = fixture(); input.qualifications.structureObstacleIds = ['bridge']
  input.geometry.obstacles.push({ id: 'bridge', kind: 'obstacle', label: 'Bridge', points: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }], baseHeightFeet: 5, heightFeet: 5,
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, cover: 'total', createdAt: 1 })
  const result = prepareDnd5eDruidGroveFog(input)
  expect(result.ok).toBe(true)
  if (result.ok) {
    const map={...input.map,dnd5ePluginAreas:result.areas}
    const viewer=input.map.tokens[0]
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({map,token:viewer,position:{x:75,y:25}})).toBe(3)
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({map,token:{...viewer,elevationFeet:5},position:{x:75,y:25}})).toBe(1)
  }
})

it('preserves explicitly exempt friends through reload without making other viewers immune', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveFog({ ...input, exemptTokenIds: ['caster'] })
  expect(result.ok).toBe(true); if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
  const [friend, stranger] = map.tokens
  expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token: friend, position: { x: 75, y: 25 } })).toBe(1)
  expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token: stranger, position: { x: 75, y: 25 } })).toBe(3)
  expect(mapGeometryCanSeeToken({ map, geometry: input.geometry, viewer: friend, target: stranger, forceEnabled: true })).toBe(true)
  expect(mapGeometryCanSeeToken({ map, geometry: input.geometry, viewer: stranger, target: friend, forceEnabled: true })).toBe(false)
  expect(prepareDnd5eDruidGroveFog({ ...input, exemptTokenIds: ['missing'] })).toEqual({ ok: false, reason: 'invalid-exemptions' })
})

it('removes all fog cells of one cast after reload, preserving different effects, casts and owners', () => {
  const input = fixture()
  input.placement.fogCells.push({ col: 2, row: 1 })
  const result = prepareDnd5eDruidGroveFog(input)
  expect(result.ok).toBe(true); if (!result.ok) throw Error(result.reason)
  const base = result.areas[0]
  const unrelated = [
    { ...base, id: 'undergrowth', effectGroup: { castId: 'cast-1', effectId: 'undergrowth' } },
    { ...base, id: 'another-cast', effectGroup: { castId: 'cast-2', effectId: 'solid-fog' } },
    { ...base, id: 'another-owner', sourceCharacterId: 'other' },
    { ...base, id: 'another-plugin', pluginId: 'other.plugin' },
  ]
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: [...result.areas, ...unrelated] }] }))).maps[0]
  const removed = removePersistentAreaByDm({ map, characters: [], areaId: base.id })!
  expect(removed.map.dnd5ePluginAreas?.map(area => area.id)).toEqual(unrelated.map(area => area.id))
  expect(map.dnd5ePluginAreas).toHaveLength(6)
  expect(removed.concentrationEnded).toBe(false)
  expect(removePersistentAreaByDm({ map: removed.map, characters: [], areaId: base.id })).toBeUndefined()
})

it.each(['source', 'slot', 'clock'] as const)('rejects invalid creation facts: %s', mode => {
  const input = fixture()
  if (mode === 'source') input.source.characterId = 'other'
  if (mode === 'slot') input.source.slotLevel = 5
  if (mode === 'clock') input.worldMinute = -1
  expect(prepareDnd5eDruidGroveFog(input)).toEqual({ ok: false, reason: 'invalid-source' })
})

it('excludes the classified part of a partially covered fog cell from point visibility',()=>{
 const input=fixture()
 input.qualifications.structureObstacleIds=['building']
 input.geometry.obstacles.push({id:'building',kind:'obstacle',label:'Building',points:[{x:0,y:0},{x:70,y:0},{x:70,y:50},{x:0,y:50}],baseHeightFeet:0,heightFeet:20,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:1})
 const result=prepareDnd5eDruidGroveFog(input)
 if(!result.ok)throw Error(result.reason)
 const volume={minX:0,minY:0,widthPixels:300,baseElevationFeet:0,heightFeet:30,excludedStructures:[{points:input.geometry.obstacles[0].points,baseElevationFeet:0,heightFeet:20}]}
 const map=migrateMapsState(JSON.parse(JSON.stringify({maps:[{...input.map,dnd5ePluginAreas:result.areas.map(a=>({...a,groveVolume:volume}))}]}))).maps[0]
 const viewer=map.tokens[0]
 const point={x:60,y:25,elevationFeet:2.5}
 expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({map,token:viewer,position:{x:40,y:25}})).toBe(1)
 // Center inside the building, but the creature extends into outdoor fog.
 expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({map,token:viewer,position:{x:60,y:25}})).toBe(3)
 expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({map,token:viewer,position:{x:85,y:25}})).toBe(3)
 expect(mapGeometryCanSeePoint({map:{...map,dnd5ePluginAreas:[]},geometry:input.geometry,viewer,point})).toBe(true)
 expect(mapGeometryCanSeePoint({map,geometry:input.geometry,viewer,point})).toBe(true)
 const polygon=mapGeometryVisibilityPolygon({map,geometry:input.geometry,viewer,forceEnabled:true})
 expect(polygon.find(p=>Math.abs(p.y-25)<1e-6&&p.x>25)?.x).toBeCloseTo(70,5)
 expect(mapGeometryCanSeePoint({map,geometry:input.geometry,viewer,point:{x:85,y:25,elevationFeet:2.5}})).toBe(false)
})

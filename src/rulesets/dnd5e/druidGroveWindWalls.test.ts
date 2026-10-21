import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryMovementBlocked, mapGeometryOrdinaryProjectileBlocked } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eDruidGroveWindWalls, normalizeDnd5eGroveWindWall } from './druidGroveWindWalls'
import { collectDnd5ePersistentAreaTriggers, reconcileDnd5ePluginAreasOnMap } from './pluginAreas'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { normalizeDnd5ePersistentAreaVerticalSnapshot } from './persistentAreaTypes'
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'
function fixture() {
  const caster: Token = { id: 'caster', characterId: 'owner', label: 'Caster', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const target: Token = { ...caster, id: 'target', characterId: undefined, type: 'enemy', x: 125, y: 25 }
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, target] }
  const geometry = createEmptyMapGeometry(map.id, 1); geometry.environment = 'outdoors'
  return { map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [] as string[], treeTokenIds: [] },
    source: { castId: 'cast-1', pluginId: 'test.grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100 }
}

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})




const walls = [{ center: { col: 3, row: 1 }, aim: { col: 3, row: 2 }, lengthFeet: 20 },
  { center: { col: 4, row: 4 }, aim: { col: 4, row: 5 }, lengthFeet: 10 }]

it('checks the actual creature footprint against excluded structure volume', () => {
  const input=fixture()
  input.placement.undergrowthCells=[]
  input.qualifications.structureObstacleIds=['house']
  input.geometry.obstacles.push({id:'house',kind:'obstacle',label:'House',
    points:[{x:50,y:0},{x:180,y:0},{x:180,y:250},{x:50,y:250}],
    baseHeightFeet:0,heightFeet:20,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:1})
  const result=prepareDnd5eDruidGroveWindWalls({...input,walls:[{path:[{col:3,row:1}]},{path:[{col:4,row:4}]}]})
  if(!result.ok)throw Error(result.reason)
  const map={...input.map,dnd5ePluginAreas:result.areas}, wall=result.areas[0]
  const small={...map.tokens[1],x:150,y:75,elevationFeet:5,creatureSize:'小型' as const}
  expect(dnd5eTokenIntersectsPersistentAreaAt(small,map,wall,small)).toBe(false)
  const large={...small,size:2,creatureSize:'大型' as const}
  expect(dnd5eTokenIntersectsPersistentAreaAt(large,map,wall,large)).toBe(true)
  expect(mapGeometryMovementBlocked({map,token:{...small,y:25},to:{x:150,y:125},fromElevationFeet:5,toElevationFeet:5}).blocked).toBe(false)
  expect(mapGeometryMovementBlocked({map,token:{...small,x:205,y:25},to:{x:205,y:125},fromElevationFeet:5,toElevationFeet:5}).blocked).toBe(true)
})

it.each([[0,180],[5,180],[0,199.9],[5,199.9]])('subtracts a partial structure at base %i ending at %i from wind projectile blocking', (base,right) => {
  const input=fixture()
  input.qualifications.structureObstacleIds=['bridge']
  input.geometry.obstacles.push({id:'bridge',kind:'obstacle',label:'Classified structure',
    points:[{x:150,y:50},{x:right,y:50},{x:right,y:100},{x:150,y:100}],
    baseHeightFeet:base,heightFeet:5,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:1})
  const result=prepareDnd5eDruidGroveWindWalls({...input,walls:[{path:[{col:3,row:1}]},{path:[{col:1,row:4}]}]})
  if(!result.ok)throw Error(result.reason)
  const map=migrateMapsState(JSON.parse(JSON.stringify({maps:[{...input.map,dnd5ePluginAreas:result.areas}]}))).maps[0]
  const blocked=(x:number,z:number)=>mapGeometryOrdinaryProjectileBlocked({map,
    from:{...map.tokens[0],x,y:25,elevationFeet:z},to:{...map.tokens[1],x,y:125,elevationFeet:z},
    fromHeightFeet:0.1,toHeightFeet:0.1})
  expect(blocked(165,base+2)).toBe(false)
  expect(blocked((right+200)/2,base+2)).toBe(true)
  expect(blocked(165,12)).toBe(true)
  if(base===5)expect(blocked(165,2)).toBe(true)
  expect(mapGeometryOrdinaryProjectileBlocked({map,
    from:{...map.tokens[0],x:25,y:75,elevationFeet:base+2},
    to:{...map.tokens[1],x:275,y:75,elevationFeet:base+2},
    fromHeightFeet:0.1,toHeightFeet:0.1})).toBe(true)
})

function slopedGrove() {
  const input = fixture()
  input.geometry.obstacles.push({ id: 'hill', kind: 'obstacle', label: 'Hill',
    points: [{ x: 150, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 150 }, { x: 150, y: 150 }],
    baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20,
    blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, cover: 'none', createdAt: 1 })
  const result = prepareDnd5eDruidGroveWindWalls({ ...input,
    walls: [{ path: [{ col: 3, row: 1 }, { col: 3, row: 2 }] }, { path: [{ col: 1, row: 4 }] }] })
  if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
  return { ...input, map, wall: map.dnd5ePluginAreas![0] }
}

it('persists individual terrain heights and clips the raised wall at the grove ceiling', () => {
  const { map, wall } = slopedGrove()
  expect(map.dnd5ePluginAreas).toHaveLength(2)
  expect(wall.vertical).toEqual({ mode: 'volume', baseElevationFeet: 0, heightFeet: 30, columns: [
    { col: 3, row: 1, baseElevationFeet: 0, heightFeet: 15 },
    { col: 3, row: 2, baseElevationFeet: 20, heightFeet: 10 },
  ] })
  expect(validateAndMigrateSharedResource('maps', { maps: [map], selectedId: map.id, updatedAt: 1 }).status).not.toBe('invalid')
  expect(normalizeDnd5ePersistentAreaVerticalSnapshot({ ...wall.vertical, columns: [
    { col: 3, row: 1, baseElevationFeet: 0, heightFeet: 15 },
    { col: 3, row: 1, baseElevationFeet: 20, heightFeet: 10 },
  ] })).toBeUndefined()
})

it.each([[75, 5, true], [75, 20, false], [125, 5, false], [125, 20, true], [125, 30, false]] as const)(
  'uses the local wall height for creatures and projectiles at y=%i z=%i', (y, elevationFeet, expected) => {
    const { map, wall, geometry } = slopedGrove()
    const target = { ...map.tokens[1], x: 175, y, elevationFeet, creatureSize: '小型' as const }
    expect(dnd5eTokenIntersectsPersistentAreaAt(target, map, wall, target)).toBe(expected)
    const from = { ...target, x: 25 }, to = { ...target, x: 275 }
    expect(mapGeometryOrdinaryProjectileBlocked({ map, from, to })).toBe(expected)
    expect(mapGeometryMovementBlocked({ map, geometry, token: from, to,
      fromElevationFeet: elevationFeet, toElevationFeet: elevationFeet }).blocked).toBe(expected)
  })

it.each([1, 20])('settles one creation save (%i) for a large creature spanning different wall heights', d20 => {
  const { map } = slopedGrove()
  map.tokens[1] = { ...map.tokens[1], characterId: 'victim', type: 'player', size: 2, x: 150, y: 100, elevationFeet: 12 }
  const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'on-create', round: 1, targetTokenId: 'target' })
  expect(candidates).toHaveLength(1)
  const prepared = prepareDnd5ePersistentAreaTrigger({ map, combatId: map.id, round: 1,
    characters: [character({ id: 'owner' }), character({ id: 'victim', currentHp: 30, maxHp: 30 })],
    initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })), candidate: candidates[0] })
  if (!prepared.ok) throw Error(JSON.stringify(prepared))
  const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20, damageRolls: [3, 4, 5] })
  expect(resolved.result.ok).toBe(true)
  expect(resolved.application?.characters.find(c => c.id === 'victim')?.currentHp).toBe(d20 === 1 ? 18 : 24)
})

it('does not disperse fog in the vertical gap between low and raised walls', () => {
  const { map, wall } = slopedGrove()
  const fog = { ...wall, id: 'low-fog', sourceKind: 'core-spell' as const, coreSpellId: 'fog-cloud',
    windBarrier: false, cells: [{ col: 3, row: 2 }], anchorCell: { col: 3, row: 2 }, triggers: [],
    vertical: { mode: 'volume' as const, baseElevationFeet: 16, heightFeet: 2 } }
  map.dnd5ePluginAreas!.push(fog)
  const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character({ id: 'owner' })], 1)
  expect(reconciled.dnd5ePluginAreas?.some(area => area.id === fog.id)).toBe(true)
})
it.each([1, 20])('settles grove wind creation save %i without concentration', d20 => {
  const input = fixture()
  input.map.tokens[1] = { ...input.map.tokens[1], characterId: 'victim', type: 'player', x: 175, y: 75 }
  const result = prepareDnd5eDruidGroveWindWalls({ ...input, walls })
  if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
  expect(map.dnd5ePluginAreas).toHaveLength(2)
  expect(map.dnd5ePluginAreas![0].windBarrier).toBe(true)
  expect(map.dnd5ePluginAreas![0].concentrationId).toBeUndefined()
  const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'on-create', round: 1, targetTokenId: 'target' })
  expect(candidates).toHaveLength(1)
  const prepared = prepareDnd5ePersistentAreaTrigger({ map, combatId: map.id, round: 1,
    characters: [character({ id: 'owner' }), character({ id: 'victim', currentHp: 30, maxHp: 30 })],
    initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })), candidate: candidates[0] })
  if (!prepared.ok) throw Error(JSON.stringify(prepared))
  const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20, damageRolls: [3, 4, 5] })
  expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
  expect(resolved.application?.characters.find(c => c.id === 'victim')?.currentHp).toBe(d20 === 1 ? 18 : 24)
})

it('blocks ordinary projectiles and non-exempt small flyers, but not exempt flyers or ground walkers', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveWindWalls({ ...input, walls, exemptTokenIds: ['caster'] })
  if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
  const from = { ...map.tokens[0], x: 25, y: 75, elevationFeet: 5, creatureSize: '小型' as const }
  const to = { ...map.tokens[1], x: 275, y: 75, elevationFeet: 5 }
  expect(mapGeometryOrdinaryProjectileBlocked({ map, from, to })).toBe(true)
  expect(mapGeometryMovementBlocked({ map, token: from, to, fromElevationFeet: 5, toElevationFeet: 5 }).blocked).toBe(false)
  expect(mapGeometryMovementBlocked({ map, token: { ...from, id: 'target' }, to, fromElevationFeet: 5, toElevationFeet: 5 }).blocked).toBe(true)
  expect(mapGeometryMovementBlocked({ map, token: { ...from, id: 'target', elevationFeet: 0 }, to, fromElevationFeet: 0, toElevationFeet: 0 }).blocked).toBe(false)
})

it('rejects missing or oversized walls', () => {
  expect(prepareDnd5eDruidGroveWindWalls({ ...fixture(), walls: walls.slice(0, 1) }).ok).toBe(false)
  expect(prepareDnd5eDruidGroveWindWalls({ ...fixture(), walls: walls.map(w => ({ ...w, lengthFeet: 51 })) }).ok).toBe(false)
})

it('disperses overlapping ordinary fog without removing the grove solid fog', () => {
  const input = fixture(), result = prepareDnd5eDruidGroveWindWalls({ ...input, walls })
  if (!result.ok) throw Error(result.reason)
  const base = result.areas[0]
  const fog = { ...base, id: 'fog', windBarrier: false, sourceKind: 'core-spell' as const,
    coreSpellId: 'fog-cloud', triggers: [], blocking: undefined }
  const groveFog = { ...base, id: 'grove-fog', windBarrier: false, triggers: [], blocking: undefined,
    obscuration: { kind: 'heavy' as const }, utilityProjectionId: 'druid-grove-solid-fog' }
  const map = { ...input.map, dnd5ePluginAreas: [...result.areas, fog, groveFog] }
  const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character({ id: 'owner' })], 1)
  expect(reconciled.dnd5ePluginAreas?.map(a => a.id)).toEqual([...result.areas.map(a => a.id), 'grove-fog'])
})

it.each([1, 20])('settles bent grove wind creation save %i without concentration', d20 => {
  const walls = [{path:[{col:3,row:1},{col:3,row:2},{col:4,row:2}]},{path:[{col:1,row:4},{col:2,row:4}]}]
  const input = fixture()
  input.map.tokens[1] = { ...input.map.tokens[1], characterId: 'victim', type: 'player', x: 175, y: 75 }
  const result = prepareDnd5eDruidGroveWindWalls({ ...input, walls })
  if (!result.ok) throw Error(result.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
  expect(map.dnd5ePluginAreas).toHaveLength(2)
  expect(map.dnd5ePluginAreas![0].windBarrier).toBe(true)
  expect(map.dnd5ePluginAreas![0].concentrationId).toBeUndefined()
  const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'on-create', round: 1, targetTokenId: 'target' })
  expect(candidates).toHaveLength(1)
  const prepared = prepareDnd5ePersistentAreaTrigger({ map, combatId: map.id, round: 1,
    characters: [character({ id: 'owner' }), character({ id: 'victim', currentHp: 30, maxHp: 30 })],
    initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })), candidate: candidates[0] })
  if (!prepared.ok) throw Error(JSON.stringify(prepared))
  const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20, damageRolls: [3, 4, 5] })
  expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
  expect(resolved.application?.characters.find(c => c.id === 'victim')?.currentHp).toBe(d20 === 1 ? 18 : 24)
})

it('validates connected paths, diagonal length and the protected ground boundary', () => {
 const path=[{col:1,row:1},{col:2,row:1},{col:2,row:2}]
 expect(normalizeDnd5eGroveWindWall({path})).toEqual({path})
 expect(normalizeDnd5eGroveWindWall({path:[path[0],{col:4,row:4}]})).toBeUndefined()
 expect(normalizeDnd5eGroveWindWall({path:[path[0],path[1],path[0]]})).toBeUndefined()
 expect(normalizeDnd5eGroveWindWall({path:Array.from({length:10},(_,col)=>({col,row:0}))})).toBeDefined()
 expect(normalizeDnd5eGroveWindWall({path:Array.from({length:8},(_,col)=>({col,row:col}))})).toBeUndefined()
 expect(normalizeDnd5eGroveWindWall({path,center:path[0]})).toBeUndefined()
 const input=fixture()
 expect(prepareDnd5eDruidGroveWindWalls({...input,walls:[{path}, {path:[{col:6,row:1}]}]}).ok).toBe(false)
 const result=prepareDnd5eDruidGroveWindWalls({...input,walls:[{path},{path:[{col:1,row:4}]}]})
 if(!result.ok)throw Error(result.reason)
 expect(result.areas[0].cells).toEqual(path)
 expect(result.areas[0].windBarrier).toBe(true)
 expect(mapGeometryOrdinaryProjectileBlocked({map:{...input.map,dnd5ePluginAreas:result.areas},
   from:{...input.map.tokens[0],x:25,y:125,elevationFeet:5},to:{...input.map.tokens[0],x:225,y:125,elevationFeet:5}})).toBe(true)
})

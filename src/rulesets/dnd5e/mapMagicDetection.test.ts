import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { prepareDnd5eDruidGroveWindWalls } from './druidGroveWindWalls'
import { projectDnd5eMapMagicPresences } from './mapMagicDetection'

function fixture() {
  const token: Token = { id: 'detector', type: 'enemy', label: 'Detector', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 2000, height: 2000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [token] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.environment = 'outdoors'
  map.tokens.push({...token, id: 'absent-caster', characterId: 'absent-owner'})
  const result = prepareDnd5eDruidGroveWindWalls({map, geometry,
    placement: { origin: {col: 0, row: 0}, sideFeet: 30, fogCells: [], undergrowthCells: [], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [], treeTokenIds: [] },
    source: { castId: 'cast', pluginId: 'test.grove', spellId: 'druid-grove', characterId: 'absent-owner', tokenId: 'absent-caster', slotLevel: 6, saveDc: 17 },
    round: 1, worldMinute: 100,
    walls: [{path: [{col: 3, row: 1}]}, {path: [{col: 4, row: 4}]}] })
  if (!result.ok) throw Error(result.reason)
  map.dnd5ePluginAreas = result.areas
  map.tokens = [token]
  const project = (round = 1, worldMinute = 100) => projectDnd5eMapMagicPresences({map, geometry, tokens: [token], round, worldMinute}).detector
  return {map, token, geometry, project}
}

it('projects one ambient presence for the entire surviving Grove without its caster or fake aura target', () => {
  const {map, project} = fixture()
  expect(project()).toHaveLength(1)
  expect(project()[0]).toMatchObject({distanceFeet: 0, auraVisible: false, categories: ['magic', 'magic-area']})
  map.dnd5ePluginAreas!.splice(0, 1)
  expect(project()).toHaveLength(1)
  map.dnd5ePluginAreas = []
  expect(project()).toEqual([])
})

it('measures horizontal and vertical distance to the protected volume, not selected wall cells', () => {
  const {token, project} = fixture()
  token.x = 600
  expect(project()[0].distanceFeet).toBeCloseTo(30)
  token.x = 601
  expect(project()[0].distanceFeet).toBeCloseTo(30.1)
  token.x = 25
  token.elevationFeet = 40
  expect(project()[0].distanceFeet).toBeCloseTo(12.5)
})

it('subtracts excluded building volume and does not invent presence in a completely excluded Grove', () => {
  const {map, project} = fixture()
  for (const area of map.dnd5ePluginAreas!) area.groveVolume!.excludedStructures = [{
    points: [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 100}, {x: 0, y: 100}], baseElevationFeet: 0, heightFeet: 30,
  }]
  expect(project()[0].distanceFeet).toBeCloseTo(7.5)
  for (const area of map.dnd5ePluginAreas!) area.groveVolume!.excludedStructures[0].points = [
    {x: 0, y: 0}, {x: 300, y: 0}, {x: 300, y: 300}, {x: 0, y: 300},
  ]
  expect(project()).toEqual([])
})

it('removes expired presences while retaining permanent annual Groves', () => {
  const {map, project} = fixture()
  for (const area of map.dnd5ePluginAreas!) { area.expiresAfterRound = 10; area.expiresAtWorldMinute = 110 }
  expect(project(10, 109)).toHaveLength(1)
  expect(project(11, 109)).toEqual([])
  expect(project(10, 110)).toEqual([])
  for (const area of map.dnd5ePluginAreas!) area.permanent = true
  expect(project(100, 200)).toHaveLength(1)
})

it.each([[2.5, 11.25], [5, 12.5], [10, 15], [15, 17.5], [20, 20]])('uses authoritative detector height %s for vertical distance', (height, distance) => {
  const {map, token} = fixture()
  token.elevationFeet = 40
  const presences = projectDnd5eMapMagicPresences({map, tokens: [token], round: 1, worldMinute: 100,
    detectorHeightFeetById: {[token.id]: height}})
  expect(presences.detector[0].distanceFeet).toBeCloseTo(distance)
})

it.each([
  ['stone', 0.99, false], ['stone', 1, true],
  ['metal', 0.08, false], ['metal', 1 / 12, true],
  ['wood-earth', 2.99, false], ['wood-earth', 3, true], ['other', 10, false],
] as const)('detects through %s thickness %s unless the threshold blocks it (%s)', (material, thicknessFeet, blocked) => {
  const {token, geometry, project} = fixture()
  token.x = 400
  geometry.walls.push({id: 'barrier', kind: 'wall', label: 'Barrier', points: [{x: 350, y: -1000}, {x: 350, y: 1000}],
    baseHeightFeet: -100, heightFeet: 200, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1,
    magicDetectionBarrier: {material, thicknessFeet, leadLined: false}})
  expect(project()).toHaveLength(blocked ? 0 : 1)
  geometry.walls[0].blocksVision = false
  geometry.walls[0].magicDetectionBarrier!.leadLined = true
  expect(project()).toEqual([])
  token.elevationFeet = 201
  expect(project()).toHaveLength(1)
})

it('stops applying a lead layer when its door opens or is destroyed', () => {
  const {token, geometry, project} = fixture()
  token.x = 400
  geometry.doors.push({id: 'door', kind: 'door', label: 'Door', points: [{x: 350, y: -1000}, {x: 350, y: 1000}],
    baseHeightFeet: -100, heightFeet: 200, blocksVision: false, blocksMovement: true, blocksLineOfEffect: true,
    state: 'closed', openState: 'closed', secret: false, createdAt: 1,
    magicDetectionBarrier: {material: 'other', thicknessFeet: 0, leadLined: true}})
  expect(project()).toEqual([])
  geometry.doors[0].openState = 'open'
  expect(project()).toHaveLength(1)
  geometry.doors[0].openState = 'closed'
  geometry.doors[0].physicalState = 'destroyed'
  expect(project()).toHaveLength(1)
})

it('does not reuse a stale compiled result after the physical layer changes', () => {
  const {token, geometry, project} = fixture()
  token.x = 400
  geometry.walls.push({id: 'wall', kind: 'wall', label: 'Wall', points: [{x: 350, y: -1000}, {x: 350, y: 1000}],
    baseHeightFeet: -100, heightFeet: 200, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1,
    magicDetectionBarrier: {material: 'stone', thicknessFeet: 1, leadLined: false}})
  expect(project()).toEqual([])
  geometry.walls[0].magicDetectionBarrier!.thicknessFeet = 0.5
  expect(project()).toHaveLength(1)
  geometry.walls[0].magicDetectionBarrier!.thicknessFeet = 1
  expect(project()).toEqual([])
})

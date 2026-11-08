import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryPlacementBlocked } from './mapGeometry'
import { createMapGeometryPathTree, findMapGeometryPath } from './mapPathfinding'
import { mapObjectCreatureTraversalEndsInsideObject } from './mapObjectCreatureTraversal'
import type { BattleMap, Token } from '../store/maps'

function fixture() {
  const token: Token = { id: 'mover', label: 'Mover', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const map: BattleMap = { id: 'traverse', name: 'Traverse', width: 250, height: 50, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [token] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  const to = { x: 225, y: 25 }
  return { map, geometry, token, to }
}
function both(input: Parameters<typeof findMapGeometryPath>[0]) {
  return [findMapGeometryPath(input), createMapGeometryPathTree(input).pathTo(input.to)]
}

it.each(['wood', 'metal', 'stone'] as const)('crosses an actual %s wall with difficult cost and preserves opaque original', material => {
  const input = fixture()
  input.geometry.walls.push({ id: 'object', kind: 'wall', label: 'Object',
    points: [{x:125,y:0},{x:125,y:50}],
    material, baseHeightFeet: 0, heightFeet: 10,
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, createdAt: 1 })
  const before = structuredClone(input)
  expect(both(input)).toEqual([undefined, undefined])
  for (const path of both({ ...input, passThroughObjectsAndCreatures: true })) {
    expect(path).toMatchObject({ distanceFeet: 20, movementCostFeet: 30, doorsToOpen: [] })
  }
  expect(mapObjectCreatureTraversalEndsInsideObject({ ...input, at: {x:125,y:25}, elevationFeet:0 })).toBe(true)
  expect(mapObjectCreatureTraversalEndsInsideObject({ ...input, at: input.to, elevationFeet:0 })).toBe(false)
  expect(mapGeometryPlacementBlocked({ ...input, at:{x:125,y:25}, elevationFeet:0 }).blocked).toBe(true)
  expect(input).toEqual(before)
})

it('crosses creatures at difficult cost but never ends in their space, and a creature is not an object penalty', () => {
  const input = fixture()
  input.map.tokens.push({ ...input.token, id:'other', x:125 })
  for (const path of both({ ...input, passThroughObjectsAndCreatures:true })) {
    expect(path).toMatchObject({ distanceFeet:20, movementCostFeet:30 })
  }
  expect(both({ ...input, to:{x:125,y:25}, passThroughObjectsAndCreatures:true })).toEqual([undefined,undefined])
  expect(mapObjectCreatureTraversalEndsInsideObject({ ...input, at:{x:125,y:25}, elevationFeet:0 })).toBe(false)
})

it('crosses a locked physical door without opening or unlocking it', () => {
  const input=fixture()
  input.geometry.doors.push({ id:'door',kind:'door',label:'Door',points:[{x:100,y:0},{x:100,y:50}],
    state:'locked',openState:'closed',lockState:'locked',secret:false,
    baseHeightFeet:0,heightFeet:10,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1 })
  const before=structuredClone(input)
  expect(both(input)).toEqual([undefined,undefined])
  for(const path of both({...input,passThroughObjectsAndCreatures:true})) {
    expect(path).toMatchObject({distanceFeet:20,movementCostFeet:25,doorsToOpen:[]})
  }
  expect(input).toEqual(before)
})

it('retains actual magical force wall collision while allowing physical ice panels', () => {
  const input=fixture()
  input.map.dnd5ePluginAreas=[{id:'wall',pluginId:'test.wall',featureId:'wall',label:'Wall',color:'#aaa',
    sourceCharacterId:'caster',sourceTokenId:'caster-token',cells:[{col:2,row:0}],createdRound:1,expiresAfterRound:100,
    stoneWall:{mode:'ice',saveDc:15,panels:[{id:'panel',start:{col:2,row:-1},end:{col:2,row:2},cells:[],hitPoints:30,maxHitPoints:30}]},
    vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10}}]
  const ice=structuredClone(input)
  for(const path of both({...input,passThroughObjectsAndCreatures:true}))expect(path).toBeDefined()
  expect(input).toEqual(ice)
  input.map.dnd5ePluginAreas[0].stoneWall=undefined
  input.map.dnd5ePluginAreas[0].forceWall={mode:'thick',start:{col:2,row:-1},angles:[90,90,90]}
  expect(both({...input,passThroughObjectsAndCreatures:true})).toEqual([undefined,undefined])
})

it('charges real underground vertical traversal and preserves native height constraints', () => {
  const input=fixture()
  input.geometry.obstacles.push({id:'ground',kind:'obstacle',label:'Ground',points:[{x:0,y:0},{x:250,y:0},{x:250,y:50},{x:0,y:50}],
    surfaceMaterial:'earth',terrainRegion:true,terrainElevationFeet:0,baseHeightFeet:0,heightFeet:0,cover:'none',
    blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
  for(const path of both({...input,to:{x:25,y:25},targetElevationFeet:-5,passThroughObjectsAndCreatures:true})) {
    expect(path).toMatchObject({distanceFeet:5,movementCostFeet:10,elevationsFeet:[0,-5]})
  }
  expect(both({...input,to:{x:25,y:25},targetElevationFeet:20,passThroughObjectsAndCreatures:true})).toEqual([undefined,undefined])
  expect(mapObjectCreatureTraversalEndsInsideObject({...input,at:{x:25,y:25},elevationFeet:-5})).toBe(true)
})

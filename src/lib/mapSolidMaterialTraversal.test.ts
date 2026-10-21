import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryFootprintTerrainSamples, mapGeometryPlacementBlocked } from './mapGeometry'
import { planSolidMaterialExit } from './mapSolidMaterialTraversal'
import { tokenOccupiedCellsAt } from './gridCombat'
import type { BattleMap, Token } from '../store/maps'
import { findMapGeometryPath, createMapGeometryPathTree } from './mapPathfinding'
import { migrateMapsState } from '../store/maps'

function fixture() {
  const token: Token = { id: 'mover', label: 'Mover', type: 'player', x: 125, y: 125, size: 1, color: '', emoji: '' }
  const map: BattleMap = { id: 'exit', name: 'Exit', width: 250, height: 250, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [token] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'rock', kind: 'obstacle', label: 'Rock',
    points: [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 150 }, { x: 100, y: 150 }],
    surfaceMaterial: 'stone', blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 10, cover: 'total', createdAt: 1 })
  return { map, geometry, token, at: { x: 125, y: 125 }, elevationFeet: 0, materials: ['stone', 'earth'] as const }
}

it.each(['thick', 'thin', 'ice', 'force'] as const)('classifies %s wall collision while preserving its state and HP', mode => {
  const input = fixture()
  input.geometry.obstacles = []
  input.map.dnd5ePluginAreas = [{ id: 'wall', pluginId: 'test.wall', featureId: 'wall', label: 'Wall', color: '#aaa',
    sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
    cells: Array.from({ length: 5 }, (_, row) => ({ col: 2, row })), createdRound: 1, expiresAfterRound: 100,
    stoneWall: { mode: mode === 'force' ? 'thick' : mode, saveDc: 15, panels: [{ id: 'panel', start: { col: 2, row: -1 }, end: { col: 2, row: 5 },
      cells: [], hitPoints: 30, maxHitPoints: 30 }] },
    vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
  }]
  if (mode === 'force') {
    input.map.dnd5ePluginAreas[0].stoneWall = undefined
    input.map.dnd5ePluginAreas[0].forceWall = { mode: 'thick', start: { col: 2, row: -1 }, angles: [90, 90, 90] }
  }
  const permitted = mode === 'thick' || mode === 'thin'
  const before = structuredClone(input)
  const travel = { map: input.map, geometry: input.geometry, token: { ...input.token, x: 25 },
    to: { x: 225, y: 125 }, passThroughSolidMaterials: ['stone'] as const }
  expect(!!findMapGeometryPath(travel)).toBe(permitted)
  expect(!!createMapGeometryPathTree(travel).pathTo(travel.to)).toBe(permitted)
  expect(findMapGeometryPath({ ...travel, passThroughSolidMaterials: [] })).toBeUndefined()
  expect(planSolidMaterialExit(input)).toMatchObject(!permitted
    ? { ok: false, reason: 'blocked-by-other-material' }
    : { ok: true, displaced: true })
  expect(input).toEqual(before)
})

it('plans the nearest unoccupied ground space without changing source map or token', () => {
  const input = fixture(), original = structuredClone(input)
  expect(planSolidMaterialExit(input)).toMatchObject({ ok: true, displaced: true, position: { x: 75, y: 75 } })
  expect(input).toEqual(original)
  input.map.tokens.push({ ...input.token, id: 'other', x: 75, y: 75 })
  expect(planSolidMaterialExit(input)).toMatchObject({ ok: true, displaced: true, position: { x: 125, y: 75 } })
})

it.each(['stone', 'earth', 'wood', 'metal', 'ice', 'other', undefined] as const)(
  'uses explicit pillar material %s and preserves it on reload', material => {
    const input = fixture()
    input.geometry.obstacles = []
    input.map.dnd5ePluginAreas = [{ id: 'pillar', pluginId: 'test.pillar', featureId: 'pillar', label: 'Pillar', color: '#aaa',
      sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      cells: [{ col: 2, row: 2 }], anchorCell: { col: 2, row: 2 }, createdRound: 1, expiresAfterRound: 100,
      circularGeometry: { radiusFeet: 3 }, blocking: { movement: true },
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
      entityProfile: { material, armorClass: 15, hitPoints: 30, cannotAttack: true, invisible: false },
    }]
    const loaded = migrateMapsState({ maps: [JSON.parse(JSON.stringify(input.map))] }).maps[0]
    expect(loaded.dnd5ePluginAreas?.[0]?.entityProfile?.material).toBe(material)
    const permitted = material === 'stone' || material === 'earth'
    expect(!!findMapGeometryPath({ map: loaded, geometry: input.geometry,
      token: { ...input.token, x: 25 }, to: input.at, passThroughSolidMaterials: input.materials })).toBe(permitted)
    expect(planSolidMaterialExit({ ...input, map: loaded })).toMatchObject(permitted
      ? { ok: true, displaced: true } : { ok: false, reason: 'blocked-by-other-material' })
  },
)

it('does not eject from unpermitted material or when the destination is already clear', () => {
  const input = fixture()
  input.geometry.obstacles[0].surfaceMaterial = 'solid'
  expect(planSolidMaterialExit(input)).toEqual({ ok: false, reason: 'blocked-by-other-material' })
  expect(planSolidMaterialExit({ ...input, at: { x: 25, y: 25 } })).toMatchObject({ ok: true, displaced: false })
})

it('checks the full large footprint and finds vertical exits when ground space is full', () => {
  const input = fixture()
  input.token.size = 2
  const result = planSolidMaterialExit(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Expected destination')
  expect(tokenOccupiedCellsAt(input.token, input.map, result.position).every(c => c.col >= 0 && c.row >= 0 && c.col < 5 && c.row < 5)).toBe(true)
  expect(mapGeometryPlacementBlocked({ ...input, at: result.position }).blocked).toBe(false)
  input.geometry.obstacles[0].points = [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 250 }, { x: 0, y: 250 }]
  expect(planSolidMaterialExit(input)).toMatchObject({ ok: true, displaced: true, elevationFeet: 10 })
  input.token.size = 6
  expect(planSolidMaterialExit(input)).toEqual({ ok: false, reason: 'no-free-ejection-space' })
})


it.each(['earth', 'stone', 'ice', undefined] as const)('handles an underground endpoint only with authored material %s', material => {
  const input = fixture()
  input.geometry.obstacles = [{ ...input.geometry.obstacles[0],
    points: [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 250 }, { x: 0, y: 250 }],
    surfaceMaterial: material, terrainElevationFeet: 0, terrainRegion: true,
    blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, heightFeet: 0 }]
  const before = structuredClone(input)
  const result = planSolidMaterialExit({ ...input, elevationFeet: -5 })
  if (material === 'earth' || material === 'stone') {
    expect(result).toMatchObject({ ok: true, displaced: true, elevationFeet: 0 })
  } else expect(result).toEqual({ ok: false, reason: 'blocked-by-other-material' })
  expect(input).toEqual(before)
})


it('rejects a thin forbidden underground patch away from the token centre', () => {
  const input = fixture()
  const base = { ...input.geometry.obstacles[0], terrainRegion: true, terrainElevationFeet: 0,
    blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, heightFeet: 0 }
  input.geometry.obstacles = [
    { ...base, points: [{x:0,y:0},{x:250,y:0},{x:250,y:250},{x:0,y:250}], surfaceMaterial: 'earth' },
    { ...base, id: 'ice-strip', points: [{x:101,y:101},{x:102,y:101},{x:102,y:149},{x:101,y:149}], surfaceMaterial: 'ice' },
  ]
  expect(planSolidMaterialExit({ ...input, elevationFeet: -5 })).toEqual({ok:false,reason:'blocked-by-other-material'})
  // Last authored paint wins even for a strip smaller than a grid cell.
  input.geometry.obstacles.push({ ...input.geometry.obstacles[1], id: 'earth-overwrite', surfaceMaterial: 'earth' })
  expect(planSolidMaterialExit({ ...input, elevationFeet: -5 })).toMatchObject({ok:true,displaced:true,elevationFeet:0})
})

it('ejects a partially buried footprint entirely above uneven terrain', () => {
  const input = fixture()
  input.geometry.obstacles = [{ ...input.geometry.obstacles[0],
    points: [{x:100,y:100},{x:110,y:100},{x:110,y:150},{x:100,y:150}],
    surfaceMaterial:'earth',terrainRegion:true,terrainElevationFeet:10,
    blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,heightFeet:0 }]
  const result = planSolidMaterialExit(input)
  expect(result).toMatchObject({ok:true,displaced:true})
  if (!result.ok) throw new Error(result.reason)
  const surfaces = mapGeometryFootprintTerrainSamples({geometry:input.geometry,at:result.position,halfSizePixels:25})
  expect(surfaces.every(surface => surface.elevationFeet <= result.elevationFeet)).toBe(true)
})


it('keeps preview and actual movement level through earth but follows ice terrain', () => {
  for (const material of ['earth', 'ice'] as const) {
    const input = fixture()
    input.token.x = 25
    input.geometry.obstacles = [{ ...input.geometry.obstacles[0],
      points: [{x:100,y:0},{x:150,y:0},{x:150,y:250},{x:100,y:250}],
      surfaceMaterial:material,terrainRegion:true,terrainElevationFeet:10,
      blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,heightFeet:0 }]
    const options = {map:input.map,geometry:input.geometry,token:input.token,
      to:{x:225,y:125},targetElevationFeet:0,passThroughSolidMaterials:input.materials}
    const actual = findMapGeometryPath(options)
    const preview = createMapGeometryPathTree(options).pathTo(options.to)
    for (const path of [actual, preview]) {
      expect(path).toBeDefined()
      const middle = path!.points.findIndex(point => point.x === 125)
      expect(middle).toBeGreaterThanOrEqual(0)
      expect(path!.elevationsFeet[middle]).toBe(material === 'earth' ? 0 : 10)
    }
    const ordinary = findMapGeometryPath({...options,passThroughSolidMaterials:[]})!
    expect(ordinary.elevationsFeet[ordinary.points.findIndex(point=>point.x===125)]).toBe(10)
  }
})


it.each(['earth','ice',undefined] as const)('validates underground destinations against %s terrain', material => {
  const input=fixture()
  input.token.x=25
  input.geometry.obstacles=[{...input.geometry.obstacles[0],
    points:[{x:0,y:0},{x:250,y:0},{x:250,y:250},{x:0,y:250}],surfaceMaterial:material,
    terrainRegion:true,terrainElevationFeet:0,heightFeet:0,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false}]
  const options={map:input.map,geometry:input.geometry,token:input.token,to:{x:125,y:125},
    targetElevationFeet:-5,passThroughSolidMaterials:input.materials}
  for(const result of [findMapGeometryPath(options),createMapGeometryPathTree(options).pathTo(options.to)]) {
    if(material==='earth')expect(result?.elevationsFeet.at(-1)).toBe(-5)
    else expect(result).toBeUndefined()
  }
})


it.each([5, 15, 30])('charges for vertical earth traversal of %s feet and retains both path heights', depth => {
  const input=fixture()
  input.geometry.obstacles=[{...input.geometry.obstacles[0],
    points:[{x:0,y:0},{x:250,y:0},{x:250,y:250},{x:0,y:250}],surfaceMaterial:'earth',
    terrainRegion:true,terrainElevationFeet:0,heightFeet:0,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false}]
  const options={map:input.map,geometry:input.geometry,token:input.token,to:input.at,
    targetElevationFeet:-depth,passThroughSolidMaterials:input.materials}
  for(const result of [findMapGeometryPath(options),createMapGeometryPathTree(options).pathTo(options.to)]) {
    expect(result).toMatchObject({distanceFeet:depth,movementCostFeet:depth,elevationsFeet:[0,-depth],points:[input.at,input.at]})
  }
  expect(createMapGeometryPathTree({...options,maximumMovementCostFeet:depth-1}).pathTo(options.to)).toBeUndefined()
  const adjacent = {...options,to:{x:input.at.x+50,y:input.at.y}}
  for(const result of [findMapGeometryPath(adjacent),createMapGeometryPathTree(adjacent).pathTo(adjacent.to)]) {
    expect(result).toMatchObject({distanceFeet:depth,movementCostFeet:depth})
  }
})

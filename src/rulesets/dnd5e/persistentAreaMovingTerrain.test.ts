import { afterEach, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { reconcileDnd5ePersistentAreaAnchors } from './coreSpellAreas'
import { dnd5ePersistentAreaMovementCostMultiplierAt, dnd5ePersistentAreaDifficultTerrainMultiplierAt } from './persistentAreaGeometry'

afterEach(() => setMapGeometryRuntime([]))

it.each([false, true])('moves custom difficult terrain with its caster while excluding only the caster (movement-only=%s)', movementOnly => {
  const caster: Token = { id: 'caster', label: 'Caster', type: 'player', characterId: 'caster', x: 75, y: 75, size: 1, color: '#fff', emoji: '' }
  const ally: Token = { ...caster, id: 'ally', characterId: 'ally', x: 125 }
  const enemy: Token = { ...ally, id: 'enemy', type: 'enemy', characterId: undefined }
  const map: BattleMap = {
    id: 'moving-custom-terrain', name: 'Terrain', width: 500, height: 500,
    gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [caster, ally, enemy],
    dnd5ePluginAreas: [{
      id: 'custom-terrain', pluginId: 'test.terrain', featureId: 'test.terrain:aura', label: 'Terrain', color: '#fff',
      sourceTokenId: caster.id, sourceCharacterId: 'caster', createdRound: 1, expiresAfterRound: 11,
      anchorMode: 'source-token', anchorTokenId: caster.id, anchorCell: { col: 1, row: 1 },
      cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
      relation: 'any', includeSelf: movementOnly, movementCostMultiplier: 2, movementExcludesSource: movementOnly,
    }],
  }
  const cost = (state: BattleMap, token: Token, position = token) =>
    dnd5ePersistentAreaMovementCostMultiplierAt({ map: state, token, position })
  expect(cost(map, caster)).toBe(1)
  expect(cost(map, ally)).toBe(2)
  expect(cost(map, enemy)).toBe(2)
  const movedCaster = { ...caster, x: 225 }
  const moved = reconcileDnd5ePersistentAreaAnchors({ ...map, tokens: [movedCaster, ally, enemy] })
  expect(moved.dnd5ePluginAreas?.[0].cells).toEqual([{ col: 4, row: 1 }, { col: 5, row: 1 }])
  expect(cost(moved, ally)).toBe(1)
  expect(cost(moved, enemy, { ...enemy, x: 275 })).toBe(2)
  expect(cost(moved, movedCaster)).toBe(1)
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [moved] }))).maps[0]
  expect(cost(restored, enemy, { ...enemy, x: 275 })).toBe(2)
  expect(cost(restored, movedCaster)).toBe(1)
  if (movementOnly) {
    // Exemption belongs to this area source, never to the player faction.
    const otherCasterArea = { ...restored.dnd5ePluginAreas![0], id: 'other-source', sourceTokenId: ally.id }
    expect(cost({ ...restored, dnd5ePluginAreas: [...restored.dnd5ePluginAreas!, otherCasterArea] }, movedCaster)).toBe(2)
    expect(cost({ ...restored, dnd5ePluginAreas: [] }, enemy, { ...enemy, x: 275 })).toBe(1)
  }
})

it('rechecks grounded source and enemy relation after flight, landing, movement and reload', () => {
  const caster: Token = { id: 'caster', label: 'Caster', type: 'player', characterId: 'caster', x: 75, y: 75, size: 1, color: '#fff', emoji: '' }
  const ally = { ...caster, id: 'ally', characterId: 'ally', x: 125 }
  const enemy: Token = { ...ally, id: 'enemy', type: 'enemy', characterId: undefined }
  const map: BattleMap = {
    id: 'ground-contact-terrain', name: 'Terrain', width: 500, height: 500,
    gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [caster, ally, enemy],
    dnd5ePluginAreas: [{
      id: 'terrain', pluginId: 'test.terrain', featureId: 'test.terrain:aura', label: 'Terrain', color: '#fff',
      sourceTokenId: caster.id, sourceCharacterId: 'caster', createdRound: 1, expiresAfterRound: 11,
      anchorMode: 'source-token', anchorTokenId: caster.id, anchorCell: { col: 1, row: 1 },
      cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
      relation: 'enemy', includeSelf: false, movementCostMultiplier: 2, movementRequiresGroundedSource: true,
    }],
  }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.obstacles.push({
    id: 'plateau', kind: 'obstacle', label: 'Plateau',
    points: [{x:0,y:0},{x:500,y:0},{x:500,y:500},{x:0,y:500}],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
    baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20, createdAt: 1,
  })
  setMapGeometryRuntime([geometry])
  for (const cost of [dnd5ePersistentAreaMovementCostMultiplierAt, dnd5ePersistentAreaDifficultTerrainMultiplierAt]) {
    expect(cost({map, token:enemy, position:enemy})).toBe(2)
    expect(cost({map, token:ally, position:ally})).toBe(1)
    expect(cost({map, token:caster, position:caster})).toBe(1)
    const flying = {...map, tokens: [{...caster,elevationFeet:25},ally,enemy]}
    expect(cost({map:flying, token:enemy, position:enemy})).toBe(1)
    const landed = {...map, tokens: [{...caster,elevationFeet:20},ally,enemy]}
    expect(cost({map:landed, token:enemy, position:enemy})).toBe(2)
    expect(cost({map:{...map,tokens:[ally,enemy]}, token:enemy, position:enemy})).toBe(1)
    const moved = reconcileDnd5ePersistentAreaAnchors({...landed,tokens:[{...caster,x:225,elevationFeet:20},ally,enemy]})
    expect(cost({map:moved,token:enemy,position:enemy})).toBe(1)
    const restored = migrateMapsState(JSON.parse(JSON.stringify({maps:[moved]}))).maps[0]
    expect(restored.dnd5ePluginAreas?.[0].movementRequiresGroundedSource).toBe(true)
    expect(cost({map:restored,token:enemy,position:{...enemy,x:275}})).toBe(2)
  }
})

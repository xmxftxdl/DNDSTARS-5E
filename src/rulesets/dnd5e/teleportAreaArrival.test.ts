import { expect, it } from 'vitest'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'

function fixture() {
  const token = { id: 'actor', type: 'player' as const, label: 'Actor', size: 1,
    x: 25, y: 25, elevationFeet: 0, color: '', emoji: '' }
  const area = (id: string, col: number): Dnd5ePluginArea => ({
    id, pluginId: 'test', featureId: 'test:area', label: id, color: '#fff',
    sourceCharacterId: 'source', sourceTokenId: 'source', cells: [{ col, row: 0 }],
    createdRound: 1, expiresAfterRound: 10, relation: 'any',
    triggers: [{ id: 'enter', label: 'Enter', timing: 'on-enter' }],
  })
  const map: BattleMap = { id: 'teleport-area', name: '', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [token], dnd5ePluginAreas: [area('crossed', 1), area('destination', 2)] }
  return { map, movement: { token, to: { x: 125, y: 25 }, transportMode: 'teleport' as const,
    path: [{ x: 25, y: 25 }, { x: 125, y: 25 }], pathElevationsFeet: [0, 0] } }
}

it('teleport arrival enters the destination without crossing the intervening area', () => {
  const f = fixture()
  const result = collectDnd5ePersistentAreaTriggers({ ...f, round: 1, turnKey: '1:actor', timing: 'on-enter' })
  expect(result.map(candidate => candidate.area.id)).toEqual(['destination'])
})

it('normal movement still crosses and triggers the intervening area', () => {
  const f = fixture()
  const result = collectDnd5ePersistentAreaTriggers({ ...f, movement: { ...f.movement, transportMode: undefined },
    round: 1, turnKey: '1:actor', timing: 'on-enter' })
  expect(result.map(candidate => candidate.area.id)).toEqual(['crossed', 'destination'])
})

it('does not charge travel-distance triggers for teleportation', () => {
  const f = fixture()
  f.map.dnd5ePluginAreas![0].cells = [0, 1, 2].map(col => ({ col, row: 0 }))
  f.map.dnd5ePluginAreas![0].triggers = [{ id: 'distance', label: 'Distance', timing: 'on-move-distance', movementIntervalFeet: 5 }]
  const input = { ...f, round: 1, turnKey: '1:actor', timing: 'on-move-distance' as const }
  expect(collectDnd5ePersistentAreaTriggers(input)).toEqual([])
  expect(collectDnd5ePersistentAreaTriggers({ ...input,
    movement: { ...f.movement, transportMode: undefined } }).length).toBeGreaterThan(0)
})

it('does not re-enter a contiguous area when both teleport endpoints are inside', () => {
  const f = fixture()
  f.map.dnd5ePluginAreas = [{ ...f.map.dnd5ePluginAreas![0],
    cells: [0, 1, 2].map(col => ({ col, row: 0 })) }]
  expect(collectDnd5ePersistentAreaTriggers({ ...f, round: 1, turnKey: '1:actor', timing: 'on-enter' })).toEqual([])
})

it('uses the destination height rather than triggering a ground area beneath an airborne arrival', () => {
  const f = fixture()
  f.map.dnd5ePluginAreas = [{
    ...f.map.dnd5ePluginAreas![1],
    vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 5 },
  }]
  expect(collectDnd5ePersistentAreaTriggers({ ...f,
    movement: { ...f.movement, pathElevationsFeet: [0, 20] },
    round: 1, turnKey: '1:actor', timing: 'on-enter',
  })).toEqual([])
})

it('detects a vertical teleport into an elevated area without changing grid cells', () => {
  const f = fixture()
  f.map.dnd5ePluginAreas = [{
    ...f.map.dnd5ePluginAreas![0], cells: [{ col: 0, row: 0 }],
    vertical: { mode: 'volume', baseElevationFeet: 20, heightFeet: 10 },
  }]
  const result = collectDnd5ePersistentAreaTriggers({ ...f,
    movement: { ...f.movement, to: { x: 25, y: 25 },
      path: [{ x: 25, y: 25 }, { x: 25, y: 25 }], pathElevationsFeet: [0, 20] },
    round: 1, turnKey: '1:actor', timing: 'on-enter',
  })
  expect(result.map(candidate => candidate.area.id)).toEqual(['crossed'])
})



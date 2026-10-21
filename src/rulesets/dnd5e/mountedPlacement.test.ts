import { expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { planDnd5eDismountPlacement, type Dnd5eDismountDirection } from './mountedPlacement'
import { tokenOccupiedCellsAt, cellKey } from '../../lib/gridCombat'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'

const map: BattleMap = { id: 'mount-placement', name: 'Mount', width: 100, height: 100, gridSize: 10,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [
    { id: 'rider', type: 'player', x: 25, y: 35, size: 1, color: '', emoji: '', label: 'Rider' },
    { id: 'mount', type: 'enemy', x: 40, y: 40, size: 2, creatureSize: '大型', color: '', emoji: '', label: 'Mount' },
  ] }
it('places the whole rider footprint outside the mount in all eight directions', () => {
  const before = JSON.stringify(map)
  const occupied = new Set(tokenOccupiedCellsAt(map.tokens[1], map, map.tokens[1]).map(cellKey))
  for (const direction of ['north','northeast','east','southeast','south','southwest','west','northwest'] as Dnd5eDismountDirection[]) {
    const to = planDnd5eDismountPlacement(map, 'rider', 'mount', direction)
    expect(to, direction).toBeDefined()
    expect(tokenOccupiedCellsAt(map.tokens[0], map, to!).some(cell => occupied.has(cellKey(cell)))).toBe(false)
  }
  expect(JSON.stringify(map)).toBe(before)
})
it('rejects occupied, outside-map, overlapping and forged destinations', () => {
  const to = planDnd5eDismountPlacement(map, 'rider', 'mount', 'east')!
  const blocked = { ...map, tokens: [...map.tokens, { ...map.tokens[0], id: 'other', ...to }] }
  expect(planDnd5eDismountPlacement(blocked, 'rider', 'mount', 'east')).toBeUndefined()
  expect(planDnd5eDismountPlacement({ ...map, tokens: map.tokens.map(t => t.id === 'mount' ? { ...t, y: 10 } : t) }, 'rider', 'mount', 'north')).toBeUndefined()
  expect(planDnd5eDismountPlacement({ ...map, tokens: map.tokens.map(t => t.id === 'rider' ? { ...t, x: 35, y: 35 } : t) }, 'rider', 'mount')).toBeUndefined()
  expect(planDnd5eDismountPlacement(map, 'rider', 'mount', 'teleport' as Dnd5eDismountDirection)).toBeUndefined()
  for (const direction of ['constructor', 'toString', '__proto__']) {
    expect(planDnd5eDismountPlacement(map, 'rider', 'mount', direction as Dnd5eDismountDirection)).toBeUndefined()
  }
})
it('checks the landing body against low barriers when dismounting from above them', () => {
  const airborneMap = { ...map, tokens: map.tokens.map(token => ({ ...token, elevationFeet: 20 })) }
  const landing = planDnd5eDismountPlacement(airborneMap, 'rider', 'mount', 'east')!
  expect(landing).toBeDefined()
  setMapGeometryRuntime([{ mapId: map.id, walls: [{ id: 'low-wall', kind: 'wall', label: 'Low wall',
    points: [{ x: landing.x, y: 0 }, { x: landing.x, y: 100 }], edgeIds: ['low-edge'], baseHeightFeet: 0,
    heightFeet: 5, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }],
    doors: [], obstacles: [], vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: false, ambientLight: 'bright' }, updatedAt: 1 }])
  try {
    expect(planDnd5eDismountPlacement(airborneMap, 'rider', 'mount', 'east')).toBeUndefined()
    expect(planDnd5eDismountPlacement(airborneMap, 'rider', 'mount', 'west')).toBeDefined()
  } finally { setMapGeometryRuntime([]) }
})
it('does not dismount through a blocking wall', () => {
  setMapGeometryRuntime([{ mapId: map.id, walls: [{ id: 'wall', kind: 'wall', label: 'Wall',
    points: [{ x: 50, y: 0 }, { x: 50, y: 100 }], edgeIds: ['edge'], baseHeightFeet: 0,
    heightFeet: 20, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }],
    doors: [], obstacles: [], vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: false, ambientLight: 'bright' }, updatedAt: 1 }])
  try { expect(planDnd5eDismountPlacement(map, 'rider', 'mount', 'east')).toBeUndefined() }
  finally { setMapGeometryRuntime([]) }
})

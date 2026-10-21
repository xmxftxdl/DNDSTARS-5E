import { afterEach, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eAttackTeleportCellsForTarget, prepareDnd5eAttackTeleportDestination as destination } from './attackTeleportDestination'

afterEach(() => setMapGeometryRuntime([]))
function fixture() {
  const actor: Token = { id: 'actor', type: 'player', label: '', emoji: '', color: '', size: 1, x: 25, y: 25 }
  const map: BattleMap = { id: 'attack-teleport', name: '', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [actor] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.vision.ambientLight = 'bright'
  setMapGeometryRuntime([geometry])
  return { map, actorTokenId: actor.id, characters: [], targetCell: { col: 2, row: 0 }, rangeFeet: 10 }
}

it('validates the whole destination without moving the actor or spending anything', () => {
  const input = fixture(), before = JSON.stringify(input)
  expect(destination(input)).toEqual({ ok: true, to: { x: 125, y: 25 }, elevationFeet: 0, distanceFeet: 10 })
  expect(destination({ ...input, targetCell: { col: 3, row: 0 } })).toMatchObject({ ok: false, reason: 'target-out-of-range' })
  expect(destination({ ...input, targetElevationFeet: 15 })).toMatchObject({ ok: false, reason: 'target-out-of-range' })
  expect(JSON.stringify(input)).toBe(before)
})

it('rejects occupied footprints but allows a distinct vertical space', () => {
  const input = fixture()
  input.map.tokens.push({ ...input.map.tokens[0], id: 'other', x: 125 })
  expect(destination(input)).toMatchObject({ ok: false, reason: 'invalid-target' })
  expect(destination({ ...input, targetElevationFeet: 5 }).ok).toBe(true)
  input.map.tokens[1].elevationFeet = 5
  expect(destination({ ...input, targetElevationFeet: 5 }).ok).toBe(false)
})

it.each([{ col: -1, row: 0 }, { col: 1.5, row: 0 }, { col: NaN, row: 0 }])('rejects malformed or off-map cells %j', targetCell => {
  expect(destination({ ...fixture(), targetCell }).ok).toBe(false)
})

it('rejects a large creature destination whose footprint crosses the map edge', () => {
  const input = fixture()
  input.map.tokens[0] = { ...input.map.tokens[0], size: 2, x: 450, y: 50 }
  expect(destination({ ...input, targetCell: { col: 9, row: 0 } })).toMatchObject({ ok: false, reason: 'invalid-target' })
})

it('requires actual sight and allows linked natural darkvision', () => {
  const input = fixture(), geometry = createEmptyMapGeometry(input.map.id)
  geometry.vision.ambientLight = 'darkness'
  setMapGeometryRuntime([geometry])
  expect(destination(input)).toMatchObject({ ok: false, reason: 'target-not-visible' })
  input.map.tokens[0].darkvisionRangeFeet = 10
  expect(destination(input).ok).toBe(true)
})

it('can cross a transparent movement barrier but cannot land inside it', () => {
  const input = fixture(), geometry = createEmptyMapGeometry(input.map.id)
  geometry.vision.ambientLight = 'bright'
  geometry.walls = [{ id: 'barrier', kind: 'wall', label: '', points: [{ x: 75, y: 0 }, { x: 75, y: 500 }],
    edgeIds: ['edge'], baseHeightFeet: 0, heightFeet: 20, blocksVision: false,
    blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }]
  setMapGeometryRuntime([geometry])
  expect(destination(input).ok).toBe(true)
  expect(destination({ ...input, targetCell: { col: 1, row: 0 } })).toMatchObject({ ok: false, reason: 'invalid-target' })
  geometry.walls[0].blocksVision = true
  setMapGeometryRuntime([geometry])
  expect(destination(input)).toMatchObject({ ok: false, reason: 'target-not-visible' })
})

it('uses the terrain elevation for legacy tokens and rejects destinations below ground', () => {
  const input = fixture(), geometry = createEmptyMapGeometry(input.map.id)
  geometry.vision.ambientLight = 'bright'
  geometry.obstacles.push({ id: 'plateau', kind: 'obstacle', label: '',
    points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
    baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  expect(destination(input)).toMatchObject({ ok: true, elevationFeet: 20, distanceFeet: 10 })
  input.map.tokens[0].elevationFeet = 0
  expect(destination(input).ok).toBe(true)
  expect(destination({ ...input, targetElevationFeet: 0 })).toMatchObject({ ok: false, reason: 'invalid-target' })
  input.map.tokens.push({ ...input.map.tokens[0], id: 'occupied', x: 125 })
  expect(destination(input)).toMatchObject({ ok: false, reason: 'invalid-target' })
})

it('offers only empty teleport destinations that can reach the selected basic-attack target', () => {
  const input = fixture()
  input.map.tokens.push({ ...input.map.tokens[0], id: 'target', type: 'enemy', x: 175 })
  const request = { ...input, targetTokenId: 'target' }
  const cells = dnd5eAttackTeleportCellsForTarget(request)
  expect(cells).toContainEqual({ col: 2, row: 0 })
  expect(cells).not.toContainEqual({ col: 0, row: 0 })
  expect(cells).not.toContainEqual({ col: 3, row: 0 })
  expect(dnd5eAttackTeleportCellsForTarget({ ...request, targetReachFeet: 15 })).toContainEqual({ col: 0, row: 0 })
  expect(cells.every(targetCell => destination({ ...input, targetCell }).ok)).toBe(true)
  input.map.tokens.push({ ...input.map.tokens[0], id: 'blocker', x: 125 })
  expect(dnd5eAttackTeleportCellsForTarget(request)).not.toContainEqual({ col: 2, row: 0 })
  input.map.tokens.find(token => token.id === 'target')!.x = 325
  expect(dnd5eAttackTeleportCellsForTarget(request)).toEqual([])
})

it('previews the selected altitude using the same occupancy and range checks as submission', () => {
  const input = fixture()
  input.map.tokens.push({ ...input.map.tokens[0], id: 'target', x: 175, elevationFeet: 15 })
  const request = { ...input, targetTokenId: 'target', targetElevationFeet: 10 }
  expect(dnd5eAttackTeleportCellsForTarget({ ...request, targetElevationFeet: undefined })).toEqual([])
  const cells = dnd5eAttackTeleportCellsForTarget(request)
  expect(cells).toContainEqual({ col: 2, row: 0 })
  expect(cells.every(targetCell => destination({ ...request, targetCell }).ok)).toBe(true)
  expect(dnd5eAttackTeleportCellsForTarget({ ...request, targetElevationFeet: 15 })).toEqual([])
})

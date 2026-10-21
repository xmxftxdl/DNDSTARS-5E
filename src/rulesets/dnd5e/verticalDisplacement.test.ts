import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eMappedVerticalDisplacement } from './verticalDisplacement'
import { createDnd5eMapCombatSnapshot, refreshDnd5eMapSpatialRelations } from './mapBridge'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import { afterEach } from 'vitest'
afterEach(() => setMapGeometryRuntime([]))

it('derives clearance from the Host map and refreshes it after movement', () => {
  const token: Token = { id: 'creature', label: 'Creature', color: '#ffffff', emoji: '',
    x: 125, y: 125, size: 1, type: 'enemy', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 }
  const map: BattleMap = { id: 'clearance-map', name: 'Map', width: 1000, height: 1000,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [token] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'ceiling', kind: 'obstacle', label: 'Ceiling',
    points: [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 150 }, { x: 100, y: 150 }],
    baseHeightFeet: 15, heightFeet: 1, blocksMovement: true, blocksVision: true,
    blocksLineOfEffect: true, cover: 'total', createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const { state } = createDnd5eMapCombatSnapshot({ combatId: 'test', map, characters: [],
    initiativeOrder: [{ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 10 }] })
  expect(state.combatants.creature.upwardClearanceFeet).toBe(10)
  state.combatants.creature.position = { x: 400, y: 400 }
  refreshDnd5eMapSpatialRelations(state, map, [])
  expect(state.combatants.creature.upwardClearanceFeet).toBe(10000)
})

it('stops below a thin overhead slab even when the requested endpoint lies above it', () => {
  const token = { id: 'creature', x: 125, y: 125, size: 1 } as Token
  const map = { id: 'map', gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, tokens: [token] } as BattleMap
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'ceiling', kind: 'obstacle', label: 'Ceiling',
    points: [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 150 }, { x: 100, y: 150 }],
    baseHeightFeet: 15, heightFeet: 1, blocksMovement: true, blocksVision: true,
    blocksLineOfEffect: true, cover: 'total', createdAt: 1 })
  const run = (fromFeet: number, toFeet: number) => dnd5eMappedVerticalDisplacement({ map, geometry, token, fromFeet, toFeet })
  expect(run(0, 30)).toEqual({ elevationFeet: 10, blocked: true, entityId: 'ceiling' })
  expect(run(30, 0)).toEqual({ elevationFeet: 16, blocked: true, entityId: 'ceiling' })
  expect(run(0, 10).blocked).toBe(false)
  expect(run(0, 9).blocked).toBe(false)
  expect(run(10, 30)).toMatchObject({ elevationFeet: 10, blocked: true })
  geometry.obstacles[0].blocksMovement = false
  expect(run(0, 30).blocked).toBe(false)
})

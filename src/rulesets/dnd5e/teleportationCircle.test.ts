import { migrateMapsState } from '../../store/maps'
import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createTeleportationCircle, normalizeTeleportationCircleExit, teleportationCircleLanding, travelThroughTeleportationCircle, teleportationCircleContains, teleportationCircleCrossed, teleportationCircleExpiredAfterDeparture } from './teleportationCircle'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'
const token = (id: string, patch: Partial<Token> = {}): Token => ({ id, label: id, x: 75, y: 75, color: '#fff', emoji: '', size: 1, type: 'player', ...patch })
const map = (id: string, tokens: Token[] = []): BattleMap => ({ id, name: id, width: 200, height: 200, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens })

describe('DM-directed Teleportation Circle', () => {
  it('moves the original token across maps and places subsequent travelers in distinct spaces', () => {
    const a = token('a', { hp: 7, characterId: 'hero' }), b = token('b')
    const source = map('source', [a, b]), destination = map('destination', [token('block', { type: 'obstacle' })])
    const portal = createTeleportationCircle({ id: 'portal', map: source, caster: a, round: 2, exit: { mapId: destination.id, x: 75, y: 75 } })
    source.dnd5ePluginAreas = [portal]
    expect(portal.expiresAtSourceTurnEndAfterRound).toBe(3)
    const once = travelThroughTeleportationCircle([source, destination], source.id, portal.id, a.id)!
    expect(once[0].tokens.map(t => t.id)).toEqual(['b'])
    expect(once[1].tokens.find(t => t.id === 'a')).toMatchObject({ hp: 7, characterId: 'hero' })
    const twice = travelThroughTeleportationCircle(once, source.id, portal.id, b.id)!
    const positions = twice[1].tokens.map(t => `${t.x},${t.y}`)
    expect(new Set(positions).size).toBe(3)
  })
  it('rejects invalid, full, duplicate-character and expired destinations without deleting the traveler', () => {
    const actor = token('actor', { characterId: 'hero' }), source = map('source', [actor])
    const destination = map('destination', [token('duplicate', { characterId: 'hero' })])
    const exit = { mapId: destination.id, x: 25, y: 25 }
    const portal = createTeleportationCircle({ id: 'portal', map: source, caster: actor, round: 1, exit })
    source.dnd5ePluginAreas = [portal]
    expect(travelThroughTeleportationCircle([source, destination], source.id, portal.id, actor.id)).toBeUndefined()
    destination.tokens = []
    portal.teleportationExit!.expiresAt = 1
    expect(travelThroughTeleportationCircle([source, destination], source.id, portal.id, actor.id)).toBeUndefined()
    destination.tokens = Array.from({ length: 16 }, (_, i) => token(String(i), { x: i % 4 * 50 + 25, y: Math.floor(i / 4) * 50 + 25 }))
    expect(teleportationCircleLanding(destination, actor, exit)).toBeUndefined()
    expect(teleportationCircleLanding(destination, actor, { ...exit, x: -1 })).toBeUndefined()
    expect(source.tokens).toEqual([actor])
    expect(normalizeTeleportationCircleExit({ ...exit, x: NaN })).toBeUndefined()
  })
})

it('follows the approved path rather than teleporting a token that walks around the circle', () => {
  const caster = token('caster'), scene = map('source', [caster])
  const portal = createTeleportationCircle({ id: 'portal', map: scene, caster, round: 1, exit: { mapId: 'dest', x: 25, y: 25 } })
  const before = token('walker', { x: 0, y: 75 })
  const after = token('walker', { x: 175, y: 75, movementAnimation: { id: 'move', issuedAt: 1, durationMs: 1000,
    points: [{ x: 0, y: 75 }, { x: 0, y: 0 }, { x: 175, y: 0 }, { x: 175, y: 75 }] } })
  expect(teleportationCircleCrossed(scene, portal, before, after)).toBe(false)
  expect(teleportationCircleCrossed(scene, portal, before, { ...after, movementAnimation: undefined })).toBe(true)
  expect(teleportationCircleContains(scene, portal, caster)).toBe(true)
  expect(teleportationCircleContains(scene, portal, after)).toBe(false)
})

it('keeps exploration portals open and retains the original expiry boundary when the caster travels first', () => {
  const caster = token('caster'), successor = token('next'), scene = map('source', [caster, successor])
  const portal = createTeleportationCircle({ id: 'portal', map: scene, caster, round: 2,
    exit: { mapId: 'dest', x: 25, y: 25, closesBeforeTokenId: 'next', closesBeforeRound: 3 } })
  expect(teleportationCircleExpiredAfterDeparture(portal, scene, 3, 'next')).toBe(false)
  scene.tokens = [successor]
  expect(teleportationCircleExpiredAfterDeparture(portal, scene, 2, 'next')).toBe(false)
  expect(teleportationCircleExpiredAfterDeparture(portal, scene, 3, 'other')).toBe(false)
  expect(teleportationCircleExpiredAfterDeparture(portal, scene, 3, 'next')).toBe(true)
  const exploration = createTeleportationCircle({ id: 'explore', map: scene, caster, round: 2,
    exit: { mapId: 'dest', x: 25, y: 25, exploration: true } })
  expect(exploration.permanent).toBe(true)
  expect(exploration.teleportationExit?.expiresAt).toBeUndefined()
  expect(exploration.expiresAtSourceTurnEndAfterRound).toBeUndefined()
  expect(teleportationCircleExpiredAfterDeparture(exploration, scene, 100, 'next')).toBe(false)
})

it('follows only the traveling player across maps and preserves token state through persistence', () => {
  const caster = token('caster', { characterId: 'hero', hp: 7, elevationFeet: 15, dnd5eCombatState: { conditions: ['poisoned'] } })
  const source = map('source', [caster, token('ally', { characterId: 'ally' })]), destination = map('destination')
  source.dnd5ePluginAreas = [createTeleportationCircle({ id: 'portal', map: source, caster, round: 1, exit: { mapId: destination.id, x: 75, y: 75 } })]
  const maps = travelThroughTeleportationCircle([source, destination], source.id, 'portal', caster.id)!
  const state = migrateMapsState({ maps, selectedId: source.id })
  expect(state.maps[1].tokens[0]).toMatchObject({ id: 'caster', hp: 7, teleportationArrivalMapId: 'destination', dnd5eCombatState: { conditions: ['poisoned'] } })
  expect(projectMapsForPlayer(state, undefined, 'hero').selectedId).toBe('destination')
  expect(projectMapsForPlayer(state, undefined, 'ally').selectedId).toBe('source')
  expect(state.selectedId).toBe('source')
})

it('persists the DM exit through shared map normalization', () => {
  const caster = token('caster')
  const source = map('source', [caster])
  source.dnd5ePluginAreas = [createTeleportationCircle({
    id: 'portal', map: source, caster, round: 1,
    exit: { mapId: 'destination', x: 25, y: 75 },
  })]
  const restored = migrateMapsState({ maps: [source] })
  expect(restored.maps[0].dnd5ePluginAreas?.[0].teleportationExit).toEqual({ mapId: 'destination', x: 25, y: 75 })
})

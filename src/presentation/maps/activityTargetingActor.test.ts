import { expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { resolveMapActivityTargetingActor } from './activityTargetingActor'

const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [
  { id: 'monster', label: 'Monster', x: 25, y: 25, type: 'enemy', size: 1, color: '', emoji: '' },
  { id: 'player-token', characterId: 'hero', label: 'Hero', x: 125, y: 25, type: 'player', size: 1, color: '', emoji: '' },
  { id: 'object', label: 'Object', x: 225, y: 25, type: 'obstacle', size: 1, color: '', emoji: '' },
] }

it('keeps monster identity independent of the player character or selected unit', () => {
  expect(resolveMapActivityTargetingActor(map, { characterId: 'hero', dmActor: { mapId: 'map', tokenId: 'monster' } })?.id).toBe('monster')
  expect(resolveMapActivityTargetingActor(map, { characterId: 'hero' })?.id).toBe('player-token')
})
it.each(['missing', 'object', 'player-token'])('rejects invalid DM preview actor %s', tokenId => {
  expect(resolveMapActivityTargetingActor(map, { characterId: 'hero', dmActor: { mapId: 'map', tokenId } })).toBeUndefined()
})
it('does not reuse a stale selection on another map or fall back to the player', () => {
  expect(resolveMapActivityTargetingActor(map, { characterId: 'hero', dmActor: { mapId: 'other-map', tokenId: 'monster' } })).toBeUndefined()
  expect(resolveMapActivityTargetingActor({ ...map, tokens: map.tokens.slice(1) }, { characterId: 'hero', dmActor: { mapId: 'map', tokenId: 'monster' } })).toBeUndefined()
})

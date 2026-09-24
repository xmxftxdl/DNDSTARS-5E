import { describe, expect, it } from 'vitest'
import { playerOwnsActivityPlacement } from './usePlayerActivityPlacement'

describe('caster-owned Activity placement', () => {
  const request = { mapId: 'map', characterId: 'wizard', input: {
    receiptId: 'cast:move', kind: 'movement' as const, label: '心灵遥控',
    actorTokenId: 'caster', originTokenId: 'minotaur', rangeFeet: 30, count: 1,
  } }
  it('routes monster destination selection to the caster, not the monster controller', () => {
    expect(playerOwnsActivityPlacement(request, 'map', new Set(['wizard']))).toBe(true)
    expect(playerOwnsActivityPlacement(request, 'map', new Set(['minotaur']))).toBe(false)
    expect(playerOwnsActivityPlacement(request, 'map', new Set(['other-player']))).toBe(false)
  })
  it('does not open a placement in another map or for a spectator', () => {
    expect(playerOwnsActivityPlacement(request, 'other-map', new Set(['wizard']))).toBe(false)
    expect(playerOwnsActivityPlacement(request, 'map', new Set())).toBe(false)
  })
})

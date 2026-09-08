import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { resolvePersistentAreaCreatureTarget } from './persistentAreaTargetSelection'

function token(id: string, type: Token['type'], x: number, y: number, size = 1): Token {
  return { id, type, x, y, size, label: id, color: '#fff', emoji: '' }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map', name: 'map', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens,
  }
}

describe('resolvePersistentAreaCreatureTarget', () => {
  it('selects the creature underneath the granting area effect token', () => {
    const captain = token('captain', 'enemy', 175, 175)
    const hand = token('arcane-hand-effect-token', 'obstacle', 175, 175, 2)
    const battleMap = map([
      token('caster', 'player', 75, 375),
      captain,
      token('distant-enemy', 'enemy', 425, 75),
      hand,
    ])

    expect(resolvePersistentAreaCreatureTarget(
      battleMap,
      { anchorTokenId: hand.id },
      hand.id,
    )?.id).toBe(captain.id)
  })

  it('keeps an ordinary creature click unchanged', () => {
    const captain = token('captain', 'enemy', 175, 175)
    const battleMap = map([captain])
    expect(resolvePersistentAreaCreatureTarget(
      battleMap,
      { anchorTokenId: 'arcane-hand-effect-token' },
      captain.id,
    )).toBe(captain)
  })

  it('does not tunnel through unrelated obstacle tokens', () => {
    const wall = token('wall', 'obstacle', 175, 175)
    const battleMap = map([token('captain', 'enemy', 175, 175), wall])
    expect(resolvePersistentAreaCreatureTarget(
      battleMap,
      { anchorTokenId: 'different-effect-token' },
      wall.id,
    )).toBe(wall)
  })
})

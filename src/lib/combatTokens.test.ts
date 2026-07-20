import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import { characterNeedsDeathSave, checkCombatOutcome, decideTurnAction, isTokenAlive } from './combatTokens'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'player',
    ...patch,
  }
}

describe('combat token liveness', () => {
  it('does not treat a linked token as defeated while its character is still syncing', () => {
    const linkedPlayer = token({ id: 'player-token', type: 'player', characterId: 'missing-character' })
    const enemy = token({ id: 'enemy-token', type: 'enemy', hp: 12, maxHp: 12 })

    expect(isTokenAlive(linkedPlayer, [])).toBe(true)
    expect(checkCombatOutcome([linkedPlayer, enemy], [])).toEqual({ ended: false })
  })

  it('keeps an unstable 0 HP player in initiative until death saves are resolved', () => {
    const linkedPlayer = token({ id: 'player-token', type: 'player', characterId: 'hero' })
    const enemy = token({ id: 'enemy-token', type: 'enemy', hp: 12, maxHp: 12 })
    const hero = { id: 'hero', currentHp: 0, deathSaveFailures: 0, deathSaveStable: false } as Character

    expect(isTokenAlive(linkedPlayer, [hero])).toBe(false)
    expect(characterNeedsDeathSave(hero)).toBe(true)
    expect(decideTurnAction(linkedPlayer, [hero])).toBe('player')
    expect(checkCombatOutcome([linkedPlayer, enemy], [hero])).toEqual({ ended: false })
  })

  it('ends the player side only after the character has three failed death saves', () => {
    const linkedPlayer = token({ id: 'player-token', type: 'player', characterId: 'hero' })
    const enemy = token({ id: 'enemy-token', type: 'enemy', hp: 12, maxHp: 12 })
    const hero = { id: 'hero', currentHp: 0, deathSaveFailures: 3, deathSaveStable: false } as Character

    expect(characterNeedsDeathSave(hero)).toBe(false)
    expect(decideTurnAction(linkedPlayer, [hero])).toBe('skip')
    expect(checkCombatOutcome([linkedPlayer, enemy], [hero]).ended).toBe(true)
  })
})

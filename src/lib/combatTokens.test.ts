import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import { characterNeedsDeathSave, checkCombatOutcome, decideTurnAction, getTokenCombatSide, isTokenAlive } from './combatTokens'

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

  it('counts a DM-controlled allied summon on the player side for combat outcome', () => {
    const summon = token({
      id: 'summon', type: 'enemy', hp: 11, maxHp: 11,
      dnd5eSummon: {
        schemaVersion: 1, pluginId: 'com.example', featureId: 'com.example:wolf',
        sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
        expiresAfterRound: 10, side: 'player',
      },
    })
    const defeatedEnemy = token({ id: 'enemy', type: 'enemy', hp: 0, maxHp: 7 })
    expect(checkCombatOutcome([summon, defeatedEnemy], [])).toMatchObject({ ended: true, winner: 'ally' })
  })

  it('treats ordinary NPC tokens as allies instead of neutral by default', () => {
    const npc = token({ id: 'guide', type: 'npc', hp: 8, maxHp: 8 })
    const defeatedEnemy = token({ id: 'enemy', type: 'enemy', hp: 0, maxHp: 7 })
    expect(getTokenCombatSide(npc)).toBe('ally')
    expect(checkCombatOutcome([npc, defeatedEnemy], [])).toMatchObject({ ended: true, winner: 'ally' })
  })
})

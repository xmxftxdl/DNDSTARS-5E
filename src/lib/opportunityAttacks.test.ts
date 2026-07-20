import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from './opportunityAttacks'

function token(id: string, type: Token['type'], summonSide?: 'player' | 'enemy'): Token {
  return {
    id, label: id, x: 0, y: 0, color: '#fff', emoji: id, size: 1, type,
    dnd5eSummon: summonSide ? {
      schemaVersion: 1, pluginId: 'com.example', featureId: 'com.example:summon',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
      expiresAfterRound: 10, side: summonSide,
    } : undefined,
  }
}

describe('D&D 5e combat token sides', () => {
  it('uses summon allegiance instead of its DM-controlled presentation type', () => {
    const hero = token('hero', 'player')
    const enemy = token('enemy', 'enemy')
    const alliedSummon = token('summon', 'enemy', 'player')
    expect(dnd5eCombatTokenSide(alliedSummon)).toBe('player')
    expect(areOpposedCombatTokens(hero, alliedSummon)).toBe(false)
    expect(areOpposedCombatTokens(enemy, alliedSummon)).toBe(true)
  })
})

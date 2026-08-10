import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { resolvePlayerSpellActionSubmission } from './playerSpellActionAuthority'

const hero = { id: 'hero', currentHp: 10 } as Character
const other = { id: 'other', currentHp: 10 } as Character
const heroToken = {
  id: 'hero-token', type: 'player', characterId: hero.id, label: 'Hero',
  x: 0, y: 0, size: 1, emoji: '', color: '#fff',
} as Token
const map = { id: 'map', tokens: [heroToken] } as BattleMap

function input(overrides: Partial<Parameters<typeof resolvePlayerSpellActionSubmission>[0]> = {}) {
  return {
    activeMap: map,
    mode: 'player' as const,
    playerCombatLocked: false,
    combatActive: false,
    combatActiveSnapshot: false,
    authorityReady: true,
    combatFlowPaused: false,
    playerCharacter: hero,
    characters: [hero, other],
    ...overrides,
  }
}

describe('resolvePlayerSpellActionSubmission', () => {
  it('selects the owned living token outside combat, including after a prior combat lock', () => {
    expect(resolvePlayerSpellActionSubmission(input({ playerCombatLocked: true }))).toEqual({
      character: hero,
      token: heroToken,
    })
  })

  it('requires the owned current initiative actor during combat', () => {
    expect(resolvePlayerSpellActionSubmission(input({
      combatActive: true,
      combatActiveSnapshot: true,
      turnCharacter: hero,
      currentInitiativeToken: heroToken,
    }))).toEqual({ character: hero, token: heroToken })

    expect(resolvePlayerSpellActionSubmission(input({
      combatActive: true,
      combatActiveSnapshot: true,
      turnCharacter: other,
      currentInitiativeToken: { ...heroToken, characterId: other.id },
    }))).toBeUndefined()
  })

  it('fails closed while authority is unavailable or combat state is transitioning', () => {
    expect(resolvePlayerSpellActionSubmission(input({ authorityReady: false }))).toBeUndefined()
    expect(resolvePlayerSpellActionSubmission(input({ combatActiveSnapshot: true }))).toBeUndefined()
    expect(resolvePlayerSpellActionSubmission(input({ combatFlowPaused: true }))).toBeUndefined()
  })
})

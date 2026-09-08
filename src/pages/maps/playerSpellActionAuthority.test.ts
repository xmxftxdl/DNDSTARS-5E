import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  playerSpellTargetingMatchesAuthority,
  resolvePlayerSpellActionSubmission,
} from './playerSpellActionAuthority'

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

  it('returns the assigned caster for a Host-opened reaction during another creature turn', () => {
    expect(resolvePlayerSpellActionSubmission(input({
      combatActive: true,
      combatActiveSnapshot: true,
      turnCharacter: other,
      currentInitiativeToken: { ...heroToken, type: 'enemy', characterId: undefined },
      allowTriggeredReaction: true,
    }))).toEqual({ character: hero, token: heroToken })
  })

  it('fails closed while authority is unavailable or live combat is paused/transitioning', () => {
    expect(resolvePlayerSpellActionSubmission(input({ authorityReady: false }))).toBeUndefined()
    expect(resolvePlayerSpellActionSubmission(input({ combatActiveSnapshot: true }))).toBeUndefined()
    expect(resolvePlayerSpellActionSubmission(input({
      combatActive: true,
      combatActiveSnapshot: true,
      combatFlowPaused: true,
      turnCharacter: hero,
      currentInitiativeToken: heroToken,
    }))).toBeUndefined()
  })

  it('ignores a stale combat-flow pause outside combat', () => {
    expect(resolvePlayerSpellActionSubmission(input({ combatFlowPaused: true }))).toEqual({
      character: hero,
      token: heroToken,
    })
  })
})

describe('playerSpellTargetingMatchesAuthority', () => {
  it('keeps owned spell targeting outside combat', () => {
    expect(playerSpellTargetingMatchesAuthority({
      combatActive: false,
      targetingCharacterId: hero.id,
      playerCharacterId: hero.id,
    })).toBe(true)
  })

  it('keeps a Host-opened reaction targeter during another creature turn', () => {
    expect(playerSpellTargetingMatchesAuthority({
      combatActive: true,
      targetingCharacterId: hero.id,
      playerCharacterId: hero.id,
      turnCharacterId: other.id,
      currentInitiativeToken: { ...heroToken, type: 'enemy', characterId: undefined },
      allowTriggeredReaction: true,
    })).toBe(true)
  })

  it('keeps targeting only for the owned live initiative actor in combat', () => {
    expect(playerSpellTargetingMatchesAuthority({
      combatActive: true,
      targetingCharacterId: hero.id,
      playerCharacterId: hero.id,
      turnCharacterId: hero.id,
      currentInitiativeToken: heroToken,
    })).toBe(true)

    expect(playerSpellTargetingMatchesAuthority({
      combatActive: true,
      targetingCharacterId: hero.id,
      playerCharacterId: hero.id,
      turnCharacterId: other.id,
      currentInitiativeToken: { ...heroToken, type: 'enemy', characterId: undefined },
    })).toBe(false)

    expect(playerSpellTargetingMatchesAuthority({
      combatActive: true,
      targetingCharacterId: other.id,
      playerCharacterId: hero.id,
      turnCharacterId: other.id,
      currentInitiativeToken: { ...heroToken, characterId: other.id },
    })).toBe(false)
  })
})

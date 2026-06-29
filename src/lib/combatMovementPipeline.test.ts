import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { resolveCombatMovement } from './combatMovementPipeline'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: 'Tester',
    avatar: ':)',
    accent: '',
    race: '',
    charClass: 'Ranger',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    actionPoints: 2,
    currentAP: 2,
    passivePerception: 10,
    inspiration: 0,
    mana: 0,
    maxMana: 0,
    traits: [],
    combatSkills: [],
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(patch: Partial<Token> = {}): Token {
  return {
    id: 'hero-token',
    label: 'Hero',
    x: 175,
    y: 175,
    color: '#fff',
    emoji: ':)',
    size: 1,
    type: 'player',
    characterId: 'hero',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 700,
    height: 700,
    gridSize: 70,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
  }
}

describe('combatMovementPipeline', () => {
  it('accepts normal turn movement and returns the AP patch', () => {
    const actor = character()
    const result = resolveCombatMovement({
      map: map([token()]),
      characters: [actor],
      actorTokenId: 'hero-token',
      characterId: actor.id,
      targetPosition: { x: 245, y: 175 },
      mode: 'turn-move',
      active: true,
      currentTurnTokenId: 'hero-token',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.apCost).toBe(1)
    expect(result.feet).toBe(5)
    expect(result.triggersMoveEffects).toBe(true)
    expect(result.characterPatch).toMatchObject({ currentAP: 1 })
    expect(result.to).toEqual({ x: 245, y: 175 })
  })

  it('rejects turn movement when AP is insufficient', () => {
    const result = resolveCombatMovement({
      map: map([token()]),
      characters: [character({ currentAP: 0 })],
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 245, y: 175 },
      mode: 'turn-move',
      active: true,
      currentTurnTokenId: 'hero-token',
    })

    expect(result).toEqual({ ok: false, reason: 'insufficient-ap' })
  })

  it('rejects normal movement outside the current actor turn', () => {
    const result = resolveCombatMovement({
      map: map([token()]),
      characters: [character()],
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 245, y: 175 },
      mode: 'turn-move',
      active: true,
      currentTurnTokenId: 'other-token',
    })

    expect(result).toEqual({ ok: false, reason: 'stale-turn' })
  })

  it('accepts agile leap without AP and clears the prepared movement buff', () => {
    const actor = character({ currentAP: 0, combatBuffs: { agileLeapMoveFeet: 10 } })
    const result = resolveCombatMovement({
      map: map([token()]),
      characters: [actor],
      actorTokenId: 'hero-token',
      characterId: actor.id,
      targetPosition: { x: 315, y: 175 },
      mode: 'agile-leap',
      active: true,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.apCost).toBe(0)
    expect(result.feet).toBe(10)
    expect(result.triggersMoveEffects).toBe(false)
    expect(result.characterPatch?.currentAP).toBeUndefined()
    expect(result.characterPatch?.combatBuffs?.agileLeapMoveFeet).toBeUndefined()
  })

  it('accepts skill free movement without AP and clears the prepared movement buff', () => {
    const actor = character({ currentAP: 0, combatBuffs: { freeMoveFeet: 15 } })
    const result = resolveCombatMovement({
      map: map([token()]),
      characters: [actor],
      actorTokenId: 'hero-token',
      characterId: actor.id,
      targetPosition: { x: 385, y: 175 },
      mode: 'skill-free-move',
      active: true,
      currentTurnTokenId: 'hero-token',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.apCost).toBe(0)
    expect(result.feet).toBe(15)
    expect(result.triggersMoveEffects).toBe(false)
    expect(result.characterPatch?.currentAP).toBeUndefined()
    expect(result.characterPatch?.combatBuffs?.freeMoveFeet).toBeUndefined()
  })

  it('accepts calm spirit movement without AP and clears the prepared movement buff', () => {
    const actor = character({ currentAP: 0, combatBuffs: { calmSpiritMoveFeet: 15 } })
    const result = resolveCombatMovement({
      map: map([token()]),
      characters: [actor],
      actorTokenId: 'hero-token',
      characterId: actor.id,
      targetPosition: { x: 385, y: 175 },
      mode: 'calm-spirit-move',
      active: true,
      currentTurnTokenId: 'hero-token',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.apCost).toBe(0)
    expect(result.feet).toBe(15)
    expect(result.triggersMoveEffects).toBe(false)
    expect(result.characterPatch?.currentAP).toBeUndefined()
    expect(result.characterPatch?.combatBuffs?.calmSpiritMoveFeet).toBeUndefined()
  })

  it('lets DM override movement move defeated tokens without AP checks', () => {
    const actor = character({ currentHp: 0, currentAP: 0 })
    const result = resolveCombatMovement({
      map: map([token({ hp: 0 })]),
      characters: [actor],
      actorTokenId: 'hero-token',
      characterId: actor.id,
      targetPosition: { x: 315, y: 175 },
      mode: 'dm-override',
      active: false,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.apCost).toBe(0)
    expect(result.triggersMoveEffects).toBe(false)
    expect(result.to).toEqual({ x: 315, y: 175 })
  })
})

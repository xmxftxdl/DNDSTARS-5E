import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { findOpportunityAttackersForMove } from './opportunityAttacks'

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
    id: 'token',
    label: 'Token',
    x: 105,
    y: 105,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'player',
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

describe('opportunity attacks', () => {
  it('finds an enemy when a player leaves its adjacent reach', () => {
    const mover = token({ id: 'hero-token', type: 'player', characterId: 'hero', x: 105, y: 105 })
    const enemy = token({ id: 'goblin', type: 'enemy', poolId: 'goblin', x: 105, y: 175 })
    const attackers = findOpportunityAttackersForMove({
      map: map([mover, enemy]),
      characters: [character({ id: 'hero' })],
      movingToken: mover,
      to: { x: 315, y: 105 },
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    })

    expect(attackers.map((item) => item.id)).toEqual(['goblin'])
  })

  it('does not trigger while the mover stays within adjacent reach', () => {
    const mover = token({ id: 'hero-token', type: 'player', characterId: 'hero', x: 105, y: 105 })
    const enemy = token({ id: 'goblin', type: 'enemy', poolId: 'goblin', x: 105, y: 175 })
    const attackers = findOpportunityAttackersForMove({
      map: map([mover, enemy]),
      characters: [character({ id: 'hero' })],
      movingToken: mover,
      to: { x: 175, y: 105 },
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    })

    expect(attackers).toHaveLength(0)
  })

  it('does not trigger after disengage or when the attacker lacks AP', () => {
    const mover = token({ id: 'hero-token', type: 'player', characterId: 'hero', x: 105, y: 105 })
    const enemy = token({ id: 'goblin', type: 'enemy', poolId: 'goblin', x: 105, y: 175 })
    const battleMap = map([mover, enemy])

    expect(
      findOpportunityAttackersForMove({
        map: battleMap,
        characters: [character({ id: 'hero' })],
        movingToken: mover,
        to: { x: 315, y: 105 },
        disengagedCharacterIds: new Set(['hero']),
        enemyApByToken: { goblin: { current: 1, max: 2 } },
      }),
    ).toHaveLength(0)

    expect(
      findOpportunityAttackersForMove({
        map: battleMap,
        characters: [character({ id: 'hero' })],
        movingToken: mover,
        to: { x: 315, y: 105 },
        enemyApByToken: { goblin: { current: 0, max: 2 } },
      }),
    ).toHaveLength(0)
  })

  it('finds a player attacker when an enemy leaves reach', () => {
    const mover = token({ id: 'goblin', type: 'enemy', poolId: 'goblin', x: 105, y: 105 })
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: 'hero', x: 105, y: 175 })
    const attackers = findOpportunityAttackersForMove({
      map: map([mover, heroToken]),
      characters: [character({ id: 'hero', currentAP: 1 })],
      movingToken: mover,
      to: { x: 315, y: 105 },
    })

    expect(attackers.map((item) => item.id)).toEqual(['hero-token'])
  })
})

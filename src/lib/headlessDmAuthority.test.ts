import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { HeadlessDmCombatState } from './headlessDmCombatEngine'
import {
  createHeadlessDmAuthority,
  endHeadlessDmCombatAuthority,
  startHeadlessDmCombatAuthority,
} from './headlessDmAuthority'

function map(): BattleMap {
  return {
    id: 'map-1',
    name: 'Authority test',
    width: 500,
    height: 500,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [
      {
        id: 'hero-token',
        label: 'Hero',
        x: 25,
        y: 25,
        color: '#34d399',
        emoji: 'H',
        type: 'player',
        size: 1,
        characterId: 'hero',
      },
    ],
  }
}

function character(): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: 'Player 1',
    avatar: 'H',
    accent: '',
    race: '',
    charClass: 'Archer',
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
    hitDice: '1d8',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
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
  }
}

function state(battleMap = map()): HeadlessDmCombatState {
  return {
    map: battleMap,
    characters: [character()],
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: 'H', color: '#34d399', roll: 20 }],
    enemyApByToken: {},
    disengagedCharacterIds: [],
  }
}

describe('headless DM authority', () => {
  it('builds a fresh authority snapshot for normal execution', () => {
    const battleMap = map()
    let snapshots = 0
    const authority = createHeadlessDmAuthority({
      createSnapshot: (inputMap) => {
        snapshots += 1
        return state(inputMap)
      },
    })

    const result = authority.resolve(battleMap, {
      type: 'disengage',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(result.ok).toBe(true)
    expect(snapshots).toBe(1)
  })

  it('reuses an explicit snapshot for preview and final resolution', () => {
    const authority = createHeadlessDmAuthority({
      createSnapshot: () => {
        throw new Error('explicit state should not request another snapshot')
      },
    })
    const snapshot = state()

    const preview = authority.resolveState(snapshot, {
      type: 'disengage',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })
    const final = authority.resolveState(snapshot, {
      type: 'disengage',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(preview).toEqual(final)
    expect(snapshot.characters[0].currentAP).toBe(2)
  })

  it('owns combat lifecycle initialization and shutdown', () => {
    const battleMap = map()
    battleMap.tokens.push({
      id: 'enemy-token',
      label: 'Enemy',
      x: 125,
      y: 25,
      color: '#ef4444',
      emoji: 'E',
      type: 'enemy',
      size: 1,
    })
    const started = startHeadlessDmCombatAuthority({
      map: battleMap,
      characters: [{ ...character(), currentAP: 0 }],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: 'H', color: '#34d399', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: 'E', color: '#ef4444', roll: 10 },
      ],
    })

    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.state.active).toBe(true)
    expect(started.state.characters[0].currentAP).toBe(2)
    expect(started.state.enemyApByToken['enemy-token']).toEqual({ current: 2, max: 2 })

    const ended = endHeadlessDmCombatAuthority(started.state)
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.active).toBe(false)
    expect(ended.state.initiativeOrder).toEqual([])
    expect(ended.state.enemyApByToken).toEqual({})
  })
})

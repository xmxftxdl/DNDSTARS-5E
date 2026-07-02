import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { HeadlessCombatResult, HeadlessDmCombatState } from './headlessDmCombatEngine'
import {
  createHeadlessCombatSnapshot,
  planHeadlessCombatResultApplication,
} from './headlessCombatBridge'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: '',
    avatar: '',
    accent: '',
    race: '',
    charClass: '',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d8',
    ac: 14,
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

function map(hp = 20): BattleMap {
  return {
    id: 'map',
    name: 'Map',
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
        x: 50,
        y: 50,
        color: '#22c55e',
        emoji: '',
        size: 1,
        type: 'player',
        characterId: 'hero',
        hp,
        maxHp: 20,
      },
    ],
  }
}

function state(patch: Partial<HeadlessDmCombatState> = {}): HeadlessDmCombatState {
  const initiativeOrder: InitiativeEntry[] = [
    { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '#22c55e', roll: 10 },
  ]
  return {
    map: map(),
    characters: [character()],
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder,
    enemyApByToken: { goblin: { current: 2, max: 2 } },
    disengagedCharacterIds: [],
    ...patch,
  }
}

describe('headless combat bridge', () => {
  it('creates a headless state snapshot from current authority state', () => {
    const source = state({ disengagedCharacterIds: ['hero'] })
    const snapshot = createHeadlessCombatSnapshot({
      map: source.map,
      characters: source.characters,
      active: source.active,
      round: source.round,
      initiativeIndex: source.initiativeIndex,
      initiativeOrder: source.initiativeOrder,
      enemyApByToken: source.enemyApByToken,
      disengagedCharacterIds: source.disengagedCharacterIds,
    })

    expect(snapshot).toMatchObject({
      active: true,
      round: 1,
      initiativeIndex: 0,
      disengagedCharacterIds: ['hero'],
    })
    expect(snapshot.disengagedCharacterIds).not.toBe(source.disengagedCharacterIds)
  })

  it('does not apply failed headless results', () => {
    const current = state()
    const result: HeadlessCombatResult = {
      ok: false,
      state: current,
      reason: 'invalid-action',
      events: [],
    }

    const plan = planHeadlessCombatResultApplication({
      result,
      currentActive: true,
      currentRound: 1,
      currentInitiativeIndex: 0,
      currentInitiativeOrder: current.initiativeOrder,
      currentCharacters: current.characters,
      currentMap: current.map,
      currentEnemyApByToken: current.enemyApByToken,
      currentDisengagedCharacterIds: [],
    })

    expect(plan).toMatchObject({
      ok: false,
      shouldPublishCombatState: false,
      charactersToUpdate: [],
      tokensToUpdate: [],
      deathEvents: [],
    })
  })

  it('plans authoritative state, AP, character, token, and death updates', () => {
    const current = state()
    const next = state({
      round: 2,
      initiativeIndex: 0,
      characters: [character({ currentHp: 0, currentAP: 1 })],
      map: map(0),
      enemyApByToken: { goblin: { current: 1, max: 2 } },
      disengagedCharacterIds: ['hero'],
    })
    const result: HeadlessCombatResult = {
      ok: true,
      state: next,
      events: [
        {
          type: 'damage-applied',
          targetTokenId: 'hero-token',
          characterId: 'hero',
          amount: 20,
          hpBefore: 20,
          hpAfter: 0,
        },
      ],
    }

    const plan = planHeadlessCombatResultApplication({
      result,
      currentActive: current.active,
      currentRound: current.round,
      currentInitiativeIndex: current.initiativeIndex,
      currentInitiativeOrder: current.initiativeOrder,
      currentCharacters: current.characters,
      currentMap: current.map,
      currentEnemyApByToken: current.enemyApByToken,
      currentDisengagedCharacterIds: [],
    })

    expect(plan.ok).toBe(true)
    expect(plan.round).toBe(2)
    expect(plan.enemyApByToken).toEqual({ goblin: { current: 1, max: 2 } })
    expect(plan.disengagedCharacterIds).toEqual(['hero'])
    expect(plan.charactersToUpdate).toMatchObject([{ id: 'hero', currentHp: 0, currentAP: 1 }])
    expect(plan.tokensToUpdate).toMatchObject([{ id: 'hero-token', hp: 0 }])
    expect(plan.deathEvents).toEqual([{ targetTokenId: 'hero-token', characterId: 'hero' }])
    expect(plan.shouldPublishCombatState).toBe(true)
  })
})

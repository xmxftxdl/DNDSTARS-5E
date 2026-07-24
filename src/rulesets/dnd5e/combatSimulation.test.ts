import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { defaultEquipmentForDnd5eCharacter } from './equipment'
import {
  DND5E_COMBAT_SIMULATION_MAX_TRIALS,
  simulateDnd5eCombats,
  validateDnd5eCombatSimulationRequest,
} from './combatSimulation'

function fighter(patch: Partial<Character> = {}): Character {
  return {
    id: 'fighter',
    name: '测试战士',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: '战士',
    level: 5,
    background: '士兵',
    experience: 0,
    reputation: 0,
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 52,
    currentHp: 52,
    tempHp: 0,
    hitDice: '5d10',
    ac: 18,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: defaultEquipmentForDnd5eCharacter({ charClass: '战士' }),
    ...patch,
  }
}

describe('D&D 5e combat simulator', () => {
  it('runs exactly 1000 seeded trials and is reproducible', () => {
    const request = {
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 2 }],
      trials: 1_000,
      seed: 12345,
      initialDistanceFeet: 30,
    } as const
    const first = simulateDnd5eCombats(request)
    const second = simulateDnd5eCombats(request)
    expect(first.trials).toBe(DND5E_COMBAT_SIMULATION_MAX_TRIALS)
    expect(first.playerWins + first.monsterWins + first.draws).toBe(1_000)
    expect(second).toEqual(first)
    expect(first.coverage.automatedMonsterActions).toBeGreaterThan(0)
  })

  it('reports a stronger party as more likely to beat a single goblin', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter(), fighter({ id: 'fighter-2', name: '第二名战士' })],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 200,
      seed: 7,
    })
    expect(result.playerWinRate).toBeGreaterThan(0.9)
    expect(result.averagePlayerSurvivors).toBeGreaterThan(1)
    expect(result.participantSummaries.some((entry) => entry.name === '地精')).toBe(true)
  })

  it('rejects empty teams, unknown monsters and trial counts above the safe cap', () => {
    expect(validateDnd5eCombatSimulationRequest({
      characters: [],
      monsters: [{ monsterId: 'not-a-monster', count: 1 }],
      trials: 1_001,
    })).toEqual(expect.arrayContaining([
      '至少选择一名玩家角色。',
      '找不到怪物：not-a-monster',
      '模拟次数必须是 1 至 1000 的整数。',
    ]))
  })
})

import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { defaultEquipmentForDnd5eCharacter } from './equipment'
import {
  DND5E_COMBAT_SIMULATION_MAX_TRIALS,
  simulateDnd5eCombats,
  validateDnd5eCombatSimulationRequest,
} from './combatSimulation'
import { getDnd5eSrdMonster } from './monsters'

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
    expect(first.trials).toBe(1_000)
    expect(first.playerWins + first.monsterWins + first.draws).toBe(1_000)
    expect(second).toEqual(first)
    expect(first.coverage.automatedMonsterActions).toBeGreaterThan(0)
    expect(first.roundSummaries.length).toBeGreaterThan(0)
    expect(first.actionUsage.length).toBeGreaterThan(0)
    expect(first.decisionLog.length).toBeGreaterThan(0)
    expect(first.decisionLog[0]).toMatchObject({
      providerId: 'dnd5e:deterministic-tactical-v3',
      candidateCount: expect.any(Number),
      candidates: expect.any(Array),
      executionSteps: expect.any(Array),
      outcome: {
        executed: expect.any(Boolean),
        hits: expect.any(Number),
        damage: expect.any(Number),
        headlessTransactions: expect.any(Number),
      },
    })
    expect(first.decisionLog[0].candidateCount).toBe(first.decisionLog[0].candidates.length)
    const executionTexts = first.decisionLog.flatMap((entry) =>
      entry.executionSteps.map((step) => step.text))
    expect(executionTexts.some((text) => text.includes('D20='))).toBe(true)
    expect(executionTexts.some((text) => text.includes('受到') && text.includes('HP'))).toBe(true)
    expect(executionTexts.some((text) => text.includes('Headless 事务已提交'))).toBe(true)
    expect(first.decisionLog[0].candidates[0]).toMatchObject({
      rank: 1,
      selected: true,
      metrics: {
        expectedDamage: expect.any(Number),
        hitProbability: expect.any(Number),
      },
    })
    expect(first.headlessTransactionCount).toBeGreaterThan(0)
  })

  it('scores and resolves Aboleth Enslave as a control candidate', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:aboleth', count: 1 }],
      trials: 1,
      seed: 71,
      initialDistanceFeet: 30,
    })

    expect(result.coverage.automatedMonsterActions).toBe(4)
    expect(result.coverage.totalMonsterActions).toBe(4)
    expect(result.decisionLog.flatMap((entry) => entry.candidates)
      .some((candidate) =>
        candidate.actionId === 'enslave' &&
        (candidate.metrics.controlValue ?? 0) > 0)).toBe(true)
    expect(result.actionUsage.some((entry) =>
      entry.actionId === 'enslave' && entry.headlessTransactions > 0)).toBe(true)
  })

  it('lets an enslaved character take later turns for the Aboleth side', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter(), fighter({ id: 'fighter-2', name: '第二名战士' })],
      monsters: [{ monsterId: 'srd-5.1:aboleth', count: 1 }],
      trials: 1,
      seed: 1,
      initialDistanceFeet: 30,
    })

    const controlledTurn = result.decisionLog.find((entry) =>
      entry.controlledByName === '底栖魔鱼')
    expect(controlledTurn).toMatchObject({
      providerId: 'dnd5e:deterministic-tactical-v3',
      controlledByName: '底栖魔鱼',
      outcome: { executed: true },
    })
    expect(['测试战士', '第二名战士']).toContain(controlledTurn?.actorName)
    expect(result.actionUsage.some((entry) =>
      entry.side === 'monsters' &&
      ['测试战士', '第二名战士'].includes(entry.actorName))).toBe(true)
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

  it('includes safely automatable monster spells in decisions and coverage', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:mage', count: 1 }],
      trials: 50,
      seed: 51,
      initialDistanceFeet: 60,
    })

    expect(result.coverage.automatedMonsterSpells).toBeGreaterThan(0)
    expect(result.coverage.totalMonsterSpells).toBeGreaterThan(
      result.coverage.automatedMonsterSpells,
    )
    expect(result.participantSummaries.find((entry) => entry.side === 'monsters')?.averageDamage)
      .toBeGreaterThan(0)
    expect(result.actionUsage.some((entry) =>
      entry.actionId.startsWith('spell:') && entry.headlessTransactions > 0)).toBe(true)
  })

  it('rejects empty teams, unknown monsters and trial counts above the safe cap', () => {
    expect(validateDnd5eCombatSimulationRequest({
      characters: [],
      monsters: [{ monsterId: 'not-a-monster', count: 1 }],
      trials: DND5E_COMBAT_SIMULATION_MAX_TRIALS + 1,
    })).toEqual(expect.arrayContaining([
      '至少选择一名玩家角色。',
      '找不到怪物：not-a-monster',
      '模拟次数必须是 1 至 100000 的整数。',
    ]))
    expect(validateDnd5eCombatSimulationRequest({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 100_000,
    })).toEqual([])
  })

  it('loads a workshop monster into the shared simulation catalog', () => {
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')
    expect(goblin).toBeDefined()
    const workshopMonster = {
      ...goblin!,
      id: 'dm-custom:worker-goblin',
      slug: 'worker-goblin',
      name: '工坊测试地精',
      englishName: 'Workshop Goblin',
      source: 'DM 自定义',
    } as const

    const request = {
      characters: [fighter()],
      monsters: [{ monsterId: workshopMonster.id, count: 1 }],
      customMonsters: [workshopMonster],
      trials: 20,
      seed: 99,
    }
    expect(validateDnd5eCombatSimulationRequest(request)).toEqual([])
    const result = simulateDnd5eCombats(request)
    expect(result.participantSummaries.some((entry) => entry.name === workshopMonster.name)).toBe(true)
    expect(result.actionUsage.some((entry) => entry.actorName === workshopMonster.name)).toBe(true)
  })

  it('runs automatic-damage monster spells through committed Headless transactions', () => {
    const mage = getDnd5eSrdMonster('srd-5.1:mage')
    expect(mage).toBeDefined()
    const missileMage = {
      ...mage!,
      id: 'dm-custom:missile-mage',
      slug: 'missile-mage',
      name: '飞弹法师',
      englishName: 'Missile Mage',
      source: 'DM 自定义',
      actions: [],
      spellcasting: {
        ...mage!.spellcasting!,
        slots: { 1: 1 },
        spells: mage!.spellcasting!.spells!.filter((spell) => spell.id === 'magic-missile'),
      },
    } as const
    const result = simulateDnd5eCombats({
      characters: [fighter()],
      monsters: [{ monsterId: missileMage.id, count: 1 }],
      customMonsters: [missileMage],
      trials: 20,
      seed: 314,
      initialDistanceFeet: 60,
    })
    expect(result.actionUsage).toContainEqual(expect.objectContaining({
      actorName: missileMage.name,
      actionId: 'spell:magic-missile:1',
      headlessTransactions: expect.any(Number),
    }))
    expect(result.actionUsage.find((entry) => entry.actionId === 'spell:magic-missile:1')
      ?.headlessTransactions).toBeGreaterThan(0)
  })
})

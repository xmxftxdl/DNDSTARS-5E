import { describe, expect, it } from 'vitest'
import {
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterMechanicDraft,
  createDnd5eCustomMonsterTraitDraft,
} from './customMonsterWorkshop'
import {
  analyzeDnd5eMonsterDraftContent,
  normalizeDnd5eMonsterDraftContent,
} from './monsterContentDeepAnalysis'

describe('怪物内容深度分析', () => {
  it('自动修复 AI 生成的中文动作 ID，并同步动作引用', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions = [{
      ...draft.actions[0],
      id: 'attack-呼唤伊利法军',
      name: '呼唤伊利法军',
      kind: 'summon',
      summonMonsterId: 'srd-5.1:wolf',
    }, {
      ...draft.actions[0],
      id: 'follow-up',
      name: '后续动作',
      referencedActionId: 'attack-呼唤伊利法军',
    }]
    draft.equipment = [{
      id: 'focus',
      name: '法器',
      category: 'gear',
      quantity: 1,
      description: '',
      linkedActionId: 'attack-呼唤伊利法军',
    }]

    const normalized = normalizeDnd5eMonsterDraftContent(draft)
    const repairedId = normalized.draft.actions[0].id
    expect(repairedId).toMatch(/^action-[a-z0-9-]+$/)
    expect(normalized.report.repairedActionIds).toHaveLength(1)
    expect(normalized.draft.actions[1].referencedActionId).toBe(repairedId)
    expect(normalized.draft.equipment[0].linkedActionId).toBe(repairedId)
  })

  it('把施法段落移出普通特性并保留无法识别的法术引用', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions = []
    draft.traits = [
      { ...createDnd5eCustomMonsterTraitDraft(), name: '施法', description: '作为一个2级施法者，其施法主属性为魅力。' },
      { ...createDnd5eCustomMonsterTraitDraft(), name: '戏法', description: '火焰箭，鸣雷破' },
      { ...createDnd5eCustomMonsterTraitDraft(), name: '一环（3法术位）', description: '命令术，混乱箭' },
    ]

    const normalized = normalizeDnd5eMonsterDraftContent(draft)
    expect(normalized.report.absorbedSpellTraits).toEqual(['施法', '戏法', '一环（3法术位）'])
    expect(normalized.draft.traits).toEqual([])
    expect(normalized.draft.spellcastingEnabled).toBe(true)
    expect(normalized.draft.spellSlots).toMatchObject({ '1': 3 })
    expect(normalized.draft.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fire-bolt', level: 0 }),
      expect.objectContaining({ id: 'command', level: 1 }),
      expect.objectContaining({ name: '鸣雷破', level: 0 }),
      expect.objectContaining({ name: '混乱箭', level: 1 }),
    ]))
    expect(normalized.report.unresolvedSpells.map((spell) => spell.name)).toEqual(['鸣雷破', '混乱箭'])
    expect(normalized.draft.spellcastingAutomation).toBe('dm-adjudication')
  })

  it('报告缺失的随机延迟召唤目标，而不伪装为完全自动化', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions = [{
      ...draft.actions[0],
      id: 'call-ilifa-army',
      name: '呼唤伊利法军',
      kind: 'other',
      automation: 'dm-adjudication',
      description: '使用动作祈唤（期间视为专注），在下一个其回合开始时，1d3个伊利法军兵就会出现在战场上。',
    }]

    const analysis = analyzeDnd5eMonsterDraftContent(draft)
    expect(analysis.summonReferences).toEqual([expect.objectContaining({
      sourceId: 'call-ilifa-army',
      monsterName: '伊利法军兵',
      countExpression: '1d3',
      resolvedMonsterId: undefined,
      reasons: expect.arrayContaining([
        '目标怪物尚未加入当前目录',
        '请将动作类型设为“召唤”，由 Host 预掷随机数量',
        '效果延迟到下回合开始',
        '动作包含非标准专注过程',
      ]),
    })])
  })

  it('把误建成动作的法术层级归入施法，并移除被动机制的伪范围动作副本', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'last-stand',
      name: '不退斗志',
      trigger: 'after-damaged',
      hpBelow: 10,
      effectKind: 'damage',
      healingDice: '1d6',
    }]
    draft.actions = [
      {
        ...draft.actions[0],
        id: 'bogus-last-stand',
        name: '不退斗志',
        kind: 'area-saving-throw',
        description: '当他的血量低于10时，其造成的所有伤害获得额外1d6的加值。',
      },
      {
        ...draft.actions[0],
        id: 'bogus-first-level-spells',
        name: '一环（3法术位，目前只剩2）',
        kind: 'area-saving-throw',
        description: '命令术，法师护甲，混乱箭',
      },
    ]

    const normalized = normalizeDnd5eMonsterDraftContent(draft)
    expect(normalized.draft.actions).toEqual([])
    expect(normalized.report.absorbedSpellActions).toEqual(['一环（3法术位，目前只剩2）'])
    expect(normalized.report.removedMechanicActionDuplicates).toEqual(['不退斗志'])
    expect(normalized.draft.spellSlots).toMatchObject({ '1': 3 })
    expect(normalized.draft.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'command', level: 1 }),
      expect.objectContaining({ name: '混乱箭', level: 1 }),
    ]))
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DmAdjudicationPanel, {
  type SharedDmAdjudicationPromptView,
} from './DmAdjudicationPanel'
import {
  initialPersistentAreaAdjudicationEffects,
  initialSpellAdjudicationEffects,
  projectPersistentAreaAdjudicationEffectsForSaveOverride,
} from './persistentAreaAdjudicationDraft'

type Props = Parameters<typeof DmAdjudicationPanel>[0]

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    isDm: true,
    prompt: null,
    tokens: [],
    pluginAreas: [],
    dc: '',
    setDc: vi.fn(),
    mapOverride: 'roll',
    setMapOverride: vi.fn(),
    saveOverride: 'unchanged',
    setSaveOverride: vi.fn(),
    effects: [],
    setEffects: vi.fn(),
    concentrationRounds: '',
    setConcentrationRounds: vi.fn(),
    note: '',
    setNote: vi.fn(),
    onDecision: vi.fn(),
    ...overrides,
  }
  return renderToStaticMarkup(createElement(DmAdjudicationPanel, props))
}

describe('DM 裁定面板', () => {
  it('does not invent a zero-damage effect for a save-only persistent-area trigger', () => {
    expect(initialPersistentAreaAdjudicationEffects({
      id: 'sleet-concentration',
      targetTokenId: 'wizard-token',
    })).toEqual([])
    expect(initialPersistentAreaAdjudicationEffects({
      id: 'sleet-prone',
      targetTokenId: 'wizard-token',
      proposedCondition: 'prone',
    })).toMatchObject([{
      targetTokenId: 'wizard-token', operation: '', amount: '', addCondition: 'prone',
    }])
    expect(initialPersistentAreaAdjudicationEffects({
      id: 'wall-fire',
      targetTokenId: 'wizard-token',
      proposedDamage: 0,
      proposedDamageType: 'fire',
    })).toMatchObject([{
      targetTokenId: 'wizard-token', operation: 'damage', amount: '0', damageType: 'fire', addCondition: '',
    }])
  })

  it('reprojects untouched persistent-area damage when the DM overrides the save result', () => {
    const effects = initialPersistentAreaAdjudicationEffects({
      id: 'wind-wall',
      targetTokenId: 'worm-token',
      proposedDamage: 14,
      proposedDamageType: 'bludgeoning',
    })

    expect(projectPersistentAreaAdjudicationEffectsForSaveOverride({
      effects,
      targetTokenId: 'worm-token',
      currentSaveOverride: 'unchanged',
      nextSaveOverride: 'success',
      proposedDamage: 14,
      proposedDamageOnSaveSuccess: 7,
      proposedDamageOnSaveFailure: 14,
    })[0]?.amount).toBe('7')

    expect(projectPersistentAreaAdjudicationEffectsForSaveOverride({
      effects: [{ ...effects[0]!, amount: '13' }],
      targetTokenId: 'worm-token',
      currentSaveOverride: 'unchanged',
      nextSaveOverride: 'success',
      proposedDamage: 14,
      proposedDamageOnSaveSuccess: 7,
      proposedDamageOnSaveFailure: 14,
    })[0]?.amount).toBe('13')
  })

  it('prefills Etherealness with its authoritative self effect and eight-hour duration', () => {
    expect(initialSpellAdjudicationEffects({
      id: 'etherealness-effect',
      spellId: 'etherealness',
      casterTokenId: 'wizard-token',
    })).toMatchObject([{
      targetTokenId: 'wizard-token',
      operation: '',
      addCondition: '以太化',
      conditionDurationRounds: '4800',
      conditionDurationTickOn: 'target-turn-end',
    }])
    expect(initialSpellAdjudicationEffects({
      id: 'ordinary-effect',
      spellId: 'teleport',
      casterTokenId: 'wizard-token',
    })).toEqual([])
    expect(initialSpellAdjudicationEffects({
      id: 'etherealness-activity-boundary',
      spellId: 'etherealness',
      casterTokenId: 'wizard-token',
      contextKind: 'activity-boundary',
    })).toEqual([])
  })

  it('玩家端或没有待裁定事务时不显示', () => {
    expect(render()).toBe('')
    expect(render({ isDm: false })).toBe('')
  })

  it('keeps the adjudication footer above the initiative rail for real pointer input', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'persistent-area-layering',
      payload: {
        contextKind: 'persistent-area-trigger', actionId: 'sleet-trigger', casterName: '法师 → 强盗',
        spellId: 'sleet-storm', spellName: '雪雨暴·回合开始', spellLevel: 0, slotLevel: 0,
        castingTime: 'action', description: '区域触发。', concentration: false,
      },
    }
    expect(render({ prompt })).toContain('z-[180]')
  })

  it('地图交互显示权威事务说明、DC 与结果覆盖', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'adjudication',
      payload: {
        contextKind: 'map-interaction', actionId: 'action', casterName: '战士',
        spellId: 'map-door', spellName: '力量破门', spellLevel: 0, slotLevel: 0,
        castingTime: 'action', description: '尝试撞开上锁的门。', concentration: false,
        proposedDc: 15,
      },
    }
    const html = render({ prompt, dc: '15' })
    expect(html).toContain('地图交互中断 · 力量破门')
    expect(html).toContain('DM 权威地图事务')
    expect(html).toContain('裁定 DC')
    expect(html).toContain('按 Headless 骰值结算')
    expect(html).toContain('拒绝交互')
    expect(html).toContain('aria-label="最小化 DM 裁定"')
  })

  it('其他行动明确显示资源已经消耗且裁定不会返还', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'basic-action-adjudication',
      payload: {
        contextKind: 'basic-action', actionId: 'action', casterName: '游荡者',
        spellId: 'basic-action:other-bonus-action', spellName: '其他（附赠动作）',
        spellLevel: 0, slotLevel: 0, castingTime: 'bonus-action',
        description: '快速割断吊灯绳索。', concentration: false,
      },
    }
    const html = render({ prompt })
    expect(html).toContain('其他行动裁定 · 其他（附赠动作）')
    expect(html).toContain('已经消耗附赠动作')
    expect(html).toContain('驳回裁定（不返还）')
    expect(html).toContain('确认裁定')
    expect(html).not.toContain('添加目标效果')
  })

  it('法术裁定明确说明自动消费施法行动资源与法术位', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'spell-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'cast', casterName: '法师',
        spellId: 'shatter', spellName: '粉碎音波', spellLevel: 2, slotLevel: 3,
        castingTime: 'action', description: '规则存在未自动化边界。', concentration: false,
      },
    }

    const html = render({
      prompt,
      effects: [{
        id: 'effect', targetTokenId: 'caster', operation: '', amount: '', addCondition: '易容术',
        conditionDurationRounds: '600', conditionDurationTickOn: 'target-turn-end', removeCondition: '',
      }],
    })
    expect(html).toContain('批准后：消费动作与 3 环位')
    expect(html).toContain('该法术不会进入完整 Headless 效果推导')
    expect(html).toContain('Host 已校验 V/S/M 与特殊材料')
    expect(html).toContain('状态持续轮数（可选）')
    expect(html).toContain('1 小时 = 600 轮')
    expect(html).toContain('目标回合结束')
  })

  it('专注法术明确提示留空的状态持续时间会跟随专注', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'concentration-spell-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'cast', casterName: '法师',
        spellId: 'alter-self', spellName: '变身术', spellLevel: 2, slotLevel: 2,
        castingTime: 'action', description: '选择一种形态。', concentration: true,
      },
    }

    const html = render({
      prompt,
      concentrationRounds: '600',
      effects: [{
        id: 'effect', targetTokenId: 'caster', operation: '', amount: '', addCondition: '变身术·水生适应',
        conditionDurationRounds: '', conditionDurationTickOn: 'target-turn-end', removeCondition: '',
      }],
    })
    expect(html).toContain('placeholder="留空则跟随本次专注"')
    expect(html).toContain('留空时状态会随本次专注结束；填写轮数则建立独立计时。')
  })

  it('短讯术显示玩家声明、25 词边界和 DM 位面送达裁定，不允许添加伤害效果', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'sending-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'sending-cast', casterName: '法师',
        spellId: 'sending', spellName: '短讯术', spellLevel: 3, slotLevel: 6,
        castingTime: 'action', description: '距离不限；跨位面有 5% 几率失败。', concentration: false,
        sending: {
          schemaVersion: 1,
          recipientName: '银月城档案员伊蕾娜',
          message: '月门安全，立即回报。',
        },
      },
    }
    const html = render({ prompt })
    expect(html).toContain('短讯术声明')
    expect(html).toContain('熟悉的生物：银月城档案员伊蕾娜')
    expect(html).toContain('月门安全，立即回报。')
    expect(html).toContain('目标智力')
    expect(html).toContain('不同位面（5% 失败）')
    expect(html).toContain('目标即时回应（可选，最多 25 词）')
    expect(html).not.toContain('＋ 添加目标效果')
  })

  it('伤害效果可声明类型并说明由 Host 应用伤害防御', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'typed-damage',
      payload: {
        contextKind: 'spell', actionId: 'cast', casterName: '法师',
        spellId: 'prismatic-spray', spellName: '虹光喷射', spellLevel: 7, slotLevel: 8,
        castingTime: 'action', description: '黄色光造成闪电伤害。', concentration: false,
      },
    }
    const html = render({
      prompt,
      effects: [{
        id: 'effect', targetTokenId: 'air', operation: 'damage', amount: '34',
        damageType: 'lightning', addCondition: '', conditionDurationRounds: '',
        conditionDurationTickOn: 'target-turn-end', removeCondition: '',
      }],
    })
    expect(html).toContain('抗性前伤害')
    expect(html).toContain('伤害类型')
    expect(html).toContain('闪电')
    expect(html).toContain('Host 会自动应用免疫、抗性与易伤')
  })

  it('探索中的戏法裁定明确不消费战斗行动资源或环位', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'exploration-cantrip-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'cast', casterName: '法师',
        spellId: 'prestidigitation', spellName: '魔法伎俩', spellLevel: 0, slotLevel: 0,
        castingTime: 'action', exploration: true,
        description: '创造一个小型魔法效果。', concentration: false,
      },
    }

    const html = render({ prompt })
    expect(html).toContain('批准后：探索施法，不消费战斗行动资源或环位')
    expect(html).toContain('探索施法不消费战斗行动资源')
  })

  it('植物交谈提供可提交的权威植物地形调整', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'speak-with-plants-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'cast', casterName: '德鲁伊',
        spellId: 'speak-with-plants', spellName: '植物交谈', spellLevel: 3, slotLevel: 4,
        castingTime: 'action', exploration: true, description: '改变植物地形。', concentration: false,
      },
    }
    const html = render({
      prompt,
      pluginAreas: [{
        id: 'entangle-area', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:entangle',
        sourceKind: 'core-spell', coreSpellId: 'entangle', label: '纠缠术', color: '#4d7c0f',
        sourceCharacterId: 'druid', sourceTokenId: 'druid-token', cells: [{ col: 1, row: 1 }],
        createdRound: 1, expiresAfterRound: 11, movementCostMultiplier: 2,
      }],
    })
    expect(html).toContain('植物地形结算（可选）')
    expect(html).toContain('Host 会实际更新地图移动成本')
    expect(html).toContain('纠缠术（1 格）')
    expect(html).toContain('变为普通地形')
    expect(html).toContain('变为困难地形')
  })

  it('仪式施法明确显示长时施法且不消费行动或法术位', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'ritual-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'ritual', casterName: '法师',
        spellId: 'comprehend-languages', spellName: '通晓语言', spellLevel: 1, slotLevel: 1,
        castingTime: 'long', ritual: true, description: '持续 1 小时。', concentration: false,
      },
    }

    const html = render({ prompt })
    expect(html).toContain('1环，仪式施法（原施法时间 +10 分钟） · 长时施法')
    expect(html).toContain('批准后：完成长时仪式，不消费行动资源或法术位')
    expect(html).toContain('Host 已验证法术与职业的仪式资格')
    expect(html).toContain('请确认原施法时间加 10 分钟的过程与成分')
  })

  it('已审计仪式不允许 DM 重复填写效果并明确执行普通 Headless 语义', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'automated-ritual',
      payload: {
        contextKind: 'spell', actionId: 'ritual', casterName: '法师',
        spellId: 'comprehend-languages', spellName: '通晓语言', spellLevel: 1, slotLevel: 1,
        castingTime: 'long', ritual: true, automatedRitual: true,
        description: '持续 1 小时。', concentration: false,
      },
    }

    const html = render({ prompt })
    expect(html).toContain('执行与普通施法完全相同的已审计 Headless 效果')
    expect(html).toContain('确认仪式完成并执行 Headless 效果')
    expect(html).not.toContain('＋ 添加目标效果')
  })

  it('Activity 边界只读展示自动专注且不允许 DM 重复填写效果', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'activity-boundary',
      payload: {
        contextKind: 'activity-boundary', actionId: 'silent-image', casterName: '法师',
        spellId: 'silent-image', spellName: '无声幻影', spellLevel: 1, slotLevel: 3,
        castingTime: 'action', description: 'Host 已准备 15 尺立方区域。', concentration: true,
        suggestedConcentrationRounds: 100,
      },
    }

    const html = render({ prompt, concentrationRounds: '100' })
    expect(html).toContain('Activity 边界确认 · 无声幻影')
    expect(html).toContain('安全子集会由 Activity 建立 100 轮专注')
    expect(html).not.toContain('专注持续轮数')
    expect(html).not.toContain('＋ 添加目标效果')
  })

  it('未自动化的随机表结果显示暂停状态和恢复操作', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'random-table-adjudication',
      payload: {
        contextKind: 'post-spell-random-table',
        actionId: 'random-table-action',
        casterName: '术士',
        spellId: 'fixture.table-check',
        spellName: '施法后随机表结果 50',
        spellLevel: 0,
        slotLevel: 0,
        castingTime: 'action',
        description: '当前结果需要 DM 裁定。',
        concentration: false,
        randomTableRoll: 50,
        sourceSpellId: 'magic-missile',
      },
    }

    const html = render({ prompt })
    expect(html).toContain('随机表结果裁定 · 施法后随机表结果 50')
    expect(html).toContain('d100 结果 50 · 原始法术 magic-missile')
    expect(html).toContain('战斗结算已暂停')
    expect(html).toContain('跳过该随机表结果')
    expect(html).toContain('提交裁定并继续')
    expect(html).not.toContain('取消施法（不消费）')
  })

  it('传奇动作裁定也提供相同的最小化入口', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'legendary-adjudication',
      payload: {
        contextKind: 'monster-legendary-action',
        actionId: 'teleport',
        casterName: '斯芬克斯',
        spellId: 'legendary:teleport',
        spellName: '传送',
        spellLevel: 0,
        slotLevel: 0,
        castingTime: 'action',
        description: '由 DM 选择传送落点。',
        concentration: false,
        legendaryActionCost: 1,
        legendaryActionPointsBefore: 3,
      },
    }

    const html = render({ prompt })
    expect(html).toContain('传奇动作裁定 · 传送')
    expect(html).toContain('aria-label="最小化 DM 裁定"')
    expect(html).toContain('批准后扣除 1 点')
  })

  it('普通怪物动作在确认前明确不消费动作或次数', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'monster-action-adjudication',
      payload: {
        contextKind: 'monster-action',
        actionId: 'teleport',
        casterName: '闪现犬',
        spellId: 'monster-action:teleport',
        spellName: '传送',
        spellLevel: 0,
        slotLevel: 0,
        castingTime: 'action',
        description: '传送到可见位置。',
        concentration: false,
      },
    }

    const html = render({ prompt })
    expect(html).toContain('怪物动作裁定 · 传送')
    expect(html).toContain('批准后扣除动作与能力次数')
    expect(html).toContain('取消（不消费资源）')
    expect(html).toContain('确认裁定并消费资源')
  })

  it('非 Headless 怪物法术说明会原子扣除行动与法术位', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'monster-spell-adjudication',
      payload: {
        contextKind: 'monster-spell',
        actionId: 'legend-lore',
        casterName: '雌性斯芬克斯',
        spellId: 'legend-lore',
        spellName: '传奇知识',
        spellLevel: 5,
        slotLevel: 5,
        castingTime: 'action',
        description: '由 DM 回答。',
        concentration: false,
      },
    }

    const html = render({ prompt })
    expect(html).toContain('怪物法术裁定 · 传奇知识')
    expect(html).toContain('批准后扣除动作与 5 环位')
    expect(html).toContain('取消或提交失败均不消费')
  })

  it('造物术以只读卡展示材质、持续时间、升环尺寸与无伤害语义', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'creation-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'cast-creation', casterName: '法师',
        spellId: 'creation', spellName: '造物术', spellLevel: 5, slotLevel: 9,
        castingTime: 'long', exploration: true, elapsedCastingMinutes: 1,
        description: '造物术规则。', concentration: false,
        creation: {
          schemaVersion: 1, objectDescription: '宝石镶嵌木箱',
          materials: ['plant', 'gemstone'], edgeFeet: 25,
          targetCell: { col: 4, row: 6 },
        },
      },
    }
    const html = render({ prompt })
    expect(html).toContain('造物术：生成临时地图物件')
    expect(html).toContain('植物材料、宝石')
    expect(html).toContain('持续：10 分钟')
    expect(html).toContain('9 环上限 25 尺')
    expect(html).toContain('地图格（4, 6）')
    expect(html).toContain('造物术不造成伤害')
    expect(html).not.toContain('＋ 添加目标效果')
  })

  it('造水／枯水术以只读卡展示容器水量、升环上限与无伤害语义', () => {
    const prompt: SharedDmAdjudicationPromptView = {
      id: 'create-water-adjudication',
      payload: {
        contextKind: 'spell', actionId: 'cast-water', casterName: '牧师',
        spellId: 'create-or-destroy-water', spellName: '造水/枯水术', spellLevel: 1, slotLevel: 3,
        castingTime: 'action', exploration: true,
        description: '造水／枯水术规则。', concentration: false,
        createOrDestroyWater: {
          schemaVersion: 1, mode: 'create-container', targetCell: { col: 3, row: 4 },
          targetObjectId: 'cistern', targetObjectName: '敞口蓄水池', gallons: 30,
        },
      },
    }
    const html = render({ prompt })
    expect(html).toContain('造水／枯水术：造水：敞开容器')
    expect(html).toContain('敞口蓄水池')
    expect(html).toContain('水量：30 加仑')
    expect(html).toContain('3 环上限 30 加仑')
    expect(html).toContain('容器敞开、30 尺射程、容量与当前水量')
    expect(html).toContain('本法术不造成伤害')
    expect(html).not.toContain('＋ 添加目标效果')
  })
})

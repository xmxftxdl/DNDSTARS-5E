import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  createD20ChoiceRerollContribution,
  createD20RollConfirmationInterrupt,
  d20RollConfirmationTimeoutContribution,
} from '../../lib/rollConfirmation'
import D20RollConfirmationOverlay from './D20RollConfirmationOverlay'

const handlers = { onContribute: vi.fn(), onContinue: vi.fn() }

describe('投骰修正侧栏', () => {
  const interrupt = createD20RollConfirmationInterrupt({
    mapId: 'map', rollId: 'roll', label: '攻击检定', targetName: '巨魔', originalValue: 8,
    eligibleModifiers: [{
      characterId: 'hero', featureId: 'fortune', featureLabel: '命运改写',
      modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: 2,
      selectionPolicy: 'owner-chooses', resourceCosts: [{ resourceKey: 'fortune', amount: 1 }],
    }],
  })

  it('只在玩家端渲染左侧非模态侧栏，并只显示具体特性和十秒读条', () => {
    const html = renderToStaticMarkup(createElement(D20RollConfirmationOverlay, {
      interrupt, isDM: false, playerCharacter: { id: 'hero', name: '英雄' }, ...handlers,
    }))
    expect(html).toContain('data-layout="left-drawer"')
    expect(html).toContain('pointer-events-none')
    expect(html).not.toContain('aria-modal')
    expect(html).toContain('data-testid="d20-countdown"')
    expect(html).toContain('未选择将自动跳过')
    expect(html).toContain('命运改写')
    expect(html).toContain('额外投掷 2 枚 d20')
    expect(html).not.toContain('3 个结果中采用')
    expect(html).toContain('data-testid="d20-roll-decline"')
  })

  it('公开玩家修正不会在 DM 端出现复核窗口', () => {
    expect(renderToStaticMarkup(createElement(D20RollConfirmationOverlay, {
      interrupt, isDM: true, ...handlers,
    }))).toBe('')
  })

  it('把激励、幸运和预言骰作为能力选项，并按机制显示不同提示', () => {
    const choices = createD20RollConfirmationInterrupt({
      mapId: 'map', rollId: 'feature-kinds', label: '豁免检定', originalValue: 9,
      eligibleModifiers: [
        { characterId: 'hero', featureId: 'bardic', featureLabel: '诗人激励', modifierKind: 'adjust-d20', dieSides: 8, direction: 'add' },
        { characterId: 'hero', featureId: 'lucky', featureLabel: '幸运', modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: 1 },
        { characterId: 'hero', featureId: 'portent', featureLabel: '预言骰' },
      ],
    })
    const html = renderToStaticMarkup(createElement(D20RollConfirmationOverlay, {
      interrupt: choices, isDM: false, playerCharacter: { id: 'hero', name: '英雄' }, ...handlers,
    }))
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html).toContain('诗人激励')
    expect(html).toContain('投掷 d8，加入本次结果')
    expect(html).toContain('幸运')
    expect(html).toContain('额外投掷 1 枚 d20')
    expect(html).toContain('预言骰')
    expect(html).toContain('使用该特性保存的结果替换本次 d20')
  })

  it('Host 掷骰后在同一侧栏显示二选一或三选一结果', () => {
    const contribution = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '英雄',
      featureId: 'fortune', featureLabel: '命运改写', decision: 'use',
    })
    const offered = {
      ...interrupt,
      contributions: [contribution],
      payload: { ...interrupt.payload, rollOptions: { contributionId: contribution.id, values: [8, 12, 19] } },
    }
    const html = renderToStaticMarkup(createElement(D20RollConfirmationOverlay, {
      interrupt: offered, isDM: false, playerCharacter: { id: 'hero', name: '英雄' }, ...handlers,
    }))
    expect(html).toContain('data-testid="d20-result-options"')
    expect(html.match(/data-testid="d20-result-option-/g)).toHaveLength(3)
    expect(html).toContain('原始结果')
    expect(html).toContain('新骰 2')
  })

  it('强制采用新骰属于内部策略，不作为玩家选项显示', () => {
    const forced = createD20RollConfirmationInterrupt({
      mapId: 'map', rollId: 'forced', label: '强制重掷', originalValue: 20,
      eligibleModifiers: [{
        characterId: 'hero', featureId: 'forced', featureLabel: '强制重掷',
        modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: 1,
        selectionPolicy: 'must-use-latest', resourceCosts: [{ resourceKey: 'forced', amount: 1 }],
      }],
    })
    const html = renderToStaticMarkup(createElement(D20RollConfirmationOverlay, {
      interrupt: forced, isDM: false, playerCharacter: { id: 'hero', name: '英雄' }, ...handlers,
    }))
    expect(html).toContain('强制重掷')
    expect(html).toContain('额外投掷 1 枚 d20')
    expect(html).not.toContain('必须采用最后一枚结果')
  })

  it('已提交重掷后超时不会被改写成不使用', () => {
    const contribution = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '英雄',
      featureId: 'inspiration', featureLabel: '激励', decision: 'use',
    })
    expect(d20RollConfirmationTimeoutContribution({
      contribution, rollOptions: [8, 16], selectionPolicy: 'highest', hasEligibleFeature: true,
    })).toBeUndefined()
    expect(d20RollConfirmationTimeoutContribution({
      contribution, rollOptions: [8, 16], selectionPolicy: 'owner-chooses', hasEligibleFeature: true,
    })).toEqual({
      featureId: 'inspiration', featureLabel: '激励', choiceDecision: 'use', selectedIndex: 0,
    })
    expect(d20RollConfirmationTimeoutContribution({
      hasEligibleFeature: true,
    })).toEqual({ featureId: '', featureLabel: '', decline: true })
  })

  it('Host 正在结算第二颗 d20 时锁定按钮且不再运行玩家倒计时', () => {
    const contribution = createD20ChoiceRerollContribution({
      interruptId: interrupt.id, characterId: 'hero', characterName: '英雄',
      featureId: 'fortune', featureLabel: '命运改写', decision: 'use',
    })
    const rolling = { ...interrupt, status: 'rolling' as const, contributions: [contribution] }
    const html = renderToStaticMarkup(createElement(D20RollConfirmationOverlay, {
      interrupt: rolling, isDM: false, playerCharacter: { id: 'hero', name: '英雄' }, ...handlers,
    }))

    expect(html).toContain('第二颗 d20 已提交，正在结算…')
    expect(html).toContain('结算中…')
    expect(html).not.toContain('data-testid="d20-countdown"')
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

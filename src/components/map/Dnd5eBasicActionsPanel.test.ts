import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Dnd5eBasicActionsPanel, { dnd5eControlledUndeadCommandTargets } from './Dnd5eBasicActionsPanel'
import { dnd5eBasicActionEconomyAvailable } from './dnd5eBasicActionEconomy'

describe('Dnd5eBasicActionsPanel', () => {
  it('keeps other bonus actions available after the ordinary action is spent', () => {
    expect(dnd5eBasicActionEconomyAvailable({
      kind: 'other-bonus-action',
      actionAvailable: false,
      bonusActionAvailable: true,
    })).toBe(true)
    expect(dnd5eBasicActionEconomyAvailable({
      kind: 'other-action',
      actionAvailable: false,
      bonusActionAvailable: true,
    })).toBe(false)
    expect(dnd5eBasicActionEconomyAvailable({
      kind: 'command-animate-dead',
      actionAvailable: false,
      bonusActionAvailable: true,
    })).toBe(true)
  })

  it('surfaces a direct fixed-DC escape control for the authoritative grappler', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets: [
        { tokenId: 'ankheg', label: '掘穴虫', opposed: true, currentHp: 39, distanceFeet: 10 },
        { tokenId: 'goblin', label: '地精', opposed: true, currentHp: 7, distanceFeet: 5 },
      ],
      grappleEscapes: [{ grapplerTokenId: 'ankheg', dc: 13 }],
      onAction: vi.fn(),
    }))

    expect(html).toContain('data-testid="grapple-escape-controls"')
    expect(html).toContain('挣脱 掘穴虫 的擒抱（DC 13）')
    expect(html).not.toContain('挣脱 地精 的擒抱')
  })

  it('removes duplicated hotbar actions and exposes both DM-adjudicated economy options', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets: [],
      onAction: vi.fn(),
    }))

    expect(html).not.toContain('<option value="dash">')
    expect(html).not.toContain('<option value="hide">')
    expect(html).toContain('<option value="other-action">其他（动作）</option>')
    expect(html).toContain('<option value="other-bonus-action">其他（附赠动作）</option>')
    expect(html).toContain('疾走与躲藏使用底部快捷栏')
  })

  it('exposes the source-side Warding Bond dismissal only while a linked bond exists', () => {
    const withoutBond = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets: [],
      onAction: vi.fn(),
    }))
    const withBond = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets: [],
      canDismissWardingBond: true,
      onAction: vi.fn(),
    }))

    expect(withoutBond).not.toContain('<option value="dismiss-warding-bond">')
    expect(withBond).toContain('<option value="dismiss-warding-bond">解除守护之链</option>')
  })

  it('uses 60 feet for Animate Dead and 120 feet for Create Undead command targets', () => {
    const targets = [
      { tokenId: 'near', label: '受控骷髅', opposed: false, currentHp: 13, distanceFeet: 60, animateDeadControlled: true },
      { tokenId: 'far', label: '过远僵尸', opposed: false, currentHp: 22, distanceFeet: 65, animateDeadControlled: true },
      { tokenId: 'create-near', label: '受控食尸鬼', opposed: false, currentHp: 22, distanceFeet: 120, animateDeadControlled: true, controlledUndeadCommandRangeFeet: 120 as const },
      { tokenId: 'create-far', label: '过远尸妖', opposed: false, currentHp: 45, distanceFeet: 125, animateDeadControlled: true, controlledUndeadCommandRangeFeet: 120 as const },
      { tokenId: 'ended', label: '失控僵尸', opposed: false, currentHp: 22, distanceFeet: 10 },
    ]
    const html = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets,
      onAction: vi.fn(),
    }))

    expect(html).toContain('<option value="command-animate-dead">操纵死尸：心灵命令</option>')
    expect(dnd5eControlledUndeadCommandTargets(targets).map((target) => target.tokenId))
      .toEqual(['near', 'create-near'])
  })

  it('disables ordinary panel actions when a form allows only an explicit action whitelist', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eBasicActionsPanel, {
      canAct: true,
      pending: false,
      targets: [],
      allowedBasicActions: ['dash'],
      onAction: vi.fn(),
    }))

    expect(html).toContain('data-testid="basic-action-restriction-notice"')
    expect(html).toContain('当前形态只允许规则明确列出的动作')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*执行动作/s)
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Dnd5eWeaponAttackConfirmationPanel, {
  type Dnd5eWeaponAttackConfirmation,
} from './Dnd5eWeaponAttackConfirmationPanel'

const confirmation: Dnd5eWeaponAttackConfirmation = {
  actorCharacterId: 'actor-char', actorTokenId: 'actor', actorName: '战士',
  targetTokenId: 'target', targetName: '地精', weaponName: '长剑',
  automaticCover: 'half', automaticArmorClass: 17, baseArmorClass: 15,
  sourceLabel: '翻倒的桌子', selectedCover: 'auto',
}

function panel(overrides: Partial<Parameters<typeof Dnd5eWeaponAttackConfirmationPanel>[0]> = {}) {
  return createElement(Dnd5eWeaponAttackConfirmationPanel, {
    confirmation,
    previewCover: 'half',
    previewArmorClass: 17,
    isDm: true,
    onDismiss: vi.fn(),
    onCoverChange: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  })
}

describe('攻击前掩护面板', () => {
  it('向 DM 显示自动来源、目标 AC 与单次覆盖选项', () => {
    const html = renderToStaticMarkup(panel())
    expect(html).toContain('来源：翻倒的桌子')
    expect(html).toContain('本次攻击目标 AC')
    expect(html).toContain('>17<')
    expect(html).toContain('DM 本次攻击覆盖')
  })

  it('全身掩护在玩家端保留请求 DM 裁定入口', () => {
    const html = renderToStaticMarkup(panel({
      confirmation: { ...confirmation, automaticCover: 'total' },
      previewCover: 'total',
      previewArmorClass: 15,
      isDm: false,
    }))
    expect(html).toContain('无法攻击')
    expect(html).toContain('请求 DM 裁定')
    expect(html).not.toContain('DM 本次攻击覆盖')
  })
})

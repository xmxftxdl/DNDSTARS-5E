import { describe, expect, it } from 'vitest'
import { dnd5eWizardSpellPreparationDisabled } from './dnd5eSpellbookPanelRules'

describe('法师法术书选择', () => {
  it('允许直接学习戏法，不要求先把戏法写入法术书', () => {
    expect(dnd5eWizardSpellPreparationDisabled(0, false)).toBe(false)
  })

  it('只有一环及以上法术需要先加入法术书才能准备', () => {
    expect(dnd5eWizardSpellPreparationDisabled(1, false)).toBe(true)
    expect(dnd5eWizardSpellPreparationDisabled(1, true)).toBe(false)
  })
})

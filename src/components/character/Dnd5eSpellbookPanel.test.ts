import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  dnd5eAdvancementWizardSpellbookIds,
  dnd5eSpellbookEditLocks,
  dnd5eWizardSpellPreparationDisabled,
} from './dnd5eSpellbookPanelRules'

describe('法师法术书选择', () => {
  it('允许直接学习戏法，不要求先把戏法写入法术书', () => {
    expect(dnd5eWizardSpellPreparationDisabled(0, false)).toBe(false)
  })

  it('只有一环及以上法术需要先加入法术书才能准备', () => {
    expect(dnd5eWizardSpellPreparationDisabled(1, false)).toBe(true)
    expect(dnd5eWizardSpellPreparationDisabled(1, true)).toBe(false)
  })

  it('只锁定实际写入法师升级记录的法术', () => {
    const records = [{
      classId: 'wizard',
      decision: {
        spellSelections: {
          wizardSpellbook: ['magic-missile', 'spider-climb'],
        },
      },
    }, {
      classId: 'bard',
      decision: {
        spellSelections: {
          wizardSpellbook: ['web'],
        },
      },
    }] as unknown as Character['dnd5eLevelAdvancements']

    const lockedIds = dnd5eAdvancementWizardSpellbookIds(records, 'wizard')

    expect(lockedIds.has('magic-missile')).toBe(true)
    expect(lockedIds.has('spider-climb')).toBe(true)
    expect(lockedIds.has('web')).toBe(false)
  })

  it('DM 绕过升级记录锁定，但玩家仍受升级选择约束', () => {
    expect(dnd5eSpellbookEditLocks({
      isDM: true,
      cantripChoicesLocked: true,
      spellChoicesLocked: true,
      wizardSpellbookLocked: true,
    })).toEqual({
      cantripChoicesLocked: false,
      spellChoicesLocked: false,
      wizardSpellbookLocked: false,
    })

    expect(dnd5eSpellbookEditLocks({
      isDM: false,
      cantripChoicesLocked: true,
      spellChoicesLocked: true,
      wizardSpellbookLocked: true,
    })).toEqual({
      cantripChoicesLocked: true,
      spellChoicesLocked: true,
      wizardSpellbookLocked: true,
    })
  })
})

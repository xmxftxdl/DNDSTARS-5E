import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  dnd5eEffectiveSpellSelections,
  dnd5eEffectiveSpellcastingSource,
  dnd5ePatchEffectiveSpellSelections,
} from './subclassSpellcasting'
import { dnd5eSelectedSpellIdsForClass } from './spells'

function wizard(): Character {
  return {
    id: 'wizard-spell-persistence',
    rulesetId: 'dnd5e-2014-srd-5.1',
    name: '法术持久化测试法师',
    player: '玩家',
    avatar: '🧙',
    accent: 'from-violet-500 to-sky-500',
    race: '人类',
    charClass: '法师',
    dnd5eClassLevels: { wizard: 5 },
    level: 5,
    background: '学者',
    alignment: '中立善良',
    experience: 6_500,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: ['arcana'],
    maxHp: 32,
    currentHp: 32,
    tempHp: 0,
    hitDice: '5d6',
    ac: 13,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 15,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eClassChoices: {
      classes: {
        wizard: {
          selections: {
            'spell-cantrips': ['fire-bolt'],
            'wizard-spellbook': ['magic-missile', 'fireball'],
            'spell-prepared': ['magic-missile'],
            'unrelated-choice': ['preserve-me'],
          },
        },
      },
    },
  }
}

describe('effective spell selection persistence', () => {
  it('keeps the wizard spellbook and prepared spells in the same class snapshot', () => {
    const character = wizard()
    const source = dnd5eEffectiveSpellcastingSource(character, 'wizard')
    expect(source).toBeDefined()

    const selections = dnd5eEffectiveSpellSelections(character, source!)
    const patch = dnd5ePatchEffectiveSpellSelections(character, source!, {
      ...selections,
      'spell-prepared': ['magic-missile', 'fireball'],
    })
    const saved = { ...character, ...patch }

    expect(saved.dnd5eClassChoices?.classes?.wizard?.selections).toEqual({
      'spell-cantrips': ['fire-bolt'],
      'wizard-spellbook': ['magic-missile', 'fireball'],
      'spell-prepared': ['magic-missile', 'fireball'],
      'unrelated-choice': ['preserve-me'],
    })
    expect(dnd5eSelectedSpellIdsForClass(saved, 'wizard')).toEqual([
      'fire-bolt',
      'magic-missile',
      'fireball',
    ])
  })
})

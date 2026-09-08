import { describe, expect, it } from 'vitest'
import {
  quickCharacterAbilityRows,
  quickCharacterSkillRows,
  quickCreatureFormAbilityRows,
  quickCreatureFormPassivePerception,
  quickCreatureFormSkillRows,
} from './quickCharacterView'

describe('quickCharacterView', () => {
  const character = {
    level: 5,
    abilities: { str: 8, dex: 16, con: 14, int: 12, wis: 10, cha: 18 },
    savingThrows: ['dex', 'cha'],
    skills: ['stealth', 'persuasion'],
    classSelections: { expertise: ['persuasion'] },
  }

  it('计算属性、豁免与熟练加值', () => {
    const rows = quickCharacterAbilityRows(character)
    expect(rows.find((entry) => entry.key === 'dex')).toMatchObject({ score: 16, modifier: 3, savingThrowModifier: 6, saveProficient: true })
    expect(rows.find((entry) => entry.key === 'str')).toMatchObject({ modifier: -1, savingThrowModifier: -1, saveProficient: false })
  })

  it('区分技能熟练和专精', () => {
    const rows = quickCharacterSkillRows(character)
    expect(rows.find((entry) => entry.key === 'stealth')).toMatchObject({ modifier: 6, proficient: true, expertise: false })
    expect(rows.find((entry) => entry.key === 'persuasion')).toMatchObject({ modifier: 10, proficient: true, expertise: true })
  })

  it('形体变化保留心智属性，并逐项采用角色与新形态中更高的豁免和技能加值', () => {
    const level20Wizard = {
      ...character,
      level: 20,
      abilities: { str: 8, dex: 16, con: 18, int: 20, wis: 13, cha: 11 },
      savingThrows: ['int', 'wis'],
      skills: ['arcana', 'insight', 'investigation', 'religion'],
      classSelections: {},
    }
    const adultBlackDragon = {
      abilities: { str: 23, dex: 14, con: 21, int: 14, wis: 13, cha: 17 },
      savingThrows: { dex: 7, con: 10, wis: 6, cha: 8 },
      skills: [{ key: 'perception', bonus: 11 }, { key: 'stealth', bonus: 7 }],
      passivePerception: 21,
    }
    const state = {
      wildShapeMode: 'shapechange' as const,
      wildShapeOriginalAbilities: level20Wizard.abilities,
      wildShapeOriginalSavingThrowBonuses: { str: -1, dex: 3, con: 4, int: 11, wis: 7, cha: 0 },
      wildShapeOriginalSavingThrowProficiencies: ['int', 'wis'] as const,
      wildShapeOriginalSkillProficiencies: level20Wizard.skills,
      wildShapeOriginalPassivePerception: 11,
    }

    const abilities = quickCreatureFormAbilityRows(level20Wizard, adultBlackDragon, state)
    expect(abilities.map(({ key, score, savingThrowModifier }) => ({ key, score, savingThrowModifier }))).toEqual([
      { key: 'str', score: 23, savingThrowModifier: 6 },
      { key: 'dex', score: 14, savingThrowModifier: 7 },
      { key: 'con', score: 21, savingThrowModifier: 10 },
      { key: 'int', score: 20, savingThrowModifier: 11 },
      { key: 'wis', score: 13, savingThrowModifier: 7 },
      { key: 'cha', score: 11, savingThrowModifier: 8 },
    ])
    const skills = quickCreatureFormSkillRows(level20Wizard, adultBlackDragon, state)
    expect(skills.find((entry) => entry.key === 'arcana')).toMatchObject({ modifier: 11, proficient: true })
    expect(skills.find((entry) => entry.key === 'perception')).toMatchObject({ modifier: 11, proficient: true })
    expect(skills.find((entry) => entry.key === 'stealth')).toMatchObject({ modifier: 7, proficient: true })
    expect(quickCreatureFormPassivePerception(11, adultBlackDragon, state)).toBe(21)
  })

  it('变形术仍完全采用目标形态的心智属性与熟练项', () => {
    const form = {
      abilities: { str: 23, dex: 14, con: 21, int: 14, wis: 13, cha: 17 },
      savingThrows: { wis: 6 },
      skills: [{ key: 'perception', bonus: 11 }],
      passivePerception: 21,
    }
    const abilities = quickCreatureFormAbilityRows(character, form, { wildShapeMode: 'polymorph' })
    expect(abilities.find((entry) => entry.key === 'int')).toMatchObject({ score: 14, savingThrowModifier: 2 })
    expect(quickCreatureFormPassivePerception(30, form, { wildShapeMode: 'polymorph' })).toBe(21)
  })
})

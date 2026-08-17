import { describe, expect, it } from 'vitest'
import { quickCharacterAbilityRows, quickCharacterSkillRows } from './quickCharacterView'

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
})

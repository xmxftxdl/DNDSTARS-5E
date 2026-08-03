import { describe, expect, it } from 'vitest'
import {
  dnd5eCoreRaceMechanics,
  mergeDnd5eRacialSavingThrowAdvantages,
} from './coreRaceMechanics'

describe('D&D 5e core race mechanics', () => {
  it('resolves core races and only SRD-owned subrace aliases', () => {
    expect([
      '矮人', '精灵', '半身人', '人类', '龙裔', '侏儒', '半精灵', '半兽人', '提夫林',
    ].map((race) => dnd5eCoreRaceMechanics(race)?.id)).toEqual([
      'dwarf', 'elf', 'halfling', 'human', 'dragonborn', 'gnome', 'half-elf', 'half-orc', 'tiefling',
    ])
    expect(dnd5eCoreRaceMechanics('high-elf')?.id).toBe('elf')
    expect(dnd5eCoreRaceMechanics('lightfoot-halfling')?.size).toBe('small')
    expect(dnd5eCoreRaceMechanics('hill-dwarf')).toBeUndefined()
    expect(dnd5eCoreRaceMechanics('local.example:wood-elf')).toBeUndefined()
  })

  it('keeps deterministic base mechanics in one host-owned catalog', () => {
    expect(dnd5eCoreRaceMechanics('矮人')).toMatchObject({
      speedFeet: 25,
      staticModifiers: { darkvisionRangeFeet: 60, damageResistances: ['poison'] },
    })
    expect(dnd5eCoreRaceMechanics('半精灵')).toMatchObject({
      skillProficiencyChoiceCount: 2,
      staticModifiers: { conditionImmunities: ['magical-sleep', '魔法睡眠'] },
    })
    expect(dnd5eCoreRaceMechanics('半兽人')?.skillProficiencies).toEqual(['intimidation'])
    expect(dnd5eCoreRaceMechanics('提夫林')?.staticModifiers?.damageResistances).toEqual(['fire'])
  })

  it('merges base ancestry and subrace saving-throw advantages without duplicates', () => {
    expect(mergeDnd5eRacialSavingThrowAdvantages(
      { conditions: ['charmed'], magicAbilities: ['wis'] },
      { conditions: ['charmed', 'poisoned'], damageTypes: ['poison'] },
    )).toEqual({
      conditions: ['charmed', 'poisoned'],
      damageTypes: ['poison'],
      magicAbilities: ['wis'],
    })
  })
})

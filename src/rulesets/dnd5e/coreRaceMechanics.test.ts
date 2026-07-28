import { describe, expect, it } from 'vitest'
import {
  dnd5eCoreRaceMechanics,
  mergeDnd5eRacialSavingThrowAdvantages,
} from './coreRaceMechanics'

describe('D&D 5e core race mechanics', () => {
  it('resolves every core race and common subrace alias', () => {
    expect([
      '矮人', '精灵', '半身人', '人类', '龙裔', '侏儒', '半精灵', '半兽人', '提夫林',
    ].map((race) => dnd5eCoreRaceMechanics(race)?.id)).toEqual([
      'dwarf', 'elf', 'halfling', 'human', 'dragonborn', 'gnome', 'half-elf', 'half-orc', 'tiefling',
    ])
    expect(dnd5eCoreRaceMechanics('丘陵矮人')?.id).toBe('dwarf')
    expect(dnd5eCoreRaceMechanics('local.example:wood-elf')?.id).toBe('elf')
    expect(dnd5eCoreRaceMechanics('强心半身人（Stout）')?.size).toBe('small')
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

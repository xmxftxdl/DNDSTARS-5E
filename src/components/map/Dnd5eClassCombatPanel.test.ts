import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { dnd5eCreatureFormEndControl } from './dnd5eCreatureFormEndControl'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'caster',
    name: '施法者',
    player: '',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: '法师',
    level: 7,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 40,
    currentHp: 11,
    tempHp: 0,
    hitDice: '7d6',
    ac: 13,
    speed: 40,
    initiativeBonus: 0,
    saveDC: 15,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

describe('dnd5eCreatureFormEndControl', () => {
  it('offers the concentrating caster a no-action Polymorph end control', () => {
    expect(dnd5eCreatureFormEndControl(character({
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'polymorph',
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeMode: 'polymorph',
      },
    }))).toEqual({
      mode: 'polymorph',
      label: '结束变形术专注',
      detail: '无需动作；结束专注并恢复所有受此法术影响的形态',
      available: true,
    })
  })

  it('prevents a transformed target from voluntarily ending the caster\'s spell', () => {
    expect(dnd5eCreatureFormEndControl(character({
      concentrating: false,
      dnd5eCombatState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeMode: 'polymorph',
      },
    }))).toMatchObject({
      label: '等待施法者结束变形术',
      available: false,
    })
  })

  it('offers the caster an end control when only another target is Polymorphed', () => {
    expect(dnd5eCreatureFormEndControl(character({
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'activity:spell:srd-5.1:polymorph',
        concentrationTargetIds: ['target-token'],
      },
    }))).toMatchObject({
      mode: 'polymorph',
      label: '结束变形术专注',
      available: true,
    })
  })
})

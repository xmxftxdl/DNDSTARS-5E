import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  DND5E_WILD_SHAPE_KNOWN_FORMS_KEY,
  dnd5eAvailableWildShapeForms,
  dnd5eCanWildShapeInto,
  dnd5eChallengeRatingValue,
  dnd5eKnownWildShapeForms,
  dnd5eWildShapeDurationHours,
} from './wildShape'

function druid(level: number, known: string[] = []): Pick<Character, 'charClass' | 'level' | 'dnd5eClassChoices'> {
  return {
    charClass: '德鲁伊', level,
    dnd5eClassChoices: { classes: { druid: { selections: { [DND5E_WILD_SHAPE_KNOWN_FORMS_KEY]: known } } } },
  }
}

describe('SRD 5.1 Druid Wild Shape form rules', () => {
  it('parses fractional challenge ratings and derives duration', () => {
    expect(dnd5eChallengeRatingValue('1/8')).toBe(0.125)
    expect(dnd5eChallengeRatingValue('1')).toBe(1)
    expect(dnd5eWildShapeDurationHours(2)).toBe(1)
    expect(dnd5eWildShapeDurationHours(7)).toBe(3)
    expect(dnd5eWildShapeDurationHours(20)).toBe(10)
  })

  it('enforces level-two CR, swim, and fly limits', () => {
    const ids = dnd5eAvailableWildShapeForms(druid(2)).map((form) => form.id)
    expect(ids).toEqual(expect.arrayContaining(['srd-5.1:badger', 'srd-5.1:cat', 'srd-5.1:giant-rat', 'srd-5.1:panther', 'srd-5.1:wolf']))
    expect(ids).not.toEqual(expect.arrayContaining(['srd-5.1:frog', 'srd-5.1:bat', 'srd-5.1:black-bear', 'srd-5.1:brown-bear']))
  })

  it('unlocks swim forms at level four and fly/CR-one forms at level eight', () => {
    const levelFour = dnd5eAvailableWildShapeForms(druid(4)).map((form) => form.id)
    expect(levelFour).toEqual(expect.arrayContaining(['srd-5.1:frog', 'srd-5.1:ape', 'srd-5.1:black-bear']))
    expect(levelFour).not.toEqual(expect.arrayContaining(['srd-5.1:bat', 'srd-5.1:brown-bear', 'srd-5.1:dire-wolf']))
    const levelEight = dnd5eAvailableWildShapeForms(druid(8)).map((form) => form.id)
    expect(levelEight).toEqual(expect.arrayContaining(['srd-5.1:bat', 'srd-5.1:brown-bear', 'srd-5.1:dire-wolf']))
    expect(levelEight).not.toContain('srd-5.1:owlbear')
  })

  it('requires the player to mark a legal beast as previously seen', () => {
    const character = druid(4, ['srd-5.1:black-bear', 'srd-5.1:bat'])
    expect(dnd5eKnownWildShapeForms(character).map((form) => form.id)).toEqual(['srd-5.1:black-bear'])
    expect(dnd5eCanWildShapeInto(character, 'srd-5.1:black-bear')).toBe(true)
    expect(dnd5eCanWildShapeInto(character, 'srd-5.1:bat')).toBe(false)
  })
})

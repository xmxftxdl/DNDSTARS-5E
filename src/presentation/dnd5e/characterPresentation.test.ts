import { describe, expect, it } from 'vitest'
import { dnd5eCharacterPresentationColors } from './characterPresentation'
import type { Character } from '../../types/character'

describe('dnd5eCharacterPresentationColors', () => {
  it('projects the dominant class palette into status and token presentation colors', () => {
    const character = {
      charClass: 'Bard',
      dnd5eClassLevels: { bard: 5, fighter: 1 },
    } as Character

    expect(dnd5eCharacterPresentationColors(character)).toMatchObject({
      classId: 'bard',
      accentColor: '#D946EF',
      statusBackgroundHighlightColor: '#D946EF',
      statusBackgroundColor: '#26072C',
      statusBorderColor: '#F9D5FF',
    })
  })
})

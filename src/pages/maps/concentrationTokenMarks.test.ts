import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { buildDnd5eConcentrationTokenMarks } from './concentrationTokenMarks'

function token(patch: Partial<Token> & Pick<Token, 'id'>): Token {
  return {
    label: patch.id,
    x: 0,
    y: 0,
    color: '#f87171',
    emoji: '',
    size: 1,
    type: 'enemy',
    ...patch,
  }
}

function character(patch: Partial<Character> & Pick<Character, 'id'>): Character {
  return {
    name: patch.id,
    charClass: 'wizard',
    dnd5eClassLevels: { wizard: 5 },
    ...patch,
  } as Character
}

describe('buildDnd5eConcentrationTokenMarks', () => {
  it('shows, updates, and immediately removes a linked character concentration mark', () => {
    const casterToken = token({
      id: 'wizard-token',
      type: 'player',
      characterId: 'wizard',
      // A stale Token projection must never override linked Character authority.
      dnd5eCombatState: { concentrationSpellId: 'stale-token-spell' },
    })
    const concentrating = character({
      id: 'wizard',
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'flaming-sphere' },
    })

    expect(buildDnd5eConcentrationTokenMarks([casterToken], [concentrating]))
      .toMatchObject([{ tokenId: 'wizard-token', spellId: 'flaming-sphere', classId: 'wizard' }])

    const switched = character({
      ...concentrating,
      dnd5eCombatState: { concentrationSpellId: 'fly' },
    })
    expect(buildDnd5eConcentrationTokenMarks([casterToken], [switched]))
      .toMatchObject([{ tokenId: 'wizard-token', spellId: 'fly', classId: 'wizard' }])

    const ended = character({
      ...switched,
      concentrating: false,
      dnd5eCombatState: {},
    })
    expect(buildDnd5eConcentrationTokenMarks([casterToken], [ended])).toEqual([])
  })

  it('uses the linked Headless spell id, supports the legacy manual toggle, and ignores stale Token state', () => {
    const casterToken = token({
      id: 'caster-token',
      type: 'player',
      characterId: 'caster',
      dnd5eCombatState: { concentrationSpellId: 'stale-token-spell' },
    })

    expect(buildDnd5eConcentrationTokenMarks([casterToken], [character({
      id: 'caster',
      concentrating: true,
      dnd5eCombatState: {},
    })])).toMatchObject([{
      tokenId: 'caster-token',
      spellId: 'manual-concentration',
      classId: 'wizard',
    }])
    expect(buildDnd5eConcentrationTokenMarks([casterToken], [character({
      id: 'caster',
      concentrating: false,
      dnd5eCombatState: { concentrationSpellId: 'web' },
    })])).toMatchObject([{
      tokenId: 'caster-token',
      spellId: 'web',
      classId: 'wizard',
    }])
    expect(buildDnd5eConcentrationTokenMarks([casterToken], [])).toEqual([])
  })

  it('uses an unlinked monster Headless spell id and its Token color', () => {
    const monster = token({
      id: 'mage-monster',
      color: '#dc2626',
      dnd5eCombatState: { concentrationSpellId: 'hold-person' },
    })
    expect(buildDnd5eConcentrationTokenMarks([monster], []))
      .toMatchObject([{
        tokenId: 'mage-monster',
        spellId: 'hold-person',
        backgroundHighlightColor: '#dc2626',
        borderColor: '#dc2626',
        glowColor: '#dc2626',
      }])

    expect(buildDnd5eConcentrationTokenMarks([{
      ...monster,
      dnd5eCombatState: {},
    }], [])).toEqual([])

    expect(buildDnd5eConcentrationTokenMarks([{
      ...monster,
      type: 'obstacle',
    }], [])).toEqual([])
  })
})

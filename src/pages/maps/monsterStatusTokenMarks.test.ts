import { describe, expect, it } from 'vitest'
import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { buildDnd5eMonsterStatusTokenMarks } from './monsterStatusTokenMarks'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function character(id: string, classId: 'wizard' | 'bard'): Character {
  return {
    id,
    charClass: classId,
    dnd5eClassLevels: { [classId]: 5 },
  } as unknown as Character
}

describe('Flesh Golem Damage Aversion Token mark', () => {
  it.each(['wizard', 'bard'] as const)('uses the triggering %s class palette for its edge', (classId) => {
    const source = character('source-character', classId)
    const marks = buildDnd5eMonsterStatusTokenMarks([
      token({ id: 'source-token', type: 'player', characterId: source.id }),
      token({
        id: 'flesh-golem',
        poolId: 'srd-5.1:flesh-golem',
        dnd5eCombatState: {
          monsterDamageAversionActive: true,
          monsterDamageAversionSourceActorId: 'source-token',
        },
      }),
    ], [source])

    expect(marks).toEqual([expect.objectContaining({
      tokenId: 'flesh-golem',
      statusId: 'monster-damage-aversion',
      borderColor: DND5E_CLASS_ICON_PALETTES[classId][2],
      glowColor: DND5E_CLASS_ICON_PALETTES[classId][3],
    })])
  })

  it('omits the mark when Damage Aversion is inactive', () => {
    expect(buildDnd5eMonsterStatusTokenMarks([
      token({ id: 'flesh-golem', poolId: 'srd-5.1:flesh-golem' }),
    ], [])).toEqual([])
  })

  it('uses the uniform monster red when no character owns the effect', () => {
    expect(buildDnd5eMonsterStatusTokenMarks([
      token({
        id: 'flesh-golem',
        poolId: 'srd-5.1:flesh-golem',
        dnd5eCombatState: { monsterDamageAversionActive: true },
      }),
    ], [])).toEqual([expect.objectContaining({
      tokenId: 'flesh-golem',
      borderColor: '#FECACA',
      glowColor: '#EF4444',
    })])
  })
})

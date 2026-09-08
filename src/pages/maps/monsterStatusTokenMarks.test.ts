import { describe, expect, it } from 'vitest'
import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  buildDnd5eMonsterStatusTokenMarks,
  buildDnd5eMonsterTraitTokenStatusMarks,
} from './monsterStatusTokenMarks'

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
  it('projects the always-on Fire Aversion trait as a mechanical Token instance', () => {
    expect(buildDnd5eMonsterTraitTokenStatusMarks([
      token({ id: 'flesh-golem', poolId: 'srd-5.1:flesh-golem' }),
    ])).toEqual([
      expect.objectContaining({
        tokenId: 'flesh-golem',
        marker: expect.objectContaining({
          id: expect.stringContaining('monster-trait:flesh-golem:fire-averse:'),
          statusId: 'fire-averse',
          source: 'headless',
          mechanical: true,
        }),
      }),
    ])
  })

  it('lets the DM hide the projected badge without mutating the monster trait', () => {
    expect(buildDnd5eMonsterTraitTokenStatusMarks([
      token({
        id: 'flesh-golem',
        poolId: 'srd-5.1:flesh-golem',
        dnd5eSuppressedStatusMarkerIds: ['monster-trait:flesh-golem:fire-averse:1'],
      }),
    ])).toEqual([])
  })

  it('replaces the always-on Fire Aversion badge with its triggered runtime state', () => {
    const golem = token({
      id: 'flesh-golem',
      poolId: 'srd-5.1:flesh-golem',
      dnd5eCombatState: { monsterDamageAversionActive: true },
    })

    expect(buildDnd5eMonsterTraitTokenStatusMarks([golem])).toEqual([])
    expect(buildDnd5eMonsterStatusTokenMarks([golem], [])).toEqual([
      expect.objectContaining({
        tokenId: 'flesh-golem',
        statusId: 'monster-damage-aversion',
      }),
    ])
  })

  it('uses a linked combatant state when deciding whether the runtime badge replaces the trait badge', () => {
    const golem = token({
      id: 'flesh-golem',
      poolId: 'srd-5.1:flesh-golem',
      characterId: 'golem-combatant',
    })
    const linked = {
      id: 'golem-combatant',
      dnd5eCombatState: { monsterDamageAversionActive: true },
    } as unknown as Character

    expect(buildDnd5eMonsterTraitTokenStatusMarks([golem], [linked])).toEqual([])
  })

  it('projects the authoritative berserk state as a visible Token mark', () => {
    expect(buildDnd5eMonsterStatusTokenMarks([
      token({
        id: 'flesh-golem',
        poolId: 'srd-5.1:flesh-golem',
        dnd5eCombatState: { monsterBerserk: true },
      }),
    ], [])).toEqual([expect.objectContaining({
      tokenId: 'flesh-golem',
      statusId: 'monster-berserk',
      glowColor: '#ef4444',
    })])
  })

  it('keeps berserk and Damage Aversion as two independent marks', () => {
    const marks = buildDnd5eMonsterStatusTokenMarks([
      token({
        id: 'flesh-golem',
        poolId: 'srd-5.1:flesh-golem',
        dnd5eCombatState: {
          monsterBerserk: true,
          monsterDamageAversionActive: true,
        },
      }),
    ], [])
    expect(marks.map((mark) => mark.statusId)).toEqual([
      'monster-berserk',
      'monster-damage-aversion',
    ])
    expect(new Set(marks.map((mark) => mark.instance.id)).size).toBe(2)
  })

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

  it('projects regeneration suppression as an independent removable runtime state', () => {
    expect(buildDnd5eMonsterStatusTokenMarks([
      token({
        id: 'troll',
        poolId: 'srd-5.1:troll',
        dnd5eCombatState: { monsterRegenerationSuppressedDamageTypes: ['acid', 'fire'] },
      }),
    ], [])).toEqual([expect.objectContaining({
      tokenId: 'troll',
      statusId: 'monster-regeneration-suppressed',
      instance: expect.objectContaining({
        kind: 'monster-state',
        title: '再生受抑',
      }),
    })])
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

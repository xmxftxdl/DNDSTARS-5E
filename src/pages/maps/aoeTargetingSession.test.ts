import { describe, expect, it } from 'vitest'
import {
  mapAoeTargetingSessionKey,
  mapSpellTargetIdsForAuthoritySubmission,
} from './aoeTargetingSession'

describe('mapAoeTargetingSessionKey', () => {
  it('keeps one spell targeting session stable while its selected targets change', () => {
    const spellArea = {
      characterId: 'wizard',
      castingClassId: 'wizard',
      spellId: 'fireball',
      slotLevel: 3,
    }

    expect(mapAoeTargetingSessionKey({ spellArea }))
      .toBe(mapAoeTargetingSessionKey({ spellArea: { ...spellArea } }))
  })

  it('starts a new session for a different cast configuration', () => {
    const base = {
      characterId: 'wizard',
      castingClassId: 'wizard',
      spellId: 'fireball',
      slotLevel: 3,
    }

    expect(mapAoeTargetingSessionKey({ spellArea: base }))
      .not.toBe(mapAoeTargetingSessionKey({ spellArea: { ...base, slotLevel: 4 } }))
  })

  it('uses a stable identity for a racial innate spell without a class id', () => {
    expect(mapAoeTargetingSessionKey({
      spellArea: {
        characterId: 'dragonborn',
        spellId: 'burning-hands',
        slotLevel: 1,
      },
    })).toBe('spell:dragonborn:racial-innate:burning-hands:1:')
  })

  it('uses the active targeting source priority and clears when none is active', () => {
    expect(mapAoeTargetingSessionKey({
      coreAreaMove: { characterId: 'wizard', areaId: 'flaming-sphere' },
      spellArea: {
        characterId: 'wizard',
        castingClassId: 'wizard',
        spellId: 'fireball',
        slotLevel: 3,
      },
    })).toBe('core:wizard:flaming-sphere')
    expect(mapAoeTargetingSessionKey({})).toBeNull()
  })
})

describe('mapSpellTargetIdsForAuthoritySubmission', () => {
  it('submits only the anchor for an area spell so the Host discovers affected creatures', () => {
    expect(mapSpellTargetIdsForAuthoritySubmission({
      hasArea: true,
      targetKind: 'area',
      selectedTargetIds: ['visible-goblin', 'stale-goblin'],
    })).toEqual([])
  })

  it('preserves explicitly selected targets for selective spells', () => {
    expect(mapSpellTargetIdsForAuthoritySubmission({
      hasArea: true,
      targetKind: 'creature',
      selectedTargetIds: ['cleric', 'fighter', 'fighter'],
    })).toEqual(['cleric', 'fighter'])
  })
})

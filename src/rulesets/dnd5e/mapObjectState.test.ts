import { describe, expect, it } from 'vitest'
import {
  dnd5eArcaneLockDispelSucceedsV1,
  hashDnd5eArcaneLockPasswordV1,
  normalizeDnd5eArcaneLockStateV1,
  normalizeDnd5eMapObjectStateV1,
  type Dnd5eArcaneLockStateV1,
} from './mapObjectState'

const lock: Dnd5eArcaneLockStateV1 = {
  schemaVersion: 1,
  sourceTokenId: 'caster',
  sourceActivityId: 'spell:arcane-lock',
  spellLevel: 5,
  previousLocked: false,
  authorizedTokenIds: ['ally'],
  passwordDigest: hashDnd5eArcaneLockPasswordV1('Moon Door'),
}

describe('D&D 5e mapped magic object state', () => {
  it('normalizes bounded authorization state without storing plaintext passwords', () => {
    expect(normalizeDnd5eArcaneLockStateV1(lock)).toEqual(lock)
    expect(hashDnd5eArcaneLockPasswordV1(' moon   door ')).toBe(lock.passwordDigest)
    expect(normalizeDnd5eArcaneLockStateV1({ ...lock, authorizedTokenIds: ['ally', 'ally'] })).toBeUndefined()
    expect(normalizeDnd5eArcaneLockStateV1({ ...lock, passwordDigest: 'moon door' })).toBeUndefined()
  })

  it('uses the generic Dispel Magic level/check rule', () => {
    expect(dnd5eArcaneLockDispelSucceedsV1({ lock, dispelSlotLevel: 5 })).toBe(true)
    expect(dnd5eArcaneLockDispelSucceedsV1({ lock, dispelSlotLevel: 3, abilityCheckTotal: 14 })).toBe(false)
    expect(dnd5eArcaneLockDispelSucceedsV1({ lock, dispelSlotLevel: 3, abilityCheckTotal: 15 })).toBe(true)
  })

  it('persists only internally consistent Creation expiry metadata', () => {
    const state = {
      schemaVersion: 1,
      magical: false,
      creation: {
        schemaVersion: 1,
        sourceTokenId: 'wizard-token', sourceCharacterId: 'wizard', sourceActionId: 'cast-creation',
        slotLevel: 6, objectDescription: '石门', materials: ['stone-or-crystal'], edgeFeet: 10,
        createdWorldMinute: 100, expiresAtWorldMinute: 820, cannotBeSpellMaterial: true,
      },
    }
    expect(normalizeDnd5eMapObjectStateV1(state)).toEqual(state)
    expect(normalizeDnd5eMapObjectStateV1({
      ...state,
      creation: { ...state.creation, expiresAtWorldMinute: 819 },
    })).toBeUndefined()
  })

  it('persists only bounded water-container capacity and volume', () => {
    const state = {
      schemaVersion: 1,
      waterContainer: { schemaVersion: 1, open: true, capacityGallons: 50, waterGallons: 20 },
    }
    expect(normalizeDnd5eMapObjectStateV1(state)).toEqual(state)
    expect(normalizeDnd5eMapObjectStateV1({
      ...state,
      waterContainer: { ...state.waterContainer, waterGallons: 51 },
    })).toBeUndefined()
  })
})

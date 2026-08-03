import { describe, expect, it } from 'vitest'
import {
  compileDnd5eEffectiveVisionProfile,
  dnd5eCharacterDarkvisionRangeFeet,
  dnd5eCharacterHasDevilsSight,
} from '../../../shared/dnd5e-vision-profile.mjs'

describe('D&D 5e effective vision profile', () => {
  it('uses the host-resolved character Darkvision without inspecting content ids', () => {
    expect(dnd5eCharacterDarkvisionRangeFeet({ darkvisionRangeFeet: 60 })).toBe(60)
    expect(dnd5eCharacterDarkvisionRangeFeet({ darkvisionRangeFeet: 120 })).toBe(120)
    expect(dnd5eCharacterDarkvisionRangeFeet({ darkvisionRangeFeet: 99_999 })).toBe(10_000)
    expect(dnd5eCharacterDarkvisionRangeFeet({ race: 'private-room-race' })).toBe(0)
  })

  it('merges a room-token character projection with explicit token vision', () => {
    expect(compileDnd5eEffectiveVisionProfile({
      token: { darkvisionRangeFeet: 30, dnd5eCharacterDarkvisionRangeFeet: 120 },
    }).darkvisionRangeFeet).toBe(120)
  })

  it('merges temporary effects and clamps untrusted ranges', () => {
    const profile = compileDnd5eEffectiveVisionProfile({
      token: {
        darkvisionRangeFeet: -30,
        dnd5eCombatState: {
          activeEffects: [{ modifiers: { darkvisionRangeFeet: 60 } }],
        },
        truesightRangeFeet: 99_999,
      },
      fallbackRangeFeet: 30,
    })
    expect(profile).toMatchObject({
      schemaVersion: 1,
      normalRangeFeet: 30,
      darkvisionRangeFeet: 60,
      truesightRangeFeet: 10_000,
    })
  })

  it('turns Devil\'s Sight into normal sight through both kinds of darkness', () => {
    const character = {
      dnd5eClassChoices: {
        classes: {
          warlock: {
            selections: { 'eldritch-invocations': ['devils-sight'] },
          },
        },
      },
    }
    expect(dnd5eCharacterHasDevilsSight(character)).toBe(true)
    expect(compileDnd5eEffectiveVisionProfile({ token: {}, character })).toMatchObject({
      darknessSightRangeFeet: 120,
      magicalDarknessSightRangeFeet: 120,
    })
  })

  it('derives monster senses and Devil\'s Sight from the stat block', () => {
    expect(compileDnd5eEffectiveVisionProfile({
      token: {},
      monster: {
        senses: [{ name: 'Darkvision', distanceFeet: 60 }],
        traits: [{ name: "Devil's Sight" }],
      },
    })).toMatchObject({
      darkvisionRangeFeet: 60,
      darknessSightRangeFeet: 120,
      magicalDarknessSightRangeFeet: 120,
    })
  })
})

import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { dnd5eEffectiveCharacterMovementProfile } from './characterMovement'
import { dnd5eTraversalTargetingDistanceFeet } from './traversal'

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: 'Hero', player: 'P1', avatar: '', accent: 'blue', race: '',
    charClass: '法师', level: 17, background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 80, currentHp: 80, tempHp: 0,
    hitDice: '17d6', ac: 12, speed: 30, initiativeBonus: 0, saveDC: 19,
    passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
    visibleToPlayers: true,
    ...overrides,
  }
}

describe('D&D 5e current character movement profile', () => {
  it('uses every movement mode from the active polymorph form', () => {
    const profile = dnd5eEffectiveCharacterMovementProfile(character({
      dnd5eCombatState: {
        wildShapeFormId: 'srd-5.1:giant-eagle',
        wildShapeMode: 'polymorph',
      },
    }))

    expect(profile).toMatchObject({
      walkSpeed: 10,
      flySpeed: 80,
      maximumSpeed: 80,
    })
    expect(dnd5eTraversalTargetingDistanceFeet({
      movementBudgetFeet: profile.maximumSpeed,
      mode: 'fly',
      profile: {
        strengthScore: 16,
        strengthModifier: 3,
        movementPoolSpeed: profile.maximumSpeed,
        walkSpeed: profile.walkSpeed,
        flySpeed: profile.flySpeed,
      },
    })).toBe(80)
  })

  it('uses the token creature-form projection while the character snapshot is one revision behind', () => {
    const staleCharacter = character({
      speed: 30,
    })

    expect(dnd5eEffectiveCharacterMovementProfile(staleCharacter, {
      wildShapeFormId: 'srd-5.1:giant-eagle',
    })).toMatchObject({
      walkSpeed: 10,
      flySpeed: 80,
      maximumSpeed: 80,
    })
  })

  it('uses the body movement modes when no creature form is active', () => {
    expect(dnd5eEffectiveCharacterMovementProfile(character({
      dnd5eMovementSpeeds: { fly: 40, hover: true },
    }))).toMatchObject({
      walkSpeed: 30,
      flySpeed: 40,
      hover: true,
      maximumSpeed: 40,
    })
  })
})

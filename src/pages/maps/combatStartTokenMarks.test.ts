import { describe, expect, it } from 'vitest'
import {
  clearDnd5eStatusTokenMarksAtCombatStart,
  clearDnd5eTransientTokenMarksAtCombatStart,
} from './combatStartTokenMarks'

describe('combat-start Token mark cleanup', () => {
  it('removes Damage Aversion presentation state from a previous combat', () => {
    const state = {
      monsterDamageAversionActive: true,
      monsterDamageAversionSourceActorId: 'fire-source',
      surprisedCombatId: 'old-combat',
    }

    expect(clearDnd5eTransientTokenMarksAtCombatStart(state)).toEqual({
      surprisedCombatId: 'old-combat',
    })
  })

  it('also removes a stale source-only or false marker', () => {
    expect(clearDnd5eTransientTokenMarksAtCombatStart({
      monsterDamageAversionActive: false,
      monsterDamageAversionSourceActorId: 'stale-source',
    })).toEqual({})
  })

  it('preserves conditions, active effects, concentration and persistent spell state', () => {
    const activeEffect = {
      id: 'effect-1',
      definitionId: 'srd-5.1:spell:mage-armor',
    }
    const state = {
      monsterDamageAversionActive: true,
      monsterDamageAversionSourceActorId: 'fire-source',
      conditions: ['blessed'],
      activeEffects: [activeEffect],
      concentrationSpellId: 'flaming-sphere',
      concentrationTargetIds: ['sphere-token'],
      concentrationRoundsRemaining: 9,
      monsterSpellSlots: { '1': { current: 2, max: 3 } },
    }

    expect(clearDnd5eTransientTokenMarksAtCombatStart(state)).toEqual({
      conditions: ['blessed'],
      activeEffects: [activeEffect],
      concentrationSpellId: 'flaming-sphere',
      concentrationTargetIds: ['sphere-token'],
      concentrationRoundsRemaining: 9,
      monsterSpellSlots: { '1': { current: 2, max: 3 } },
    })
  })

  it('keeps a clean state by reference and leaves missing state missing', () => {
    const state = { activeEffects: [] }
    expect(clearDnd5eTransientTokenMarksAtCombatStart(state)).toBe(state)
    expect(clearDnd5eTransientTokenMarksAtCombatStart(undefined)).toBeUndefined()
  })

  it('clears all fields that project Token status marks but preserves combat resources', () => {
    expect(clearDnd5eStatusTokenMarksAtCombatStart({
      monsterDamageAversionActive: true,
      monsterDamageAversionSourceActorId: 'fire-source',
      activeEffects: [{ id: 'bless' }],
      conditions: ['blinded'],
      concentrationSpellId: 'flaming-sphere',
      concentrationSpellLevel: 2,
      concentrationTargetIds: ['target'],
      concentrationRoundsRemaining: 8,
      concentrationEffectsBySource: { caster: 'flaming-sphere' },
      monsterSpellSlots: { '2': { current: 1, max: 2 } },
      legendaryResistanceUses: 2,
    })).toEqual({
      activeEffects: [],
      conditions: undefined,
      concentrationSpellId: undefined,
      concentrationSpellLevel: undefined,
      concentrationTargetIds: undefined,
      concentrationRoundsRemaining: undefined,
      concentrationEffectsBySource: undefined,
      monsterSpellSlots: { '2': { current: 1, max: 2 } },
      legendaryResistanceUses: 2,
    })
  })
})

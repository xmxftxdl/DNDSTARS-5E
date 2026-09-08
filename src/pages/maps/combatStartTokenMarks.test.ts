import { describe, expect, it } from 'vitest'
import {
  clearDnd5eStatusTokenMarksAtCombatStart,
  clearDnd5eTransientTokenMarksAtCombatStart,
  shouldClearDnd5eStatusesAtCombatStart,
} from './combatStartTokenMarks'

describe('combat-start Token mark cleanup', () => {
  it('preserves ongoing effects in the ordinary combat-start flow unless the DM explicitly requests a reset', () => {
    expect(shouldClearDnd5eStatusesAtCombatStart(true)).toBe(false)
    expect(shouldClearDnd5eStatusesAtCombatStart(true, false)).toBe(false)
    expect(shouldClearDnd5eStatusesAtCombatStart(true, true)).toBe(true)
    expect(shouldClearDnd5eStatusesAtCombatStart(false, true)).toBe(false)
  })

  it('removes Damage Aversion presentation state from a previous combat', () => {
    const state = {
      monsterDamageAversionActive: true,
      monsterDamageAversionSourceActorId: 'fire-source',
      monsterRegenerationSuppressedDamageTypes: ['acid', 'fire'],
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

  it('removes a Time Stop one-shot group and every paired suspension at a new combat boundary', () => {
    const mageArmor = {
      id: 'mage-armor', definitionId: 'srd-5.1:spell:mage-armor',
    }
    const suspension = {
      id: 'time-stop-suspension',
      definitionId: 'activity-extra-turns:suspension:old-combat:group-1',
    }
    expect(clearDnd5eTransientTokenMarksAtCombatStart({
      activityExtraTurnGroup: {
        groupId: 'old-combat:group-1', slotIds: ['slot-1'], endOnAffectOther: true,
      },
      activeEffects: [mageArmor],
    })).toEqual({ activeEffects: [mageArmor] })
    expect(clearDnd5eTransientTokenMarksAtCombatStart({
      activityExtraTurnSuspension: {
        groupId: 'old-combat:group-1', reactionAvailableBefore: true,
      },
      activeEffects: [mageArmor, suspension],
    })).toEqual({ activeEffects: [mageArmor] })
  })

  it('preserves conditions, active effects, concentration and persistent spell state', () => {
    const activeEffect = {
      id: 'effect-1',
      definitionId: 'srd-5.1:spell:mage-armor',
    }
    const state = {
      monsterDamageAversionActive: true,
      monsterDamageAversionSourceActorId: 'fire-source',
      monsterRegenerationSuppressedDamageTypes: ['fire'],
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

  it('clears transient status marks but preserves authoritative concentration and combat resources', () => {
    expect(clearDnd5eStatusTokenMarksAtCombatStart({
      monsterDamageAversionActive: true,
      monsterDamageAversionSourceActorId: 'fire-source',
      monsterRegenerationSuppressedDamageTypes: ['acid'],
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
      concentrationSpellId: 'flaming-sphere',
      concentrationSpellLevel: 2,
      concentrationTargetIds: ['target'],
      concentrationRoundsRemaining: 8,
      concentrationEffectsBySource: { caster: 'flaming-sphere' },
      monsterSpellSlots: { '2': { current: 1, max: 2 } },
      legendaryResistanceUses: 2,
    })
  })
})

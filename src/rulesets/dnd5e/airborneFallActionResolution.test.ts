import { describe, expect, it } from 'vitest'
import { resolveDnd5eActionWithAirborneFallPreview } from './airborneFallActionResolution'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  startDnd5eHeadlessCombat,
  type Dnd5eAction,
} from './headlessCombatEngine'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

describe('synchronous Headless airborne fall facade', () => {
  it('previews required dice, then atomically replays the same action with fall damage', () => {
    const shover = createDnd5eCombatant({
      id: 'shover', name: 'shover', controller: 'player', initiative: 20,
      abilities, proficiencyBonus: 2, armorClass: 16, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    })
    const flyer = createDnd5eCombatant({
      id: 'flyer', name: 'flyer', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 16, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false,
      elevationFeet: 30, groundElevationFeet: 0, airborne: true,
      movementSpeeds: { walk: 30, fly: 60 },
    })
    const state = startDnd5eHeadlessCombat('facade-airborne-fall', [shover, flyer])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(shover.id, flyer.id)]: 5 }
    const action: Dnd5eAction = {
      type: 'shove', actorId: shover.id, targetId: flyer.id,
      actorD20: 20, targetD20: 1, targetDefense: 'acrobatics', outcome: 'prone',
    }

    const preview = resolveDnd5eActionWithAirborneFallPreview(state, action)
    expect(preview.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(preview.airborneFalls).toEqual([{
      combatantId: flyer.id,
      fromElevationFeet: 30,
      groundElevationFeet: 0,
      fallDistanceFeet: 30,
      fallingDamageDice: 3,
    }])
    expect(state.combatants.flyer).toMatchObject({ currentHp: 20, elevationFeet: 30, airborne: true })

    const settled = resolveDnd5eActionWithAirborneFallPreview(
      state,
      action,
      { [flyer.id]: [2, 3, 4] },
    )
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.airborneFalls).toBeUndefined()
    expect(settled.result.state.combatants.flyer).toMatchObject({
      currentHp: 11,
      elevationFeet: 0,
      groundElevationFeet: 0,
      airborne: false,
    })

    // Reusing stale Host dice after landing is rejected and cannot deal the
    // same fall damage twice.
    const replay = resolveDnd5eActionWithAirborneFallPreview(
      settled.result.state,
      action,
      { [flyer.id]: [2, 3, 4] },
    )
    expect(replay.result).toMatchObject({ ok: false, reason: 'action-unavailable' })
    expect(replay.result.state.combatants.flyer).toMatchObject({
      currentHp: 11,
      elevationFeet: 0,
      airborne: false,
    })
    expect(replay.result.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
  })

  it('falls when a spell flight effect becomes suspended without mutating the source snapshot', () => {
    const charmed = createDnd5eConditionEffect({
      id: 'suspended-flight:charmed',
      condition: 'charmed',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'charm-person' },
      targetId: 'flyer',
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' },
    })
    const flight = createDnd5eMechanicalEffect({
      id: 'suspended-flight:fly',
      definitionId: 'test:suspended-flight',
      label: 'Dependent magical flight',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'dependent-flight' },
      targetId: 'flyer',
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' },
      dependsOnEffectId: charmed.id,
      modifiers: { flySpeedFeet: 60 },
    })
    const flyer = createDnd5eCombatant({
      id: 'flyer', name: 'flyer', controller: 'player', initiative: 20,
      abilities, proficiencyBonus: 3, armorClass: 16, currentHp: 30, maxHp: 30,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      classId: 'barbarian', subclassId: 'berserker', level: 6,
      classResources: { 'dnd5e-rage': { current: 1, max: 1 } },
      classState: { activeEffects: [charmed, flight] },
      elevationFeet: 30, groundElevationFeet: 0, airborne: true,
      movementSpeeds: { walk: 30 },
    })
    const enemy = createDnd5eCombatant({
      id: 'enemy', name: 'enemy', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 12, currentHp: 10, maxHp: 10,
      temporaryHp: 0, speed: 30, position: { x: 30, y: 0 }, concentrating: false,
    })
    const state = startDnd5eHeadlessCombat('suspended-magical-flight', [flyer, enemy])
    const sourceBefore = structuredClone(state)
    const action: Dnd5eAction = { type: 'barbarian-rage', actorId: flyer.id }

    const preview = resolveDnd5eActionWithAirborneFallPreview(state, action)
    expect(preview.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(preview.airborneFalls).toEqual([
      expect.objectContaining({ combatantId: flyer.id, fallingDamageDice: 3 }),
    ])
    expect(state).toEqual(sourceBefore)

    const settled = resolveDnd5eActionWithAirborneFallPreview(
      state,
      action,
      { [flyer.id]: [1, 2, 3] },
    )
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    if (!settled.result.ok) return
    expect(settled.result.state.combatants.flyer).toMatchObject({
      // Rage starts before the atomic landing and halves bludgeoning damage.
      currentHp: 27,
      elevationFeet: 0,
      groundElevationFeet: 0,
      airborne: false,
      classState: { raging: true },
    })
    expect(settled.result.state.combatants.flyer.conditions).toContain('prone')
    expect(settled.result.state.combatants.flyer.classState.activeEffects
      ?.filter((effect) => effect.id === charmed.id || effect.id === flight.id)
      .every((effect) => effect.suspendedBy?.includes('class:berserker:mindless-rage')),
    ).toBe(true)
  })
})

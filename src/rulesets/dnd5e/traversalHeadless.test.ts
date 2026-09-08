import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eFeatherFallReactionOption,
  resolveDnd5eFeatherFallReaction,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { createDnd5eMechanicalEffect } from './activeEffects'

const base = {
  abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  concentrating: false, temporaryHp: 0, proficiencyBonus: 2,
}

describe('D&D 5e traversal in Headless combat', () => {
  it('requires a fly speed and charges vertical distance while flying', () => {
    const walker = createDnd5eCombatant({
      ...base, id: 'walker', name: '行者', controller: 'player', initiative: 20,
      armorClass: 14, currentHp: 20, maxHp: 20, speed: 30, position: { x: 0, y: 0 },
    })
    const enemy = createDnd5eCombatant({
      ...base, id: 'enemy', name: '敌人', controller: 'dm', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30, position: { x: 5, y: 0 },
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('walk', [walker, enemy]), {
      type: 'move', actorId: walker.id, to: { x: 0, y: 0 }, distance: 0, traversalMode: 'fly', toElevationFeet: 10,
    })
    expect(blocked).toMatchObject({ ok: false })

    const flyer = { ...walker, movementSpeeds: { walk: 30, fly: 30 } }
    const flown = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('fly', [flyer, enemy]), {
      type: 'move', actorId: flyer.id, to: { x: 0, y: 0 }, distance: 0, traversalMode: 'fly', toElevationFeet: 10,
    })
    expect(flown.ok).toBe(true)
    if (!flown.ok) return
    expect(flown.state.combatants.walker).toMatchObject({ elevationFeet: 10, airborne: true, turn: { movementRemaining: 20 } })
  })

  it('authoritatively applies fall damage, elevation, movement, and prone', () => {
    const hero = createDnd5eCombatant({
      ...base, id: 'hero', name: '英雄', controller: 'player', initiative: 20,
      armorClass: 14, currentHp: 20, maxHp: 20, speed: 30,
      position: { x: 0, y: 0 }, elevationFeet: 30,
    })
    const enemy = createDnd5eCombatant({
      ...base, id: 'enemy', name: '敌人', controller: 'dm', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30, position: { x: 5, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('combat', [hero, enemy])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: hero.id, to: { x: 5, y: 0 }, distance: 5,
      traversalMode: 'fall', toElevationFeet: 0, fallingDamageRolls: [2, 3, 4],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero).toMatchObject({ currentHp: 11, elevationFeet: 0 })
    expect(result.state.combatants.hero.conditions).toContain('prone')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved', rolls: [2, 3, 4], damage: 9,
    }))
  })

  it('does not treat a controlled descent as a fall', () => {
    const hero = createDnd5eCombatant({
      ...base, id: 'hero', name: '英雄', controller: 'player', initiative: 20,
      armorClass: 14, currentHp: 20, maxHp: 20, speed: 30,
      position: { x: 0, y: 0 }, elevationFeet: 10,
    })
    const enemy = createDnd5eCombatant({
      ...base, id: 'enemy', name: '敌人', controller: 'dm', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30, position: { x: 10, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('combat', [hero, enemy])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: hero.id, to: { x: 5, y: 0 }, distance: 5,
      traversalMode: 'climb', toElevationFeet: 0,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(20)
    expect(result.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
  })

  it('advances an unsupported controlled descent at the turn boundary and ends it on a safe landing', () => {
    const featherFall = createDnd5eMechanicalEffect({
      definitionId: 'activity:srd-5.1:spell:feather-fall:modifiers:0',
      label: '羽落术',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'feather-fall', magical: true },
      targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        safeFallFeet: 600,
        controlledDescent: {
          maximumFeetPerRound: 60,
          safeLanding: true,
          endsOnLanding: true,
        },
      },
    })
    const hero = createDnd5eCombatant({
      ...base, id: 'hero', name: '英雄', controller: 'player', initiative: 20,
      armorClass: 14, currentHp: 20, maxHp: 20, speed: 30,
      position: { x: 0, y: 0 }, elevationFeet: 40, groundElevationFeet: 0,
      airborne: true, classState: { activeEffects: [featherFall] },
    })
    const caster = createDnd5eCombatant({
      ...base, id: 'caster', name: '施法者', controller: 'player', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30, position: { x: 5, y: 0 },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('feather-fall', [hero, caster]),
      { type: 'begin-turn', actorId: hero.id },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero).toMatchObject({
      currentHp: 20,
      elevationFeet: 0,
      groundElevationFeet: 0,
      airborne: false,
    })
    expect(result.state.combatants.hero.conditions).not.toContain('prone')
    expect(result.state.combatants.hero.classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ definitionId: featherFall.definitionId }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'controlled-descent-resolved', actorId: hero.id,
      distanceFeet: 40, landed: true,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved', actorId: hero.id, damage: 0, landedProne: false,
      rolls: [],
      prevention: expect.objectContaining({
        kind: 'controlled-descent',
        definitionId: featherFall.definitionId,
        label: '羽落术',
      }),
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: hero.id, reason: 'landed',
    }))
  })

  it('spends the caster reaction and slot before a Host-authoritative fall, then descends at most 60 feet', () => {
    const hero = createDnd5eCombatant({
      ...base, id: 'hero', name: '英雄', controller: 'player', initiative: 20,
      armorClass: 14, currentHp: 20, maxHp: 20, speed: 30,
      position: { x: 0, y: 0 }, elevationFeet: 100, groundElevationFeet: 0,
    })
    const caster = createDnd5eCombatant({
      ...base, id: 'caster', name: '法师', controller: 'player', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30, position: { x: 5, y: 0 },
      classId: 'wizard', classLevels: { wizard: 5 },
      classSelections: { 'spell-prepared': ['feather-fall'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('feather-fall-reaction', [hero, caster])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(hero.id, caster.id)]: 5,
    }
    expect(dnd5eFeatherFallReactionOption(state.combatants[caster.id])).toEqual({
      slotLevel: 1,
      castingClassId: 'wizard',
    })
    const reaction = resolveDnd5eFeatherFallReaction(state, {
      casterId: caster.id,
      falls: [{
        combatantId: hero.id,
        fromElevationFeet: 100,
        groundElevationFeet: 0,
        fallDistanceFeet: 100,
        fallingDamageDice: 10,
      }],
    })
    expect(reaction.ok, reaction.ok ? undefined : reaction.reason).toBe(true)
    if (!reaction.ok) return
    expect(reaction.state.combatants[caster.id].turn.reactionAvailable).toBe(false)
    expect(reaction.state.combatants[caster.id].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(reaction.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', actorId: caster.id, spellId: 'feather-fall', slotLevel: 1,
    }))

    const descent = resolveDnd5eHeadlessAction(reaction.state, {
      type: 'begin-turn', actorId: hero.id,
    })
    expect(descent.ok, descent.ok ? undefined : descent.reason).toBe(true)
    if (!descent.ok) return
    expect(descent.state.combatants[hero.id]).toMatchObject({
      currentHp: 20,
      elevationFeet: 40,
      groundElevationFeet: 0,
      airborne: true,
    })
    expect(descent.events).toContainEqual(expect.objectContaining({
      type: 'controlled-descent-resolved', actorId: hero.id,
      distanceFeet: 60, landed: false,
    }))
    expect(descent.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
  })
})

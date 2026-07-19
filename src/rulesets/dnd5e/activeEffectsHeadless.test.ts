import { describe, expect, it } from 'vitest'
import { createDnd5eConditionEffect } from './activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

const abilities = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 } as const

function combatant(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2,
    armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
    ...patch,
  })
}

describe('ActiveEffectInstance Headless 生命周期', () => {
  it('ticks a round duration only once at the same turn boundary', () => {
    const startEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'actor', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start' },
    })
    const state = startDnd5eHeadlessCombat('single-boundary-tick', [
      combatant('actor', 20, { classState: { activeEffects: [startEffect] } }),
      combatant('target', 10),
    ])
    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'actor', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.actor.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'single-boundary-tick:1:actor' })

    const dashed = resolveDnd5eHeadlessAction(moved.state, { type: 'dash', actorId: 'actor' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.actor.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'single-boundary-tick:1:actor' })
  })

  it('does not run a creature turn-start boundary for an off-turn transaction', () => {
    const startEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'reactor', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start' },
    })
    const state = startDnd5eHeadlessCombat('off-turn-boundary', [
      combatant('actor', 20),
      combatant('reactor', 10, {
        concentrating: true,
        classState: { concentrationSpellId: 'bless', activeEffects: [startEffect] },
      }),
    ])
    const saved = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'reactor', d20: 20, dc: 10,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.state.combatants.reactor.classState.activeEffects?.[0].duration)
      .toEqual({ type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start', lastTickTurnKey: undefined })
  })

  it('does not tick the next creature twice after authoritative turn advancement', () => {
    const startEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'target', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start' },
    })
    const state = startDnd5eHeadlessCombat('turn-transition-boundary', [
      combatant('actor', 20),
      combatant('target', 10, { classState: { activeEffects: [startEffect] } }),
    ])
    const advanced = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'actor' })
    expect(advanced.ok).toBe(true)
    if (!advanced.ok) return
    expect(advanced.state.combatants.target.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'turn-transition-boundary:1:target' })

    const dashed = resolveDnd5eHeadlessAction(advanced.state, { type: 'dash', actorId: 'target' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.target.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'turn-transition-boundary:1:target' })
  })

  it('removes effects on movement, attacking, being targeted, being hit and taking damage', () => {
    const moverEffect = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'actor', source: { kind: 'dm' }, breakOn: ['moves'],
    })
    let state = startDnd5eHeadlessCombat('events', [
      combatant('actor', 20, { classState: { activeEffects: [moverEffect] } }),
      combatant('target', 10, { position: { x: 10, y: 0 } }),
    ])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'actor', to: { x: 5, y: 0 }, distance: 5 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.actor.classState.activeEffects).toBeUndefined()
    expect(moved.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', reason: 'moves' }))

    const attackBreak = createDnd5eConditionEffect({
      condition: 'invisible', targetId: 'actor', source: { kind: 'feature' }, breakOn: ['makes-attack'],
    })
    const targetBreaks = [
      createDnd5eConditionEffect({ condition: 'charmed', targetId: 'target', source: { kind: 'feature' }, breakOn: ['targeted-by-attack'] }),
      createDnd5eConditionEffect({ condition: 'deafened', targetId: 'target', source: { kind: 'feature' }, breakOn: ['hit-by-attack'] }),
      createDnd5eConditionEffect({ condition: 'poisoned', targetId: 'target', source: { kind: 'feature' }, breakOn: ['takes-damage'] }),
    ]
    state = startDnd5eHeadlessCombat('attack-events', [
      combatant('actor', 20, { classState: { activeEffects: [attackBreak] } }),
      combatant('target', 10, { position: { x: 5, y: 0 }, classState: { activeEffects: targetBreaks } }),
    ])
    const attacked = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 8, d20: 15,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4] },
    })
    expect(attacked.ok).toBe(true)
    if (!attacked.ok) return
    expect(attacked.state.combatants.actor.classState.activeEffects).toBeUndefined()
    expect(attacked.state.combatants.target.classState.activeEffects).toBeUndefined()
    expect(attacked.events.filter((event) => event.type === 'active-effect-removed').map((event) => event.reason))
      .toEqual(expect.arrayContaining(['makes-attack', 'targeted-by-attack', 'hit-by-attack', 'takes-damage']))
  })

  it('ends concentration-linked effects when the source loses concentration', () => {
    const linked = createDnd5eConditionEffect({
      condition: 'restrained', targetId: 'target', source: { kind: 'spell', actorId: 'caster', rulesId: 'web' },
      duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'web' },
    })
    const state = startDnd5eHeadlessCombat('concentration', [
      combatant('caster', 20, {
        concentrating: true,
        classState: { concentrationSpellId: 'web', concentrationTargetIds: ['target'], concentrationRoundsRemaining: 10 },
      }),
      combatant('target', 10, { classState: { activeEffects: [linked], concentrationEffectsBySource: { caster: 'web' } } }),
    ])
    const resolved = resolveDnd5eHeadlessAction(state, { type: 'concentration-save', actorId: 'caster', d20: 1, dc: 10 })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.caster.concentrating).toBe(false)
    expect(resolved.state.combatants.target.classState.activeEffects).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', reason: 'concentration-ended' }))
  })

  it('resolves repeated end-of-turn saves and round expiry authoritatively', () => {
    const savedEffect = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'actor', source: { kind: 'spell', actorId: 'target' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'con', dc: 12, timing: 'target-turn-end', onSuccess: 'remove' },
    })
    const expiredEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'actor', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
    })
    const state = startDnd5eHeadlessCombat('turn-end', [
      combatant('actor', 20, { classState: { activeEffects: [savedEffect, expiredEffect] } }),
      combatant('target', 10),
    ])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn', actorId: 'actor',
      activeEffectSavingThrows: [{ effectId: savedEffect.id, d20: 20 }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.actor.classState.activeEffects).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'active-effect-save-resolved', success: true }))
    expect(resolved.events.filter((event) => event.type === 'active-effect-removed').map((event) => event.reason))
      .toEqual(expect.arrayContaining(['save-succeeded', 'expired']))
  })

  it('resolves the next creature repeated start-of-turn save during the authoritative turn transaction', () => {
    const startSave = createDnd5eConditionEffect({
      condition: 'restrained', targetId: 'target', source: { kind: 'spell', actorId: 'actor' },
      duration: { type: 'rounds', remainingRounds: 2, tickOn: 'target-turn-start' },
      repeatSave: { ability: 'str', dc: 12, timing: 'target-turn-start', onSuccess: 'remove' },
    })
    const state = startDnd5eHeadlessCombat('turn-start-save', [
      combatant('actor', 20),
      combatant('target', 10, { classState: { activeEffects: [startSave] } }),
    ])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn', actorId: 'actor',
      turnStartActiveEffectSavingThrows: [{ effectId: startSave.id, d20: 20 }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.target.classState.activeEffects).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved', targetId: 'target', success: true,
    }))
  })
})

import { expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eHeadlessTurnKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'
import { withDnd5eWeaponHitCheckpoints } from './weaponHitCheckpoint'
import { createDnd5eWeaponHitSession } from './weaponHitSession'

function fixture(critical = false) {
  const make = (id: string) => createDnd5eCombatant({ id, name: id, initiative: id === 'actor' ? 20 : 10,
    controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    concentrating: false, position: { x: 0, y: 0 }, classResources: { focus: { current: 1, max: 1 } } })
  const state = startDnd5eHeadlessCombat('hit-checkpoint', [make('actor'), make('target')])
  state.combatants.target.damageResistances = ['slashing']
  const action: Dnd5eAction = { type: 'attack', actorId: 'actor', targetId: 'target', d20: critical ? 20 : 18,
    attackModifier: 5, damage: { count: 1, sides: 6, rolls: critical ? [3, 3] : [3], bonus: 0, type: 'slashing' },
    classDamageContext: { mode: 'melee', weaponId: 'sword', finesse: false, strengthBased: true,
      weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false } }
  return { state, action }
}

it('replays a frozen attack once, rejects changed state and stale hit replies', () => {
  const { state, action } = fixture(), original = structuredClone(state)
  const session = createDnd5eWeaponHitSession(state, action, () => true)
  const pending = session.run(state)
  expect(pending.status).toBe('pending')
  if (pending.status !== 'pending') throw Error('expected pending')
  expect(state).toEqual(original)
  expect(session.resume(state, { ...pending.event, targetId: 'actor' }, pending.index)).toEqual({ status: 'rejected', reason: 'stale-hit' })
  if (action.type === 'attack') action.damage.rolls = [6]
  pending.snapshot.combatants.target.currentHp = 1
  const result = session.resume(state, pending.event, pending.index, {
    extraDice: { count: 1, rolls: [3], doubleOnCritical: true }, resourceCosts: [{ resourceId: 'focus', amount: 1 }],
  })
  expect(result.status).toBe('resolved')
  if (result.status !== 'resolved') throw Error('expected resolution')
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.target.currentHp).toBe(17)
  expect(result.result.state.combatants.actor.classResources.focus.current).toBe(0)
  expect(session.resume(state, pending.event, pending.index)).toEqual({ status: 'rejected', reason: 'session-ended' })
  const stale = createDnd5eWeaponHitSession(state, action, () => true)
  const p = stale.run(state)
  if (p.status !== 'pending') throw Error('expected pending')
  const changed = structuredClone(state); changed.combatants.actor.currentHp--
  expect(stale.resume(changed, p.event, p.index)).toEqual({ status: 'rejected', reason: 'stale-state' })
})

it.each([false, true])('adds accepted hit dice before defenses and a single HP commit (critical=%s)', critical => {
  const { state, action } = fixture(critical), original = structuredClone(state)
  let calls = 0
  const result = withDnd5eWeaponHitCheckpoints((event, snapshot) => {
    calls++
    expect(event.critical).toBe(critical)
    expect(snapshot.combatants.target.currentHp).toBe(20)
    // A decision UI cannot mutate authority by keeping or changing this snapshot.
    snapshot.combatants.target.currentHp = 1
    event.weaponDamageDice!.sides = 20
    return { extraDice: { count: 1, rolls: critical ? [3, 3] : [3], doubleOnCritical: true },
      resourceCosts: [{ resourceId: 'focus', amount: 1 }] }
  }, () => resolveDnd5eHeadlessAction(state, action))
  expect(result.ok, result.ok ? '' : result.reason).toBe(true)
  expect(calls).toBe(1)
  expect(result.state.combatants.target.currentHp).toBe(critical ? 14 : 17)
  expect(result.state.combatants.actor.classResources.focus.current).toBe(0)
  expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
  expect(result.events.filter(event => event.type === 'damage-defense-resolved')).toHaveLength(1)
  expect(state).toEqual(original)
})

it.each(['decline', 'bad-dice', 'overspend', 'duplicate-cost', 'throw'] as const)('keeps incomplete hit decisions atomic (%s)', mode => {
  const { state, action } = fixture(), original = structuredClone(state)
  const run = () => withDnd5eWeaponHitCheckpoints(() => {
    if (mode === 'throw') throw Error('pause-hit')
    if (mode === 'decline') return
    return { extraDice: { count: 1, rolls: [mode === 'bad-dice' ? 7 : 3], doubleOnCritical: true },
      resourceCosts: mode === 'duplicate-cost' ? [{ resourceId: 'focus', amount: 1 }, { resourceId: 'focus', amount: 1 }]
        : [{ resourceId: 'focus', amount: mode === 'overspend' ? 2 : 1 }] }
  }, () => resolveDnd5eHeadlessAction(state, action))
  if (mode === 'throw') expect(run).toThrow('pause-hit')
  else {
    const result = run()
    expect(result.ok).toBe(mode === 'decline')
    expect(result.state.combatants.target.currentHp).toBe(mode === 'decline' ? 19 : 20)
    expect(result.state.combatants.actor.classResources.focus.current).toBe(1)
  }
  expect(state).toEqual(original)
  // Completed, rejected and suspended scopes all remove their listener.
  const ordinary = resolveDnd5eHeadlessAction(state, action)
  expect(ordinary.ok).toBe(true)
  expect(ordinary.state.combatants.target.currentHp).toBe(19)
})


it.each(['duplicate', 'already-used'] as const)('rejects invalid hit usage atomically (%s)', mode => {
  const { state, action } = fixture()
  if (mode === 'already-used') state.combatants.actor.classState.declarativeUsedTurnKeys = { hit: dnd5eHeadlessTurnKey(state, 'actor') }
  const original = structuredClone(state)
  const result = withDnd5eWeaponHitCheckpoints(() => ({
    extraDice: { count: 1, rolls: [3], doubleOnCritical: true },
    resourceCosts: [{ resourceId: 'focus', amount: 1 }], usageKeys: mode === 'duplicate' ? ['hit', 'hit'] : ['hit'],
  }), () => resolveDnd5eHeadlessAction(state, action))
  expect(result.ok).toBe(false)
  expect(result.state).toEqual(original)
  expect(state).toEqual(original)
})


it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid typed hit damage before paying resources (%s)', amount => {
  const { state, action } = fixture(), original = structuredClone(state)
  const result = withDnd5eWeaponHitCheckpoints(() => ({
    damageComponents: [{ amount, type: 'radiant' }], resourceCosts: [{ resourceId: 'focus', amount: 1 }],
  }), () => resolveDnd5eHeadlessAction(state, action))
  expect(result.ok).toBe(false)
  expect(result.state).toEqual(original)
  expect(state).toEqual(original)
})

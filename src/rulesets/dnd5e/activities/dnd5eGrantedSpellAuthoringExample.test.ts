import { expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { dnd5eSpellActivityReachabilityIssues } from './dnd5eSpellActivityReachability'
import { DND5E_GRANTED_SPELL_AUTHORING_EXAMPLE } from './dnd5eGrantedSpellAuthoringExample'

it('executes the published spell grant example and revokes access on expiry despite spell ownership', () => {
  const packageId = 'test.granted-spell-example'
  const activities = JSON.parse(JSON.stringify(DND5E_GRANTED_SPELL_AUTHORING_EXAMPLE))
  expect(dnd5eSpellActivityReachabilityIssues(activities, 'example-granted-spell')).toEqual([])
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities })
  try {
    const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    actor.classSelections = { spells: [packageId + ':example-granted-spell'] }
    const other = createDnd5eCombatant({ ...actor, id: 'other', name: 'Other', initiative: 0, classSelections: {} })
    let state = startDnd5eHeadlessCombat('grant-example', [actor, other])
    const run = (activityId: string) => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      confirmedBy: 'actor', authoritativeRolls: {}, command: { schemaVersion: 1, commandId: activityId,
        actorId: 'actor', packageId, packageVersion: '1.0.0', activityId, targetIds: ['actor'], expectedRevision: 1 } }).result
    const before = structuredClone(state)
    expect(run('example-follow-up').ok).toBe(false)
    expect(state).toEqual(before)
    const cast = run('example-cast')
    expect(cast.ok, JSON.stringify(cast)).toBe(true)
    if (!cast.ok) throw new Error('Example casting failed')
    state = JSON.parse(JSON.stringify(cast.state))
    expect(state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(state.combatants.actor.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('example-follow-up'))).toBe(true)
    const follow = run('example-follow-up')
    expect(follow.ok, JSON.stringify(follow)).toBe(true)
    if (!follow.ok) throw new Error('Example follow-up failed')
    state = follow.state
    expect(state.combatants.actor.temporaryHp).toBe(2)
    expect(state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    for (const actorId of ['actor', 'other', 'actor', 'other', 'actor', 'other']) {
      const next = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
      expect(next.ok, JSON.stringify(next)).toBe(true)
      state = JSON.parse(JSON.stringify(next.state))
    }
    expect(state.combatants.actor.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('example-follow-up')) ?? false).toBe(false)
    expect(state.combatants.actor.turn.bonusActionAvailable).toBe(true)
    const expired = structuredClone(state)
    expect(run('example-follow-up').ok).toBe(false)
    expect(state).toEqual(expired)
  } finally { registration.dispose() }
})

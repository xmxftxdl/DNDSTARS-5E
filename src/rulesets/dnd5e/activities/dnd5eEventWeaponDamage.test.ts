import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { materializeDnd5eEventWeaponDice } from './dnd5eEventWeaponDice'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'hit-bonus', name: 'Synthetic optional hit dice', activation: { kind: 'free' },
  invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' },
  target: { kind: 'creature', relation: 'enemy', count: 1 },
  requirements: [{ kind: 'attack-weapon-category', categories: ['simple', 'martial'] }],
  consumption: [{ kind: 'resource', resourceId: 'focus', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
  outcomes: [{ id: 'bonus', when: { kind: 'always' }, operations: [{ id: 'bonus', kind: 'damage', target: 'target',
    amount: { kind: 'constant', value: 0 }, weaponDiceFromTrigger: { rollId: 'bonus', count: 1 },
    damageType: 'inherit-primary', critical: 'double-dice', magical: false }] }],
  automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'hit-bonus' },
}

it('refuses missing attack evidence instead of substituting current equipment or authored dice', () => {
  expect(() => materializeDnd5eEventWeaponDice(activity)).toThrow('activity-trigger-weapon-dice-unavailable')
  for (const category of ['weapon', 'spell'] as const) for (const result of ['hit', 'miss'] as const) {
    const context = { eventId: 'test', event: 'attack-hit' as const, eligibleActorIds: ['actor'], eligibleTargetIds: ['target'],
      source: { kind: 'attack' as const, mode: 'melee' as const, category, result, damageType: 'slashing' as const,
        weaponDamageDice: { count: 2, sides: 6 } } }
    if (category === 'weapon' && result === 'hit') {
      expect(materializeDnd5eEventWeaponDice(activity, context).outcomes[0].operations[0]).toMatchObject({
        amount: { kind: 'dice', count: 1, sides: 6, rollId: 'bonus' },
      })
    } else expect(() => materializeDnd5eEventWeaponDice(activity, context)).toThrow('activity-trigger-weapon-dice-unavailable')
  }
  expect(activity.outcomes[0].operations[0]).toHaveProperty('amount', { kind: 'constant', value: 0 })
})

it.each([
  { d20: 18, sides: 12, count: 1, accept: true, invalid: false },
  { d20: 20, sides: 6, count: 2, accept: true, invalid: false },
  { d20: 18, sides: 8, count: 1, accept: false, invalid: false },
  { d20: 18, sides: 8, count: 1, accept: true, invalid: true },
])('settles optional damage on the triggering hit atomically (%j)', async scenario => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  registerDnd5eActivityPackage({ packageId: 'test.event-weapon', packageVersion: '1.0.0', activities: [activity] })
  try {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: id === 'actor' ? 'player' : 'dm',
      initiative: id === 'actor' ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 },
      concentrating: false, classResources: { focus: { current: 1, max: 1 } } })
    const actor = make('actor'), target = make('target')
    actor.pluginFeatureIds = ['hit-bonus']
    const state = startDnd5eHeadlessCombat('event-weapon', [actor, target])
    const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target',
      attackModifier: 5, d20: scenario.d20, damage: { count: scenario.count, sides: scenario.sides, bonus: 0,
        rolls: Array.from({ length: scenario.count * (scenario.d20 === 20 ? 2 : 1) }, () => 2), type: 'slashing' },
      classDamageContext: { mode: 'melee', weaponId: 'test-sword', weaponCategory: 'martial', weaponDamageSides: scenario.sides,
        finesse: false, strengthBased: true, damageType: 'slashing', adjacentEnemyOfTarget: false },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) throw Error(attack.reason)
    let confirmations = 0, rolls = 0
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events,
      eventBatchId: 'attack-1', combatRevision: 1,
      confirm: async request => { confirmations++; expect(request.actorId).toBe('actor'); return scenario.accept },
      roll: async request => {
        rolls++
        expect(request.sides).toBe(scenario.sides)
        expect(request.count).toBe(scenario.d20 === 20 ? 2 : 1)
        return Array.from({ length: request.count }, () => scenario.invalid ? scenario.sides + 1 : 3)
      },
    })
    expect(confirmations).toBe(1)
    expect(rolls).toBe(scenario.accept ? 1 : 0)
    const accepted = scenario.accept && !scenario.invalid
    expect(settled.state.combatants.target.currentHp).toBe(attack.state.combatants.target.currentHp - (accepted ? scenario.d20 === 20 ? 6 : 3 : 0))
    expect(settled.state.combatants.actor.classResources.focus.current).toBe(accepted ? 0 : 1)
    expect(attack.state.combatants.actor.classResources.focus.current).toBe(1)
    if (!scenario.invalid) {
      const replay = await settleDnd5eActivityTriggerWindowsV1({ state: JSON.parse(JSON.stringify(settled.state)),
        events: attack.events, eventBatchId: 'attack-1', combatRevision: settled.combatRevision,
        confirm: async () => { throw Error('replayed choice') }, roll: async () => { throw Error('replayed dice') } })
      expect(replay.state.combatants.target.currentHp).toBe(settled.state.combatants.target.currentHp)
      expect(replay.state.combatants.actor.classResources.focus.current).toBe(accepted ? 0 : 1)
    }
  } finally { clearDnd5eActivityRegistryForTests() }
})

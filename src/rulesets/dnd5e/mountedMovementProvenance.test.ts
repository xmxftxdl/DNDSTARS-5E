import { expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, previewDnd5eMountedBalance, resolveDnd5eMountedBalanceAfterAction } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from './activeEffects'
import { listDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerWindows'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'

it('carries a shoved mount rider until the pending save resolves, without spending rider movement', () => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'enemy' ? 'dm' : 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false, sizeRank: id === 'mount' ? 3 : 2 })
  let source = startDnd5eHeadlessCombat('mounted-shove', [make('rider', 30), make('enemy', 20), make('mount', 10)])
  source.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('rider', 'mount')]: 5, [dnd5eCombatantPairKey('enemy', 'mount')]: 5 }
  const mount = resolveDnd5eHeadlessAction(source, { type: 'mount-creature', actorId: 'rider', targetId: 'mount', hostApproved: true })
  expect(mount.ok).toBe(true)
  source = mount.state
  source.initiativeIndex = 1
  const pushed = resolveDnd5eHeadlessAction(source, { type: 'shove', actorId: 'enemy', targetId: 'mount',
    actorD20: 20, targetD20: 1, targetDefense: 'athletics', outcome: 'push', pushTo: { x: 50, y: 0 }, pushDistanceFeet: 5 })
  expect(pushed.ok).toBe(true)
  expect(pushed.state.combatants.rider.position).toEqual({ x: 50, y: 0 })
  expect(pushed.events).toContainEqual(expect.objectContaining({ type: 'moved', actorId: 'mount', movementKind: 'forced' }))
  expect(pushed.events).toContainEqual(expect.objectContaining({ type: 'moved', actorId: 'rider', movementKind: 'mounted', straightDistanceFeet: 0 }))
  expect(previewDnd5eMountedBalance(source, pushed)).toHaveLength(1)
  const before = JSON.stringify(source)
  const pending = resolveDnd5eMountedBalanceAfterAction(source, pushed, {})
  expect(pending).toMatchObject({ ok: false, events: [] })
  expect(JSON.stringify(pending.state)).toBe(before)
  const saved = resolveDnd5eMountedBalanceAfterAction(source, pushed, { rider: { d20: 15 } })
  expect(saved.ok).toBe(true)
  expect(saved.state.combatants.rider.turn.movementRemaining).toBe(source.combatants.rider.turn.movementRemaining)
  expect(saved.state.combatants.mount.classState.activeEffects?.some(effect => effect.relation?.slotGroup === 'riding')).toBe(true)
})

it.each(['riding', 'dragging'] as const)('distinguishes mounted riders from other coupled movement: %s', slotGroup => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
    abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 40, position: { x: 0, y: 0 }, concentrating: false })
  const mount = make('mount', 30), rider = make('rider', 20), enemy = make('enemy', 10)
  enemy.controller = 'dm'
  rider.pluginFeatureIds = ['test.mounted:observe']
  mount.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'synthetic-riding', label: 'Riding',
    source: { kind: 'feature', actorId: rider.id, rulesId: 'basic-action:mount' }, targetId: mount.id, legacyCondition: 'attached',
    relation: { schemaVersion: 1, kind: 'attachment', sourceActorId: rider.id, sourceActionId: 'basic-action:mount',
      slotGroup: 'riding', maxDistanceFeet: 5, movement: 'source-rides-target', endsOnSourceIncapacitated: true } })]
  if (slotGroup === 'dragging') {
    mount.classState.activeEffects = []
    rider.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'grappled',
      source: { kind: 'feature', actorId: mount.id, rulesId: 'basic-action:grapple' }, targetId: rider.id,
      relation: { schemaVersion: 1, kind: 'grapple', sourceActorId: mount.id, sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand', maxDistanceFeet: 5, movement: 'drag-target', endsOnSourceIncapacitated: true } })]
  }
  const registration = registerDnd5eActivityPackage({ packageId: 'test.mounted', packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'observe', name: 'Mounted movement observer', activation: { kind: 'free' }, target: { kind: 'self' },
    legacySource: { kind: 'feature', id: 'observe' }, automation: automationCapabilityFromLegacyStatus('full'),
    invocation: { kind: 'triggered', event: 'movement-completed', confirmation: 'automatic' },
    requirements: [{ kind: 'movement-property', movementKind: 'mounted' }, { kind: 'movement-distance', basis: 'straight-streak', minimumFeet: 10 }],
    outcomes: [{ id: 'observe', when: { kind: 'always' }, operations: [{ id: 'benefit', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 1 } }] }],
  }] })
  try {
    let state = startDnd5eHeadlessCombat('mounted-provenance', [mount, rider, enemy])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(mount.id, rider.id)]: 0 }
    const riderBudget = state.combatants.rider.turn.movementRemaining
    for (const [index, x] of [50, 100].entries()) {
      const result = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: mount.id, to: { x, y: 0 }, distance: 5, straightLine: true })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      const event = result.events.find(event => event.type === 'moved' && event.actorId === rider.id)
      expect(event, JSON.stringify(result.events)).toMatchObject({ type: 'moved', sourceActorId: mount.id, movementKind: slotGroup === 'riding' ? 'mounted' : 'forced',
        straightDistanceFeet: slotGroup === 'riding' ? (index + 1) * 5 : 0 })
      expect(result.state.combatants.rider.position).toEqual({ x, y: 0 })
      expect(result.state.combatants.rider.turn.movementRemaining).toBe(riderBudget)
      const windows = listDnd5eActivityTriggerWindowsV1({ state: result.state, events: result.events, eventBatchId: `move-${index}` })
      expect(windows.some(window => window.triggerContext.eligibleActorIds.includes('rider'))).toBe(slotGroup === 'riding' && index === 1)
      state = JSON.parse(JSON.stringify(result.state))
    }
  } finally { registration.dispose() }
})

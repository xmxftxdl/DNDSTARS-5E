import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'

const charger: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1,
  id: 'charger-test',
  name: 'Charger test',
  activation: { kind: 'passive', timing: 'after movement' },
  invocation: { kind: 'triggered', event: 'movement-completed', confirmation: 'actor-choice', retention: 'until-turn-end' },
  target: { kind: 'self' },
  requirements: [
    { kind: 'event-source', source: 'movement' },
    { kind: 'movement-distance', minimumFeet: 10 },
    { kind: 'movement-property', straightLine: true, dashedThisTurn: true },
    { kind: 'action-economy-available', economy: 'bonus-action' },
  ],
  choices: [{
    id: 'mode', label: 'Mode', defaultOptionId: 'shove',
    options: [{ id: 'shove', label: 'Shove' }, { id: 'attack', label: 'Attack' }],
  }],
  outcomes: [{
    id: 'grant', when: { kind: 'choice', choiceId: 'mode', optionId: 'shove' }, operations: [{
      id: 'grant-shove', kind: 'grant-basic-action', target: 'actor',
      grantId: 'charger-shove', label: 'Charger shove', economy: 'bonus-action',
      expires: 'turn-end', actions: ['shove'], shovePushDistanceBonusFeet: 10,
    }],
  }],
  automation: automationCapabilityFromLegacyStatus('full'),
  legacySource: { kind: 'feat', id: 'charger' },
}

function combatant(id: string, controller: 'player' | 'dm', initiative: number, x: number) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative,
    abilities: { str: 16, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0,
    speed: 30, position: { x, y: 0 }, concentrating: false,
    pluginFeatureIds: id === 'actor' ? ['charger'] : [],
  })
}

describe('unified Activity basic action grants', () => {
  afterEach(() => clearDnd5eActivityRegistryForTests())

  it('derives Dash and straight-line history, then consumes a bonus-action shove credential', async () => {
    registerDnd5eActivityPackage({ packageId: 'local.test.charger', packageVersion: '1.0.0', activities: [charger] })
    const initial = startDnd5eHeadlessCombat('charger-combat', [
      combatant('actor', 'player', 20, 0),
      combatant('target', 'dm', 10, 15),
    ])
    const dashed = resolveDnd5eHeadlessAction(initial, { type: 'dash', actorId: 'actor' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    const moved = resolveDnd5eHeadlessAction(dashed.state, {
      type: 'move', actorId: 'actor', to: { x: 10, y: 0 },
      distance: 10, movementCost: 10, straightLine: true,
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return

    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: moved.state,
      events: moved.events,
      eventBatchId: 'charger-move',
      combatRevision: 1,
      confirm: async () => ({ accepted: true, choices: { mode: 'shove' } }),
      roll: async () => [],
    })
    expect(settled.state.combatants.actor.classState.activityBasicActionGrants?.['charger-shove'])
      .toMatchObject({ actions: ['shove'], shovePushDistanceBonusFeet: 10 })

    settled.state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('actor', 'target')]: 5,
    }
    const shoved = resolveDnd5eHeadlessAction(settled.state, {
      type: 'shove', actorId: 'actor', targetId: 'target',
      actorD20: 20, targetD20: 1, targetDefense: 'athletics', outcome: 'push',
      pushTo: { x: 30, y: 0 }, pushDistanceFeet: 15,
      spendAction: false, spendBonusAction: true,
      activityBasicActionGrantId: 'charger-shove',
    })
    expect(shoved.ok, shoved.ok ? undefined : shoved.reason).toBe(true)
    if (!shoved.ok) return
    expect(shoved.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(shoved.state.combatants.actor.classState.activityBasicActionGrants).toBeUndefined()
    expect(shoved.events).toContainEqual(expect.objectContaining({
      type: 'moved', actorId: 'target', distance: 15,
    }))
  })

  it('does not grant Charger from a bent authoritative path', async () => {
    registerDnd5eActivityPackage({ packageId: 'local.test.charger', packageVersion: '1.0.0', activities: [charger] })
    const initial = startDnd5eHeadlessCombat('charger-bent', [
      combatant('actor', 'player', 20, 0),
      combatant('target', 'dm', 10, 15),
    ])
    const dashed = resolveDnd5eHeadlessAction(initial, { type: 'dash', actorId: 'actor' })
    if (!dashed.ok) return
    const moved = resolveDnd5eHeadlessAction(dashed.state, {
      type: 'move', actorId: 'actor', to: { x: 10, y: 0 },
      distance: 10, movementCost: 10, straightLine: false,
    })
    if (!moved.ok) return
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: moved.state, events: moved.events, eventBatchId: 'bent', combatRevision: 1,
      confirm: async () => true, roll: async () => [],
    })
    expect(settled.diagnostics).toHaveLength(0)
    expect(settled.state.combatants.actor.classState.activityBasicActionGrants).toBeUndefined()
  })
})

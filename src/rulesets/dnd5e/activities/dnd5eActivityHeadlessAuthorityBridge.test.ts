import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../../store/characters'
import { createDnd5eCombatant, commitDnd5eActivityExecution, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from '../items'
import type { Dnd5eActivityExecutionResult } from './dnd5eActivityExecutor'
import { resolveAndCommitDnd5eActivityCommand } from './dnd5eActivityHeadlessAuthorityBridge'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'

const abilities = { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 } as const

afterEach(clearDnd5eActivityRegistryForTests)

function combatant(id: string, controller: 'player' | 'dm', initiative: number) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative, abilities, proficiencyBonus: 3,
    armorClass: 14, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
    classResources: controller === 'player'
      ? { 'dnd5e-spell-slot-3': { current: 1, max: 1 }, focus: { current: 2, max: 2 } }
      : undefined,
  })
}

describe('Activity Headless authority commit bridge', () => {
  it('commits effects and costs atomically while returning map-owned handoffs', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-bridge', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true,
      status: 'resolved',
      checks: [],
      consumptions: [
        { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
        { kind: 'spell-slot', minimumLevel: 3, level: 'selected', amount: 1, consumeOn: 'resolve' },
        { kind: 'resource', resourceId: 'focus', amount: 1, consumeOn: 'resolve' },
      ],
      proposals: [
        { kind: 'deal-damage', operationId: 'damage', targetId: 'target', amount: 9, damageType: 'fire', magical: true },
        { kind: 'create-persistent-area', operationId: 'area', label: 'Fire zone', durationRounds: 10, concentration: true },
      ],
      areaInstance: { origin: 'point', shape: 'circle', x: 10, y: 20, radiusFeet: 10 },
    }
    const result = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:test-fire-zone', castLevel: 3,
      targetIds: ['target'], resolution,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(21)
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.actor.classResources['dnd5e-spell-slot-3']?.current).toBe(0)
    expect(result.state.combatants.actor.classResources.focus?.current).toBe(1)
    expect(result.activityHandoffs?.persistentAreas).toHaveLength(1)
    expect(result.areaInstance).toMatchObject({ shape: 'circle', x: 10, y: 20, radiusFeet: 10 })
    expect(result.state.combatants.actor.classState.concentrationSpellId).toBe('activity:spell:test-fire-zone')
  })

  it('does not partially mutate the source when a cost is unavailable', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-bridge-failure', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [],
      consumptions: [{ kind: 'resource', resourceId: 'focus', amount: 3, consumeOn: 'resolve' }],
      proposals: [{ kind: 'deal-damage', operationId: 'damage', targetId: 'target', amount: 9, damageType: 'fire', magical: true }],
    }
    const result = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'feature:test', targetIds: ['target'], resolution,
    })
    expect(result.ok).toBe(false)
    expect(state.combatants.target.currentHp).toBe(30)
    expect(state.combatants.actor.classResources.focus?.current).toBe(2)
  })

  it('refuses to interpret an item charge as a spoofed class resource', () => {
    const actor = combatant('actor', 'player', 20)
    actor.classResources['item:test:quantity'] = { current: 99, max: 99 }
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-item-core-guard', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true,
      status: 'resolved',
      checks: [],
      consumptions: [{
        kind: 'item-charge', resourceId: 'item:test:quantity', amount: 1, consumeOn: 'resolve',
      }],
      proposals: [{
        kind: 'deal-damage', operationId: 'damage', targetId: 'target', amount: 5, damageType: 'force', magical: true,
      }],
    }
    const result = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'item:test', targetIds: ['target'], resolution,
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
    expect(result.state.combatants.target.currentHp).toBe(30)
    expect(result.state.combatants.actor.classResources['item:test:quantity']?.current).toBe(99)
  })

  it('atomically spends a real item instance and durably deduplicates the command', () => {
    registerDnd5eActivityPackage({
      packageId: 'test.item-package',
      packageVersion: '1.0.0',
      activities: [{
        schemaVersion: 1,
        id: 'item:srd-5.1:item:potion-of-healing:use',
        name: 'Charged strike',
        activation: { kind: 'action' },
        target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
        consumption: [
          { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
          {
            kind: 'item-charge',
            resourceId: 'item:srd-5.1:item:potion-of-healing:quantity',
            amount: { kind: 'constant', value: 1 },
            consumeOn: 'resolve',
          },
        ],
        outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
          id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 5 }, damageType: 'force',
        }] }],
        automation: automationCapabilityFromLegacyStatus('full'),
        legacySource: { kind: 'item', id: 'srd-5.1:item:potion-of-healing' },
      }],
    })
    const inventoryOwner = normalizeCharacter({
      id: 'actor', name: 'actor', player: 'actor', charClass: '法师', maxHp: 30, currentHp: 30,
      equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] },
    })
    const granted = applyDnd5eInventoryMutation([inventoryOwner], {
      type: 'grant', characterId: 'actor', templateId: 'srd-5.1:item:potion-of-healing', quantity: 2,
    })
    const owner = granted.characters[0]
    const entry = normalizeDnd5eInventory(owner).entries[0]
    const actorCombatant = combatant('actor', 'player', 20)
    const targetCombatant = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-item-bridge', [actorCombatant, targetCombatant])
    const command = {
      schemaVersion: 1 as const,
      commandId: 'item-command-1',
      actorId: 'actor',
      packageId: 'test.item-package',
      packageVersion: '1.0.0',
      activityId: 'item:srd-5.1:item:potion-of-healing:use',
      targetIds: ['target'],
      expectedRevision: 0,
      inventoryInstanceId: entry.instanceId,
      expectedInventoryRevision: normalizeDnd5eInventory(owner).revision ?? 0,
    }
    const actorSnapshot = {
      id: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
    }
    const targetSnapshot = {
      id: 'target', controller: 'dm' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
    }
    const first = resolveAndCommitDnd5eActivityCommand(state, {
      command,
      currentRevision: 0,
      actor: actorSnapshot,
      targets: [targetSnapshot],
      authoritativeRolls: {},
      distanceFeetByTargetId: { target: 15 },
      inventoryOwner: owner,
    })
    expect(first.phase).toBe('commit')
    if (first.phase !== 'commit' || !first.result.ok) return
    expect(first.result.state.combatants.target.currentHp).toBe(25)
    expect(first.result.state.combatants.actor.classResources['item:srd-5.1:item:potion-of-healing:quantity']).toBeUndefined()
    expect(normalizeDnd5eInventory(first.result.inventoryOwner!).entries[0].quantity).toBe(1)

    const replay = resolveAndCommitDnd5eActivityCommand(first.result.state, {
      command,
      currentRevision: 0,
      actor: actorSnapshot,
      targets: [targetSnapshot],
      authoritativeRolls: {},
      distanceFeetByTargetId: { target: 15 },
      inventoryOwner: first.result.inventoryOwner,
    })
    expect(replay).toMatchObject({
      phase: 'commit',
      result: { ok: true, inventoryDeduplicated: true, events: [] },
    })
    if (replay.phase === 'commit' && replay.result.ok) {
      expect(replay.result.state.combatants.target.currentHp).toBe(25)
      expect(normalizeDnd5eInventory(replay.result.inventoryOwner!).entries[0].quantity).toBe(1)
    }
  })
})

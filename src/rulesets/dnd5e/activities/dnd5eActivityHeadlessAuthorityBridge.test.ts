import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../../store/characters'
import { createDnd5eCombatant, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from '../items'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import type { DeclarativeSubclassDefinitionV1 } from '../declarativeSubclassAbility'
import type { Dnd5eActivityExecutionResult } from './dnd5eActivityExecutor'
import { resolveAndCommitDnd5eActivityCommand } from './dnd5eActivityHeadlessAuthorityBridge'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { dnd5eActivityFromDeclarativeSubclassAbility } from './legacyContentActivityAdapters'

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

  it('links repeat-save effects to the same authoritative concentration', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-repeat-save-concentration', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'apply-effect', operationId: 'apply', targetId: 'target',
        effectId: 'charm', name: 'Charm', concentration: true,
        duration: { kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'wis', dc: 14 },
        conditions: ['charmed'], modifierGroups: [], stacking: 'replace',
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:concentrated-charm', castLevel: 2,
      targetIds: ['target'], resolution, source: { kind: 'spell', id: 'concentrated-charm' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants.actor.classState.concentrationSpellId)
      .toBe('activity:spell:concentrated-charm')
    expect(committed.state.combatants.target.conditions).toContain('charmed')
    expect(committed.state.combatants.target.classState.activeEffects?.[0]).toMatchObject({
      duration: { type: 'concentration', remainingRounds: 10 },
      repeatSave: { ability: 'wis', dc: 14, timing: 'target-turn-end' },
    })

    const ended = resolveDnd5eHeadlessAction(committed.state, {
      type: 'concentration-save', actorId: 'actor', d20: 1, dc: 10,
    })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.target.conditions).not.toContain('charmed')
  })

  it('ends a source-linked concentration effect when its turn maintenance receipt is missing', () => {
    const state = startDnd5eHeadlessCombat('activity-source-maintenance', [
      combatant('actor', 'player', 20), combatant('target', 'dm', 10),
    ])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [
        {
          kind: 'apply-effect', operationId: 'apply-link', targetId: 'target',
          effectId: 'linked-charm', name: 'Linked Charm', concentration: true,
          duration: { kind: 'concentration', maximumRounds: 10 }, conditions: ['charmed'],
          modifierGroups: [], stacking: 'replace',
          sourceLink: { sourceRequiresEffectAtSourceTurnEnd: 'maintained-this-turn' },
        },
        {
          kind: 'apply-effect', operationId: 'initial-maintenance', targetId: 'actor',
          effectId: 'maintained-this-turn', name: 'Maintained', concentration: false,
          duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
          conditions: [], modifierGroups: [], stacking: 'refresh-duration',
        },
      ],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:maintained-link', castLevel: 2,
      targetIds: ['target'], resolution, source: { kind: 'spell', id: 'maintained-link' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return

    const firstEnd = resolveDnd5eHeadlessAction(committed.state, { type: 'end-turn', actorId: 'actor' })
    expect(firstEnd.ok).toBe(true)
    if (!firstEnd.ok) return
    expect(firstEnd.state.combatants.target.conditions).toContain('charmed')
    const targetEnd = resolveDnd5eHeadlessAction(firstEnd.state, { type: 'end-turn', actorId: 'target' })
    expect(targetEnd.ok).toBe(true)
    if (!targetEnd.ok) return
    expect(targetEnd.state.combatants.actor.classState.activeEffects?.some((effect) =>
      effect.definitionId.includes(':maintained-this-turn')) ?? false).toBe(false)
    const missingMaintenance = resolveDnd5eHeadlessAction(targetEnd.state, { type: 'end-turn', actorId: 'actor' })
    expect(missingMaintenance.ok).toBe(true)
    if (!missingMaintenance.ok) return
    expect(missingMaintenance.state.combatants.target.conditions).not.toContain('charmed')
    expect(missingMaintenance.state.combatants.actor.concentrating).toBe(false)
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

  it('routes an active native-mechanic Activity through its trusted Headless action', () => {
    const packageId = 'test.activity-native'
    const subclassId = 'fortune-bearer'
    const abilityId = 'prepared-fortune'
    const featureId = `${packageId}:${subclassId}.${abilityId}`
    const resourceId = `${packageId}:decl-${subclassId}-${abilityId}-uses`
    const definition: DeclarativeSubclassDefinitionV1 = {
      schemaVersion: 1,
      id: subclassId,
      classId: 'sorcerer',
      name: 'Fortune Bearer',
      summary: 'Synthetic native Activity route.',
      abilities: [{
        schemaVersion: 1,
        id: abilityId,
        name: 'Prepared Fortune',
        description: 'Arms advantage for one later d20 roll.',
        level: 1,
        trigger: { kind: 'active-use' },
        targeting: { kind: 'self' },
        mechanic: { kind: 'next-d20-advantage', rollKinds: ['attack', 'ability-check', 'saving-throw'] },
        effects: [],
        limits: { reset: 'long-rest', uses: { kind: 'fixed', value: 1 } },
        automation: 'full',
      }],
    }
    const disposePlugin = registerDnd5eRulesPlugin({
      manifest: {
        id: packageId, name: 'Native Activity Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) { api.registerDeclarativeSubclass(definition) },
    })
    try {
      const activity = dnd5eActivityFromDeclarativeSubclassAbility(definition.abilities[0]!, {
        subclassId,
        compatibility: { effective: 'full', reasons: [] },
      })
      registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
      const actorCombatant = combatant('actor', 'player', 20)
      Object.assign(actorCombatant, {
        level: 6,
        classId: 'sorcerer',
        subclassId: `${packageId}:${subclassId}`,
        classLevels: { sorcerer: 6 },
        subclassIds: { sorcerer: `${packageId}:${subclassId}` },
        pluginFeatureIds: [featureId],
        classResources: { [resourceId]: { current: 1, max: 1 } },
      })
      const state = startDnd5eHeadlessCombat('activity-native-route', [
        actorCombatant,
        combatant('target', 'dm', 10),
      ])
      const actorSnapshot = {
        id: 'actor', controller: 'players' as const, level: 6, proficiencyBonus: 3, abilities,
        armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
        classLevels: { sorcerer: 6 }, resources: { [resourceId]: { current: 1, maximum: 1 } },
      }
      const result = resolveAndCommitDnd5eActivityCommand(state, {
        command: {
          schemaVersion: 1,
          commandId: 'native-activity-command-1',
          actorId: 'actor',
          packageId,
          packageVersion: '1.0.0',
          activityId: activity.id,
          targetIds: ['actor'],
          expectedRevision: 0,
        },
        currentRevision: 0,
        actor: actorSnapshot,
        targets: [actorSnapshot],
        authoritativeRolls: {},
        distanceFeetByTargetId: { actor: 0 },
        confirmedBy: 'actor',
      })
      expect(result.phase).toBe('commit')
      if (result.phase !== 'commit' || !result.result.ok) return
      expect(result.result.state.combatants.actor.classResources[resourceId]?.current).toBe(0)
      expect(result.result.state.combatants.actor.classState.nextD20Advantage).toMatchObject({
        featureId,
        rollKinds: ['attack', 'ability-check', 'saving-throw'],
      })
    } finally {
      disposePlugin()
    }
  })
})

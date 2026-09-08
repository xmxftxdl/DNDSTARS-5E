import { afterEach, describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../../store/characters'
import type { Character } from '../../../types/character'
import {
  commitDnd5eActivityExecution,
  createDnd5eCombatant,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from '../headlessCombatEngine'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from '../items'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eActivityActorSnapshot, Dnd5eActivityExecutionResult } from './dnd5eActivityExecutor'
import { resolveAndCommitDnd5eActivityCommand } from './dnd5eActivityHeadlessAuthorityBridge'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { dnd5eSrdAuditedFullContentDefinitionsV1 } from './dnd5eSrdAuditedSpellActivities'

const abilities = { str: 10, dex: 12, con: 12, int: 18, wis: 14, cha: 16 } as const

afterEach(clearDnd5eActivityRegistryForTests)

function combatant(id: string, controller: 'player' | 'dm', initiative: number): Dnd5eCombatant {
  const result = createDnd5eCombatant({
    id, name: id, controller, initiative, abilities, proficiencyBonus: 4,
    armorClass: 15, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
  })
  result.level = 12
  result.creatureType = 'humanoid'
  result.campaignWorldMinute = 1_000
  return result
}

function snapshot(actor: Dnd5eCombatant): Dnd5eActivityActorSnapshot {
  return {
    id: actor.id, controller: actor.controller, level: actor.level,
    proficiencyBonus: actor.proficiencyBonus, abilities: actor.abilities,
    armorClass: actor.armorClass, conditions: [], currentHp: actor.currentHp,
    maxHp: actor.maxHp, creatureType: actor.creatureType, spellSaveDc: 16,
    savingThrowModifiers: actor.savingThrowBonuses,
    resources: Object.fromEntries(Object.entries(actor.classResources).map(([id, resource]) => [id, {
      current: resource.current, maximum: resource.max,
    }])),
    activeEffectDefinitionIds: (actor.classState.activeEffects ?? []).map((effect) => ({
      definitionId: effect.definitionId, sourceActorId: effect.source.actorId,
    })),
  }
}

function spellActivities(spellId: string): readonly Dnd5eActivityDefinitionV1[] {
  const definition = dnd5eSrdAuditedFullContentDefinitionsV1().find((entry) => entry.id === spellId)
  expect(definition, spellId).toBeDefined()
  return (definition?.activities ?? []) as readonly Dnd5eActivityDefinitionV1[]
}

function registerSpell(spellId: string): readonly Dnd5eActivityDefinitionV1[] {
  const activities = spellActivities(spellId)
  registerDnd5eActivityPackage({ packageId: 'srd-5.1', packageVersion: '1.0.0', activities })
  return activities
}

function inventoryOwner(id = 'actor'): Character {
  const empty = normalizeCharacter({
    id, name: id, player: id, charClass: '法师', maxHp: 40, currentHp: 40,
    equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] },
  })
  const granted = applyDnd5eInventoryMutation([empty], {
    type: 'grant', characterId: id,
    templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1,
  })
  expect(granted.ok).toBe(true)
  return granted.characters[0]!
}

describe('long-lived audited SRD spell authorities', () => {
  it('consumes an Instant Summons link exactly once and clears the inventory authority marker', () => {
    const activities = registerSpell('instant-summons')
    const root = activities.find((entry) => entry.id === 'spell:instant-summons')!
    const recall = activities.find((entry) => entry.id === 'spell:instant-summons:recall')!
    const actor = combatant('actor', 'player', 20)
    actor.classResources['dnd5e-spell-slot-6'] = { current: 2, max: 2 }
    let state = startDnd5eHeadlessCombat('instant-summons-authority', [actor])
    let owner = inventoryOwner()
    const entry = normalizeDnd5eInventory(owner).entries[0]!
    const cast = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'instant-summons-cast-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: root.id,
        targetIds: ['actor'], castLevel: 6, expectedRevision: 0,
        inventoryInstanceId: entry.instanceId,
        expectedInventoryRevision: normalizeDnd5eInventory(owner).revision ?? 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants.actor)],
      authoritativeRolls: {}, distanceFeetByTargetId: { actor: 0 }, inventoryOwner: owner,
    })
    expect(cast.phase, JSON.stringify(cast)).toBe('commit')
    if (cast.phase !== 'commit' || !cast.result.ok) return
    state = cast.result.state
    owner = cast.result.inventoryOwner!
    expect(normalizeDnd5eInventory(owner).entries[0]).toMatchObject({
      planarState: 'material', linkedSpellAuthorityRecordId: 'linked-planar-object:instant-summons:actor',
    })
    state.combatants.actor.turn.actionAvailable = true
    const recalled = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'instant-summons-recall-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: recall.id,
        targetIds: ['actor'], expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants.actor)],
      authoritativeRolls: {}, distanceFeetByTargetId: { actor: 0 }, inventoryOwner: owner,
    })
    expect(recalled.phase, JSON.stringify(recalled)).toBe('commit')
    if (recalled.phase !== 'commit' || !recalled.result.ok) return
    expect(recalled.result.state.combatants.actor.classState.spellAuthorityRecords)
      .not.toHaveProperty('linked-planar-object:instant-summons:actor')
    expect(normalizeDnd5eInventory(recalled.result.inventoryOwner!).entries[0]).toMatchObject({
      planarState: 'material', linkedSpellAuthorityRecordId: undefined,
    })
  })

  it('binds Secret Chest to a concrete inventory instance and recalls it from the Ethereal Plane', () => {
    const activities = registerSpell('secret-chest')
    const root = activities.find((entry) => entry.id === 'spell:secret-chest')!
    const recall = activities.find((entry) => entry.id === 'spell:secret-chest:recall')!
    const actor = combatant('actor', 'player', 20)
    actor.classResources['dnd5e-spell-slot-4'] = { current: 1, max: 1 }
    let state = startDnd5eHeadlessCombat('secret-chest-authority', [actor])
    let owner = inventoryOwner()
    const entry = normalizeDnd5eInventory(owner).entries[0]!
    const cast = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'secret-chest-cast-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: root.id,
        targetIds: ['actor'], castLevel: 4, expectedRevision: 0,
        inventoryInstanceId: entry.instanceId,
        expectedInventoryRevision: normalizeDnd5eInventory(owner).revision ?? 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)], authoritativeRolls: {},
      distanceFeetByTargetId: { actor: 0 }, inventoryOwner: owner,
    })
    expect(cast.phase, JSON.stringify(cast)).toBe('commit')
    if (cast.phase !== 'commit' || !cast.result.ok) return
    state = cast.result.state
    owner = cast.result.inventoryOwner!
    expect(normalizeDnd5eInventory(owner).entries[0]).toMatchObject({
      instanceId: entry.instanceId, planarState: 'ethereal',
      linkedSpellAuthorityRecordId: 'linked-planar-object:secret-chest:actor',
    })
    expect(state.combatants.actor.classState.spellAuthorityRecords).toHaveProperty(
      'linked-planar-object:secret-chest:actor',
    )

    state.combatants.actor.turn.actionAvailable = true
    const recalled = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'secret-chest-recall-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: recall.id,
        targetIds: ['actor'], expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)], authoritativeRolls: {},
      distanceFeetByTargetId: { actor: 0 }, inventoryOwner: owner,
    })
    expect(recalled.phase, JSON.stringify(recalled)).toBe('commit')
    if (recalled.phase !== 'commit' || !recalled.result.ok) return
    expect(normalizeDnd5eInventory(recalled.result.inventoryOwner!).entries[0]).toMatchObject({
      instanceId: entry.instanceId, planarState: 'material',
    })
  })

  it('delegates Magic Jar control and mental abilities, then returns both souls', () => {
    const activities = registerSpell('magic-jar')
    const root = activities.find((entry) => entry.id === 'spell:magic-jar')!
    const possess = activities.find((entry) => entry.id === 'spell:magic-jar:possess')!
    const returnActivity = activities.find((entry) => entry.id === 'spell:magic-jar:return')!
    const returnBody = activities.find((entry) => entry.id === 'spell:magic-jar:return-body')!
    const actor = combatant('actor', 'player', 20)
    actor.classResources['dnd5e-spell-slot-6'] = { current: 1, max: 1 }
    const target = combatant('target', 'dm', 10)
    target.abilities = { str: 18, dex: 14, con: 16, int: 8, wis: 9, cha: 6 }
    let state = startDnd5eHeadlessCombat('magic-jar-authority', [actor, target])
    const cast = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'magic-jar-cast-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: root.id,
        targetIds: ['actor'], castLevel: 6, expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)], authoritativeRolls: {},
      distanceFeetByTargetId: { actor: 0 },
    })
    expect(cast.phase, JSON.stringify(cast)).toBe('commit')
    if (cast.phase !== 'commit' || !cast.result.ok) return
    state = cast.result.state
    state.combatants.actor.turn.actionAvailable = true
    const possession = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'magic-jar-possess-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: possess.id,
        targetIds: ['target'], expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.target)],
      authoritativeRolls: { 'magic-jar-possession-save:target': { values: [2] } },
      checkRollModes: { 'possession-save:target': 'normal' },
      distanceFeetByTargetId: { target: 30 },
    })
    expect(possession.phase, JSON.stringify(possession)).toBe('commit')
    if (possession.phase !== 'commit' || !possession.result.ok) return
    state = possession.result.state
    expect(state.combatants.target).toMatchObject({
      abilities: { int: 18, wis: 14, cha: 16, str: 18, dex: 14, con: 16 },
      classState: { spellControlledByActorId: 'actor' },
    })

    state.combatants.actor.turn.actionAvailable = true
    const recast = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'magic-jar-recast-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: root.id,
        targetIds: ['actor'], castLevel: 6, expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)], authoritativeRolls: {},
      distanceFeetByTargetId: { actor: 0 },
    })
    expect(recast.phase, JSON.stringify(recast)).toBe('commit')
    if (recast.phase !== 'commit' || !recast.result.ok) return
    state = recast.result.state
    expect(state.combatants.target).toMatchObject({
      abilities: { int: 8, wis: 9, cha: 6 },
      classState: { spellControlledByActorId: undefined },
    })

    state.combatants.actor.turn.actionAvailable = true
    const secondPossession = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'magic-jar-possess-2', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: possess.id,
        targetIds: ['target'], expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.target)],
      authoritativeRolls: { 'magic-jar-possession-save:target': { values: [2] } },
      checkRollModes: { 'possession-save:target': 'normal' },
      distanceFeetByTargetId: { target: 30 },
    })
    expect(secondPossession.phase, JSON.stringify(secondPossession)).toBe('commit')
    if (secondPossession.phase !== 'commit' || !secondPossession.result.ok) return
    state = secondPossession.result.state

    state.combatants.actor.turn.actionAvailable = true
    const returned = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'magic-jar-return-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: returnActivity.id,
        targetIds: ['actor'], expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)], authoritativeRolls: {},
      distanceFeetByTargetId: { actor: 0 },
    })
    expect(returned.phase, JSON.stringify(returned)).toBe('commit')
    if (returned.phase !== 'commit' || !returned.result.ok) return
    expect(returned.result.state.combatants.target).toMatchObject({
      abilities: { int: 8, wis: 9, cha: 6 },
      classState: { spellControlledByActorId: undefined },
    })

    state = returned.result.state
    state.combatants.actor.turn.actionAvailable = true
    const ended = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'magic-jar-return-body-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: returnBody.id,
        targetIds: ['actor'], expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)], authoritativeRolls: {},
      distanceFeetByTargetId: { actor: 0 },
    })
    expect(ended.phase, JSON.stringify(ended)).toBe('commit')
    if (ended.phase !== 'commit' || !ended.result.ok) return
    expect(ended.result.state.combatants.actor.classState.spellAuthorityRecords).toBeUndefined()
    expect(ended.result.state.combatants.actor.classState.activeEffects ?? []).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ definitionId: expect.stringContaining(':magic-jar-controller') })]),
    )
  })

  it('settles Meld into Stone minor destruction as 6d6, prone, and immediate ejection', () => {
    const activities = registerSpell('meld-into-stone')
    const root = activities.find((entry) => entry.id === 'spell:meld-into-stone')!
    const eject = activities.find((entry) => entry.id === 'spell:meld-into-stone:eject-minor')!
    const actor = combatant('actor', 'player', 20)
    actor.classResources['dnd5e-spell-slot-3'] = { current: 1, max: 1 }
    let state = startDnd5eHeadlessCombat('meld-authority', [actor])
    const cast = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'meld-cast-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: root.id,
        targetIds: ['actor'], castLevel: 3, expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)], authoritativeRolls: {},
      distanceFeetByTargetId: { actor: 0 },
    })
    expect(cast.phase, JSON.stringify(cast)).toBe('commit')
    if (cast.phase !== 'commit' || !cast.result.ok) return
    state = cast.result.state
    const ejected = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'meld-eject-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: eject.id,
        targetIds: ['actor'], expectedRevision: 0,
      },
      currentRevision: 0, actor: snapshot(state.combatants.actor),
      targets: [snapshot(state.combatants.actor)],
      authoritativeRolls: { 'meld-minor-damage': { values: [1, 2, 3, 4, 5, 6] } },
      distanceFeetByTargetId: { actor: 0 },
    })
    expect(ejected.phase, JSON.stringify(ejected)).toBe('commit')
    if (ejected.phase !== 'commit' || !ejected.result.ok) return
    expect(ejected.result.state.combatants.actor.currentHp).toBe(19)
    expect(ejected.result.state.combatants.actor.conditions).toContain('prone')
    expect(ejected.result.state.combatants.actor.classState.spellAuthorityRecords)
      .not.toHaveProperty('terrain-merge:actor')
  })

  it('prevents ordinary healing from restoring a simulacrum', () => {
    const healer = combatant('healer', 'player', 20)
    const duplicate = combatant('duplicate', 'player', 10)
    duplicate.currentHp = 5
    duplicate.maxHp = 20
    duplicate.simulacrumCannotRegainHitPoints = true
    const state = startDnd5eHeadlessCombat('simulacrum-healing', [healer, duplicate])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
        kind: 'heal', operationId: 'heal-target', targetId: 'duplicate', amount: 10,
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'healer', activityId: 'test-heal', targetIds: ['duplicate'], resolution,
      source: { kind: 'spell', id: 'test-heal' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants.duplicate.currentHp).toBe(5)
  })
})

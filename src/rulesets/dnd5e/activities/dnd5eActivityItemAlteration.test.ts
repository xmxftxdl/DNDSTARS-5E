import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../../store/characters'
import { applyDnd5eInventoryMutation, expireDnd5eSourceBoundInventoryRoster } from '../items'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import { resolveDnd5eActivityCommand } from './dnd5eActivityCommand'
import { settleDnd5eActivityInventoryAlterations } from './dnd5eActivityInventorySettlement'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { resolveAndCommitDnd5eActivityCommand } from './dnd5eActivityHeadlessAuthorityBridge'
import { dnd5eActivityHeadlessCompatibility } from './dnd5eActivityHeadlessCompiler'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityInventorySelectionOptions, dnd5eActivitySelectsInventoryItem, dnd5eActivitySelectsEquipmentItem } from './dnd5eActivityInventorySelection'

afterEach(clearDnd5eActivityRegistryForTests)
const originalId = 'srd-5.1:item:gold-dust-25gp'
const abilities = { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 } as const

it.each(['success', 'stale', 'missing-effect', 'insufficient-after-cost', 'wrong-owner'] as const)('settles inventory handoff after a staged material cost: %s', mode => {
  const { state, input } = fixture(definition(), 'token-actor')
  const resolution = resolveDnd5eActivityCommand(input)
  if (!resolution.ok) throw new Error(JSON.stringify(resolution))
  const proposals = resolution.proposals.filter(proposal => proposal.kind === 'alter-inventory-item')
  const commit = commitDnd5eActivityExecution(state, { actorId: 'token-actor', activityId: 'alter', targetIds: ['token-actor'],
    resolution: { ...resolution, proposals: resolution.proposals.filter(proposal => proposal.kind !== 'alter-inventory-item') } })
  if (!commit.ok) throw new Error(JSON.stringify(commit))
  const staged = structuredClone(input.inventoryOwner)
  staged.dnd5eInventory!.revision = input.command.expectedInventoryRevision + 1
  staged.dnd5eInventory!.entries[0].quantity = mode === 'insufficient-after-cost' ? 2 : 4
  if (mode === 'missing-effect') commit.state.combatants['token-actor'].classState.activeEffects = []
  const baseline = structuredClone(input.inventoryOwner), before = structuredClone(staged)
  const result = settleDnd5eActivityInventoryAlterations({ characters: [staged], baselineCharacters: [baseline],
    state: commit.state, actorId: 'token-actor', characterId: 'actor', proposals,
    selection: { instanceId: input.command.inventoryInstanceId, ownerId: mode === 'wrong-owner' ? 'other' : 'actor',
      expectedRevision: input.command.expectedInventoryRevision + (mode === 'stale' ? 1 : 0) } })
  expect(result.ok).toBe(mode === 'success')
  expect(staged).toEqual(before)
  expect(baseline).toEqual(input.inventoryOwner)
  if (result.ok) {
    const inventory = result.characters[0].dnd5eInventory!
    expect(inventory.revision).toBe(input.command.expectedInventoryRevision + 2)
    expect(inventory.entries.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(4)
    expect(inventory.entries.find(entry => entry.spellAlteration)?.quantity).toBe(3)
    expect(inventory.entries.find(entry => entry.templateId === originalId)?.quantity).toBe(1)
  }
})
function definition(): Dnd5eActivityDefinitionV1 {
  return { schemaVersion: 1, id: 'alter', name: 'Synthetic material alteration', activation: { kind: 'action' },
    target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'lifetime', name: 'Lifetime', stacking: 'replace', duration: { kind: 'permanent' }, modifiers: [] }],
    outcomes: [{ id: 'result', when: { kind: 'always' }, operations: [
      { id: 'life', kind: 'apply-effect', target: 'actor', effectId: 'lifetime' },
      { id: 'alter', kind: 'alter-inventory-item', target: 'actor', originalTemplateIds: [originalId],
        templateId: 'srd-5.1:item:goodberry', quantity: { kind: 'constant', value: 3 }, sourceEffectId: 'lifetime' },
    ] }] }
}
function fixture(activity = definition(), actorId = 'actor') {
  registerDnd5eActivityPackage({ packageId: 'alter-test', packageVersion: '1.0.0', activities: [activity] })
  const actor = createDnd5eCombatant({ id: actorId, name: 'Actor', controller: 'player', initiative: 20,
    abilities, proficiencyBonus: 3, armorClass: 14, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('alter-test', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 10 }])
  const granted = applyDnd5eInventoryMutation([normalizeCharacter({ id: 'actor', name: 'Actor', equipment: {}, dnd5eInventory: { schemaVersion: 3, entries: [] } })],
    { type: 'grant', characterId: 'actor', templateId: originalId, quantity: 5 })
  if (!granted.ok) throw new Error('fixture grant')
  const inventoryOwner = granted.characters[0], inventory = inventoryOwner.dnd5eInventory!
  const snapshot = { id: actorId, characterId: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3,
    abilities, armorClass: 14, conditions: [], currentHp: 30, maxHp: 30, resources: {} }
  return { state, input: { command: { schemaVersion: 1 as const, commandId: 'alter-command', actorId,
    packageId: 'alter-test', packageVersion: '1.0.0', activityId: activity.id, targetIds: [actorId],
    expectedRevision: 0, inventoryInstanceId: inventory.entries[0].instanceId, expectedInventoryRevision: inventory.revision ?? 0 },
    currentRevision: 0, actor: snapshot, targets: [snapshot], authoritativeRolls: {}, distanceFeetByTargetId: { [actorId]: 0 }, inventoryOwner } }
}

function permanentDefinition(): Dnd5eActivityDefinitionV1 {
  const activity = definition()
  activity.effects = []
  activity.outcomes[0].operations = [{ id: 'convert', kind: 'alter-inventory-item', target: 'actor',
    originalTemplateIds: [originalId], templateId: 'srd-5.1:item:holy-water-flask',
    quantity: { kind: 'constant', value: 1 }, permanent: true }]
  return activity
}

function heldWaterFixture() {
  const activity = permanentDefinition()
  activity.target = { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 }
  const operation = activity.outcomes[0].operations[0]
  if (operation.kind !== 'alter-inventory-item') throw Error('fixture')
  operation.target = 'target'
  const f = fixture(activity, 'caster-token')
  const holder = { ...structuredClone(f.input.inventoryOwner), id: 'holder', name: 'Holder' }
  const target = { ...f.input.actor, id: 'enemy', characterId: holder.id }
  return { ...f, activity, holder, input: { ...f.input, inventoryRoster: [f.input.inventoryOwner, holder],
    targets: [target], distanceFeetByTargetId: { enemy: 5 }, command: { ...f.input.command,
      targetIds: ['enemy'], inventoryOwnerId: holder.id } } }
}

it('permanently converts one vial in the selected holder inventory and leaves caster inventory intact', () => {
  const { state, input, activity, holder } = heldWaterFixture()
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eActivityHeadlessCompatibility(activity).supported).toBe(true)
  const candidates = dnd5eActivityInventorySelectionOptions(activity, {}, input.inventoryOwner, [holder])
  expect(candidates).toHaveLength(1)
  expect(candidates[0].ownerId).toBe('holder')
  const before = structuredClone({ state, input })
  const result = resolveAndCommitDnd5eActivityCommand(state, input)
  if (result.phase !== 'commit' || !result.result.ok) throw Error(JSON.stringify(result))
  expect(result.result.inventoryOwner?.id).toBe(holder.id)
  expect(result.result.inventoryOwner?.dnd5eInventory?.entries.find(entry => entry.templateId === 'srd-5.1:item:holy-water-flask'))
    .toMatchObject({ quantity: 1 })
  expect(result.result.inventoryOwner?.dnd5eInventory?.entries.find(entry => entry.templateId === originalId)?.quantity).toBe(4)
  expect(result.result.state.combatants['caster-token'].turn.actionAvailable).toBe(false)
  expect({ state, input }).toEqual(before)
})

it.each(['wrong-owner', 'duplicate-owner', 'wrong-target', 'stale', 'out-of-reach'] as const)(
  'rejects a targeted vial conversion atomically: %s', mode => {
    const { state, input } = heldWaterFixture(), invalid = structuredClone(input)
    if (mode === 'wrong-owner') invalid.command.inventoryOwnerId = 'actor'
    if (mode === 'duplicate-owner') invalid.inventoryRoster.push(structuredClone(invalid.inventoryRoster[1]))
    if (mode === 'wrong-target') { invalid.command.targetIds = ['caster-token']; invalid.targets = [{ ...invalid.actor }] }
    if (mode === 'stale') invalid.command.expectedInventoryRevision += 1
    if (mode === 'out-of-reach') invalid.distanceFeetByTargetId.enemy = 6
    const before = structuredClone({ state, invalid })
    expect(resolveAndCommitDnd5eActivityCommand(state, invalid).result.ok).toBe(false)
    expect({ state, invalid }).toEqual(before)
  })

it('settles a targeted permanent conversion using the Host combatant-to-character binding', () => {
  const { state, input, holder } = heldWaterFixture()
  const resolution = resolveDnd5eActivityCommand(input)
  if (!resolution.ok) throw Error(JSON.stringify(resolution))
  const proposals = resolution.proposals.filter(proposal => proposal.kind === 'alter-inventory-item')
  expect(proposals).toHaveLength(1)
  expect(proposals[0]).toMatchObject({ actorId: 'caster-token', ownerActorId: 'enemy' })
  const roster = input.inventoryRoster
  const selection = { instanceId: input.command.inventoryInstanceId, ownerId: holder.id,
    expectedRevision: input.command.expectedInventoryRevision }
  const args = { state, characters: roster, baselineCharacters: roster, actorId: 'caster-token', characterId: 'actor',
    proposals, selection, characterIdByCombatantId: { 'caster-token': 'actor', enemy: holder.id } }
  const result = settleDnd5eActivityInventoryAlterations(args)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.characters[0]).toEqual(roster[0])
  expect(result.characters[1].dnd5eInventory?.entries.some(entry => entry.templateId === 'srd-5.1:item:holy-water-flask')).toBe(true)
  expect(settleDnd5eActivityInventoryAlterations({ ...args, characterIdByCombatantId: {} }).ok).toBe(false)
  expect(settleDnd5eActivityInventoryAlterations({ ...args, characterIdByCombatantId: { enemy: 'actor' } }).ok).toBe(false)
  expect(settleDnd5eActivityInventoryAlterations({ ...args, characters: result.characters, baselineCharacters: result.characters }).ok).toBe(false)
})

it('requires a declared lifetime for reversible target-owned inventory', () => {
  const activity = permanentDefinition(), operation = activity.outcomes[0].operations[0]
  if (operation.kind !== 'alter-inventory-item') throw Error('fixture')
  operation.target = 'target'
  delete operation.permanent
  operation.sourceEffectId = 'lifetime'
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('references an unknown effect'))).toBe(true)
})

it.each(['success', 'wrong-owner', 'stale', 'out-of-reach', 'missing-effect'] as const)(
  'binds temporary target inventory to the caster and rejects invalid authority: %s', mode => {
    const activity = definition()
    activity.target = { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 }
    const alteration = activity.outcomes[0].operations[1]
    if (alteration.kind !== 'alter-inventory-item') throw Error('fixture')
    alteration.target = 'target'
    if (mode === 'missing-effect') activity.outcomes[0].operations = [alteration]
    const { state, input } = fixture(activity, 'caster-token')
    const holder = { ...structuredClone(input.inventoryOwner), id: 'holder', name: 'Holder' }
    const authority = { ...input, inventoryRoster: [input.inventoryOwner, holder],
      targets: [{ ...input.actor, id: 'enemy', characterId: holder.id }],
      distanceFeetByTargetId: { enemy: mode === 'out-of-reach' ? 6 : 5 },
      command: { ...input.command, targetIds: ['enemy'], inventoryOwnerId: mode === 'wrong-owner' ? 'actor' : holder.id,
        expectedInventoryRevision: input.command.expectedInventoryRevision + (mode === 'stale' ? 1 : 0) } }
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const before = structuredClone({ state, authority })
    const result = resolveAndCommitDnd5eActivityCommand(state, authority)
    expect(result.result.ok, JSON.stringify(result)).toBe(mode === 'success')
    expect({ state, authority }).toEqual(before)
    if (result.phase !== 'commit' || !result.result.ok) return
    const altered = result.result.inventoryOwner!.dnd5eInventory!.entries.find(entry => entry.spellAlteration)!
    expect(altered).toMatchObject({ quantity: 3, sourceEffectOwnerId: 'actor', spellAlteration: { sourceEffectOwnerId: 'actor' } })
    expect(result.result.state.combatants['caster-token'].classState.activeEffects?.some(effect => effect.tags?.includes(altered.sourceEffectTag!))).toBe(true)
    expect(result.result.state.combatants.enemy.classState.activeEffects ?? []).toHaveLength(0)
    const resolution = resolveDnd5eActivityCommand(authority)
    if (!resolution.ok) throw Error('resolve')
    const proposals = resolution.proposals.filter(proposal => proposal.kind === 'alter-inventory-item')
    const commit = commitDnd5eActivityExecution(state, { actorId: 'caster-token', activityId: activity.id, targetIds: ['enemy'],
      resolution: { ...resolution, proposals: resolution.proposals.filter(proposal => proposal.kind !== 'alter-inventory-item') } })
    if (!commit.ok) throw Error('commit')
    const args = { characters: authority.inventoryRoster, baselineCharacters: authority.inventoryRoster,
      state: commit.state, actorId: 'caster-token', characterId: 'actor', characterIdByCombatantId: { enemy: holder.id }, proposals,
      selection: { instanceId: authority.command.inventoryInstanceId, ownerId: holder.id, expectedRevision: authority.command.expectedInventoryRevision } }
    const settled = settleDnd5eActivityInventoryAlterations(args)
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.characters[1].dnd5eInventory!.entries.find(entry => entry.spellAlteration)?.sourceEffectOwnerId).toBe('actor')
    commit.state.combatants['caster-token'].classState.activeEffects = []
    expect(settleDnd5eActivityInventoryAlterations(args).ok).toBe(false)
    const restored = expireDnd5eSourceBoundInventoryRoster(settled.characters)[1]
    expect(restored.dnd5eInventory!.entries.every(entry => entry.templateId === originalId)).toBe(true)
    expect(restored.dnd5eInventory!.entries.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(5)
  })

it('commits a permanent physical conversion without an effect, survives transfer and source cleanup, and rejects replay', () => {
  const activity = permanentDefinition()
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const { state, input } = fixture(activity, 'token-actor')
  const before = structuredClone({ state, input })
  const result = resolveAndCommitDnd5eActivityCommand(state, input)
  if (result.phase !== 'commit' || !result.result.ok) throw new Error(JSON.stringify(result))
  const owner = result.result.inventoryOwner!
  const converted = owner.dnd5eInventory!.entries.find(entry => entry.templateId === 'srd-5.1:item:holy-water-flask')!
  expect(converted.quantity).toBe(1)
  expect(converted.spellAlteration).toBeUndefined()
  expect(converted.sourceEffectTag).toBeUndefined()
  expect(converted.expiresAtWorldMinute).toBeUndefined()
  expect(owner.dnd5eInventory!.entries.find(entry => entry.templateId === originalId)?.quantity).toBe(4)
  expect(result.result.state.combatants['token-actor'].classState.activeEffects ?? []).toHaveLength(0)
  expect(result.result.state.combatants['token-actor'].turn.actionAvailable).toBe(false)
  expect(resolveAndCommitDnd5eActivityCommand(result.result.state, { ...input, inventoryOwner: owner }).result.ok).toBe(false)
  const holder = normalizeCharacter({ id: 'holder', name: 'Holder' })
  const transferred = applyDnd5eInventoryMutation([owner, holder], { type: 'transfer', characterId: 'actor',
    targetCharacterId: 'holder', instanceId: converted.instanceId, quantity: 1 })
  if (!transferred.ok) throw new Error('transfer failed')
  const loaded = JSON.parse(JSON.stringify(transferred.characters)) as typeof transferred.characters
  const cleaned = expireDnd5eSourceBoundInventoryRoster(loaded)
  expect(cleaned[1].dnd5eInventory!.entries.find(entry => entry.templateId === converted.templateId))
    .toMatchObject({ templateId: 'srd-5.1:item:holy-water-flask', quantity: 1 })
  expect(cleaned[0].dnd5eInventory!.entries.some(entry => entry.templateId === converted.templateId)).toBe(false)
  expect({ state, input }).toEqual(before)
})

it('settles a permanent conversion after this transaction staged its material cost using the original observed revision', () => {
  const { state, input } = fixture(permanentDefinition(), 'token-actor')
  const resolution = resolveDnd5eActivityCommand(input)
  if (!resolution.ok) throw new Error(JSON.stringify(resolution))
  const proposals = resolution.proposals.filter(proposal => proposal.kind === 'alter-inventory-item')
  const staged = structuredClone(input.inventoryOwner)
  staged.dnd5eInventory!.revision = input.command.expectedInventoryRevision + 1
  staged.dnd5eInventory!.entries[0].quantity = 4
  const result = settleDnd5eActivityInventoryAlterations({ characters: [staged], baselineCharacters: [input.inventoryOwner],
    state, actorId: 'token-actor', characterId: 'actor', proposals,
    selection: { instanceId: input.command.inventoryInstanceId, ownerId: 'actor', expectedRevision: input.command.expectedInventoryRevision } })
  if (!result.ok) throw new Error('permanent settlement failed')
  expect(result.characters[0].dnd5eInventory!.revision).toBe(input.command.expectedInventoryRevision + 2)
  expect(result.characters[0].dnd5eInventory!.entries.find(entry => entry.templateId === originalId)?.quantity).toBe(3)
  expect(result.characters[0].dnd5eInventory!.entries.find(entry => entry.templateId === 'srd-5.1:item:holy-water-flask'))
    .toMatchObject({ quantity: 1 })
  expect(staged.dnd5eInventory!.entries).toHaveLength(1)
})

it.each(['expiry', 'ethereal', 'released', 'lease', 'source', 'modifier', 'false'] as const)
  ('rejects an invalid permanent conversion: %s', mode => {
    const activity = permanentDefinition()
    const operation = activity.outcomes[0].operations[0]
    if (operation.kind !== 'alter-inventory-item') throw new Error('fixture')
    if (mode === 'source') operation.sourceEffectId = 'lifetime'
    if (mode === 'modifier') operation.captureSpellcastingModifier = true
    if (mode === 'false') Object.assign(operation, { permanent: false })
    if (['source', 'modifier', 'false'].includes(mode)) {
      expect(validateDnd5eActivityDefinitionV1(activity).length).toBeGreaterThan(0)
      return
    }
    const { state, input } = fixture(activity)
    const entry = input.inventoryOwner.dnd5eInventory!.entries[0]
    if (mode === 'expiry') entry.expiresAtWorldMinute = 500
    if (mode === 'ethereal') entry.planarState = 'ethereal'
    if (mode === 'released') entry.releasedByCharacterId = 'actor'
    if (mode === 'lease') entry.sourceEffectTag = 'item-lease:11111111-1111-1111-1111-111111111111'
    const before = structuredClone({ state, input })
    expect(resolveAndCommitDnd5eActivityCommand(state, input).result.ok).toBe(false)
    expect({ state, input }).toEqual(before)
  })

it('uses the Host character mapping when the acting map token has a different id', () => {
  const { state, input } = fixture(definition(), 'token-actor')
  const result = resolveAndCommitDnd5eActivityCommand(state, { ...input, command: { ...input.command, inventoryOwnerId: 'actor' } })
  expect(result.result.ok, JSON.stringify(result)).toBe(true)
  if (result.phase !== 'commit' || !result.result.ok) throw new Error('commit failed')
  const item = result.result.inventoryOwner!.dnd5eInventory!.entries.find(entry => entry.spellAlteration)!
  expect(item.sourceEffectOwnerId).toBe('actor')
  expect(result.result.state.combatants['token-actor'].classState.activeEffects?.some(effect => effect.tags?.includes(item.sourceEffectTag!))).toBe(true)
})

it('settles selected existing objects and the actual source effect together; stale replay cannot create more objects', () => {
  const { state, input } = fixture(), before = structuredClone({ state, input })
  const result = resolveAndCommitDnd5eActivityCommand(state, input)
  expect(result.phase, JSON.stringify(result)).toBe('commit')
  if (result.phase !== 'commit' || !result.result.ok) throw new Error(JSON.stringify(result))
  const owner = result.result.inventoryOwner!, altered = owner.dnd5eInventory!.entries.find(entry => entry.spellAlteration)!
  expect(altered).toMatchObject({ quantity: 3, templateId: 'srd-5.1:item:goodberry', spellAlteration: { original: { templateId: originalId } } })
  expect(owner.dnd5eInventory!.entries.find(entry => entry.templateId === originalId)!.quantity).toBe(2)
  expect(result.result.state.combatants.actor.classState.activeEffects?.some(effect => effect.tags?.includes(altered.sourceEffectTag!))).toBe(true)
  expect(result.result.state.combatants.actor.turn.actionAvailable).toBe(false)
  const replay = resolveAndCommitDnd5eActivityCommand(result.result.state, { ...input, inventoryOwner: owner })
  expect(replay.result.ok).toBe(false)
  // The ordinary forms survive after the actual owning effect is absent.
  const restored = expireDnd5eSourceBoundInventoryRoster([owner])[0]
  expect(restored.dnd5eInventory!.entries.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(5)
  expect(restored.dnd5eInventory!.entries.every(entry => entry.templateId === originalId)).toBe(true)
  expect({ state, input }).toEqual(before)
})

it.each(['stale', 'missing', 'template', 'original-template', 'owner', 'destroyed', 'charges', 'quantity', 'no-source', 'failed-commit'] as const)('rejects %s without publishing an inventory or effect', mode => {
  const activity = definition()
  const alteration = activity.outcomes[0].operations[1]
  if (alteration.kind !== 'alter-inventory-item') throw new Error('fixture')
  if (mode === 'template') alteration.templateId = 'missing:template'
  if (mode === 'original-template') alteration.originalTemplateIds = ['srd-5.1:item:goodberry']
  if (mode === 'quantity') alteration.quantity = { kind: 'constant', value: 6 }
  if (mode === 'no-source') activity.outcomes[0].operations = [alteration]
  const { state, input } = fixture(activity)
  if (mode === 'stale') input.command.expectedInventoryRevision++
  if (mode === 'missing') input.command.inventoryInstanceId = 'missing'
  if (mode === 'owner') input.inventoryOwner = { ...input.inventoryOwner, id: 'other' }
  if (mode === 'destroyed') input.inventoryOwner.dnd5eInventory!.entries[0].condition = { destroyed: true }
  if (mode === 'charges') input.inventoryOwner.dnd5eInventory!.entries[0].remainingCharges = 1
  if (mode === 'failed-commit') state.combatants.actor.turn.actionAvailable = false
  const before = structuredClone({ state, input })
  const result = resolveAndCommitDnd5eActivityCommand(state, input)
  expect(result.phase).toBe(mode === 'no-source' ? 'resolve' : mode === 'failed-commit' ? 'commit' : 'inventory')
  expect(result.result.ok, JSON.stringify(result)).toBe(false)
  expect(result.result).not.toHaveProperty('inventoryOwner')
  expect({ state, input }).toEqual(before)
})

it('offers ordinary inventory objects on the selected branch and submits the UI owner/instance/revision to Host', () => {
  const activity = definition()
  const { state, input } = fixture(activity)
  expect(dnd5eActivitySelectsInventoryItem(activity)).toBe(true)
  expect(dnd5eActivitySelectsEquipmentItem(activity)).toBe(false)
  const candidates = dnd5eActivityInventorySelectionOptions(activity, undefined, input.inventoryOwner, [])
  expect(candidates).toHaveLength(1)
  expect(candidates[0]).toMatchObject({ ownerId: 'actor', instanceId: input.command.inventoryInstanceId, revision: input.command.expectedInventoryRevision })
  const selected = candidates[0]
  const result = resolveAndCommitDnd5eActivityCommand(state, { ...input, command: { ...input.command,
    inventoryOwnerId: selected.ownerId, inventoryInstanceId: selected.instanceId, expectedInventoryRevision: selected.revision } })
  expect(result.result.ok, JSON.stringify(result)).toBe(true)
  const forged = resolveAndCommitDnd5eActivityCommand(state, { ...input, command: { ...input.command, inventoryOwnerId: 'other' } })
  expect(forged.result.ok).toBe(false)

  const optional: Dnd5eActivityDefinitionV1 = { ...activity,
    choices: [{ id: 'mode', label: 'Mode', defaultOptionId: 'skip', options: [{ id: 'skip', label: 'Skip' }, { id: 'alter', label: 'Alter' }] }],
    outcomes: [{ ...activity.outcomes[0], when: { kind: 'choice', choiceId: 'mode', optionId: 'alter' } }] }
  expect(dnd5eActivitySelectsInventoryItem(optional)).toBe(false)
  expect(dnd5eActivityInventorySelectionOptions(optional, undefined, input.inventoryOwner, [])).toEqual([])
  expect(dnd5eActivityInventorySelectionOptions(optional, { mode: 'alter' }, input.inventoryOwner, [])).toHaveLength(1)
})

it.each(['too-few', 'bound', 'destroyed', 'charges'] as const)('does not offer %s objects in the common selector', mode => {
  const activity = definition(), { input } = fixture(activity)
  const entry = input.inventoryOwner.dnd5eInventory!.entries[0]
  if (mode === 'too-few') entry.quantity = 2
  if (mode === 'bound') entry.sourceEffectTag = 'item-lease:11111111-1111-1111-1111-111111111111'
  if (mode === 'destroyed') entry.condition = { destroyed: true }
  if (mode === 'charges') entry.remainingCharges = 1
  expect(dnd5eActivityInventorySelectionOptions(activity, undefined, input.inventoryOwner, [])).toEqual([])
})

it('validates the source allow-list and recognizes the inventory handoff operation', () => {
  const activity = definition()
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eActivityHeadlessCompatibility(activity)).toMatchObject({ supported: true })
  const alteration = activity.outcomes[0].operations[1]
  if (alteration.kind !== 'alter-inventory-item') throw new Error('fixture')
  alteration.originalTemplateIds = []
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('originalTemplateIds'))).toBe(true)
})

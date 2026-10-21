import { recoverDnd5eCombatStartResources } from './combatStartResources'
import { requestInventoryExchangeMaterials, requestInventoryExchangeRitual, type InventoryExchangeChoiceDialogs } from '../../components/map/inventoryExchangeChoices'
import { dnd5eInventoryExchangeSavedSelection } from './inventoryExchangeRitualState'
import { prepareDnd5eInventoryExchangeRitualMapApplication } from './inventoryExchangeRitualMapApplication'
import { rebaseDnd5ePluginFeatureApplication, resolvePreparedDnd5ePluginFeatureAction, type PreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { settleDnd5eInventoryExchangeRitualV1 } from './activities/dnd5eInventoryExchangeRitualSettlement'
import { beginDnd5eInventoryExchangeRitual, cancelDnd5eInventoryExchangeRitual } from './inventoryExchangeRitual'
import { settleDnd5eInventoryExchangeOnMap } from './inventoryExchangeMap'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import type { BattleMap } from '../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './activities/dnd5eActivityRegistry'
import { resolveAndCommitDnd5eActivityCommand } from './activities/dnd5eActivityHeadlessAuthorityBridge'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { dnd5eActivityHeadlessCompatibility } from './activities/dnd5eActivityHeadlessCompiler'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { applyDnd5eInventoryExchange } from './inventoryExchange'

it.each(['valid', 'unequal', 'duplicate', 'stale', 'missing-original', 'consume-original', 'ceiling', 'missing-output', 'failed-commit'] as const)('settles atomic equal-value exchange: %s', async mode => {
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: 'test.exchange', name: 'Synthetic', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
    setup(api) {
      for (const [id, value] of [['metal', 2], ['key', 5]] as const) api.registerItem({ id, name: id,
        description: 'Synthetic', rulesText: 'Synthetic', category: 'adventuring-gear', icon: 'generic', stackable: true,
        spellcastingMaterial: { tags: ['test:metal'], unitValueGp: value } })
    },
  })
  try {
    let characters = [normalizeCharacter({ id: 'actor', name: 'Actor', equipment: {}, dnd5eInventory: { schemaVersion: 3, entries: [] } })]
    for (const templateId of ['test.exchange:metal', 'test.exchange:key']) {
      const result = applyDnd5eInventoryMutation(characters, { type: 'grant', characterId: 'actor', templateId, quantity: 1 })
      expect(result.ok).toBe(true); characters = result.characters
    }
    characters = applyDnd5eInventoryMutation(characters, { type: 'adjust-currency', characterId: 'actor', currency: 'gp', delta: 3 }).characters
    const inventory = normalizeDnd5eInventory(characters[0]), metal = inventory.entries.find(entry => entry.templateId.endsWith(':metal'))!, key = inventory.entries.find(entry => entry.templateId.endsWith(':key'))!
    const before = structuredClone(characters)
    const input = { characterId: 'actor', receiptId: 'ritual-1', expectedInventoryRevision: inventory.revision! + (mode === 'stale' ? 1 : 0),
      inputs: [{ instanceId: mode === 'consume-original' ? key.instanceId : metal.instanceId, quantity: 1 }],
      coins: [{ currency: 'gp' as const, amount: mode === 'unequal' ? 2 : 3 }],
      output: { templateId: mode === 'missing-output' ? 'test.exchange:missing' : 'test.exchange:key', quantity: 1 },
      originalInstanceId: mode === 'missing-original' ? 'absent' : key.instanceId }
    if (mode === 'duplicate') input.inputs.push({ ...input.inputs[0] })
    const policy = { inputTags: ['test:metal'], outputTags: ['test:metal'], maximumValueCp: mode === 'ceiling' ? 500 : 10000, maximumInclusive: false, requiresOriginal: true }
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'exchange', name: 'Exchange', activation: { kind: 'action' },
      target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{ id: 'exchange', when: { kind: 'always' }, operations: [{ id: 'exchange', kind: 'exchange-inventory-items', target: 'actor',
        templateId: input.output.templateId, quantity: { kind: 'constant', value: 1 }, policy }] }] }
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(dnd5eActivityHeadlessCompatibility(activity).supported).toBe(false)
    registerDnd5eActivityPackage({ packageId: 'exchange-test', packageVersion: '1.0.0', activities: [activity] })
    const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
      abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const state = startDnd5eHeadlessCombat('exchange-test', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 10 }])
    if (mode === 'failed-commit') state.combatants.actor.turn.actionAvailable = false
    const snapshot = { id: 'actor', characterId: 'actor', controller: 'players' as const, level: 1, proficiencyBonus: 2,
      abilities, armorClass: 10, conditions: [], currentHp: 10, maxHp: 10, resources: {} }
    const authority = { command: { schemaVersion: 1 as const, commandId: input.receiptId, actorId: 'actor', packageId: 'exchange-test',
      packageVersion: '1.0.0', activityId: 'exchange', targetIds: ['actor'], expectedRevision: 0,
      inventoryExchange: { expectedInventoryRevision: input.expectedInventoryRevision, inputs: input.inputs, coins: input.coins, originalInstanceId: input.originalInstanceId } }, currentRevision: 0,
      actor: snapshot, targets: [snapshot], authoritativeRolls: {}, inventoryOwner: characters[0] }
    const stateBefore = structuredClone(state)
    const bridge = resolveAndCommitDnd5eActivityCommand(state, { ...authority, command: JSON.parse(JSON.stringify(authority.command)) })
    expect(bridge.result.ok, JSON.stringify(bridge)).toBe(mode === 'valid')
    expect(state).toEqual(stateBefore)
    expect(characters).toEqual(before)
    if (!bridge.result.ok) expect(bridge.result).not.toHaveProperty('inventoryOwner')
    else {
      expect(bridge.phase).toBe('commit')
      if (bridge.phase !== 'commit' || !bridge.result.ok) throw Error('commit expected')
      expect(bridge.result.inventoryOwner?.dnd5eInventory?.currency?.gp).toBe(0)
      expect(bridge.result.state.combatants.actor.turn.actionAvailable).toBe(false)
    }
    if (mode === 'failed-commit') return
    if (mode === 'valid') {
      const dialogs: InventoryExchangeChoiceDialogs = {
        choose: async options => {
          expect(options.options.some(option => option.id === key.instanceId)).toBe(true)
          return key.instanceId
        },
        multiple: async options => {
          expect(options.options.some(option => option.id === `item:${key.instanceId}`)).toBe(false)
          expect(options.options.some(option => option.id === `item:${metal.instanceId}`)).toBe(true)
          return [`item:${metal.instanceId}`, 'coin:gp']
        },
        quantity: async options => { expect(options.maxValue).toBe(3); return { direction: 'up', value: 3 } },
        alert: async () => { throw Error('unexpected choice warning') },
      }
      const uiSelection = await requestInventoryExchangeMaterials({ character: characters[0], templateId: input.output.templateId, outputQuantity: 1, policy, dialogs })
      expect(uiSelection).toEqual(authority.command.inventoryExchange)
      expect(applyDnd5eInventoryExchange(characters, { ...input, ...uiSelection }, policy).ok).toBe(true)
      expect(await requestInventoryExchangeMaterials({ character: characters[0], templateId: input.output.templateId, outputQuantity: 1, policy,
        dialogs: { ...dialogs, multiple: async () => null } })).toBeUndefined()
      expect(await requestInventoryExchangeMaterials({ character: characters[0], templateId: input.output.templateId, outputQuantity: 1, policy,
        dialogs: { ...dialogs, quantity: async () => ({ direction: 'up', value: 4 }) } })).toBeUndefined()
      expect(characters).toEqual(before)
      const map: BattleMap = { id: 'exchange-map', name: 'Map', width: 500, height: 500, gridSize: 50,
        gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
        tokens: [{ id: 'actor-token', characterId: 'actor', label: 'Actor', type: 'player', x: 25, y: 25, size: 1, emoji: '', color: '' }] }
      const context = { map, characters, actorTokenId: 'actor-token', targetCell: { col: 1, row: 0 }, exchange: input, policy, rangeFeet: 5 }
      const mapBefore = structuredClone(map)
      for (const cell of [{ col: 0, row: 0 }, { col: 2, row: 0 }, { col: -1, row: 0 }, { col: 0.5, row: 0 }]) {
        expect(settleDnd5eInventoryExchangeOnMap({ ...context, targetCell: cell }).ok).toBe(false)
        expect(characters).toEqual(before)
      }
      const operation = activity.outcomes[0].operations[0]
      if (operation.kind !== 'exchange-inventory-items') throw Error('exchange expected')
      operation.sceneRangeFeet = 5
      clearDnd5eActivityRegistryForTests()
      registerDnd5eActivityPackage({ packageId: 'exchange-test', packageVersion: '1.0.0', activities: [activity] })
      const sceneAuthority = { ...authority, command: { ...authority.command,
        inventoryExchange: { ...authority.command.inventoryExchange, targetCell: { col: 1, row: 0 } } } }
      const sceneOptions = { exchangeScene: { map, actorTokenId: 'actor-token' } }
      expect(resolveAndCommitDnd5eActivityCommand(state, sceneAuthority).result.ok).toBe(false)
      const committedScene = resolveAndCommitDnd5eActivityCommand(state, sceneAuthority, sceneOptions)
      expect(committedScene.result.ok, JSON.stringify(committedScene)).toBe(true)
      if (committedScene.phase !== 'commit' || !committedScene.result.ok) throw Error('scene commit expected')
      expect(committedScene.result.map?.tokens).toHaveLength(2)
      expect(committedScene.result.state.combatants.actor.turn.actionAvailable).toBe(false)
      expect(committedScene.result.inventoryOwner?.dnd5eInventory?.entries.find(entry => entry.instanceId === key.instanceId)?.quantity).toBe(1)
      const failedState = structuredClone(state)
      failedState.combatants.actor.turn.actionAvailable = false
      const failedScene = resolveAndCommitDnd5eActivityCommand(failedState, sceneAuthority, sceneOptions)
      expect(failedScene.result.ok).toBe(false)
      expect(failedScene.result).not.toHaveProperty('map')
      expect(failedScene.result).not.toHaveProperty('inventoryOwner')
      expect(map).toEqual(mapBefore)
      expect(characters).toEqual(before)
      // Real rooms use token ids for combat and separate character ids for inventory.
      const tokenSnapshot = { ...snapshot, characterId: 'character-sheet' }
      const tokenAuthority = { ...sceneAuthority, actor: tokenSnapshot, targets: [tokenSnapshot],
        inventoryOwner: { ...characters[0], id: 'character-sheet' } }
      const tokenMap = { ...map, tokens: [{ ...map.tokens[0], id: 'actor', characterId: 'character-sheet' }] }
      const tokenOptions = { exchangeScene: { map: tokenMap, actorTokenId: 'actor' } }
      const tokenCommit = resolveAndCommitDnd5eActivityCommand(state, tokenAuthority, tokenOptions)
      expect(tokenCommit.result.ok, JSON.stringify(tokenCommit)).toBe(true)
      if (tokenCommit.phase !== 'commit' || !tokenCommit.result.ok) throw Error('token commit expected')
      expect(tokenCommit.result.inventoryOwner?.id).toBe('character-sheet')
      expect(tokenCommit.result.inventoryOwner?.dnd5eInventory?.currency?.gp).toBe(0)
      expect(tokenCommit.result.state.combatants.actor.turn.actionAvailable).toBe(false)
      expect(resolveAndCommitDnd5eActivityCommand(state, { ...tokenAuthority, inventoryOwner: characters[0] }, tokenOptions).result.ok).toBe(false)
      expect(resolveAndCommitDnd5eActivityCommand(state, tokenAuthority, { exchangeScene: { ...tokenOptions.exchangeScene, actorTokenId: 'another-token' } }).result.ok).toBe(false)
      activity.activation = { kind: 'hour', value: 1 }
      activity.legacySource = { kind: 'feature', id: 'exchange' }
      clearDnd5eActivityRegistryForTests()
      registerDnd5eActivityPackage({ packageId: 'exchange-test', packageVersion: '1.0.0', activities: [activity] })
      const ritualAuthority = { ...sceneAuthority, combatActive: false }
      const tokenRitualAuthority = { ...tokenAuthority, combatActive: false }
      const registeredState = structuredClone(state)
      registeredState.active = false
      registeredState.combatants.actor.classState.wardingBondParticipantCharacterId = 'character-sheet'
      registeredState.combatants.actor.pluginFeatureIds = ['exchange-test:exchange']
      const hostInput = { state: registeredState, command: tokenAuthority.command, combatRevision: 0,
        authoritativeRolls: {}, actorCharacter: tokenAuthority.inventoryOwner, worldMinute: 100,
        ...tokenOptions }
      const hostBegin = settleDnd5eInventoryExchangeRitualV1({ ...hostInput, decision: 'begin' })
      expect(hostBegin.ok, JSON.stringify(hostBegin)).toBe(true)
      if (!hostBegin.ok || hostBegin.outcome !== 'begun') throw Error('Host begin expected')
      const hostCompletion = { ...hostInput, command: hostBegin.command, actorCharacter: hostBegin.character, worldMinute: 160 }
      const saved = JSON.parse(JSON.stringify(hostBegin.character))
      const continuationUi = { character: saved, templateId: input.output.templateId, outputQuantity: 1, policy,
        packageId: 'exchange-test', activityId: 'exchange', worldMinute: 160, sceneRangeFeet: 5,
        choosePlacement: async (range: number) => { expect(range).toBe(5); return { col: 1, row: 0 } },
        dialogs: { ...dialogs, choose: async () => 'complete' },
      }
      const resumed = await requestInventoryExchangeRitual(continuationUi)
      expect(resumed).toEqual({ decision: 'complete', ritualId: hostBegin.command.commandId,
        selection: { ...hostBegin.command.inventoryExchange, targetCell: { col: 1, row: 0 } } })
      expect(await requestInventoryExchangeRitual({ ...continuationUi, worldMinute: 159,
        dialogs: { ...dialogs, choose: async options => {
          expect(options.options.some(option => option.id === 'complete')).toBe(false)
          return 'complete'
        } } })).toBeUndefined()
      const cancelledUi = await requestInventoryExchangeRitual({ ...continuationUi, worldMinute: 100,
        choosePlacement: async () => { throw Error('cancellation must not place an object') },
        dialogs: { ...dialogs, choose: async () => 'cancel' } })
      expect(cancelledUi?.decision).toBe('cancel')
      expect(cancelledUi?.selection.targetCell).toBeUndefined()
      expect(await requestInventoryExchangeRitual({ ...continuationUi, choosePlacement: async () => undefined })).toBeUndefined()
      const pendingRecord = normalizeDnd5eInventory(saved).pendingExchangeRitual!
      expect(dnd5eInventoryExchangeSavedSelection({ ...pendingRecord, selection: '{invalid' })).toBeUndefined()
      expect(dnd5eInventoryExchangeSavedSelection({ ...pendingRecord, inventoryRevision: pendingRecord.inventoryRevision + 1 })).toBeUndefined()
      const hostComplete = settleDnd5eInventoryExchangeRitualV1({ ...hostCompletion, decision: 'complete' })
      expect(hostComplete.ok, JSON.stringify(hostComplete)).toBe(true)
      if (!hostComplete.ok || hostComplete.outcome !== 'completed' || !hostComplete.resolution.result.ok) throw Error('Host completion expected')
      expect(hostComplete.resolution.result.map?.tokens).toHaveLength(2)
      expect(hostComplete.resolution.result.inventoryOwner?.dnd5eInventory?.currency?.gp).toBe(0)
      expect(hostComplete.resolution.result.inventoryOwner?.dnd5eInventory?.pendingExchangeRitual).toBeUndefined()
      expect(settleDnd5eInventoryExchangeRitualV1({ ...hostCompletion, worldMinute: 159, decision: 'complete' }).ok).toBe(false)
      expect(settleDnd5eInventoryExchangeRitualV1({ ...hostInput, combatRevision: 1, decision: 'begin' }).ok).toBe(false)
      expect(settleDnd5eInventoryExchangeRitualV1({ ...hostInput, actorCharacter: characters[0], decision: 'begin' }).ok).toBe(false)
      const revokedState = structuredClone(registeredState)
      revokedState.combatants.actor.pluginFeatureIds = []
      expect(settleDnd5eInventoryExchangeRitualV1({ ...hostInput, state: revokedState, decision: 'begin' }).ok).toBe(false)
      expect(settleDnd5eInventoryExchangeRitualV1({ ...hostCompletion, state: revokedState, decision: 'complete' }).ok).toBe(false)
      const hostCancel = settleDnd5eInventoryExchangeRitualV1({ ...hostCompletion, state: revokedState, decision: 'cancel' })
      expect(hostCancel.ok).toBe(true)
      if (!hostCancel.ok || hostCancel.outcome !== 'cancelled') throw Error('Host cancellation expected')
      expect(hostCancel.character.dnd5eInventory?.pendingExchangeRitual).toBeUndefined()
      expect(hostCancel.character.dnd5eInventory?.currency?.gp).toBe(3)
      const completeMap = { ...tokenMap, tokens: [...tokenMap.tokens, { ...tokenMap.tokens[0], id: 'enemy', characterId: undefined, type: 'enemy' as const, x: 225, y: 225 }] }
      const mapInput = { ...hostInput, map: completeMap, characters: [tokenAuthority.inventoryOwner],
        characterIdByCombatantId: { actor: 'character-sheet' } }
      const mapBegin = prepareDnd5eInventoryExchangeRitualMapApplication({ ...mapInput, decision: 'begin' })
      expect(mapBegin.ok, JSON.stringify(mapBegin)).toBe(true)
      if (!mapBegin.ok) throw Error('map begin expected')
      expect(mapBegin.application.changedTokenIds).toEqual([])
      expect(mapBegin.application.characterPatches?.['character-sheet'].dnd5eInventory?.pendingExchangeRitual).toBeDefined()
      const mapCompleteInput = { ...mapInput, characters: mapBegin.application.characters,
        command: mapBegin.command, worldMinute: 160 }
      const mapComplete = prepareDnd5eInventoryExchangeRitualMapApplication({ ...mapCompleteInput, decision: 'complete' })
      expect(mapComplete.ok, JSON.stringify(mapComplete)).toBe(true)
      if (!mapComplete.ok) throw Error('map completion expected')
      const product = mapComplete.application.map.tokens.find(token => token.type === 'obstacle')!
      expect(mapComplete.application.changedTokenIds).toContain(product.id)
      expect(mapComplete.application.characterPatches?.['character-sheet'].dnd5eInventory?.currency?.gp).toBe(0)
      const rebaseInput = { baseMap: completeMap, baseCharacters: mapBegin.application.characters,
        application: mapComplete.application, latestMap: completeMap, latestCharacters: mapBegin.application.characters }
      expect(rebaseDnd5ePluginFeatureApplication(rebaseInput).ok).toBe(true)
      expect(rebaseDnd5ePluginFeatureApplication({ ...rebaseInput,
        latestCharacters: [{ ...mapBegin.application.characters[0], currentHp: 1 }] }).ok).toBe(false)
      expect(rebaseDnd5ePluginFeatureApplication({ ...rebaseInput,
        latestMap: { ...completeMap, tokens: [...completeMap.tokens, product] } }).ok).toBe(false)
      const mapCancel = prepareDnd5eInventoryExchangeRitualMapApplication({ ...mapCompleteInput, decision: 'cancel' })
      expect(mapCancel.ok).toBe(true)
      if (!mapCancel.ok) throw Error('map cancellation expected')
      expect(mapCancel.application.characterPatches?.['character-sheet'].dnd5eInventory?.pendingExchangeRitual).toBeUndefined()
      expect(mapCancel.application.characterPatches?.['character-sheet'].dnd5eInventory?.currency?.gp).toBe(3)
      expect(prepareDnd5eInventoryExchangeRitualMapApplication({ ...mapInput,
        characterIdByCombatantId: { actor: 'different-character' }, decision: 'begin' }).ok).toBe(false)
      expect(prepareDnd5eInventoryExchangeRitualMapApplication({ ...mapInput, map: tokenMap, decision: 'begin' }).ok).toBe(false)
      // Resolver boundary fixture: UI preparation/compilation remains gated separately.
      const preparedExchange: PreparedDnd5ePluginFeatureAction = {
        action: { id: 'plugin-ritual' } as PreparedDnd5ePluginFeatureAction['action'],
        feature: {} as PreparedDnd5ePluginFeatureAction['feature'],
        actor: tokenAuthority.inventoryOwner, actorToken: completeMap.tokens[0], targetToken: completeMap.tokens[0],
        targetTokens: [completeMap.tokens[0]], targetCells: [], distanceFeet: 0,
        state: { ...registeredState, active: true }, map: completeMap, characters: mapInput.characters,
        characterIdByCombatantId: mapInput.characterIdByCombatantId,
        headlessAction: { type: 'plugin', actorId: 'actor', pluginId: 'exchange-test', actionId: 'exchange', targetIds: ['actor'],
          payload: JSON.parse(JSON.stringify({ inventoryExchangeRitual: { decision: 'begin', selection: tokenAuthority.command.inventoryExchange } })) },
      }
      const pluginAuthority = { worldMinute: 100, combatRevision: 0, combatActive: false }
      expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: preparedExchange })).result.ok).toBe(false)
      expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: preparedExchange,
        inventoryExchangeAuthority: { ...pluginAuthority, combatActive: true } })).result.ok).toBe(false)
      const pluginBegin = await resolvePreparedDnd5ePluginFeatureAction({ prepared: preparedExchange, inventoryExchangeAuthority: pluginAuthority })
      expect(pluginBegin.result.ok, JSON.stringify(pluginBegin)).toBe(true)
      if (!pluginBegin.application) throw Error('plugin begin plan expected')
      const pendingInventory = normalizeDnd5eInventory(pluginBegin.application.characters[0])
      expect(pendingInventory.pendingExchangeRitual?.commandId).toBe('plugin-ritual')
      const completionPayload = { inventoryExchangeRitual: { decision: 'complete', ritualId: 'plugin-ritual',
        selection: { ...tokenAuthority.command.inventoryExchange, expectedInventoryRevision: pendingInventory.revision } } }
      const pluginComplete = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: { ...preparedExchange, characters: pluginBegin.application.characters,
          action: { ...preparedExchange.action, id: 'separate-completion-request' },
          headlessAction: { ...preparedExchange.headlessAction, payload: JSON.parse(JSON.stringify(completionPayload)) } },
        inventoryExchangeAuthority: { ...pluginAuthority, worldMinute: 160 },
      })
      expect(pluginComplete.result.ok, JSON.stringify(pluginComplete)).toBe(true)
      expect(pluginComplete.application?.characters[0].dnd5eInventory?.currency?.gp).toBe(0)
      expect(pluginComplete.application?.map.tokens.some(token => token.type === 'obstacle')).toBe(true)
      expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: preparedExchange, inventoryExchangeAuthority: pluginAuthority,
        authoritativePayload: JSON.parse(JSON.stringify({ inventoryExchangeRitual: { ...completionPayload.inventoryExchangeRitual, worldMinute: 160 } })) })).result.ok).toBe(false)
      const tokenBegun = beginDnd5eInventoryExchangeRitual(tokenRitualAuthority, 100)
      expect(tokenBegun.ok).toBe(true)
      if (!tokenBegun.ok) throw Error('token ritual expected')
      const tokenCompleted = resolveAndCommitDnd5eActivityCommand({ ...state, active: false }, {
        ...tokenRitualAuthority, command: tokenBegun.command, inventoryOwner: tokenBegun.character,
      }, { ...tokenOptions, worldMinute: 160 })
      expect(tokenCompleted.result.ok, JSON.stringify(tokenCompleted)).toBe(true)
      expect(beginDnd5eInventoryExchangeRitual({ ...tokenRitualAuthority, inventoryOwner: characters[0] }, 100).ok).toBe(false)
      const begun = beginDnd5eInventoryExchangeRitual(ritualAuthority, 100)
      expect(begun.ok).toBe(true)
      if (!begun.ok) throw Error('ritual start expected')
      expect(normalizeDnd5eInventory(begun.character).currency?.gp).toBe(3)
      const restoredOwner = normalizeCharacter(JSON.parse(JSON.stringify(begun.character)))
      const completion = { ...ritualAuthority, command: begun.command, inventoryOwner: restoredOwner }
      const inactive = { ...state, active: false }
      for (const interrupted of [
        normalizeCharacter({ ...restoredOwner, currentHp: 0 }),
        normalizeCharacter({ ...restoredOwner, conditions: ['stunned'], dnd5eCombatState: undefined }),
        recoverDnd5eCombatStartResources({ ...restoredOwner, rulesetId: 'dnd5e-2014-srd-5.1' }),
      ]) {
        expect(interrupted.dnd5eInventory?.pendingExchangeRitual).toBeUndefined()
        const recovered = normalizeCharacter({ ...interrupted, currentHp: 10, conditions: [], dnd5eCombatState: undefined })
        expect(resolveAndCommitDnd5eActivityCommand(inactive, { ...completion, inventoryOwner: recovered }, { ...sceneOptions, worldMinute: 160 }).result.ok).toBe(false)
        expect(normalizeDnd5eInventory(recovered).currency?.gp).toBe(3)
      }
      expect(beginDnd5eInventoryExchangeRitual({ ...ritualAuthority, inventoryOwner: { ...characters[0], conditions: ['incapacitated'] } }, 100).ok).toBe(false)

      expect(beginDnd5eInventoryExchangeRitual(completion, 100).ok).toBe(false)
      expect(cancelDnd5eInventoryExchangeRitual(restoredOwner, 'other')).toBeUndefined()
      const cancelled = cancelDnd5eInventoryExchangeRitual(restoredOwner, begun.command.commandId)!
      expect(normalizeDnd5eInventory(cancelled).currency?.gp).toBe(3)
      expect(resolveAndCommitDnd5eActivityCommand(inactive, { ...completion, inventoryOwner: cancelled }, { ...sceneOptions, worldMinute: 160 }).result.ok).toBe(false)
      const oldName = activity.name
      activity.name = 'Changed definition'
      clearDnd5eActivityRegistryForTests()
      registerDnd5eActivityPackage({ packageId: 'exchange-test', packageVersion: '1.0.0', activities: [activity] })
      expect(resolveAndCommitDnd5eActivityCommand(inactive, completion, { ...sceneOptions, worldMinute: 160 }).result.ok).toBe(false)
      activity.name = oldName
      clearDnd5eActivityRegistryForTests()
      registerDnd5eActivityPackage({ packageId: 'exchange-test', packageVersion: '1.0.0', activities: [activity] })

      expect(resolveAndCommitDnd5eActivityCommand(inactive, completion, { ...sceneOptions, worldMinute: 159 }).result.ok).toBe(false)
      expect(resolveAndCommitDnd5eActivityCommand(inactive, { ...completion, inventoryOwner: characters[0] }, { ...sceneOptions, worldMinute: 160 }).result.ok).toBe(false)
      const changed = applyDnd5eInventoryMutation([restoredOwner], { type: 'adjust-currency', characterId: 'actor', currency: 'cp', delta: 1 }).characters[0]
      expect(resolveAndCommitDnd5eActivityCommand(inactive, { ...completion, inventoryOwner: changed }, { ...sceneOptions, worldMinute: 160 }).result.ok).toBe(false)
      const finished = resolveAndCommitDnd5eActivityCommand(inactive, completion, { ...sceneOptions, worldMinute: 160 })
      expect(finished.result.ok, JSON.stringify(finished)).toBe(true)
      if (finished.phase !== 'commit' || !finished.result.ok) throw Error('ritual finish expected')
      expect(finished.result.map?.tokens).toHaveLength(2)
      expect(finished.result.inventoryOwner?.dnd5eInventory?.pendingExchangeRitual).toBeUndefined()
      expect(finished.result.inventoryOwner?.dnd5eInventory?.currency?.gp).toBe(0)
      expect(restoredOwner.dnd5eInventory?.pendingExchangeRitual).toBeDefined()
      const scene = settleDnd5eInventoryExchangeOnMap(context)
      expect(scene.ok).toBe(true)
      if (!scene.ok) throw Error('scene expected')
      expect(map).toEqual(mapBefore)
      expect(scene.map.tokens).toHaveLength(2)
      expect(normalizeDnd5eMapObjectStateV1(JSON.parse(JSON.stringify(scene.map.tokens[1].dnd5eObjectState))))
        .toMatchObject({ inventoryItem: { templateId: 'test.exchange:key', quantity: 1, receiptId: 'exchange:ritual-1' } })
      const sceneInventory = normalizeDnd5eInventory(scene.characters[0])
      expect(sceneInventory.entries.find(entry => entry.instanceId === key.instanceId)?.quantity).toBe(1)
      expect(sceneInventory.currency?.gp).toBe(0)
      const replay = settleDnd5eInventoryExchangeOnMap({ ...context, map: { ...scene.map, tokens: [scene.map.tokens[0]] },
        characters: JSON.parse(JSON.stringify(scene.characters)) })
      expect(replay).toMatchObject({ ok: true, deduplicated: true })
      if (replay.ok) expect(replay.map.tokens).toHaveLength(1)
    }
    const result = applyDnd5eInventoryExchange(characters, input, policy)
    expect(result.ok, result.reason).toBe(mode === 'valid')
    expect(characters).toEqual(before)
    if (!result.ok) { expect(result.characters).toEqual(before); return }
    const after = normalizeDnd5eInventory(result.characters[0])
    expect(after.currency?.gp).toBe(0)
    expect(after.entries.some(entry => entry.instanceId === metal.instanceId)).toBe(false)
    expect(after.entries.find(entry => entry.instanceId === key.instanceId)?.quantity).toBe(2)
    const replay = applyDnd5eInventoryExchange(JSON.parse(JSON.stringify(result.characters)), input, policy)
    expect(replay).toMatchObject({ ok: true, deduplicated: true })
    expect(replay.characters).toEqual(result.characters)
  } finally { clearDnd5eActivityRegistryForTests(); dispose() }
})


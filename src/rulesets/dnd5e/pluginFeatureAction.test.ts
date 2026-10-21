import { prepareDnd5eRandomTargetFeatureAction } from './randomFeatureTargets'
import { createDnd5eConditionEffect } from './activeEffects'
import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eHeadlessActionFromDeclarativeDraft } from './declarativePluginPackage'
import { registerDnd5eRulesPlugin } from './pluginApi'
import {
  activateDnd5ePluginSandbox,
  type Dnd5ePluginSandboxSession,
} from './pluginSandbox'
import {
  prepareDnd5ePluginFeatureAction,
  rebaseDnd5ePluginFeatureApplication,
  resolvePreparedDnd5ePluginFeatureAction,
} from './pluginFeatureAction'

const ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

it.each(['ordered', 'empty', 'heavy', 'held', 'missing', 'up', 'down', 'invalid-pitch', 'forged-height'] as const)('derives a feature object flight from the Host map: %s', async mode => {
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
  const automation = automationCapabilityFromLegacyStatus('full'), namespace = 'test.object-flight-feature', featureId = `${namespace}:launch`
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Object flight fixture', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'launch', name: 'Launch', automation,
      payload: { id: 'launch', name: 'Launch', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'launch', name: 'Launch', activation: { kind: 'action' }, automation,
        legacySource: { kind: 'feature', id: 'launch' },
        target: { kind: 'area', relation: 'any', origin: 'point', shape: 'rect', widthFeet: 5, lengthFeet: 5, heightFeet: 5, placeRangeFeet: 60, rotatable: true, includeSelf: true },
        checks: [{ id: 'save', kind: 'saving-throw', ability: 'dex', dc: { kind: 'constant', value: 15 }, rollId: 'save', scope: 'per-target', stopAfterFirstFailure: true }],
        outcomes: [{ id: 'flight', when: { kind: 'always' }, operations: [{ id: 'flight', kind: 'launch-map-object',
          savingThrowCheckId: 'save', amount: { kind: 'constant', value: 6 }, damageType: 'bludgeoning',
          limits: { minimumWeightPounds: 1, maximumWeightPounds: 5, additionalWeightPoundsPerSlot: 5, baseSlotLevel: 1, distanceFeet: 90 } }] }],
      }] }],
  }))!
  expect(bundle).toBeTruthy()
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
  try {
    setMapGeometryRuntime([])
    const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] }), near = character('near'), far = character('far')
    const object: Token = { id: 'stone', label: 'Stone', x: 125, y: 25, color: '#fff', emoji: '', size: 1, type: 'obstacle', hp: 20, maxHp: 20,
      dnd5eObjectState: { schemaVersion: 1, weightPounds: mode === 'heavy' ? 10 : 5, wornOrCarried: mode === 'held' } }
    const map: BattleMap = { id: 'map-1', name: 'Map', width: 2000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [{ ...token('hero-token', 'hero', 25), y: 225 }, ...(mode === 'missing' ? [] : [object]),
        ...(mode === 'empty' ? [] : [token('far-token', 'far', 425), token('near-token', 'near', 225)])] }
    const request: SharedPlayerActionState = { ...action(featureId), targetCell: { col: 2, row: 0 }, targetOrientation: 0, targetTokenIds: ['far-token', 'near-token'] }
    if (mode === 'up' || mode === 'down') {
      object.elevationFeet = 10
      request.objectLaunchPitchDegrees = mode === 'up' ? 90 : -90
    }
    if (mode === 'invalid-pitch') request.objectLaunchPitchDegrees = 91
    if (mode === 'forged-height') {
      object.elevationFeet = 100
      request.targetElevationFeet = 0
    }
    const ready = prepareDnd5ePluginFeatureAction({ action: request, map, characters: [hero, near, far],
      initiativeOrder: map.tokens.filter(t => t.type !== 'obstacle').map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) })
    expect(ready.ok, JSON.stringify(ready)).toBe(['ordered', 'empty', 'up', 'down'].includes(mode))
    if (ready.ok) {
      expect(ready.prepared.headlessAction.targetIds).toEqual(mode === 'ordered' ? ['near-token', 'far-token'] : [])
      expect(ready.prepared.targetTokens.map(t => t.id)).toEqual(mode === 'ordered' ? ['near-token', 'far-token'] : [])
      expect(ready.prepared.headlessAction.activityAreaPlacement?.angleDegrees).toBe(0)
      if (mode === 'up' || mode === 'down') {
        expect(ready.prepared.headlessAction.activityAreaPlacement?.objectLaunchPitchDegrees).toBe(request.objectLaunchPitchDegrees)
        expect(ready.prepared.headlessAction.activityAreaPlacement?.elevationFeet).toBe(10)
      }
    }
    expect(object.hp).toBe(20)
    expect(object.x).toBe(125)
  } finally { dispose(); setMapGeometryRuntime([]) }
})

it.each(['random-minimum', 'random', 'second', 'zero', 'duplicate', 'outside', 'wall-blocked', 'wall-near'] as const)('settles a selective feature area through the real map facade: %s', async mode => {
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
  const automation = automationCapabilityFromLegacyStatus('full'), namespace = 'test.selective-feature', featureId = `${namespace}:pulse`
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic selection', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'pulse', name: 'Pulse', automation,
      payload: { id: 'pulse', name: 'Pulse', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'action' }, automation,
        legacySource: { kind: 'feature', id: 'pulse' }, target: { kind: 'area', origin: 'point', shape: 'sphere', relation: 'any',
          placeRangeFeet: 60, radiusFeet: 10, selection: 'choose-any', maximumTargets: mode==='random-minimum'?2:1, minimumTargets:mode==='random-minimum'?2:0 },
        consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
        outcomes: [{ id: 'hp', when: { kind: 'always' }, operations: [{ id: 'hp', kind: 'temporary-hit-points', target: 'all-targets', amount: { kind: 'constant', value: 3 } }] }],
      }] }],
  }))!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
  try {
    const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
    if(mode.startsWith('random'))hero.dnd5eCombatState={activeEffects:[createDnd5eMechanicalEffect({definitionId:'test:random',label:'Random',targetId:'hero-token',source:{kind:'spell'},modifiers:{randomVisibleCreatureTargets:true,perceiveVisibleCreaturesAsHostile:true}})]}
    const ally = character('ally'), second = character('second'), outside = character('outside')
    const map: BattleMap = { id: 'map-1', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      feetPerCell: 5, showGrid: true, tokens: [token('hero-token', 'hero', 25), token('ally-token', 'ally', 75), token('second-token', 'second', 125), token('outside-token', 'outside', 425)] }
    if (mode.startsWith('wall-')) {
      const geometry = createEmptyMapGeometry(map.id, 1)
      geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 100, y: 0 }, { x: 100, y: 500 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 100, createdAt: 1 })
      setMapGeometryRuntime([geometry])
    }
    const selected = mode==='random-minimum'?['second-token','ally-token']:mode === 'zero' ? [] : mode === 'wall-near' ? ['ally-token'] : mode === 'outside' ? ['outside-token'] : mode === 'duplicate' ? ['second-token', 'second-token'] : ['second-token']
    const request = { ...action(featureId), targetTokenIds: selected, targetCell: { col: 1, row: 0 } }
    const prepared = prepareDnd5eRandomTargetFeatureAction({ chooseRandomTarget:(i,ids)=>{expect([...ids].sort()).toEqual(i===0?['ally-token','second-token']:['ally-token']);return mode==='random-minimum'?(i===0?'second-token':'ally-token'):'ally-token'}, action: request, map, characters: [hero, ally, second, outside],
      initiativeOrder: map.tokens.map((entry, i) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - i })) })
    expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(mode === 'random-minimum' || mode === 'random' || mode === 'second' || mode === 'zero' || mode === 'wall-near')
    if (prepared.ok) {
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
      expect(resolved.result.state.combatants['second-token'].temporaryHp).toBe(mode === 'random-minimum' || mode === 'second' ? 3 : 0)
      expect(resolved.result.state.combatants['ally-token'].temporaryHp).toBe(mode.startsWith('random') || mode === 'wall-near' ? 3 : 0)
      expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    }
  } finally { setMapGeometryRuntime([]); dispose() }
})

it.each(['legacy', 'native', 'native-feat', 'native-inferred', 'native-feat-inferred'] as const)('exports and reinstalls a complete alteration module (%s), then settles its compiled feature through the map facade', async format => {
  const { exportLegacyDnd5eStarMod, readLegacyDnd5eStarMod } = await import('./starModAdapter')
  const { DND5E_CONTENT_PACKAGE_FORMAT, DND5E_CONTENT_PACKAGE_SCHEMA_VERSION, dnd5eRulesPluginFromContentPackageV2 } = await import('./contentPackageV2')
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { dnd5ePluginFeatureActionFromActivityV1 } = await import('./activities/dnd5eActivityFeatureActionAdapter')
  const { normalizeCharacter } = await import('../../store/characters')
  const { applyDnd5eInventoryMutation } = await import('./items')
  const pluginId = 'test.archive-alteration'
  let featureId = `${pluginId}:alter`
  const contentKind = format.startsWith('native-feat') ? 'feat' : 'feature'
  const activity: import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'alter', name: 'Alter', activation: { kind: 'action' }, target: { kind: 'self' },
    legacySource: { kind: contentKind, id: 'alter' }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'life', name: 'Lifetime', stacking: 'replace', duration: { kind: 'permanent' }, modifiers: [] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
      { id: 'life', kind: 'apply-effect', target: 'actor', effectId: 'life' },
      { id: 'alter', kind: 'alter-inventory-item', target: 'actor', originalTemplateIds: ['srd-5.1:item:gold-dust-25gp'],
        templateId: 'srd-5.1:item:goodberry', quantity: { kind: 'constant', value: 3 }, sourceEffectId: 'life' },
    ] }] }
  const original: import('./contentPackageV2').Dnd5eContentPackageV2 = {
    format: DND5E_CONTENT_PACKAGE_FORMAT, schemaVersion: DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
    manifest: { id: pluginId, name: 'Synthetic alteration archive', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    provenance: { edition: '2014', contentMode: 'incremental', sourceTitle: 'Synthetic test fixture' }, assets: [],
    content: { races: [], backgrounds: [], feats: [], spells: [], items: [], subclasses: [], monsters: [], headlessActions: [], abilityGenerationMethods: [],
      features: [{ id: 'alter', name: 'Alter', summary: 'Synthetic', description: 'Synthetic archive route', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) }],
      activities: [activity] },
  }
  if (contentKind === 'feat') {
    original.content.feats = original.content.features
    original.content.features = []
  }
  const before = structuredClone(original)
  const missing = structuredClone(original)
  missing.content.activities = []
  await expect(exportLegacyDnd5eStarMod(missing)).rejects.toThrow('缺少 Headless')
  const unsupported = structuredClone(original)
  unsupported.content.activities![0].outcomes[0].operations = [{ id: 'invoke', kind: 'invoke-activity',
    activityId: 'other', target: 'actor', repeat: { kind: 'constant', value: 1 } }]
  await expect(exportLegacyDnd5eStarMod(unsupported)).rejects.toThrow('缺少 Headless')
  const decoded = await readLegacyDnd5eStarMod(await exportLegacyDnd5eStarMod(original))
  expect(decoded).toBeDefined()
  expect(original).toEqual(before)
  expect(decoded!.package.content.activities).toEqual([activity])
  let plugin = dnd5eRulesPluginFromContentPackageV2(decoded!.package)
  if (format !== 'legacy') {
    const { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
    const { exportDnd5eStarMod, readDnd5eStarMod } = await import('./starModAdapter')
    const payload = structuredClone([...original.content.features, ...original.content.feats][0])
    if (format.endsWith('inferred')) delete payload.action
    const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
      manifest: original.manifest, assets: [], definitions: [{ schemaVersion: 1, namespace: pluginId, version: '1.0.0',
        kind: contentKind, id: 'alter', name: 'Alter', description: 'Synthetic archive route',
        automation: automationCapabilityFromLegacyStatus('full'), payload, activities: [activity] }] }))!
    const sourceBundle = structuredClone(bundle)
    const installed = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    plugin = dnd5eRulesPluginFromUnifiedContentBundleV1(installed.bundle)
    expect(bundle).toEqual(sourceBundle)
    if (format.endsWith('inferred')) expect((installed.bundle.definitions[0].payload as typeof payload).action).toBeUndefined()
  }
  const dispose = registerDnd5eRulesPlugin(plugin)
  try {
    if (contentKind === 'feat') featureId = (await import('./pluginApi')).dnd5ePluginFeatDefinition(`${pluginId}:alter`)!.featureId
    const hero = applyDnd5eInventoryMutation([normalizeCharacter({ ...character('hero'), dnd5ePluginFeatureIds: [featureId],
      ...(contentKind === 'feat' ? { dnd5eFeatIds: [`${pluginId}:alter`] } : {}),
      equipment: {}, dnd5eInventory: { schemaVersion: 3, entries: [] } })],
      { type: 'grant', characterId: 'hero', templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 5 }).characters[0]
    const map: BattleMap = { id: 'map-1', name: 'Test', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      feetPerCell: 5, showGrid: true, tokens: [token('hero-token', 'hero', 25)] }
    for (const stale of [false, true]) {
      const request = { ...action(featureId), targetTokenId: 'hero-token', dnd5ePluginAction: { featureId, payload: {
        activityInventoryCharacterId: 'hero', activityInventoryInstanceId: hero.dnd5eInventory!.entries[0].instanceId,
        expectedActivityInventoryRevision: (hero.dnd5eInventory!.revision ?? 0) + (stale ? 1 : 0) } } }
      const prepared = prepareDnd5ePluginFeatureAction({ action: request, map, characters: [hero],
        initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }] })
      if (!prepared.ok) throw new Error(prepared.reason)
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(!stale)
      if (stale) { expect(resolved.application).toBeUndefined(); continue }
      const inventory = resolved.application!.characterPatches!.hero.dnd5eInventory!
      expect(inventory.entries.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(5)
      const altered = inventory.entries.find(entry => entry.spellAlteration)!
      expect(altered).toMatchObject({ quantity: 3, sourceEffectOwnerId: 'hero' })
      expect(resolved.application!.characters[0].dnd5eCombatState?.activeEffects?.some(effect => effect.tags?.includes(altered.sourceEffectTag!))).toBe(true)
    }
    expect(hero.dnd5eInventory!.entries).toHaveLength(1)
  } finally { dispose() }
})

it('routes a real rest feature request through Host authorization and preserves its receipt with the applied effect', async () => {
  const { registerDnd5eActivityPackage } = await import('./activities/dnd5eActivityRegistry')
  const { compileDnd5eActivityHeadlessAction } = await import('./activities/dnd5eActivityHeadlessCompiler')
  const { dnd5ePluginFeatureActionFromActivityV1 } = await import('./activities/dnd5eActivityFeatureActionAdapter')
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { normalizeCharacter } = await import('../../store/characters')
  const { reconcileDnd5eCharacterCampaignTime } = await import('./campaignTimeRules')
  const { applyDnd5eInventoryMutation } = await import('./items')
  const activity: import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'bless', name: 'Rest blessing', activation: { kind: 'free' }, target: { kind: 'self' },
    invocation: { kind: 'triggered', event: 'long-rest-complete', confirmation: 'actor-choice', retention: 'single-event' },
    legacySource: { kind: 'feature', id: 'bless' }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'bound', name: 'Blessed armor', stacking: 'replace', duration: { kind: 'permanent' }, breakOn: ['source-long-rest-complete'], modifiers: [{ kind: 'armor-enchantment', itemSelection: 'inventory-item', requiresNonmagical: true, armorClassBonus: { kind: 'constant', value: 1 } }] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'bind', kind: 'apply-effect', target: 'actor', effectId: 'bound' }] }],
  }
  const pluginId = 'test.rest-route', featureId = `${pluginId}:bless`
  const registration = registerDnd5eActivityPackage({ packageId: pluginId, packageVersion: '1.0.0', activities: [activity] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: pluginId, name: 'Rest', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) { api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity)); api.registerFeature({ id: 'bless', name: 'Rest', description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) }) } })
  try {
    const clock: import('../../lib/campaignTime').SharedCampaignTimeState = { schemaVersion: 2, worldMinute: 480, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], updatedAt: 1, advances: [{ id: 'rest-480', kind: 'long-rest', fromWorldMinute: 0, toWorldMinute: 480, minutes: 480, reason: 'Test', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1, beneficiaryCharacterIds: ['hero'] }] }
    const source = normalizeCharacter({ ...character('hero'), dnd5ePluginFeatureIds: [featureId], dnd5eWorldTimeAppliedMinute: 0, equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] } })
    const granted = applyDnd5eInventoryMutation([source], { type: 'grant', characterId: 'hero', templateId: 'srd-5.1:equipment:dnd5e-chain-mail', quantity: 1 }).characters[0]
    const hero = reconcileDnd5eCharacterCampaignTime(granted, clock).character
    const map: BattleMap = { id: 'map-1', name: 'Rest', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [token('hero-token', 'hero', 25)] }
    const request = { ...action(featureId), targetTokenId: 'hero-token', dnd5ePluginAction: { featureId, payload: { restEventId: hero.dnd5eRestActivityWindow!.eventId, activityInventoryCharacterId: 'hero', activityInventoryInstanceId: hero.dnd5eInventory!.entries[0].instanceId, expectedActivityInventoryRevision: hero.dnd5eInventory!.revision ?? 0 } } }
    const prepare = (owner = hero) => prepareDnd5ePluginFeatureAction({ action: request, map, characters: [owner], initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }] })
    const prepared = prepare()
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error('prepare failed')
    expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })).result.ok).toBe(false)
    expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared, restAuthority: { clock: { ...clock, worldMinute: 481 }, combatRevision: 3 } })).result.ok).toBe(false)
    const declined = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared, restAuthority: { clock, combatRevision: 3 }, authoritativePayload: { restEventId: hero.dnd5eRestActivityWindow!.eventId, restDecision: 'decline' } })
    expect(declined.result.ok).toBe(true)
    expect(declined.result.state).toBe(prepared.prepared.state)
    expect(declined.application?.characterPatches?.hero?.dnd5eRestActivityWindow?.receipts).toEqual({ '["test.rest-route","bless"]': 'declined' })
    const afterDecline = prepare(declined.application!.characters.find(entry => entry.id === 'hero')!)
    if (!afterDecline.ok) throw Error('declined state preparation failed')
    expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: afterDecline.prepared, restAuthority: { clock, combatRevision: 4 } })).result.ok).toBe(false)
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared, restAuthority: { clock, combatRevision: 3 } })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.application?.characterPatches?.hero?.dnd5eRestActivityWindow?.receipts).toEqual({ '["test.rest-route","bless"]': 'used' })
    const committed = resolved.application!.characters.find(entry => entry.id === 'hero')!
    expect(committed.dnd5eCombatState?.activeEffects?.some(effect => effect.label === 'Blessed armor')).toBe(true)
    const replay = prepare(committed)
    expect(replay.ok).toBe(true)
    if (replay.ok) expect((await resolvePreparedDnd5ePluginFeatureAction({ prepared: replay.prepared, restAuthority: { clock, combatRevision: 4 } })).result.ok).toBe(false)
    expect(hero.dnd5eRestActivityWindow!.receipts).toEqual({})
  } finally { dispose(); registration.dispose() }
})

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id,
    name: id,
    player: id,
    avatar: '🛡️',
    accent: 'from-slate-500 to-slate-700',
    race: '人类',
    charClass: '战士',
    level: 3,
    background: '士兵',
    experience: 0,
    reputation: 0,
    abilities: ABILITIES,
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d10',
    ac: 16,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    
    
    passivePerception: 10,
    inspiration: 0,
    
    
    
    
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, characterId: string, x: number, type: Token['type'] = 'player'): Token {
  return {
    id,
    label: id,
    x,
    y: 25,
    color: '#34d399',
    emoji: '●',
    type,
    size: 1,
    characterId,
  }
}

function action(featureId: string): SharedPlayerActionState {
  return {
    id: 'plugin-action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-plugin-action',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'ally-token',
    dnd5ePluginAction: { featureId },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1,
  }
}

describe('D&D 5e plugin feature authority action', () => {
  it('authorizes a DM-controlled monster action granted by its live Detect Thoughts effect', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:detect-thoughts:contest'
    const wizardToken = token('wizard-token', 'wizard', 75)
    const wizard = character('wizard', {
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'detect-thoughts-controller-instance',
          definitionId: 'activity:detect-thoughts:detect-thoughts-controller:modifiers:0',
          label: '侦测思想·持续读心',
          source: {
            kind: 'spell', actorId: wizardToken.id, characterId: 'wizard',
            rulesId: 'detect-thoughts', pluginId: 'srd-5.1', spellLevel: 2, magical: true,
          },
          targetId: wizardToken.id,
          duration: { type: 'concentration', sourceActorId: wizardToken.id, remainingRounds: 10 },
          grantedActivities: [
            'spell:detect-thoughts:surface',
            'spell:detect-thoughts:probe',
            'spell:detect-thoughts:search',
          ],
        })],
      },
    })
    const probed = createDnd5eMechanicalEffect({
      id: 'detect-thoughts-probed-instance',
      definitionId: 'activity:srd-5.1:spell:detect-thoughts:probe:detect-thoughts-probed:modifiers:0',
      label: '侦测思想·察觉深入探查',
      source: {
        kind: 'plugin', actorId: wizardToken.id, characterId: wizard.id,
        rulesId: 'srd-5.1:spell:detect-thoughts:probe', pluginId: 'srd-5.1', magical: false,
      },
      targetId: 'bandit-token',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-end' },
      grantedActivities: ['spell:detect-thoughts:contest'],
    })
    const bandit = {
      ...token('bandit-token', '', 25, 'enemy'),
      characterId: undefined,
      hp: 11,
      maxHp: 11,
      poolId: 'srd-5.1:bandit',
      dnd5eCombatState: { activeEffects: [probed] },
    } as Token
    const map: BattleMap = {
      id: 'map-1', name: 'Detect Thoughts contest', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [bandit, wizardToken],
    }
    const requested: SharedPlayerActionState = {
      ...action(featureId),
      sourceMode: 'dm',
      actorTokenId: bandit.id,
      characterId: `dm-token:${bandit.id}`,
      targetTokenId: wizardToken.id,
      dnd5ePluginAction: { featureId, payload: { activeEffectId: probed.id } },
    }

    const prepared = prepareDnd5ePluginFeatureAction({
      action: requested,
      map,
      characters: [wizard],
      initiativeOrder: [
        { slotId: 'bandit-token:normal', tokenId: bandit.id, label: bandit.label, emoji: 'B', color: '#fff', roll: 20 },
        { slotId: 'wizard-token:normal', tokenId: wizardToken.id, label: wizard.name, emoji: 'W', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:bandit-token:normal'),
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.actor.name).toBe('bandit-token')
    expect(prepared.prepared.actorToken.id).toBe(bandit.id)
    expect(prepared.prepared.targetToken.id).toBe(wizardToken.id)
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
      kind: 'active-effect', effectId: probed.id,
    })
  })

  it('preflights root Active Effect requirements before a monster grant opens its DM interrupt', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:geas:violate-command'
    const wizardToken = token('wizard-token', 'wizard', 75)
    const wizard = character('wizard')
    const geas = createDnd5eMechanicalEffect({
      id: 'geas-instance',
      definitionId: 'activity:srd-5.1:spell:geas:geas-charmed:modifiers:0',
      label: '指使术',
      source: {
        kind: 'spell', actorId: wizardToken.id, characterId: wizard.id,
        rulesId: 'geas', pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: 'bandit-token',
      duration: { type: 'rounds', remainingRounds: 432_000, tickOn: 'target-turn-end' },
      grantedActivities: ['spell:geas:violate-command'],
    })
    const cooldown = createDnd5eMechanicalEffect({
      id: 'geas-daily-lock-instance',
      definitionId: 'activity:srd-5.1:spell:geas:violate-command:geas-daily-damage-lock:modifiers:1',
      label: '指使术·每日伤害已触发',
      source: {
        kind: 'spell', actorId: 'bandit-token', rulesId: 'geas',
        pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: 'bandit-token',
      duration: { type: 'rounds', remainingRounds: 14_400, tickOn: 'target-turn-end' },
    })
    const makeBandit = (activeEffects: NonNullable<Token['dnd5eCombatState']>['activeEffects']) => ({
      ...token('bandit-token', '', 25, 'enemy'),
      characterId: undefined,
      hp: 65,
      maxHp: 65,
      poolId: 'srd-5.1:bandit-captain',
      dnd5eCombatState: { activeEffects },
    } as Token)
    const request: SharedPlayerActionState = {
      ...action(featureId),
      sourceMode: 'dm',
      actorTokenId: 'bandit-token',
      characterId: 'dm-token:bandit-token',
      targetTokenId: 'bandit-token',
      dnd5ePluginAction: { featureId, payload: { activeEffectId: geas.id } },
    }
    const prepare = (bandit: Token) => prepareDnd5ePluginFeatureAction({
      action: request,
      map: {
        id: 'map-1', name: 'Geas cooldown', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [bandit, wizardToken],
      },
      characters: [wizard],
      initiativeOrder: [
        { slotId: 'bandit-token:normal', tokenId: 'bandit-token', label: 'Bandit Captain', emoji: 'B', color: '#fff', roll: 20 },
        { slotId: 'wizard-token:normal', tokenId: wizardToken.id, label: wizard.name, emoji: 'W', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:bandit-token:normal'),
      roomRequiredPlugins: [],
    })

    const firstUse = prepare(makeBandit([geas]))
    expect(firstUse.ok, firstUse.ok ? undefined : firstUse.reason).toBe(true)
    const repeatedUse = prepare(makeBandit([geas, cooldown]))
    expect(repeatedUse).toEqual({ ok: false, reason: 'feature-unavailable' })
  })

  it('removes the caster Geas controller after dismissing the last affected target', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:geas:dismiss'
    const heroToken = token('hero-token', 'hero', 25)
    const allyToken = token('ally-token', 'ally', 75)
    const controller = createDnd5eMechanicalEffect({
      id: 'geas-controller-instance',
      definitionId: 'activity:srd-5.1:spell:geas:geas-caster-controller:marker',
      label: '指使术·施法者控制',
      source: {
        kind: 'spell', actorId: heroToken.id, characterId: 'hero',
        rulesId: 'geas', pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: heroToken.id,
      duration: { type: 'rounds', remainingRounds: 432_000, tickOn: 'target-turn-end' },
      grantedActivities: ['spell:geas:dismiss'],
      stackingPolicy: 'stack',
    })
    const geas = createDnd5eMechanicalEffect({
      id: 'geas-target-instance',
      definitionId: 'activity:srd-5.1:spell:geas:geas-charmed',
      label: '指使术',
      source: {
        kind: 'spell', actorId: heroToken.id, characterId: 'hero',
        rulesId: 'geas', pluginId: 'srd-5.1', spellLevel: 5, magical: true,
      },
      targetId: allyToken.id,
      duration: { type: 'rounds', remainingRounds: 432_000, tickOn: 'target-turn-end' },
      grantedActivities: ['spell:geas:violate-command'],
    })
    const hero = character('hero', { dnd5eCombatState: { activeEffects: [controller] } })
    const ally = character('ally', { dnd5eCombatState: { activeEffects: [geas] } })
    const map: BattleMap = {
      id: 'map-1', name: 'Geas dismissal', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken, allyToken],
    }
    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId), targetTokenId: allyToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: controller.id } },
      },
      map,
      characters: [hero, ally],
      initiativeOrder: [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: allyToken.id, label: ally.name, emoji: 'A', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((candidate) => candidate.id === ally.id)
      ?.dnd5eCombatState?.activeEffects ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: geas.id }),
    ]))
    expect(resolved.application?.characters.find((candidate) => candidate.id === hero.id)
      ?.dnd5eCombatState?.activeEffects ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: controller.id }),
    ]))
  })

  it('authorizes a monster to investigate an externally usable Disguise Self effect', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:disguise-self:inspect'
    const wizardToken = token('wizard-token', 'wizard', 75)
    const disguise = createDnd5eMechanicalEffect({
      id: 'disguise-self-instance',
      definitionId: 'activity:spell:disguise-self:disguise-self-appearance:modifiers:0',
      label: '易容术',
      source: {
        kind: 'spell', actorId: wizardToken.id, characterId: 'wizard',
        rulesId: 'disguise-self', pluginId: 'srd-5.1', spellLevel: 1,
        spellSaveDc: 19, magical: true,
      },
      targetId: wizardToken.id,
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      tags: ['illusion', 'disguise', 'appearance', 'externally-usable-activity'],
      grantedActivities: ['spell:disguise-self:dismiss', 'spell:disguise-self:inspect'],
    })
    const wizard = character('wizard', { saveDC: 19, dnd5eCombatState: { activeEffects: [disguise] } })
    const bandit = {
      ...token('bandit-token', '', 25, 'enemy'), characterId: undefined,
      hp: 11, maxHp: 11, poolId: 'srd-5.1:bandit',
    } as Token
    const map: BattleMap = {
      id: 'map-1', name: 'Disguise inspection', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [bandit, wizardToken],
    }
    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId), sourceMode: 'dm', actorTokenId: bandit.id,
        characterId: `dm-token:${bandit.id}`, targetTokenId: wizardToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: disguise.id } },
      },
      map, characters: [wizard],
      initiativeOrder: [
        { slotId: 'bandit-token:normal', tokenId: bandit.id, label: bandit.label, emoji: 'B', color: '#fff', roll: 20 },
        { slotId: 'wizard-token:normal', tokenId: wizardToken.id, label: wizard.name, emoji: 'W', color: '#fff', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:bandit-token:normal'),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
      kind: 'active-effect', effectId: disguise.id,
    })
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: prepared.prepared,
      rolls: {
        [`disguise-self-investigation-d20:${wizardToken.id}`]: {
          values: [20, 1], modifier: 0, total: 21,
        },
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', actorId: bandit.id, perceivedTargetId: wizardToken.id,
      total: 20, dc: 19, success: true,
    }))
  })

  it('accepts and resolves a legacy core-spell Effect grant and its empty Blink return cell', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:blink:return'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      id: 'blink-return-pending-instance',
      definitionId: 'blink-return-pending',
      label: '闪现术·返回落点',
      source: { kind: 'spell', actorId: heroToken.id, rulesId: 'blink', magical: true },
      targetId: heroToken.id,
      grantedActivities: ['spell:blink:return'],
      modifiers: { speedOverrideFeet: 0 },
      duration: { type: 'until-turn-boundary', boundary: 'target-turn-end' },
    })
    const hero = character('hero', { dnd5eCombatState: { activeEffects: [controller] } })
    const map: BattleMap = {
      id: 'map-1', name: 'Blink return', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken],
    }

    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: undefined,
        targetCell: { col: 1, row: 0 },
        dnd5ePluginAction: { featureId, payload: { activeEffectId: controller.id } },
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
      ],
      turnEconomy: {
        ...createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
        movement: { current: 0, max: 0 },
      },
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetCell).toEqual({ col: 1, row: 0 })
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
      kind: 'active-effect', effectId: controller.id,
    })
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: prepared.prepared,
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.activityHandoffs?.movements).toContainEqual(expect.objectContaining({
      operationId: 'blink-return-teleport', targetId: heroToken.id,
      mode: 'teleport', distanceFeet: 10,
    }))
    expect(resolved.result.state.combatants[heroToken.id]?.turn.movementRemaining).toBe(30)
  })

  it('rejects an Activity control whose granting Effect is suspended', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:tree-stride:teleport'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      id: 'suspended-tree-stride-controller',
      definitionId: 'activity:tree-stride:tree-stride-teleport:modifiers:0',
      label: '树跃术·暂停控制',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'tree-stride', spellLevel: 5, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:tree-stride:teleport'],
      suspendedBy: ['transition-instance'],
      duration: { type: 'concentration', sourceActorId: heroToken.id, remainingRounds: 10 },
    })
    const hero = character('hero', { dnd5eCombatState: { activeEffects: [controller] } })
    const map: BattleMap = {
      id: 'map-1', name: 'Suspended grant', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken],
    }

    expect(prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: heroToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: controller.id } },
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
    })).toEqual({ ok: false, reason: 'feature-not-selected' })
  })

  it('rejects a used once-per-turn granted Activity before opening its DM interrupt', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:tree-stride:teleport'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:tree-stride:tree-stride-teleport:modifiers:0',
      label: '树跃术·树跃能力',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'tree-stride', spellLevel: 5, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:tree-stride:teleport'],
      duration: { type: 'concentration', sourceActorId: heroToken.id, remainingRounds: 10 },
    })
    const hero = character('hero', {
      dnd5eCombatState: {
        activeEffects: [controller],
      },
    })
    const map: BattleMap = {
      id: 'map-1', name: 'Tree Stride once per turn', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken],
    }
    const initiativeOrder: InitiativeEntry[] = [
      { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
    ]

    expect(prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: heroToken.id,
        dnd5ePluginAction: {
          featureId,
          payload: { activeEffectId: controller.id },
        },
      },
      map,
      characters: [hero],
      initiativeOrder,
      turnEconomy: {
        ...createDnd5eTurnEconomyCounts('combat-1:1:hero-token:normal'),
        usedOncePerTurnKeys: ['tree-stride-teleport'],
      },
      roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: 'feature-already-used' })
  })

  it('keeps the captured spell DC for a spell-granted follow-up Activity', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:magic-jar:possess'
    const heroToken = token('hero-token', 'hero', 25)
    const targetToken = token('ally-token', 'target', 75, 'enemy')
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:magic-jar:magic-jar-controller:modifiers:0',
      label: '魔魂壶·灵魂容器',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'magic-jar', spellLevel: 6, spellSaveDc: 19, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:magic-jar:possess', 'spell:magic-jar:return', 'spell:magic-jar:return-body'],
      duration: { type: 'permanent' },
    })
    const hero = character('hero', {
      charClass: '法师',
      level: 20,
      abilities: { ...ABILITIES, int: 20 },
      saveDC: 12,
      dnd5eCombatState: { activeEffects: [controller] },
    })
    const target = character('target')
    const map: BattleMap = {
      id: 'map-1', name: 'Magic Jar save DC', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken, targetToken],
    }
    const initiativeOrder: InitiativeEntry[] = [
      { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
      { slotId: 'ally-token:normal', tokenId: targetToken.id, label: target.name, emoji: 'T', color: '#f00', roll: 10 },
    ]
    const prepared = prepareDnd5ePluginFeatureAction({
      action: {
        ...action(featureId),
        targetTokenId: targetToken.id,
        dnd5ePluginAction: {
          featureId,
          payload: { activeEffectId: controller.id },
        },
      },
      map,
      characters: [hero, target],
      initiativeOrder,
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[heroToken.id].saveDc).toBe(19)
  })

  it('resolves the Instant Summons recall granted by its live controller effect with an airborne witness', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const featureId = 'srd-5.1:effect-control.spell:instant-summons:recall'
    const heroToken = token('hero-token', 'hero', 25)
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:instant-summons:instant-summons-controller:modifiers:0',
      label: '瞬间召唤·物品连结',
      source: {
        kind: 'spell', actorId: heroToken.id, pluginId: 'srd-5.1',
        rulesId: 'instant-summons', spellLevel: 6, magical: true,
      },
      targetId: heroToken.id,
      grantedActivities: ['spell:instant-summons:recall'],
      duration: { type: 'permanent' },
    })
    const recordId = `linked-planar-object:instant-summons:${heroToken.id}:knife-1`
    const secondRecordId = `linked-planar-object:instant-summons:${heroToken.id}:parchment-1`
    const hero = character('hero', {
      dnd5eCombatState: {
        activeEffects: [controller],
        spellAuthorityRecords: {
          [recordId]: {
            schemaVersion: 1,
            id: recordId,
            sourceActorId: heroToken.id,
            subjectActorId: heroToken.id,
            sourceActivityId: 'spell:instant-summons',
            createdWorldMinute: 1,
            kind: 'linked-planar-object',
            profile: 'instant-summons',
            inventoryInstanceId: 'knife-1',
            planarState: 'material',
          },
          [secondRecordId]: {
            schemaVersion: 1,
            id: secondRecordId,
            sourceActorId: heroToken.id,
            subjectActorId: heroToken.id,
            sourceActivityId: 'spell:instant-summons',
            createdWorldMinute: 2,
            kind: 'linked-planar-object',
            profile: 'instant-summons',
            inventoryInstanceId: 'parchment-1',
            spellLevel: 8,
            planarState: 'material',
          },
        },
      },
    })
    const airborneWitness: Token = {
      ...token('airborne-witness', '', 125, 'enemy'),
      characterId: undefined,
      hp: 10,
      maxHp: 10,
      elevationFeet: 10,
    }
    const map: BattleMap = {
      id: 'map-1', name: 'Instant Summons exploration', width: 600, height: 400,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [heroToken, airborneWitness],
    }
    const initiativeOrder: InitiativeEntry[] = [
      {
        slotId: `exploration:${heroToken.id}`, tokenId: heroToken.id,
        label: hero.name, emoji: 'H', color: '#fff', roll: 20,
      },
      {
        slotId: `exploration:${airborneWitness.id}`, tokenId: airborneWitness.id,
        label: airborneWitness.label, emoji: 'W', color: '#f00', roll: 10,
      },
    ]
    const requested: SharedPlayerActionState = {
      ...action(featureId),
      combatId: undefined,
      targetTokenId: heroToken.id,
      dnd5ePluginAction: {
        featureId,
        payload: {
          activeEffectId: controller.id,
          activitySpellAuthorityRecordId: secondRecordId,
        },
      },
    }
    const prepared = prepareDnd5ePluginFeatureAction({
      action: requested, map, characters: [hero], initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: prepared.prepared,
      authoritativePayload: { activitySpellAuthorityRecordId: secondRecordId },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[heroToken.id].classState.spellAuthorityRecords?.[recordId])
      .toBeDefined()
    expect(resolved.result.state.combatants[heroToken.id].classState.spellAuthorityRecords?.[secondRecordId])
      .toBeUndefined()
    expect(resolved.result.state.combatants[heroToken.id].classState.activeEffects?.map((effect) => effect.id))
      .toContain(controller.id)
  })

  it('authorizes an unowned Activity only while its authoritative effect grant is live', () => {
    const pluginId = 'local.effect-grant-test'
    const featureId = `${pluginId}:effect-control.levitate-control`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Effect grant', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeature({
          id: 'effect-control.levitate-control', name: 'Levitate control',
          summary: 'Move a levitated target.', description: 'Effect-owned action.',
          automation: 'full',
          action: {
            id: 'levitate-control', label: 'Levitate control', economy: 'none',
            targeting: { kind: 'self' },
          },
        })
        api.registerHeadlessAction({ id: 'levitate-control', resolve: ({ succeed }) => succeed() })
      },
    })
    try {
      const activeEffect = createDnd5eMechanicalEffect({
        definitionId: 'activity:levitate-control', label: 'Levitate control',
        source: { kind: 'spell', actorId: 'hero-token', pluginId }, targetId: 'hero-token',
        grantedActivities: ['levitate-control'],
      })
      const hero = character('hero', { dnd5eCombatState: { activeEffects: [activeEffect] } })
      const heroToken = token('hero-token', hero.id, 25)
      const map: BattleMap = {
        id: 'map-1', name: 'Effect grant map', width: 600, height: 400,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [heroToken],
      }
      const initiativeOrder: InitiativeEntry[] = [{
        slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name,
        emoji: 'H', color: '#fff', roll: 20,
      }]
      const requested = {
        ...action(featureId),
        targetTokenId: heroToken.id,
        dnd5ePluginAction: { featureId, payload: { activeEffectId: activeEffect.id } },
      }
      const prepared = prepareDnd5ePluginFeatureAction({
        action: requested, map, characters: [hero], initiativeOrder,
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (prepared.ok) expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({
        kind: 'active-effect', effectId: activeEffect.id,
      })
      expect(prepareDnd5ePluginFeatureAction({
        action: requested, map,
        characters: [{ ...hero, dnd5eCombatState: { activeEffects: [] } }], initiativeOrder,
      })).toEqual({ ok: false, reason: 'feature-not-selected' })
    } finally {
      dispose()
    }
  })

  it('authorizes an unowned Activity only through its live persistent area and derives range from the area', () => {
    const pluginId = 'local.area-grant-test'
    const featureId = `${pluginId}:area-control.vine-control`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Area grant', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeature({
          id: 'area-control.vine-control', name: 'Vine control', summary: 'Vine control',
          description: 'Pull from a Host-owned area.', automation: 'full',
          action: {
            id: 'vine-control', label: 'Vine control', economy: 'bonusAction',
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
          },
        })
        api.registerHeadlessAction({ id: 'vine-control', resolve: ({ succeed }) => succeed() })
      },
    })
    try {
      const hero = character('hero')
      const enemy = character('enemy')
      const heroToken = token('hero-token', hero.id, 25)
      const enemyToken = token('enemy-token', enemy.id, 325, 'enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Area grant map', width: 600, height: 400,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [heroToken, enemyToken],
        dnd5ePluginAreas: [{
          id: 'vine-area', pluginId, featureId: 'vine-cast', label: 'Vine', color: '#166534',
          sourceCharacterId: hero.id, sourceTokenId: heroToken.id,
          cells: [{ col: 5, row: 0 }], anchorCell: { col: 5, row: 0 },
          createdRound: 1, expiresAfterRound: 10,
          grantedActivities: [{ activityId: 'vine-control', activateOnCreate: true }],
        }],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: enemyToken.id, label: enemy.name, emoji: 'E', color: '#f00', roll: 10 },
      ]
      const requested = {
        ...action(featureId),
        targetTokenId: enemyToken.id,
        dnd5ePluginAction: { featureId, payload: { persistentAreaId: 'vine-area' } },
      }
      const prepared = prepareDnd5ePluginFeatureAction({
        action: requested,
        map,
        characters: [hero, enemy],
        initiativeOrder,
        turnEconomy: {
          turnKey: 'combat-1:1:hero-token:normal',
          attacksUsed: 0,
          action: { current: 1, max: 1 }, bonusAction: { current: 0, max: 1 },
          reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
        },
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.distanceFeet).toBe(5)
      expect(prepared.prepared.headlessAction).toMatchObject({
        hostEntitlement: { kind: 'persistent-area', areaId: 'vine-area' },
        hostWaiveActionEconomy: true,
        hostDistanceFeetByTargetId: { 'enemy-token': 5 },
      })

      // Range is measured from the owned area, independently of caster proximity.
      for (const [targetCol, expectedDistance, allowed] of [[26, 30, true], [27, 35, false], [1, 95, false]] as const) {
        const remoteMap = { ...map, width: 2000,
          tokens: [heroToken, { ...enemyToken, x: targetCol * 50 + 25 }],
          dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({ ...area, cells: [{ col: 20, row: 0 }], anchorCell: { col: 20, row: 0 } })),
        }
        const boundary = prepareDnd5ePluginFeatureAction({ action: requested, map: remoteMap, characters: [hero, enemy], initiativeOrder })
        expect(boundary.ok, JSON.stringify(boundary)).toBe(allowed)
        if (boundary.ok) {
          expect(boundary.prepared.distanceFeet).toBe(expectedDistance)
          expect(boundary.prepared.headlessAction.hostDistanceFeetByTargetId).toEqual({ 'enemy-token': expectedDistance })
        } else expect(boundary.reason).toBe('target-out-of-range')
      }
      // Grant range includes height separation from the nearest face, not just XY cells.
      for (const [baseElevationFeet, elevationFeet, allowed, expectedDistance] of [[0, 40, true, 30], [0, 41, false, 31], [50, 15, true, 30], [50, 14, false, 31]] as const) {
        const raisedMap: BattleMap = { ...map,
          tokens: [heroToken, { ...enemyToken, elevationFeet }],
          dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({ ...area,
            vertical: { mode: 'volume', baseElevationFeet, heightFeet: 10 } })),
        }
        const result = prepareDnd5ePluginFeatureAction({ action: requested, map: raisedMap, characters: [hero, enemy], initiativeOrder })
        expect(result.ok, JSON.stringify({ elevationFeet, result })).toBe(allowed)
        if (result.ok) expect(result.prepared.distanceFeet).toBe(expectedDistance)
        else expect(result.reason).toBe('target-out-of-range')
      }
      const empty = prepareDnd5ePluginFeatureAction({ action: requested, map: { ...map,
        dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({ ...area, cells: [] })),
      }, characters: [hero, enemy], initiativeOrder })
      expect(empty.ok).toBe(false)

      // A stale persisted area must not authorize controls after expiry, even
      // if map cleanup has not run yet. World time takes precedence over rounds.
      for (const [worldMinute, round, permanent, allowed] of [
        [59, 99, false, true], [60, 1, false, false],
        [61, 1, false, false], [61, 99, true, true],
        [undefined, 11, false, false], [undefined, 10, false, true],
      ] as const) {
        const expires = prepareDnd5ePluginFeatureAction({
          action: { ...requested, round }, worldMinute,
          map: { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({
            ...area, expiresAtWorldMinute: 60, permanent: permanent || undefined,
          })) }, characters: [hero, enemy], initiativeOrder,
        })
        expect(expires.ok, JSON.stringify({worldMinute,round,permanent,expires})).toBe(allowed)
      }

      const consumedMap = {
        ...map,
        dnd5ePluginAreas: map.dnd5ePluginAreas?.map((area) => ({
          ...area,
          grantedActivityUseReceipts: ['vine-control'],
        })),
      }
      expect(prepareDnd5ePluginFeatureAction({
        action: requested,
        map: consumedMap,
        characters: [hero, enemy],
        initiativeOrder,
        turnEconomy: {
          turnKey: 'combat-1:1:hero-token:normal',
          attacksUsed: 0,
          action: { current: 1, max: 1 }, bonusAction: { current: 0, max: 1 },
          reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
        },
      })).toEqual({ ok: false, reason: 'bonus-action-unavailable' })
    } finally {
      dispose()
    }
  })

  it.each(['legacy', 'materials'] as const)('replays a Worker condition with Host-provided airborne fall dice (%s)', async boundaryMode => {
    const pluginId = 'com.example.worker-airborne'
    const featureId = `${pluginId}:drop-flyer`
    const manifest = {
      id: pluginId, name: 'Worker airborne', version: '1.0.0', apiVersion: 2 as const,
      rulesetId: 'dnd5e-2014-srd-5.1' as const, publisher: 'Tests', license: 'CC0-1.0',
    }
    const feature = {
      id: 'drop-flyer', name: 'Drop Flyer', summary: 'Drop Flyer',
      description: 'Drops a non-hover flyer.', automation: 'full' as const,
      action: {
        id: 'drop-flyer', label: 'Drop Flyer', economy: 'action' as const,
        targeting: {
          kind: 'single-creature' as const,
          relation: 'enemy' as const,
          rangeFeet: 120,
        },
      },
    }
    let workerResolveCount = 0
    const session: Dnd5ePluginSandboxSession = {
      manifest,
      features: [feature],
      feats: [],
      actions: [{ id: 'drop-flyer' }],
      races: [],
      backgrounds: [],
      abilityGenerationMethods: [],
      spells: [],
      items: [],
      monsters: [],
      resources: [],
      subclasses: [],
      migrations: [],
      async resolve() {
        workerResolveCount += 1
        return {
          ok: true,
          operations: [{
            kind: 'apply-standard-condition',
            targetId: 'enemy-token',
            condition: 'prone',
            duration: { expiresAt: 'target-turn-end', remainingRounds: 1 },
          }],
        }
      },
      async migrateState(fromVersion, state) {
        return { state, fromVersion, toVersion: fromVersion }
      },
      terminate() {},
    }
    const dispose = registerDnd5eRulesPlugin(activateDnd5ePluginSandbox(session))
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const { applyDnd5eInventoryMutation } = await import('./items')
      const { createDnd5eDamageReactionMaterialLedger } = await import('./damageReactionMaterialLedger')
      const { dnd5eSpellMaterialConsumptionPlan } = await import('./spellMaterials')
      const enemy = applyDnd5eInventoryMutation([character('enemy', { dnd5eMovementSpeeds: { fly: 60 } })], { type: 'grant', characterId: 'enemy', templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 1 }).characters[0]
      const originalEnemy = structuredClone(enemy)
      const ledger = createDnd5eDamageReactionMaterialLedger({ 'enemy-token': enemy })
      const materialPlan = dnd5eSpellMaterialConsumptionPlan(enemy, { label: 'Powder', options: [{ label: 'Powder', components: [{ tag: 'gold-dust', label: 'Powder', quantity: 1, consumed: true }] }] })!
      ledger.settle('synthetic-boundary', 'enemy-token', materialPlan)
      const materialChanges = ledger.finish()
      const heroToken = token('hero-token', hero.id, 25)
      const enemyToken = {
        ...token('enemy-token', enemy.id, 125, 'enemy'),
        elevationFeet: 30,
      }
      const map: BattleMap = {
        id: 'map-1', name: 'Worker airborne map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [heroToken, enemyToken],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: heroToken.id, label: hero.name, emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: enemyToken.id, label: enemy.name, emoji: 'E', color: '#f00', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: enemyToken.id },
        map,
        characters: [hero, enemy],
        initiativeOrder,
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return

      let boundaryCalls=0
      const resolveDamageBoundary: NonNullable<Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]['resolveDamageBoundary']> = async (state,resolve) => {
        boundaryCalls++
        expect(workerResolveCount).toBe(1)
        await Promise.resolve()
        return resolve(state)
      }
      const boundaries = boundaryMode === 'legacy' ? { resolveDamageBoundary } : {
        resolveMaterialDamageBoundary: async <Result,>(state: Parameters<typeof resolveDamageBoundary>[0], resolve: (state: Parameters<typeof resolveDamageBoundary>[0]) => Result, succeeded: (result: Result) => boolean) => {
          const result = await resolveDamageBoundary(state, resolve)
          expect(typeof succeeded(result)).toBe('boolean')
          return { result, materialChanges }
        },
      }
      const preview = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        ...boundaries,
      })
      expect(preview.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
      expect(preview.application).toBeUndefined()
      expect(preview.airborneFalls).toEqual([{
        combatantId: enemyToken.id,
        fromElevationFeet: 30,
        groundElevationFeet: 0,
        fallDistanceFeet: 30,
        fallingDamageDice: 3,
      }])

      const settled = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        ...boundaries,
        airborneFallDamageRollsByCombatantId: { [enemyToken.id]: [2, 3, 4] },
      })
      expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
      expect(settled.airborneFalls).toBeUndefined()
      expect(settled.application?.characters.find((candidate) => candidate.id === enemy.id)).toMatchObject({
        currentHp: 11,
        conditions: expect.arrayContaining(['prone']),
      })
      expect(settled.application?.map.tokens.find((candidate) => candidate.id === enemyToken.id)).toMatchObject({
        elevationFeet: 0,
      })
      expect(workerResolveCount).toBe(1)
      expect(boundaryCalls).toBe(2)
      expect(enemy).toEqual(originalEnemy)
      const inventory = settled.application!.characters.find(candidate => candidate.id === enemy.id)!.dnd5eInventory!
      expect(inventory.entries.some(entry => entry.instanceId === materialPlan.allocations[0].instanceId)).toBe(boundaryMode === 'legacy')
      if (boundaryMode === 'materials') expect(settled.application!.characterPatches?.enemy.dnd5eInventory).toEqual(inventory)
    } finally {
      dispose()
    }
  })

  it('creates a declared summon, joins initiative, and starts concentration', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.summon', name: 'Summon', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'call-wolf', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'call-wolf', name: '召狼', summary: '召唤一只狼。', description: '测试召唤。', automation: 'full',
          action: {
            id: 'call-wolf', label: '召狼', economy: 'action',
            targeting: {
              kind: 'area', relation: 'any', maximumTargets: 1,
              template: { shape: 'circle', origin: 'point', radiusFeet: 0, placeRangeFeet: 30 },
            },
            summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10, concentration: true },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Summon map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [token('hero-token', hero.id, 25), token('enemy-token', enemy.id, 425, 'enemy')],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: 'E', color: '#f00', roll: 5 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: undefined, targetCell: { col: 2, row: 0 } },
        map, characters: [hero, enemy], initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        summonInitiativeD20: 12,
      })
      expect(resolved.result.ok ? 'ok' : resolved.result.reason).toBe('ok')
      expect(resolved.application?.map.tokens).toHaveLength(3)
      expect(resolved.application?.map.tokens[2]).toMatchObject({
        id: 'plugin-summon:plugin-action-1', poolId: 'srd-5.1:wolf',
        dnd5eSummon: { side: 'player', concentrationId: 'plugin-summon:plugin-action-1' },
      })
      expect(resolved.summonedInitiativeEntries).toEqual([
        expect.objectContaining({
          tokenId: 'plugin-summon:plugin-action-1',
          roll: 14,
          initiativeCalculation: { rolls: [12], d20: 12, modifier: 2, mode: 'normal' },
        }),
      ])
      expect(resolved.application?.characters[0]).toMatchObject({
        concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'plugin-summon:plugin-action-1' },
      })
    } finally {
      dispose()
    }
  })

  it('rebuilds area targets and creates a concentration-bound persistent map entity', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.area', name: 'Area', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'ward', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'ward', name: '守护区域', summary: '测试范围。', description: '测试范围。', automation: 'full',
          action: {
            id: 'ward', label: '放置', economy: 'action',
            targeting: {
              kind: 'area', relation: 'ally', maximumTargets: 4,
              template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 30 },
            },
            persistentArea: {
              label: '守护区域', color: '#22c55e', durationRounds: 3, concentration: true,
              vertical: { mode: 'volume', heightFeet: 20 },
              visual: { preset: 'toxic-cloud', intensity: 'strong' },
              triggers: [{ id: 'hold', label: 'Synthetic restraint', timing: 'on-enter',
                condition: { condition: 'restrained', duration: { expiresAt: 'target-turn-end-save',
                  saveAbility: 'dex', saveDc: 'source-save-dc' },
                  escapeCheck: { ability: 'str', dc: 'source-save-dc', economy: 'action' } } }],
            },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ally = character('ally')
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Area map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('ally-token', ally.id, 125),
          token('enemy-token', enemy.id, 125, 'enemy'),
        ],
      }
      const geometry = createEmptyMapGeometry(map.id, 1)
      geometry.obstacles.push({
        id: 'raised-anchor', kind: 'obstacle', label: 'Raised anchor',
        points: [{ x: 200, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 50 }, { x: 200, y: 50 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
        baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 35, createdAt: 1,
      })
      setMapGeometryRuntime([geometry])
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 15 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: '●', color: '#fff', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: {
          ...action(featureId),
          targetTokenId: undefined,
          targetTokenIds: ['enemy-token'],
          targetCell: { col: 4, row: 0 },
          targetElevationFeet: 30,
        },
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens).toEqual([])
      expect(prepared.prepared.headlessAction.targetId).toBeUndefined()
      expect(prepared.prepared.headlessAction.targetIds).toEqual([])
      expect(prepared.prepared.headlessAction.targetCell).toEqual({ col: 4, row: 0 })
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.application?.map.dnd5ePluginAreas).toEqual([
        expect.objectContaining({
          id: 'plugin-area:plugin-action-1', label: '守护区域', color: '#22c55e',
          cells: expect.arrayContaining([{ col: 4, row: 0 }]),
          concentrationId: 'plugin-area:plugin-action-1', expiresAfterRound: 3,
          vertical: { mode: 'volume', baseElevationFeet: 30, heightFeet: 20 },
          visual: { preset: 'toxic-cloud', intensity: 'strong' },
          triggers: [expect.objectContaining({ condition: expect.objectContaining({
            duration: expect.objectContaining({ saveDc: 10 }), escapeCheck: expect.objectContaining({ dc: 10 }),
          }) })],
        }),
      ])
      expect(resolved.application?.characters.find((entry) => entry.id === hero.id)).toMatchObject({
        concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'plugin-area:plugin-action-1' },
      })
    } finally {
      setMapGeometryRuntime([])
      dispose()
    }
  })

  it('rebuilds plugin area targets against the selected Z-axis volume', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.airburst', name: 'Airburst', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'airburst', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'airburst', name: 'Airburst', summary: 'Airburst', description: 'Airburst', automation: 'full',
          action: {
            id: 'airburst', label: 'Airburst', economy: 'action',
            targeting: {
              kind: 'area', relation: 'enemy', maximumTargets: 8,
              template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 60 },
            },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ground = character('ground')
      const airborne = character('airborne')
      const groundToken = token('ground-token', ground.id, 125, 'enemy')
      const airborneToken = {
        ...token('airborne-token', airborne.id, 125, 'enemy'),
        elevationFeet: 40,
      }
      const map: BattleMap = {
        id: 'map-1', name: 'Airburst map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [token('hero-token', hero.id, 25), groundToken, airborneToken],
      }
      const initiativeOrder: InitiativeEntry[] = map.tokens.map((entry, index) => ({
        slotId: `${entry.id}:normal`, tokenId: entry.id, label: entry.label,
        emoji: entry.emoji ?? '', color: entry.color ?? '', roll: 20 - index,
      }))
      const baseAction = {
        ...action(featureId),
        targetTokenId: undefined,
        targetCell: { col: 2, row: 0 },
      }

      const groundCast = prepareDnd5ePluginFeatureAction({
        action: baseAction,
        map,
        characters: [hero, ground, airborne],
        initiativeOrder,
      })
      expect(groundCast).toMatchObject({
        ok: true,
        prepared: { targetTokens: [{ id: groundToken.id }] },
      })

      const airCast = prepareDnd5ePluginFeatureAction({
        action: { ...baseAction, targetElevationFeet: 40 },
        map,
        characters: [hero, ground, airborne],
        initiativeOrder,
      })
      expect(airCast).toMatchObject({
        ok: true,
        prepared: {
          areaTargetElevationFeet: 40,
          targetTokens: [{ id: airborneToken.id }],
        },
      })
    } finally {
      dispose()
    }
  })

  it('validates character ownership, spends the action, and applies Headless state', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.vertical-slice',
        name: 'Vertical Slice',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({
          id: 'guardian-spark',
          resolve({ target, grantTemporaryHitPoints, succeed, fail }) {
            if (!target) return fail('invalid-target')
            grantTemporaryHitPoints(target.id, 3)
            return succeed()
          },
        })
        featureId = api.registerFeature({
          id: 'guardian-spark',
          name: '守护火花',
          summary: '纵向切片测试特性。',
          description: '以一个动作令30尺内友方获得3点临时生命值。',
          minimumLevel: 1,
          automation: 'full',
          action: {
            id: 'guardian-spark',
            label: '使用守护火花',
            economy: 'action',
            targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, includeSelf: true },
          },
        })
      },
    }, { integrity: 'sha256-YWJjZA==' })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ally = character('ally')
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Plugin map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        feetPerCell: 5,
        showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('ally-token', ally.id, 75),
          token('enemy-token', enemy.id, 225, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 15 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: '●', color: '#fff', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: [{
          id: 'com.example.vertical-slice',
          version: '1.0.0',
          integrity: 'sha256-YWJjZA==',
        }],
        turnEconomy: {
          turnKey: 'combat-1:1:hero-token',
          attacksUsed: 0,
          action: { current: 1, max: 1 },
          bonusAction: { current: 1, max: 1 },
          reaction: { current: 1, max: 1 },
          movement: { current: 30, max: 30 },
        },
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return

      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.result.events).toContainEqual({
        type: 'turn-resource-spent',
        actorId: 'hero-token',
        resource: 'action',
      })
      expect(resolved.application?.characters.find((item) => item.id === ally.id)?.tempHp).toBe(3)

      expect(prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: [],
      })).toEqual({ ok: false, reason: 'plugin-not-enabled-for-room' })
      expect(prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: null,
      })).toEqual({ ok: false, reason: 'room-rules-unavailable' })
    } finally {
      dispose()
    }
  })

  it('lets the Host replace an untrusted player payload before Headless resolution', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.authoritative-payload',
        name: 'Authoritative Payload',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({
          id: 'trusted-action',
          resolve({ action, succeed, fail }) {
            const payload = action.payload
            return payload && typeof payload === 'object' && !Array.isArray(payload) &&
              payload.source === 'host'
              ? succeed()
              : fail('invalid-plugin-action')
          },
        })
        featureId = api.registerFeature({
          id: 'trusted-action',
          name: '可信动作',
          summary: '测试 Host 载荷覆盖。',
          description: '测试 Host 载荷覆盖。',
          automation: 'full',
          action: {
            id: 'trusted-action',
            label: '使用',
            economy: 'none',
            targeting: { kind: 'self' },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Payload map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        feetPerCell: 5,
        showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('enemy-token', enemy.id, 225, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: 'E', color: '#f00', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: {
          ...action(featureId),
          targetTokenId: 'hero-token',
          dnd5ePluginAction: { featureId, payload: { source: 'player' } },
        },
        map,
        characters: [hero, enemy],
        initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      const rejected = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
      })
      expect(rejected.result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
      const accepted = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        authoritativePayload: { source: 'host' },
      })
      expect(accepted.result.ok).toBe(true)
    } finally {
      dispose()
    }
  })

  it('executes a workshop multi-target save as independent Host rolls', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.workshop-multi-save',
        name: 'Workshop multi save',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction(dnd5eHeadlessActionFromDeclarativeDraft({
          id: 'thunder-burst',
          label: 'Thunder Burst',
          savingThrow: { ability: 'con', dc: 'source-save-dc', onSuccess: 'half' },
          effects: [
            { kind: 'damage', dice: { count: 2, sides: 6 }, damageType: 'thunder' },
            {
              kind: 'condition',
              condition: 'prone',
              duration: { expiresAt: 'target-turn-end', remainingRounds: 1 },
            },
          ],
        }))
        featureId = api.registerFeature({
          id: 'thunder-burst',
          name: 'Thunder Burst',
          summary: 'Each selected target makes its own save.',
          description: 'Workshop vertical-slice fixture.',
          automation: 'full',
          action: {
            id: 'thunder-burst',
            label: 'Use Thunder Burst',
            economy: 'action',
            targeting: {
              kind: 'multiple-creatures',
              relation: 'enemy',
              rangeFeet: 30,
              maximumTargets: 3,
            },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId], saveDC: 14 })
      const savedEnemy = character('saved-enemy')
      const failedEnemy = character('failed-enemy')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Workshop multi-save map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        feetPerCell: 5,
        showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('saved-token', savedEnemy.id, 125, 'enemy'),
          token('failed-token', failedEnemy.id, 175, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = map.tokens.map((entry, index) => ({
        slotId: `${entry.id}:normal`,
        tokenId: entry.id,
        label: entry.label,
        emoji: entry.emoji ?? '',
        color: entry.color ?? '',
        roll: 20 - index,
      }))
      const prepared = prepareDnd5ePluginFeatureAction({
        action: {
          ...action(featureId),
          targetTokenId: undefined,
          targetTokenIds: ['saved-token', 'failed-token'],
        },
        map,
        characters: [hero, savedEnemy, failedEnemy],
        initiativeOrder,
      })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([
        'saved-token',
        'failed-token',
      ])

      const resolved = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        rolls: {
          'effect-0': { values: [6, 4], modifier: 0, total: 10 },
          'target-save-d20:saved-token': { values: [20], modifier: 0, total: 20 },
          'target-save-d20:failed-token': { values: [2], modifier: 0, total: 2 },
        },
      })
      expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
      expect(resolved.application?.characters.find((entry) => entry.id === savedEnemy.id)).toMatchObject({
        currentHp: 15,
        conditions: [],
      })
      expect(resolved.application?.characters.find((entry) => entry.id === failedEnemy.id)).toMatchObject({
        currentHp: 10,
        conditions: expect.arrayContaining(['prone']),
      })
    } finally {
      dispose()
    }
  })

  it('rejects a registered feature that the actor did not select', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.ownership',
        name: 'Ownership',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'self', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'self',
          name: '未选择特性',
          summary: '测试。',
          description: '测试角色所有权。',
          automation: 'full',
          action: { id: 'self', label: '使用', economy: 'none', targeting: { kind: 'self' } },
        })
      },
    })
    try {
      const hero = character('hero')
      const ally = character('ally')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Plugin map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [token('hero-token', hero.id, 25), token('ally-token', ally.id, 75)],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 10 },
      ]
      expect(prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: 'hero-token' },
        map,
        characters: [hero, ally],
        initiativeOrder,
      })).toEqual({ ok: false, reason: 'feature-not-selected' })
    } finally {
      dispose()
    }
  })
})

describe('插件事务提交重基线', () => {
  it('preserves the explicit rest receipt through rebasing and the character commit adapter', async () => {
    const { applyDnd5eCombatResultApplication, mergeDnd5eCombatCharacterResult } = await import('../../pages/maps/commitDnd5eCombatResult')
    const hero = character('hero')
    hero.dnd5eRestActivityWindow = {schemaVersion:1,characterId:hero.id,event:'long-rest-complete',eventId:'rest:long-rest-complete:480',completedWorldMinute:480,receipts:{}}
    const window = {...hero.dnd5eRestActivityWindow,receipts:{'["test.rest","bless"]':'used' as const}}
    const baseMap = {id:'map-1',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token('hero-token',hero.id,25)]} as BattleMap
    const patch = {dnd5eRestActivityWindow:window,currentHp:7}
    const result = rebaseDnd5ePluginFeatureApplication({baseMap,baseCharacters:[hero],latestMap:baseMap,latestCharacters:[hero],application:{
      map:baseMap,characters:[{...hero,...patch}],changedCharacterIds:[hero.id],changedTokenIds:[],characterPatches:{[hero.id]:patch},
    }})
    expect(result.ok).toBe(true)
    if(!result.ok)throw Error('rebase failed')
    let committed=hero
    applyDnd5eCombatResultApplication({application:result.application,mapId:baseMap.id,applicationMode:'map',applyMap:()=>{},applyToken:()=>{},
      applyCharacter:(_id,resolved,delta)=>{committed=mergeDnd5eCombatCharacterResult(hero,resolved,delta)},
    })
    expect(committed.currentHp).toBe(7)
    expect(committed.dnd5eRestActivityWindow?.receipts).toEqual(window.receipts)
    expect(hero.dnd5eRestActivityWindow.receipts).toEqual({})
  })
  it('保留等待期间发生在无关 Token 上的移动与 HP 更新', () => {
    const hero = character('hero')
    const enemy = character('enemy')
    const heroToken = token('hero-token', hero.id, 25)
    const enemyToken = { ...token('enemy-token', enemy.id, 125, 'enemy'), hp: 10, maxHp: 10 }
    const baseMap = {
      id: 'map-1', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [heroToken, enemyToken],
    } as BattleMap
    const result = rebaseDnd5ePluginFeatureApplication({
      baseMap,
      baseCharacters: [hero, enemy],
      application: {
        map: { ...baseMap, tokens: [{ ...heroToken, hp: 8 }, enemyToken] },
        characters: [hero, enemy],
        changedTokenIds: ['hero-token'],
        changedCharacterIds: [],
      },
      latestMap: {
        ...baseMap,
        tokens: [heroToken, { ...enemyToken, x: 225, hp: 4 }],
      },
      latestCharacters: [hero, enemy],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.application.map.tokens.find((candidate) => candidate.id === 'hero-token')?.hp).toBe(8)
    expect(result.application.map.tokens.find((candidate) => candidate.id === 'enemy-token')).toMatchObject({
      x: 225,
      hp: 4,
    })
  })

  it('同一实体被并发修改或召唤 ID 已存在时 fail closed', () => {
    const hero = character('hero')
    const heroToken = token('hero-token', hero.id, 25)
    const summon = { ...token('summon-token', '', 75, 'npc'), characterId: undefined }
    const baseMap = {
      id: 'map-1', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [heroToken],
    } as BattleMap
    const application = {
      map: { ...baseMap, tokens: [{ ...heroToken, hp: 8 }, summon] },
      characters: [hero],
      changedTokenIds: ['hero-token', 'summon-token'],
      changedCharacterIds: [],
    }
    expect(rebaseDnd5ePluginFeatureApplication({
      baseMap,
      baseCharacters: [hero],
      application,
      latestMap: { ...baseMap, tokens: [{ ...heroToken, x: 75 }] },
      latestCharacters: [hero],
    })).toEqual({ ok: false, reason: 'plugin-commit-conflict' })
    expect(rebaseDnd5ePluginFeatureApplication({
      baseMap,
      baseCharacters: [hero],
      application,
      latestMap: { ...baseMap, tokens: [heroToken, summon] },
      latestCharacters: [hero],
    })).toEqual({ ok: false, reason: 'plugin-commit-conflict' })
  })
})

it('preserves granted rectangular Activity dimensions and validates anchor rays before spending resources', async () => {
  const { registerDnd5eActivityPackage, getRegisteredDnd5eActivity } = await import('./activities/dnd5eActivityRegistry')
  const { compileDnd5eActivityHeadlessAction } = await import('./activities/dnd5eActivityHeadlessCompiler')
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const pluginId = 'local.granted-rect', activityId = 'make-wall', featureId = pluginId + ':effect-control.' + activityId
  const registration = registerDnd5eActivityPackage({ packageId: pluginId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: activityId, name: 'Make wall', activation: { kind: 'action', cost: 1 },
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'rect', placeRangeFeet: 90, lengthFeet: 30, widthFeet: 10, heightFeet: 5, maximumTargets: 8, requiresLineOfSight: true },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'wall', kind: 'create-persistent-area', label: 'Wall', durationRounds: 10, concentration: false }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }] })
  const disposePlugin = registerDnd5eRulesPlugin({
    manifest: { id: pluginId, name: 'Grant', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
    setup(api) { api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(getRegisteredDnd5eActivity(pluginId, activityId)!)) },
  })
  try {
    const effect = createDnd5eMechanicalEffect({ id: 'grant', definitionId: 'grant', label: 'Grant', kind: 'buff', source: { kind: 'spell', pluginId }, targetId: 'hero-token', duration: { type: 'permanent' }, grantedActivities: [activityId] })
    const hero = character('hero', { dnd5eCombatState: { activeEffects: [effect] } })
    const caster = token('hero-token', hero.id, 25)
    const map: BattleMap = { id: 'map-1', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, { ...token('inside', '', 175, 'enemy'), characterId: undefined, elevationFeet: 12, hp: 20, maxHp: 20 }, { ...token('above', '', 175, 'enemy'), characterId: undefined, elevationFeet: 30, hp: 20, maxHp: 20 }] }
    const request = { ...action(featureId), targetTokenId: undefined, targetCell: { col: 3, row: 0 }, targetElevationFeet: 10, dnd5ePluginAction: { featureId, payload: { activeEffectId: effect.id } } }
    const initiativeOrder = map.tokens.map((t, i) => ({ tokenId: t.id, label: '', emoji: '', color: '', roll: 20-i }))
    const prepare = () => prepareDnd5ePluginFeatureAction({ action: request, map, characters: [hero], initiativeOrder })
    setMapGeometryRuntime([])
    const prepared = prepare(); expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (prepared.ok) {
      expect(prepared.prepared.targetTokens.map(t => t.id)).toEqual(['inside'])
      expect(prepared.prepared.headlessAction.activityAreaPlacement).toMatchObject({ lengthFeet: 30, widthFeet: 10, heightFeet: 5, elevationFeet: 10 })
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    }
    const before = JSON.stringify({ hero, map, request })
    for (const blocksVision of [true, false]) {
      const geometry = createEmptyMapGeometry(map.id, 1)
      geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 100, y: 0 }, { x: 100, y: 500 }], blocksVision, blocksMovement: false, blocksLineOfEffect: !blocksVision, baseHeightFeet: 0, heightFeet: 100, createdAt: 1 })
      setMapGeometryRuntime([geometry])
      expect(prepare()).toEqual({ ok: false, reason: 'invalid-target' })
    }
    expect(JSON.stringify({ hero, map, request })).toBe(before)
    setMapGeometryRuntime([])
    const original = getRegisteredDnd5eActivity(pluginId, activityId)!
    if (original.target.kind !== 'area') throw Error('fixture')
    registration.dispose()
    const grounded = registerDnd5eActivityPackage({ packageId: pluginId, packageVersion: '1.0.0', activities: [{
      ...original, target: { ...original.target, placementSurface: 'ground' },
    }] })
    try {
      expect(prepare()).toEqual({ ok: false, reason: 'invalid-target' })
      request.targetElevationFeet = 0
      expect(prepare().ok).toBe(true)
    } finally { grounded.dispose() }
  } finally { setMapGeometryRuntime([]); disposePlugin(); registration.dispose() }
})


it('checks the live turn for granted own-turn controls before opening the player action', async () => {
 const {registerDnd5eActivityPackage,getRegisteredDnd5eActivity}=await import('./activities/dnd5eActivityRegistry')
 const {compileDnd5eActivityHeadlessAction}=await import('./activities/dnd5eActivityHeadlessCompiler')
 const {automationCapabilityFromLegacyStatus}=await import('../../domain/automation/automationCapability')
 const pluginId='test.granted-turn',activityId='enhance',featureId=`${pluginId}:effect-control.${activityId}`
 const registration=registerDnd5eActivityPackage({packageId:pluginId,packageVersion:'1.0.0',activities:[{
  schemaVersion:1,id:activityId,name:'Enhance',activation:{kind:'free'},target:{kind:'self'},
  requirements:[{kind:'turn-owner',owner:'actor'}],automation:automationCapabilityFromLegacyStatus('full'),
  outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}],
 }]})
 const dispose=registerDnd5eRulesPlugin({manifest:{id:pluginId,name:'Turn grant',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},
  setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(getRegisteredDnd5eActivity(pluginId,activityId)!))}})
 try{
  const effect=createDnd5eMechanicalEffect({id:'grant',definitionId:'grant',label:'Grant',source:{kind:'spell',pluginId,actorId:'hero-token'},targetId:'hero-token',grantedActivities:[activityId]})
  const hero=character('hero',{dnd5eCombatState:{activeEffects:[effect]}})
  const map:BattleMap={id:'map-1',name:'Turn',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[token('hero-token','hero',25),{...token('other','',75,'enemy'),characterId:undefined,hp:20,maxHp:20}]}
  const initiativeOrder=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:t.emoji,color:t.color,roll:20-i}))
  const request={...action(featureId),targetTokenId:'hero-token',dnd5ePluginAction:{featureId,payload:{activeEffectId:effect.id,currentTurnActorId:'hero-token'}}}
  const prepare=(initiativeIndex:number,combatId:string|undefined)=>prepareDnd5ePluginFeatureAction({map,characters:[hero],initiativeOrder,action:{...request,initiativeIndex,combatId}})
  const ready=prepare(0,'combat-1');expect(ready.ok,JSON.stringify(ready)).toBe(true)
  if(!ready.ok)throw Error('own turn rejected')
  const resolved=await resolvePreparedDnd5ePluginFeatureAction({prepared:ready.prepared})
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.state.combatants['hero-token'].temporaryHp).toBe(3)
  expect(prepare(1,'combat-1')).toEqual({ok:false,reason:'feature-unavailable'})
  expect(prepare(0,undefined)).toEqual({ok:false,reason:'feature-unavailable'})
  expect(hero.tempHp).toBe(0)
 }finally{dispose();registration.dispose()}
})

it.each(['registered', 'archive', 'archive-inferred', 'archive-local'] as const)('registers a timed crafting feature and settles real prepared requests with a persisted ritual: %s', async mode => {
  const { registerDnd5eActivityPackage } = await import('./activities/dnd5eActivityRegistry')
  const { compileDnd5eActivityHeadlessAction, dnd5eActivityHeadlessCompatibility } = await import('./activities/dnd5eActivityHeadlessCompiler')
  const { dnd5ePluginFeatureActionFromActivityV1 } = await import('./activities/dnd5eActivityFeatureActionAdapter')
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { normalizeCharacter } = await import('../../store/characters')
  const { applyDnd5eInventoryMutation, normalizeDnd5eInventory } = await import('./items')
  const pluginId = 'test.crafting-route', featureId = `${pluginId}:craft`
  const activity: import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'craft', name: 'Craft', activation: { kind: 'hour', value: 1 }, target: { kind: 'self' },
    legacySource: { kind: 'feature', id: 'craft' }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'resource', resourceId: 'dnd5e-channel-divinity', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    outcomes: [{ id: 'craft', when: { kind: 'always' }, operations: [{ id: 'craft', kind: 'exchange-inventory-items', target: 'actor',
      templateId: mode === 'archive-local' ? 'product' : `${pluginId}:product`, quantity: { kind: 'constant', value: 1 }, sceneRangeFeet: 5,
      policy: { inputTags: ['test:metal'], outputTags: ['test:metal'], maximumValueCp: 10000, maximumInclusive: false, requiresOriginal: false } }] }],
  }
  expect(dnd5eActivityHeadlessCompatibility(activity)).toEqual({ supported: true, reasons: [] })
  const { dnd5eActivityAutomationAnalysisV1 } = await import('./plugins/pluginMechanicsRegistry')
  expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
  expect(dnd5eActivityAutomationAnalysisV1({ ...activity, activation: { kind: 'action' } }).capability.level).not.toBe('full')
  expect(dnd5eActivityHeadlessCompatibility({ ...activity, activation: { kind: 'action' } }).supported).toBe(false)
  expect(dnd5ePluginFeatureActionFromActivityV1(activity)?.economy).toBe('none')
  const registration = mode === 'registered' ? registerDnd5eActivityPackage({ packageId: pluginId, packageVersion: '1.0.0', activities: [activity] }) : undefined
  let plugin: Parameters<typeof registerDnd5eRulesPlugin>[0] = { manifest: { id: pluginId, name: 'Craft', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerItem({ id: 'product', name: 'Metal product', description: 'Synthetic', rulesText: 'Synthetic', category: 'adventuring-gear', icon: 'generic', stackable: true,
        spellcastingMaterial: { tags: ['test:metal'], unitValueGp: 5 } })
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: 'craft', name: 'Craft', description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } }
  if (mode !== 'registered') {
    const { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
    const { exportDnd5eStarMod, readDnd5eStarMod } = await import('./starModAdapter')
    const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
      manifest: { ...plugin.manifest, distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [], definitions: [
        { schemaVersion: 1, namespace: pluginId, version: '1.0.0', kind: 'feature', id: 'craft', name: 'Craft',
          automation: automationCapabilityFromLegacyStatus('full'), activities: [activity],
          payload: { id: 'craft', name: 'Craft', description: 'Synthetic', summary: 'Synthetic', automation: 'full',
            ...(mode === 'archive' ? { action: dnd5ePluginFeatureActionFromActivityV1(activity) } : {}) } },
        { schemaVersion: 1, namespace: pluginId, version: '1.0.0', kind: 'item', id: 'product', name: 'Metal product',
          automation: automationCapabilityFromLegacyStatus('full'),
          payload: { id: 'product', name: 'Metal product', description: 'Synthetic', rulesText: 'Synthetic', category: 'adventuring-gear', icon: 'generic', stackable: true,
            spellcastingMaterial: { tags: ['test:metal'], unitValueGp: 5 } } },
      ] }))!
    expect(bundle).toBeDefined()
    const original = structuredClone(bundle)
    const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    expect(bundle).toEqual(original)
    expect(decoded.bundle.definitions.find(definition => definition.kind === 'feature')?.activities).toEqual([activity])
    plugin = dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle)
  }
  const dispose = registerDnd5eRulesPlugin(plugin)
  try {
    let hero = normalizeCharacter(character('hero', { dnd5ePluginFeatureIds: [featureId], equipment: {},
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } }, dnd5eInventory: { schemaVersion: 3, entries: [] } }))
    hero = applyDnd5eInventoryMutation([hero], { type: 'adjust-currency', characterId: 'hero', currency: 'gp', delta: 5 }).characters[0]
    const map: BattleMap = { id: 'map-1', name: 'Craft', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      feetPerCell: 5, showGrid: true, tokens: [token('hero-token', 'hero', 25)] }
    const selection = { expectedInventoryRevision: normalizeDnd5eInventory(hero).revision, inputs: [], coins: [{ currency: 'gp', amount: 5 }] }
    const prepare = (owner: Character, decision: string, selected: typeof selection, ritualId?: string) => prepareDnd5ePluginFeatureAction({
      map, characters: [owner], initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }],
      action: { ...action(featureId), id: `craft-${decision}`, combatId: undefined, targetTokenId: 'hero-token',
        dnd5ePluginAction: { featureId, payload: JSON.parse(JSON.stringify({ inventoryExchangeRitual: { decision, selection: selected, ...(ritualId ? { ritualId } : {}) } })) } },
    })
    const begin = prepare(hero, 'begin', selection)
    expect(begin.ok, JSON.stringify(begin)).toBe(true)
    if (!begin.ok) throw Error(begin.reason)
    const { resolveDnd5eHeadlessAction } = await import('./headlessCombatEngine')
    const direct = resolveDnd5eHeadlessAction(begin.prepared.state, begin.prepared.headlessAction)
    expect(direct.ok).toBe(false)
    expect(begin.prepared.state.combatants['hero-token'].classResources['dnd5e-channel-divinity'].current).toBe(1)
    const started = await resolvePreparedDnd5ePluginFeatureAction({ prepared: begin.prepared,
      inventoryExchangeAuthority: { worldMinute: 100, combatRevision: 0, combatActive: false } })
    expect(started.result.ok, JSON.stringify(started.result)).toBe(true)
    const pending = normalizeCharacter(JSON.parse(JSON.stringify(started.application!.characters[0])))
    expect(pending.classResources?.['dnd5e-channel-divinity'].current).toBe(1)
    expect(pending.dnd5eInventory?.currency?.gp).toBe(5)
    const record = pending.dnd5eInventory!.pendingExchangeRitual!
    const complete = prepare(pending, 'complete', { ...selection, expectedInventoryRevision: record.inventoryRevision,
      targetCell: { col: 1, row: 0 } } as typeof selection, record.commandId)
    expect(complete.ok, JSON.stringify(complete)).toBe(true)
    if (!complete.ok) throw Error(complete.reason)
    const finished = await resolvePreparedDnd5ePluginFeatureAction({ prepared: complete.prepared,
      inventoryExchangeAuthority: { worldMinute: 160, combatRevision: 1, combatActive: false } })
    expect(finished.result.ok, JSON.stringify(finished.result)).toBe(true)
    expect(finished.application?.characters[0].classResources?.['dnd5e-channel-divinity'].current).toBe(0)
    expect(finished.application?.characters[0].dnd5eInventory?.currency?.gp).toBe(0)
    expect(finished.application?.map.tokens).toHaveLength(2)
  } finally { dispose(); registration?.dispose() }
})

it.each([1, 2])('randomizes an enemy-targeted imported feature with %s selected recipients', async count => {
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
  const automation = automationCapabilityFromLegacyStatus('full'), namespace = 'test.random-feature', featureId = `${namespace}:pulse`
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Random feature', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'pulse', name: 'Pulse', automation,
      payload: { id: 'pulse', name: 'Pulse', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'action' }, automation,
        legacySource: { kind: 'feature', id: 'pulse' }, target: { kind: 'creature', relation: 'enemy', count, rangeFeet: 30 },
        consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
        outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: 3 }, damageType: 'force' }] }],
      }] }],
  }))!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
  try {
    const effect = createDnd5eMechanicalEffect({ id: 'random', definitionId: 'test:random', label: 'Random', source: { kind: 'spell' },
      targetId: 'hero-token', modifiers: { randomVisibleCreatureTargets: true, perceiveVisibleCreaturesAsHostile: true } })
    const hero = character('hero', { dnd5ePluginFeatureIds: [featureId], dnd5eCombatState: { activeEffects: [effect] } })
    const ally = character('ally'), enemy = character('enemy'), other = character('other'), hidden = character('hidden'), far = character('far')
    hidden.dnd5eCombatState = { activeEffects: [createDnd5eConditionEffect({ id: 'invisible', targetId: 'hidden-token', condition: 'invisible', source: { kind: 'dm' } })] }
    const map: BattleMap = { id: 'map-1', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      feetPerCell: 5, showGrid: true, tokens: [token('hero-token', 'hero', 25), token('ally-token', 'ally', 75),
        token('enemy-token', 'enemy', 125, 'enemy'), token('other-token', 'other', 175, 'enemy'),
        token('hidden-token', 'hidden', 225), token('far-token', 'far', 825)] }
    const request = { ...action(featureId), targetTokenId: 'enemy-token', targetTokenIds: count === 1 ? ['enemy-token'] : ['enemy-token', 'other-token'] }
    const input = { action: request, map, characters: [hero, ally, enemy, other, hidden, far],
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }] }
    const pools: string[][] = []
    const ready = prepareDnd5eRandomTargetFeatureAction({ ...input, chooseRandomTarget: (occurrence, candidates) => {
      pools.push([...candidates].sort()); return occurrence === 0 ? 'ally-token' : 'enemy-token'
    } })
    expect(ready.ok, JSON.stringify({ ready, pools })).toBe(true)
    if (!ready.ok) throw Error(ready.reason)
    expect(pools[0]).toEqual(['ally-token', 'enemy-token', 'other-token'])
    if (count === 2) expect(pools[1]).toEqual(['enemy-token', 'other-token'])
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.result.state.combatants['ally-token'].currentHp).toBe(17)
    if (count === 2) expect(resolved.result.state.combatants['enemy-token'].currentHp).toBe(17)
    expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.initiativeOrder).toEqual(['hero-token'])
    expect(ally.currentHp).toBe(20)
    expect(map.tokens[1].type).toBe('player')
    effect.suspendedBy = ['antimagic-test']
    let choices = 0
    const ordinary = prepareDnd5eRandomTargetFeatureAction({ ...input, chooseRandomTarget: () => { choices++; return 'ally-token' } })
    expect(ordinary.ok, JSON.stringify(ordinary)).toBe(true)
    expect(choices).toBe(0)
    if (ordinary.ok) expect(ordinary.prepared.targetToken.id).toBe('enemy-token')
  } finally { dispose() }
})

it('filters random feature candidates by minimum range and separation before choosing', async () => {
  const count = 2
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
  const automation = automationCapabilityFromLegacyStatus('full'), namespace = 'test.random-feature', featureId = `${namespace}:pulse`
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Random feature', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'pulse', name: 'Pulse', automation,
      payload: { id: 'pulse', name: 'Pulse', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'action' }, automation,
        legacySource: { kind: 'feature', id: 'pulse' }, target: { kind: 'creature', relation: 'enemy', count, rangeFeet: 30, minimumRangeFeet: 10, maximumTargetSeparationFeet: 5 },
        consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
        outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: 3 }, damageType: 'force' }] }],
      }] }],
  }))!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
  try {
    const effect = createDnd5eMechanicalEffect({ id: 'random', definitionId: 'test:random', label: 'Random', source: { kind: 'spell' },
      targetId: 'hero-token', modifiers: { randomVisibleCreatureTargets: true, perceiveVisibleCreaturesAsHostile: true } })
    const hero = character('hero', { dnd5ePluginFeatureIds: [featureId], dnd5eCombatState: { activeEffects: [effect] } })
    const ally = character('ally'), enemy = character('enemy'), other = character('other'), hidden = character('hidden'), far = character('far')
    hidden.dnd5eCombatState = { activeEffects: [createDnd5eConditionEffect({ id: 'invisible', targetId: 'hidden-token', condition: 'invisible', source: { kind: 'dm' } })] }
    const map: BattleMap = { id: 'map-1', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      feetPerCell: 5, showGrid: true, tokens: [token('hero-token', 'hero', 25), token('ally-token', 'ally', 75),
        token('enemy-token', 'enemy', 125, 'enemy'), token('other-token', 'other', 175, 'enemy'),
        token('hidden-token', 'hidden', 225), token('far-token', 'far', 275)] }
    const request = { ...action(featureId), targetTokenId: 'enemy-token', targetTokenIds: ['enemy-token', 'other-token'] }
    const input = { action: request, map, characters: [hero, ally, enemy, other, hidden, far],
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }] }
    const pools: string[][] = []
    const ready = prepareDnd5eRandomTargetFeatureAction({ ...input, chooseRandomTarget: (occurrence, candidates) => {
      pools.push([...candidates].sort()); return occurrence === 0 ? 'enemy-token' : 'other-token'
    } })
    expect(ready.ok, JSON.stringify({ ready, pools })).toBe(true)
    if (!ready.ok) throw Error(ready.reason)
    expect(pools[0]).toEqual(['enemy-token', 'far-token', 'other-token'])
    expect(pools[1]).toEqual(['other-token'])
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.result.state.combatants['ally-token']).toBeUndefined()
    expect(resolved.result.state.combatants['other-token'].currentHp).toBe(17)
    if (count === 2) expect(resolved.result.state.combatants['enemy-token'].currentHp).toBe(17)
    expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.initiativeOrder).toEqual(['hero-token'])
    expect(ally.currentHp).toBe(20)
    expect(map.tokens[1].type).toBe('player')
    effect.suspendedBy = ['antimagic-test']
    let choices = 0
    const ordinary = prepareDnd5eRandomTargetFeatureAction({ ...input, chooseRandomTarget: () => { choices++; return 'ally-token' } })
    expect(ordinary.ok, JSON.stringify(ordinary)).toBe(true)
    expect(choices).toBe(0)
    if (ordinary.ok) expect(ordinary.prepared.targetToken.id).toBe('enemy-token')
  } finally { dispose() }
})

it('measures random feature candidates from the authoritative bound item holder', async () => {
  const count = 2
  const { automationCapabilityFromLegacyStatus } = await import('../../domain/automation/automationCapability')
  const { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } = await import('./unifiedContent')
  const automation = automationCapabilityFromLegacyStatus('full'), namespace = 'test.random-feature', featureId = `${namespace}:pulse`
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Random feature', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'pulse', name: 'Pulse', automation,
      payload: { id: 'pulse', name: 'Pulse', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'action' }, automation,
        legacySource: { kind: 'feature', id: 'pulse' }, target: { kind: 'creature', relation: 'enemy', count, rangeFeet: 30, minimumRangeFeet: 5, maximumTargetSeparationFeet: 5, effectOrigin: {effectId: 'weapon-light', rangeFeet: 10} },
        consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
        outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: 3 }, damageType: 'force' }] }],
      }] }],
  }))!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
  try {
    const effect = createDnd5eMechanicalEffect({ id: 'random', definitionId: 'test:random', label: 'Random', source: { kind: 'spell' },
      targetId: 'hero-token', modifiers: { randomVisibleCreatureTargets: true, perceiveVisibleCreaturesAsHostile: true } })
    const hero = character('hero', { dnd5ePluginFeatureIds: [featureId], dnd5eCombatState: { activeEffects: [effect] } })
    const ally = character('ally'), enemy = character('enemy'), other = character('other'), hidden = character('hidden'), far = character('far')
    ally.dnd5eCombatState = {activeEffects:[createDnd5eMechanicalEffect({definitionId:'weapon-light',label:'Light',targetId:'ally-token',source:{kind:'spell',actorId:'hero-token'},duration:{type:'permanent'},modifiers:{weaponEnchantment:{weaponId:'sword',inventoryInstanceId:'bound-sword',attackAndDamageBonus:0}}})]}
    hidden.dnd5eCombatState = { activeEffects: [createDnd5eConditionEffect({ id: 'invisible', targetId: 'hidden-token', condition: 'invisible', source: { kind: 'dm' } })] }
    const map: BattleMap = { id: 'map-1', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      feetPerCell: 5, showGrid: true, tokens: [token('hero-token', 'hero', 25), token('ally-token', 'ally', 825),
        token('enemy-token', 'enemy', 875, 'enemy'), token('other-token', 'other', 925, 'enemy'),
        token('hidden-token', 'hidden', 225), token('far-token', 'far', 275)] }
    const request = { ...action(featureId), targetTokenId: 'enemy-token', targetTokenIds: ['enemy-token', 'other-token'] }
    const input = { action: request, map, characters: [hero, ally, enemy, other, hidden, far],
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }] }
    const pools: string[][] = []
    const ready = prepareDnd5eRandomTargetFeatureAction({ ...input, chooseRandomTarget: (occurrence, candidates) => {
      pools.push([...candidates].sort()); return occurrence === 0 ? 'enemy-token' : 'other-token'
    } })
    expect(ready.ok, JSON.stringify({ ready, pools })).toBe(true)
    if (!ready.ok) throw Error(ready.reason)
    expect(pools[0]).toEqual(['enemy-token', 'other-token'])
    expect(pools[1]).toEqual(['other-token'])
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.result.state.combatants['ally-token'].currentHp).toBe(20)
    expect(resolved.result.state.combatants['other-token'].currentHp).toBe(17)
    if (count === 2) expect(resolved.result.state.combatants['enemy-token'].currentHp).toBe(17)
    expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.initiativeOrder).toEqual(['hero-token'])
    expect(ally.currentHp).toBe(20)
    expect(map.tokens[1].type).toBe('player')
    effect.suspendedBy = ['antimagic-test']
    let choices = 0
    const ordinary = prepareDnd5eRandomTargetFeatureAction({ ...input, chooseRandomTarget: () => { choices++; return 'ally-token' } })
    expect(ordinary.ok, JSON.stringify(ordinary)).toBe(true)
    expect(choices).toBe(0)
    if (ordinary.ok) expect(ordinary.prepared.targetToken.id).toBe('enemy-token')
  } finally { dispose() }
})

it('commits explicit summon removal with its dropped item while preserving unrelated concurrent changes', async () => {
  const {applyDnd5eCombatResultApplication}=await import('../../pages/maps/commitDnd5eCombatResult')
  const old={...token('old-summon','',75,'npc'),characterId:undefined}
  const unrelated=token('other','',125,'npc')
  const drop={...token('carried:stone','',75,'npc'),type:'obstacle' as const,characterId:undefined}
  const baseMap={id:'map-removal',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[old,unrelated]} as BattleMap
  const application={map:{...baseMap,tokens:[unrelated,drop]},characters:[],changedTokenIds:[old.id,drop.id],changedCharacterIds:[]}
  const latestMap={...baseMap,tokens:[old,{...unrelated,x:225}]}
  const input={baseMap,baseCharacters:[],application,latestMap,latestCharacters:[],removedTokenIds:[old.id]}
  const before=JSON.stringify(input)
  const result=rebaseDnd5ePluginFeatureApplication(input)
  expect(result.ok).toBe(true)
  if(!result.ok)throw Error('explicit removal rejected')
  let committed:BattleMap|undefined
  applyDnd5eCombatResultApplication({application:result.application,mapId:baseMap.id,applicationMode:'map',applyMap:(_id,map)=>{committed=map},applyToken:()=>{},applyCharacter:()=>{}})
  expect(committed!.tokens.map(item=>item.id).sort()).toEqual([drop.id,unrelated.id].sort())
  expect(committed!.tokens.find(item=>item.id===unrelated.id)?.x).toBe(225)
  expect(JSON.stringify(input)).toBe(before)
  for(const invalid of [
    {...input,removedTokenIds:undefined},
    {...input,removedTokenIds:['missing']},
    {...input,latestMap:{...latestMap,tokens:[{...old,x:175},unrelated]}},
    {...input,latestMap:{...latestMap,tokens:[unrelated]}},
    {...input,latestMap:{...latestMap,tokens:[old,unrelated,drop]}},
    {...input,application:{...application,map:baseMap}},
  ])expect(rebaseDnd5ePluginFeatureApplication(invalid)).toEqual({ok:false,reason:'plugin-commit-conflict'})
})

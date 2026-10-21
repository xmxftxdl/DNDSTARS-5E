import { describe, expect, it } from 'vitest'
import checkBoonExample from '../../../examples/community-sdk/check-boon.json'
import type { AutomationCapability } from '../../domain/automation/automationCapability'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { listRegisteredContentDefinitionPackages } from '../../domain/content/contentDefinitionRegistry'
import { listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import {
  dnd5ePluginFeatureDefinition,
  dnd5ePluginFeatDefinition,
  dnd5ePluginHeadlessActionDefinition,
  dnd5ePluginSpellDefinition,
  registerDnd5eRulesPlugin,
  registeredDnd5ePluginBackgrounds,
} from './pluginApi'
import {
  DND5E_UNIFIED_CONTENT_FORMAT,
  DND5E_UNIFIED_CONTENT_KINDS,
  dnd5eRulesPluginFromUnifiedContentBundleV1,
  encodeDnd5eUnifiedContentBundleV1,
  parseDnd5eUnifiedContentBundleV1,
  validateDnd5eUnifiedContentBundleV1,
  type Dnd5eUnifiedContentBundleV1,
} from './unifiedContent'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eFeatureActivityControls } from './activities/dnd5eFeatureActivityControls'

const FULL_AUTOMATION: AutomationCapability = {
  schemaVersion: 1,
  level: 'full',
  supportedPhases: [
    'eligibility', 'cost', 'targeting', 'attack-roll', 'saving-throw', 'damage', 'healing',
    'effects', 'duration', 'interrupt', 'persistence',
  ],
  manualPhases: [],
  limitations: [],
}

export function unifiedBackgroundBundle(): Dnd5eUnifiedContentBundleV1 {
  return {
    format: DND5E_UNIFIED_CONTENT_FORMAT,
    schemaVersion: 1,
    manifest: {
      id: 'local.test-rules',
      name: '测试规则',
      version: '1.0.0',
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Local DM',
      license: '自定义内容',
      pluginKind: 'content-package',
      distributionPolicy: 'local-only',
      contentCategory: 'mixed',
    },
    assets: [],
    definitions: [{
      schemaVersion: 1,
      id: 'field-medic',
      namespace: 'local.test-rules',
      version: '1.0.0',
      kind: 'background',
      name: '战地医师',
      description: '本地测试背景。',
      payload: {
        id: 'field-medic',
        name: '战地医师',
        description: '本地测试背景。',
        skillProficiencies: ['medicine', 'insight'],
      },
      automation: FULL_AUTOMATION,
    }],
  }
}

it.each(['missing', 'ambiguous', 'triggered', 'manual', 'assisted', 'grant-required'] as const)(
  'does not infer a feature button from %s Activities', mode => {
    const base = unifiedBackgroundBundle()
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'action' }, target: { kind: 'self' },
      legacySource: { kind: 'feature', id: 'pulse' },
      ...(mode === 'grant-required' ? { requiresEffectGrant: true as const } : {}),
      automation: mode === 'assisted' ? automationCapabilityFromLegacyStatus('partial') : FULL_AUTOMATION,
      ...(mode === 'triggered' ? { invocation: { kind: 'triggered' as const, event: 'turn-start' as const, confirmation: 'automatic' as const } } : {}),
      outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [
        { id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } },
      ] }],
    }
    const bundle: Dnd5eUnifiedContentBundleV1 = { ...base, definitions: [{
      schemaVersion: 1, id: 'pulse', namespace: base.manifest.id, version: base.manifest.version,
      kind: 'feature', name: 'Pulse', automation: FULL_AUTOMATION,
      payload: { id: 'pulse', name: 'Pulse', summary: 'Synthetic', description: 'Synthetic', automation: mode === 'manual' ? 'manual' : 'full' },
      activities: mode === 'missing' ? [] : mode === 'ambiguous' ? [activity, { ...activity, id: 'other' }] : [activity],
    }] }
    // A full declaration with no executable content may be rejected at import.
    if (mode === 'missing') {
      expect(validateDnd5eUnifiedContentBundleV1(bundle).length).toBeGreaterThan(0)
      return
    }
    const before = structuredClone(bundle)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
    try {
      expect(dnd5ePluginFeatureDefinition(`${base.manifest.id}:pulse`)?.action).toBeUndefined()
      expect(bundle).toEqual(before)
    } finally { dispose() }
  })

describe('D&D 5E unified content contract', () => {
  it.each(['feature', 'feat'] as const)('exports every owned %s recipe without authorizing foreign or triggered controls', async kind => {
    const { normalizeCharacter } = await import('../../store/characters')
    const { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } = await import('./pluginFeatureAction')
    const { dnd5eSpellAuthorityResolutionContext } = await import('../../pages/maps/spellSettlementCoordinator')
    const base = unifiedBackgroundBundle()
    const activities: Dnd5eActivityDefinitionV1[] = ['first', 'second', 'listener'].map((id, index) => ({
      schemaVersion: 1, id, name: id, activation: { kind: 'free' }, target: { kind: 'self' },
      legacySource: { kind, id: 'gift' }, automation: FULL_AUTOMATION,
      ...(id === 'listener' ? { invocation: { kind: 'triggered' as const, event: 'attack-resolved' as const, confirmation: 'actor-choice' as const } } : {}),
      outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: index + 1 } }] }],
    }))
    const bundle: Dnd5eUnifiedContentBundleV1 = { ...base, definitions: ['gift', 'foreign'].map(id => ({
      schemaVersion: 1, id, namespace: base.manifest.id, version: '1.0.0', kind, name: id, automation: FULL_AUTOMATION,
      payload: { id, name: id, summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: id === 'gift' ? activities : [{ ...activities[0], id: 'foreign', legacySource: { kind, id } }],
    })) }
    const imported = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(imported.bundle))
    try {
      const ownerId = `${base.manifest.id}:gift`
      const featureId = kind === 'feat' ? dnd5ePluginFeatDefinition(ownerId)!.featureId : ownerId
      const feature = dnd5ePluginFeatureDefinition(featureId)!
      expect(feature.action).toBeUndefined()
      expect(dnd5eFeatureActivityControls(feature).map(control => control.activity.id)).toEqual(['first', 'second'])
      const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '战士', level: 1, currentHp: 5, maxHp: 20,
        ...(kind === 'feat' ? { dnd5eFeatIds: [ownerId] } : { dnd5ePluginFeatureIds: [ownerId] }) })
      const map: import('../../store/maps').BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
        gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [{ id: 'hero-token', characterId: hero.id, label: hero.name, x: 25, y: 25, type: 'player', size: 1, color: '#fff', emoji: '' }] }
      const authority = dnd5eSpellAuthorityResolutionContext({ combatActive: false, map, actorTokenId: 'hero-token', initiativeOrder: [] })
      const prepare = (selectedActivityId: string, owner = hero) => prepareDnd5ePluginFeatureAction({ map, characters: [owner], initiativeOrder: authority.initiativeOrder,
        action: { id: 'recipe', mapId: map.id, sourceMode: 'player', status: 'pending', type: 'dnd5e-plugin-action',
          actorTokenId: 'hero-token', characterId: hero.id, targetTokenId: 'hero-token', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
          dnd5ePluginAction: { featureId, payload: { selectedActivityId } } } })
      for (const id of ['foreign', 'listener', 'missing']) expect(prepare(id).ok).toBe(false)
      expect(prepare('second', { ...hero, dnd5eFeatIds: [], dnd5ePluginFeatureIds: [] }).ok).toBe(false)
      for (const [id, hp] of [['first', 6], ['second', 7]] as const) {
        const prepared = prepare(id)
        expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
        if (!prepared.ok) throw Error('recipe preparation failed')
        const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
        expect(resolved.result.ok).toBe(true)
        expect(resolved.application?.characters.find(character => character.id === hero.id)?.currentHp).toBe(hp)
      }
    } finally { dispose() }
  })

  it.each(['short-rest-started', 'long-rest-started', 'short-rest-complete', 'long-rest-complete'] as const)(
    'retains the %s player control after archive export and import', async event => {
      const base = unifiedBackgroundBundle()
      const activity: Dnd5eActivityDefinitionV1 = {
        schemaVersion: 1, id: 'camp', name: 'Camp', activation: { kind: 'free' },
        target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'camp' },
        invocation: { kind: 'triggered', event, confirmation: 'actor-choice', retention: 'single-event' },
        automation: FULL_AUTOMATION,
        outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
          { id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } },
        ] }],
      }
      const bundle: Dnd5eUnifiedContentBundleV1 = { ...base, definitions: [{
        schemaVersion: 1, id: 'camp', namespace: base.manifest.id, version: base.manifest.version,
        kind: 'feature', name: 'Camp', automation: FULL_AUTOMATION,
        payload: { id: 'camp', name: 'Camp', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
        activities: [activity],
      }] }
      const imported = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
      const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(imported.bundle))
      try {
        const feature = dnd5ePluginFeatureDefinition(`${base.manifest.id}:camp`)!
        // It must stay a rest choice, never become an unrestricted active button.
        expect(feature.action).toBeUndefined()
        expect(dnd5ePluginHeadlessActionDefinition(base.manifest.id, activity.id)).toBeDefined()
        expect(dnd5eFeatureActivityControls(feature).map(control => control.activity.invocation)).toEqual([activity.invocation])
      } finally { dispose() }
      expect(dnd5ePluginHeadlessActionDefinition(base.manifest.id, activity.id)).toBeUndefined()
    })

  it.each(['effect', 'area', 'bond'] as const)('selects the original spell cast and installs its %s controls after archive import', async kind => {
    const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify(checkBoonExample))!
    const spell = bundle.definitions.find(entry => entry.kind === 'spell')!
    const cast = spell.activities![0]
    const follow: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'follow', name: 'Synthetic follow-up',
      automation: FULL_AUTOMATION, activation: { kind: 'bonus-action' }, target: { kind: 'self' },
      legacySource: { kind: 'spell', id: spell.id }, requiresEffectGrant: true,
      outcomes: [{ id: 'finish', when: { kind: 'always' }, operations: [{ id: 'finish', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 1 } }] }] }
    if (kind === 'effect') {
      cast.effects = [...cast.effects ?? [], { schemaVersion: 1, id: 'controller', name: 'Controller',
        duration: { kind: 'permanent' }, stacking: 'replace', grants: ['follow'] }]
      cast.outcomes[0].operations = [...cast.outcomes[0].operations, { id: 'controller', kind: 'apply-effect', target: 'actor', effectId: 'controller' }]
    } else if (kind === 'area') {
      cast.target = { kind: 'area', relation: 'any', shape: 'sphere', origin: 'point', radiusFeet: 5, placeRangeFeet: 30 }
      cast.outcomes = [{ id: 'area', when: { kind: 'always' }, operations: [{ id: 'area', kind: 'create-persistent-area',
        label: 'Synthetic', durationRounds: 10, concentration: false, grantedActivities: [{ activityId: 'follow' }] }] }]
      delete follow.requiresEffectGrant
    } else {
      cast.target = { kind: 'self' }
      cast.outcomes = [{ id: 'summon', when: { kind: 'always' }, operations: [{ id: 'summon', kind: 'summon',
        monsterId: 'srd-5.1:dire-wolf', count: { kind: 'constant', value: 1 }, timing: 'immediate', concentration: false,
        persistent: true, side: 'ally', bondKey: 'synthetic', bondActivityIds: ['follow'], bondDismissActivityId: 'dismiss' }] }]
    }
    spell.activities = [cast, follow, ...(kind === 'bond' ? [{ ...structuredClone(follow), id: 'dismiss' }] : [])]
    const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      expect(dnd5ePluginSpellDefinition('community.check-boon:check-boon')?.automation).toMatchObject({ mode: 'headless-action', actionId: cast.id })
      for (const id of kind === 'bond' ? ['follow', 'dismiss'] : ['follow']) {
        expect(dnd5ePluginHeadlessActionDefinition(bundle.manifest.id, id)).toBeDefined()
        expect(dnd5ePluginFeatureDefinition(`${bundle.manifest.id}:${kind === 'area' ? 'area' : 'effect'}-control.${id}`)?.action?.id).toBe(id)
      }
    } finally { dispose() }
    expect(dnd5ePluginHeadlessActionDefinition(bundle.manifest.id, 'follow')).toBeUndefined()
  })
  it.each([0, 2])('does not guess a spell entry point when %s cast Activities exist', (count) => {
    const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify(checkBoonExample))!
    const spell = bundle.definitions.find((entry) => entry.kind === 'spell')!
    const activity = spell.activities![0]
    spell.activities = Array.from({length:count},(_,index)=>({...structuredClone(activity),id:`cast-${index}`}))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
    try {
      expect(dnd5ePluginSpellDefinition('community.check-boon:check-boon')?.automation.mode).toBe('reference-only')
    } finally {dispose()}
    expect(dnd5ePluginSpellDefinition('community.check-boon:check-boon')).toBeUndefined()
  })
  it('exposes every supported authoring kind through one public catalog', () => {
    expect(DND5E_UNIFIED_CONTENT_KINDS).toEqual([
      'condition', 'spell', 'feature', 'feat', 'class', 'subclass', 'race', 'background', 'item', 'monster',
      'monster-action', 'ability-generation',
    ])
  })

  it('parses one common envelope for an authorable content type', () => {
    const source = encodeDnd5eUnifiedContentBundleV1(unifiedBackgroundBundle())
    const parsed = parseDnd5eUnifiedContentBundleV1(source)
    expect(parsed?.definitions[0]).toMatchObject({
      kind: 'background',
      id: 'field-medic',
      namespace: 'local.test-rules',
    })
    expect(validateDnd5eUnifiedContentBundleV1(parsed)).toEqual([])
  })

  it('rejects unknown envelope fields and mismatched payload identity', () => {
    const bundle = unifiedBackgroundBundle()
    const invalid = {
      ...bundle,
      definitions: [{
        ...bundle.definitions[0],
        unexpectedExecutableHook: 'onHit',
        payload: { ...bundle.definitions[0].payload, id: 'other-id' },
      }],
    }
    const errors = validateDnd5eUnifiedContentBundleV1(invalid)
    expect(errors).toContain('definitions[0] contains unknown field: unexpectedExecutableHook')
    expect(errors).toContain('definitions[0].payload.id must match definition.id')
  })

  it('rejects executable callbacks even when called before JSON serialization', () => {
    const bundle = unifiedBackgroundBundle()
    const invalid = {
      ...bundle,
      definitions: [{
        ...bundle.definitions[0],
        payload: { ...bundle.definitions[0].payload, run: () => 'mutate combat' },
      }],
    }
    expect(validateDnd5eUnifiedContentBundleV1(invalid)).toContain(
      'Unified content bundle.definitions[0].payload.run must contain pure JSON data only',
    )
  })

  it('validates embedded Activity recipes instead of trusting declared Headless status', () => {
    const bundle = unifiedBackgroundBundle()
    const invalid = {
      ...bundle,
      definitions: [{
        ...bundle.definitions[0],
        activities: [{
          schemaVersion: 1,
          id: 'bad-activity',
          name: '',
          activation: { kind: 'action' },
          target: { kind: 'self' },
          outcomes: [],
          automation: FULL_AUTOMATION,
        }],
      }],
    }
    const errors = validateDnd5eUnifiedContentBundleV1(invalid)
    expect(errors.some((error) => error.includes('activity.name is invalid'))).toBe(true)
    expect(errors.some((error) => error.includes('activity.outcomes is empty'))).toBe(true)
  })

  it('adapts the unified package to current catalogs and disposes it atomically', () => {
    const dispose = registerDnd5eRulesPlugin(
      dnd5eRulesPluginFromUnifiedContentBundleV1(unifiedBackgroundBundle()),
    )
    try {
      expect(registeredDnd5ePluginBackgrounds()).toContainEqual(expect.objectContaining({
        id: 'local.test-rules:field-medic',
        name: '战地医师',
      }))
      expect(listRegisteredContentDefinitionPackages()).toContainEqual(expect.objectContaining({
        packageId: 'local.test-rules',
        definitions: [expect.objectContaining({ kind: 'background', id: 'field-medic' })],
      }))
      expect(listRegisteredDnd5eActivityPackages()).toContainEqual(expect.objectContaining({
        packageId: 'local.test-rules',
        activities: [],
      }))
    } finally {
      dispose()
    }
    expect(listRegisteredContentDefinitionPackages()).toEqual([])
    expect(listRegisteredDnd5eActivityPackages()).toEqual([])
  })

  it('accepts an effects-only feature and derives its runtime capability from the unified Effect', () => {
    const base = unifiedBackgroundBundle()
    const bundle: Dnd5eUnifiedContentBundleV1 = {
      ...base,
      definitions: [{
        schemaVersion: 1,
        id: 'always-ready',
        namespace: base.manifest.id,
        version: base.manifest.version,
        kind: 'feature',
        name: 'Always Ready',
        payload: {
          id: 'always-ready',
          name: 'Always Ready',
          summary: 'Synthetic permanent feature.',
          description: 'Synthetic permanent feature.',
          automation: 'full',
        },
        effects: [{
          schemaVersion: 1,
          id: 'always-ready.effect',
          name: 'Always Ready',
          duration: { kind: 'permanent' },
          modifiers: [{
            kind: 'character-capability',
            capability: 'cannotBeSurprisedWhileConscious',
            value: true,
          }],
          stacking: 'unique-by-source',
        }],
        automation: FULL_AUTOMATION,
      }],
    }
    expect(validateDnd5eUnifiedContentBundleV1(bundle)).toEqual([])
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
    try {
      expect(dnd5ePluginFeatureDefinition('local.test-rules:always-ready')).toMatchObject({
        automation: 'full',
        staticModifiers: { cannotBeSurprisedWhileConscious: true },
      })
    } finally {
      dispose()
    }
  })
})

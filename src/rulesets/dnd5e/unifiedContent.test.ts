import { describe, expect, it } from 'vitest'
import type { AutomationCapability } from '../../domain/automation/automationCapability'
import { listRegisteredContentDefinitionPackages } from '../../domain/content/contentDefinitionRegistry'
import { listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { registerDnd5eRulesPlugin, registeredDnd5ePluginBackgrounds } from './pluginApi'
import {
  DND5E_UNIFIED_CONTENT_FORMAT,
  DND5E_UNIFIED_CONTENT_KINDS,
  dnd5eRulesPluginFromUnifiedContentBundleV1,
  encodeDnd5eUnifiedContentBundleV1,
  parseDnd5eUnifiedContentBundleV1,
  validateDnd5eUnifiedContentBundleV1,
  type Dnd5eUnifiedContentBundleV1,
} from './unifiedContent'

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

describe('D&D 5E unified content contract', () => {
  it('exposes every supported authoring kind through one public catalog', () => {
    expect(DND5E_UNIFIED_CONTENT_KINDS).toEqual([
      'spell', 'feature', 'feat', 'class', 'subclass', 'race', 'background', 'item', 'monster',
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
})

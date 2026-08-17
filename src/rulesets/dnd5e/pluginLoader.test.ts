import { describe, expect, it } from 'vitest'
import {
  DND5E_DECLARATIVE_PACKAGE_FORMAT,
  DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION,
  type Dnd5eDeclarativeRulesPackageV1,
} from './declarativeSubclassAbility'
import { DND5E_CONTENT_PACKAGE_FORMAT } from './contentPackageV2'
import { normalizeDnd5eDeclarativePackageAtLoadBoundary } from './pluginLoader'

describe('D&D 5e plugin loading boundary', () => {
  it('converts Declarative V1 content into the V2-to-Unified adapter path before activation', () => {
    const declaration: Dnd5eDeclarativeRulesPackageV1 = {
      format: DND5E_DECLARATIVE_PACKAGE_FORMAT,
      schemaVersion: DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION,
      manifest: {
        id: 'com.example.legacy-boundary', name: 'Legacy boundary', version: '1.0.0',
        publisher: 'Example', license: 'CC0-1.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', pluginKind: 'content-package',
      },
      subclasses: [],
      legacy: {
        races: [], backgrounds: [], spells: [], items: [], abilityGenerationMethods: [],
        features: [{
          id: 'legacy-feature', name: 'Legacy feature', summary: 'Legacy payload.',
          description: 'Legacy payload.', automation: 'manual',
        }],
      },
    }

    const normalized = normalizeDnd5eDeclarativePackageAtLoadBoundary(declaration)

    expect(normalized.format).toBe(DND5E_CONTENT_PACKAGE_FORMAT)
    expect(normalized.content.features).toHaveLength(1)
    expect(normalized.content.features[0]?.id).toBe('legacy-feature')
  })

  it('drops catalog-only spell classes while adapting legacy room packages', () => {
    const declaration = {
      format: DND5E_DECLARATIVE_PACKAGE_FORMAT,
      schemaVersion: DND5E_DECLARATIVE_SUBCLASS_SCHEMA_VERSION,
      manifest: {
        id: 'com.example.legacy-spell-classes', name: 'Legacy spell classes', version: '1.0.0',
        publisher: 'Example', license: 'CC0-1.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', pluginKind: 'content-package',
      },
      subclasses: [],
      legacy: {
        races: [], backgrounds: [], features: [], items: [], abilityGenerationMethods: [],
        spells: [{
          id: 'legacy-spark', name: 'Legacy Spark', level: 0, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false }, classes: ['artificer', 'wizard'],
          description: 'Compatibility fixture.', automation: { mode: 'reference-only' },
        }],
      },
    } as unknown as Dnd5eDeclarativeRulesPackageV1

    const normalized = normalizeDnd5eDeclarativePackageAtLoadBoundary(declaration)

    expect(normalized.content.spells[0]?.classes).toEqual(['wizard'])
  })
})

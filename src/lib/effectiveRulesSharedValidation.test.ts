import { describe, expect, it } from 'vitest'
import { createDnd5eEffectiveRulesContextV1 } from '../rulesets/dnd5e/effectiveRulesContext'
import { validateAndMigrateSharedResource } from './sharedResourceValidation'

describe('shared combat effective rules validation', () => {
  const combat = {
    mapId: 'map-1', combatId: 'combat-1', active: true, round: 1,
    initiativeIndex: 0, initiativeOrder: [], updatedAt: 1,
  }

  it('accepts a valid pinned rules context', () => {
    expect(validateAndMigrateSharedResource('combat', {
      ...combat,
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        revision: 2,
        hash: 'sha256-test',
        requiredPlugins: [{ id: 'example.rules', version: '1.0.0', integrity: 'sha256-test' }],
      }),
    }).status).toBe('valid')
  })

  it('fails closed when a supplied rules context is damaged', () => {
    expect(validateAndMigrateSharedResource('combat', {
      ...combat,
      effectiveRules: { schemaVersion: 1, revision: -1, hash: '', requiredPlugins: 'all' },
    }).status).toBe('invalid')
  })
})

import { describe, expect, it } from 'vitest'
import { validateSharedStateShape } from '../../scripts/shared-server-core.mjs'
import { createDnd5eEffectiveRulesContextV1 } from '../rulesets/dnd5e/effectiveRulesContext'

describe('server combat rules boundary', () => {
  const combat = { mapId: 'map-1', active: true, updatedAt: 1 }

  it('accepts a complete snapshot and rejects damaged rules', () => {
    expect(validateSharedStateShape('combat', {
      ...combat,
      effectiveRules: createDnd5eEffectiveRulesContextV1({ hash: 'sha256-test' }),
    })).toEqual({ ok: true })
    expect(validateSharedStateShape('combat', {
      ...combat,
      effectiveRules: { schemaVersion: 1, revision: 0, hash: '', houseRules: {}, requiredPlugins: [] },
    })).toEqual({ ok: false, reason: 'invalid-effective-rules' })
  })
})

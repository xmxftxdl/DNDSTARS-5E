import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDnd5eEffectiveRulesContextsForTest,
  createDnd5eEffectiveRulesContextV1,
  dnd5eEffectiveRulesContextForCombat,
  restoreDnd5eEffectiveRulesContextForCombat,
} from './effectiveRulesContext'

describe('effective combat rules persistence', () => {
  beforeEach(clearDnd5eEffectiveRulesContextsForTest)

  it('restores the shared snapshot instead of adopting a later room revision', () => {
    const pinned = createDnd5eEffectiveRulesContextV1({
      revision: 3,
      hash: 'sha256-pinned',
      houseRules: { declarativeAbilityDamageMultiplier: 2 },
      requiredPlugins: [{ id: 'example.rules', version: '1.0.0', integrity: 'sha256-old' }],
    })

    expect(restoreDnd5eEffectiveRulesContextForCombat('combat-1', pinned)).toEqual(pinned)
    expect(dnd5eEffectiveRulesContextForCombat('combat-1', {
      revision: 4,
      hash: 'sha256-new',
      houseRules: { declarativeAbilityDamageMultiplier: 4 },
      requiredPlugins: [{ id: 'example.rules', version: '2.0.0', integrity: 'sha256-new' }],
    })).toMatchObject({
      revision: 3,
      hash: 'sha256-pinned',
      houseRules: { declarativeAbilityDamageMultiplier: 2 },
      requiredPlugins: [{ id: 'example.rules', version: '1.0.0', integrity: 'sha256-old' }],
    })
  })

  it('rejects a damaged shared rules snapshot', () => {
    expect(restoreDnd5eEffectiveRulesContextForCombat('combat-1', {
      schemaVersion: 1,
      revision: 1,
      hash: '',
      sourceOrder: [],
      houseRules: {},
      requiredPlugins: [{ id: '', version: '1.0.0' }],
    })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { migrateLegacyCharacterFields } from './legacyCharacterMigration'

describe('legacy character migration', () => {
  it('removes retired class, AP, and choice fields at the V24 boundary', () => {
    const migrated = migrateLegacyCharacterFields({
      actionPoints: 2,
      currentAP: 1,
      archerLv1ChoiceDone: true,
      archerLv3ChoiceDone: false,
      traitChoicesDone: { 'windrunner-lv15': true },
    })

    expect(migrated.rulesetId).toBe('dnd5e-2014-srd-5.1')
    expect(migrated).not.toHaveProperty('actionPoints')
    expect(migrated).not.toHaveProperty('currentAP')
    expect(migrated).not.toHaveProperty('traitChoicesDone')
    expect(migrated).not.toHaveProperty('archerLv1ChoiceDone')
    expect(migrated).not.toHaveProperty('archerLv3ChoiceDone')
  })
})

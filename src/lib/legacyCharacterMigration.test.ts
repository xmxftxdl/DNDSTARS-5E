import { describe, expect, it } from 'vitest'
import { migrateLegacyCharacterFields } from './legacyCharacterMigration'

describe('legacy character migration', () => {
  it('moves archer choice flags into the generic choice map and removes the old fields', () => {
    const migrated = migrateLegacyCharacterFields({
      archerLv1ChoiceDone: true,
      archerLv3ChoiceDone: false,
      traitChoicesDone: { 'windrunner-lv15': true },
    })

    expect(migrated.traitChoicesDone).toEqual({
      'archer-lv1': true,
      'windrunner-lv15': true,
    })
    expect(migrated).not.toHaveProperty('archerLv1ChoiceDone')
    expect(migrated).not.toHaveProperty('archerLv3ChoiceDone')
  })
})

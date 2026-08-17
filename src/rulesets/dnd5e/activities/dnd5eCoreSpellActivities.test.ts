import { afterEach, describe, expect, it } from 'vitest'
import {
  clearContentDefinitionRegistryForTests,
  listRegisteredContentDefinitionPackages,
} from '../../../domain/content/contentDefinitionRegistry'
import { DND5E_SRD_COMBAT_SPELLS } from '../spells'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import {
  DND5E_CORE_SPELL_PACKAGE_ID,
  dnd5eCoreSpellActivityV1,
  ensureDnd5eCoreSpellActivitiesRegisteredV1,
  getDnd5eCoreSpellRuntimeDefinitionV1,
} from './dnd5eCoreSpellActivities'

afterEach(clearContentDefinitionRegistryForTests)

describe('built-in spell Unified Activity migration', () => {
  it('projects every combat spell into a valid fully handled Activity', () => {
    expect(DND5E_SRD_COMBAT_SPELLS).toHaveLength(122)
    for (const spell of DND5E_SRD_COMBAT_SPELLS) {
      const activity = dnd5eCoreSpellActivityV1(spell)
      expect(validateDnd5eActivityDefinitionV1(activity), spell.id).toEqual([])
      expect(activity.authorityBinding).toEqual({
        kind: 'core-spell-transaction', spellId: spell.id, execution: 'headless-event-engine',
      })
      expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level, spell.id).toBe('full')
    }
  })

  it('registers all core spells through the sole Unified Content boundary', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const registered = listRegisteredContentDefinitionPackages()
      .find((entry) => entry.packageId === DND5E_CORE_SPELL_PACKAGE_ID)
    expect(registered?.definitions).toHaveLength(122)
    const fireball = getDnd5eCoreSpellRuntimeDefinitionV1('fireball')
    expect(fireball?.spell.id).toBe('fireball')
    expect(fireball?.activity.id).toBe('spell:fireball')
  })
})

import { afterEach, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import { clearContentDefinitionRegistryForTests, getRegisteredContentDefinition } from '../../domain/content/contentDefinitionRegistry'
import { DND5E_CORE_SPELL_PACKAGE_ID, ensureDnd5eCoreSpellActivitiesRegisteredV1, getDnd5eCoreSpellRuntimeDefinitionV1 } from './activities/dnd5eCoreSpellActivities'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

afterEach(clearContentDefinitionRegistryForTests)
it('verifies every SRD spell has a localized registered activity and reports actual automation boundaries', () => {
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  expect(DND5E_SRD_SPELL_CATALOG).toHaveLength(319)
  const rows = DND5E_SRD_SPELL_CATALOG.map(spell => {
    expect(spell.name, spell.id).toMatch(/[\u3400-\u9fff]/)
    const definition = getRegisteredContentDefinition(DND5E_CORE_SPELL_PACKAGE_ID, 'spell', spell.id)
    expect(definition?.activities?.length, spell.id).toBeGreaterThan(0)
    const activity = definition!.activities![0] as Dnd5eActivityDefinitionV1
    const native = activity.authorityBinding?.kind === 'core-spell-transaction'
    if (native) expect(getDnd5eCoreSpellRuntimeDefinitionV1(spell.id), spell.id).toBeDefined()
    else expect(() => compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true }), spell.id).not.toThrow()
    const analysis = dnd5eActivityAutomationAnalysisV1(activity)
    return { id: spell.id, name: spell.name, level: spell.level, executionPath: native ? 'native' : 'declarative', automation: analysis.capability.level, missingComponents: analysis.missingComponents }
  })
  if (process.env.STARS_WRITE_VERIFICATION_REPORT === '1') {
    mkdirSync('docs/verification/2026-09-09', { recursive: true })
    writeFileSync('docs/verification/2026-09-09/spell-completeness.json', JSON.stringify({ total: rows.length, rows }, null, 2))
  }
})

import { expect, it } from 'vitest'
import { dnd5eSrdAuditedSpellActivityV1, dnd5eSrdAuditedSpellDefinitionV1 } from './dnd5eSrdAuditedSpellActivities'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './dnd5eCoreSpellActivities'
import { dnd5ePluginSpellDefinition } from '../plugins/pluginContentCatalog'
import { dnd5ePluginSpellHasFullHeadlessAutomation } from '../pluginSpellTransaction'

it('keeps Suggestion saving throws and failed-save effects without a DM approval operation', () => {
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  expect(dnd5ePluginSpellHasFullHeadlessAutomation(dnd5ePluginSpellDefinition('suggestion'))).toBe(true)
  const activity = dnd5eSrdAuditedSpellActivityV1('suggestion')!
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eSrdAuditedSpellDefinitionV1('suggestion')?.tags).toContain('headless-target:full')
  expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
  expect(activity.checks).toContainEqual(expect.objectContaining({ kind: 'saving-throw', ability: 'wis' }))
  expect(activity.outcomes.flatMap(outcome => outcome.operations).some(operation => operation.kind === 'manual-adjudication')).toBe(false)
  expect(activity.outcomes).toContainEqual(expect.objectContaining({
    when: expect.objectContaining({ kind: 'check', result: 'failure' }),
    operations: expect.arrayContaining([expect.objectContaining({ kind: 'apply-effect' })]),
  }))
  expect(activity.effects).toContainEqual(expect.objectContaining({ duration: { kind: 'concentration', maximumRounds: 4800 } }))
})

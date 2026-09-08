import { describe, expect, it } from 'vitest'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './activities/dnd5eActivityExecutor'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import { dnd5eSpellUsesNarrativeResolution } from './spellNarrativeResolution'

describe('Planar Binding audited Activity', () => {
  it('spends the spell slot and ends without map targeting or DM confirmation', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('planar-binding')

    expect(activity).toBeDefined()
    expect(validateDnd5eActivityDefinitionV1(activity!)).toEqual([])
    expect(activity?.target).toEqual({ kind: 'self' })
    expect(activity?.checks).toBeUndefined()
    expect(activity?.choices).toBeUndefined()
    expect(activity?.effects).toBeUndefined()
    expect(activity?.consumption).toContainEqual(expect.objectContaining({
      kind: 'spell-slot', minimumLevel: 5, level: 'selected', amount: 1, consumeOn: 'resolve',
    }))
    const operations = activity?.outcomes.flatMap((outcome) => outcome.operations) ?? []
    expect(operations).toEqual([expect.objectContaining({
      kind: 'mechanic', target: 'actor', handlerId: 'core.resolve-only',
    })])
    expect(operations.some((operation) => operation.kind === 'manual-adjudication')).toBe(false)
    expect(dnd5eActivityAutomationAnalysisV1(activity!).capability.level).toBe('full')
    expect(dnd5eSpellUsesNarrativeResolution('planar-binding', activity)).toBe(false)

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'planar-binding-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    expect(resolveDnd5eActivity({
      activity: activity!, actor, targets: [actor], castLevel: 5, rolls: {},
    })).toMatchObject({ ok: true, proposals: [] })
  })
})

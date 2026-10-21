import { describe, expect, it } from 'vitest'
import { dnd5ePluginSpellDefinition } from '../pluginApi'
import { dnd5ePluginSpellActivity } from '../pluginSpellTransaction'
import { dnd5eActivityChoiceIsRelevantV1, dnd5eActivityLanguageChoicesV1, dnd5eActivityOutcomeAllowsChoicesV1, dnd5eActivityTargetFormOperationV1 } from './dnd5eActivityChoices'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eSummonChoiceCoverageIssues } from './dnd5eSummonChoiceCoverage'
import { getDnd5eSrdMonster } from '../monsters'
import { registerDnd5ePluginMonsterCatalogEntry, setDnd5eRoomMonsterCatalog } from '../roomMonsterCatalog'

describe('D&D 5e Activity choice UI requirements', () => {
  it.each(['frightened', 'charmed'] as const)('binds %s to a live Host creature and rejects forged, self, missing, and misconfigured sources', condition => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'selected-fear', name: 'Selected fear',
      activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1 },
      automation: automationCapabilityFromLegacyStatus('full'),
      choices: [{ id: 'fear-source', label: '恐惧对象', optionsFrom: 'combat-creatures', options: [] }],
      effects: [{ schemaVersion: 1, id: 'fear', name: 'Fear', conditions: [condition],
        duration: { kind: 'rounds', rounds: 600, expiresAt: 'target-turn-end' }, stacking: 'replace' }],
      outcomes: [{ id: 'fear', when: { kind: 'always' }, operations: [{ id: 'fear', kind: 'apply-effect',
        target: 'target', effectId: 'fear', ...(condition === 'frightened' ? { frightenedSourceChoiceId: 'fear-source' } : { charmedSourceChoiceId: 'fear-source' }) }] }],
    }
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const actor = { id: 'actor', name: 'Author', controller: 'player', level: 3, proficiencyBonus: 2,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 }, armorClass: 12,
      currentHp: 30, maxHp: 30, conditions: [] }
    const target = { ...actor, id: 'target' }, other = { ...actor, id: 'other', name: 'Other creature' }
    const input = { activity, actor, targets: [target], combatants: [actor, target, other], rolls: {} }
    const expanded = dnd5eActivityLanguageChoicesV1(activity, [], undefined, input.combatants)
    expect(expanded.choices![0].options).toContainEqual({ id: 'other', label: 'Other creature' })
    for (const id of ['actor', 'other']) expect(resolveDnd5eActivity({ ...input, choices: { 'fear-source': id } }))
      .toMatchObject({ ok: true, proposals: [expect.objectContaining({ tags: [`condition-entity:${id}`] })] })
    for (const id of ['target', 'forged', '']) expect(resolveDnd5eActivity({ ...input, choices: { 'fear-source': id } }).ok).toBe(false)
    expect(resolveDnd5eActivity({ ...input, combatants: [actor, target], choices: { 'fear-source': 'other' } }).ok).toBe(false)
    expect(resolveDnd5eActivity(input).ok).toBe(false)
    activity.choices![0].options = [{ id: 'forged', label: 'Forged' }]
    expect(resolveDnd5eActivity({ ...input, choices: { 'fear-source': 'forged' } }).ok).toBe(false)
    expect(dnd5eActivityLanguageChoicesV1(activity).choices![0].options).toEqual([])
    activity.effects![0].conditions = [condition === 'frightened' ? 'charmed' : 'frightened']
    expect(validateDnd5eActivityDefinitionV1(activity).length).toBeGreaterThan(0)
  })

  it('offers installed devils, applies authoritative overrides and drops unloaded or forged options', () => {
    const imp = getDnd5eSrdMonster('srd-5.1:imp')!
    const imported = { ...structuredClone(imp), id: 'test:imported-devil', name: 'Imported devil' }
    const dispose = registerDnd5ePluginMonsterCatalogEntry(imported)
    const activity = structuredClone(catalogueActivity)
    activity.choices = [{ id: 'creature', label: 'Devils', optionsFrom: 'installed-monsters',
      options: [{ id: 'forged:devil', label: 'Not installed' }],
      monsterFilter: { creatureTypes: ['fiend'], subtype: 'devil', maximumChallengeRating: 6 } }]
    const ids = () => dnd5eActivityLanguageChoicesV1(activity).choices![0].options.map(option => option.id)
    try {
      expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
      expect(ids()).toContain(imported.id)
      expect(ids()).toContain(imp.id)
      expect(ids()).not.toContain('forged:devil')
      expect(ids()).not.toContain('srd-5.1:quasit')
      setDnd5eRoomMonsterCatalog([{ ...imported, challenge: { ...imported.challenge, rating: '7' } }])
      expect(ids()).not.toContain(imported.id)
      setDnd5eRoomMonsterCatalog([{ ...imported, name: 'Room override' }])
      expect(ids().filter(id => id === imported.id)).toHaveLength(1)
      expect(dnd5eActivityLanguageChoicesV1(activity).choices![0].options.find(option => option.id === imported.id)?.label).toContain('Room override')
      setDnd5eRoomMonsterCatalog([])
      dispose()
      expect(ids()).not.toContain(imported.id)
      expect(ids()).toContain(imp.id)
    } finally { setDnd5eRoomMonsterCatalog([]); dispose() }
  })
  const catalogueActivity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'catalogue', name: 'Catalogue', activation: { kind: 'action' },
    target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    choices: [{ id: 'creature', label: 'Creature', optionsFrom: 'srd-monsters', options: [],
      monsterFilter: { creatureTypes: ['fiend'], subtype: 'demon', maximumChallengeRating: 1 } }],
    outcomes: [{ id: 'summon', when: { kind: 'always' }, operations: [{ id: 'summon', kind: 'summon',
      monsterId: 'srd-5.1:dretch', monsterChoiceId: 'creature', count: { kind: 'constant', value: 1 },
      timing: 'immediate', durationRounds: 10, concentration: true, side: 'ally' }] }],
  }
  it('reconstructs filtered monster options and discards injected options', () => {
    expect(validateDnd5eActivityDefinitionV1(catalogueActivity)).toEqual([])
    const forged = structuredClone(catalogueActivity)
    forged.choices![0].options = [{ id: 'srd-5.1:balor', label: 'Injected' }]
    const options = dnd5eActivityLanguageChoicesV1(forged).choices![0].options
    expect(options.map(option => option.id).sort()).toEqual(['srd-5.1:dretch', 'srd-5.1:quasit'])
    const beasts = structuredClone(catalogueActivity)
    beasts.choices![0].monsterFilter = { creatureTypes: ['beast'], maximumChallengeRating: 0.25 }
    const beastIds = dnd5eActivityLanguageChoicesV1(beasts).choices![0].options.map(option => option.id)
    expect(beastIds).toContain('srd-5.1:wolf')
    expect(beastIds).not.toContain('srd-5.1:ape')
    expect(beastIds).not.toContain('srd-5.1:dretch')
  })
  it('asks per-target forms only for the selected mode, retaining unresolved check branches', () => {
    const activity = structuredClone(catalogueActivity)
    const operation = activity.outcomes[0].operations[0]
    if (operation.kind !== 'summon') throw new Error('fixture')
    activity.outcomes = ['first', 'second'].map(mode => ({ id: mode,
      when: { kind: 'choice', choiceId: 'mode', optionId: mode }, operations: [
        { ...operation, id: mode, monsterChoiceId: undefined, corpseFormChoiceId: `${mode}-form` },
      ] }))
    expect(dnd5eActivityTargetFormOperationV1(activity, { mode: 'second' }))
      .toMatchObject({ id: 'second', corpseFormChoiceId: 'second-form' })
    expect(dnd5eActivityTargetFormOperationV1(activity, { mode: 'no-form' })).toBeUndefined()
    expect(dnd5eActivityTargetFormOperationV1(activity, undefined)).toBeUndefined()
    activity.outcomes[1].when = { kind: 'all', conditions: [
      { kind: 'choice', choiceId: 'mode', optionId: 'second' }, { kind: 'check', checkId: 'save', result: 'failure' },
    ] }
    expect(dnd5eActivityTargetFormOperationV1(activity, { mode: 'second' })).toMatchObject({ id: 'second' })
  })

  it('detects installed upcast summon candidates hidden by a static filter without inventing missing catalogue entries', () => {
    const activity = structuredClone(catalogueActivity)
    const summon = activity.outcomes[0].operations[0]
    if (summon.kind !== 'summon') throw new Error('fixture')
    activity.choices![0].monsterFilter!.maximumChallengeRating = 5
    summon.maximumChallengeRating = { kind: 'add', values: [
      { kind: 'constant', value: 5 },
      { kind: 'reference', reference: { kind: 'slot-delta', baseLevel: 4 } },
    ] }
    expect(dnd5eSummonChoiceCoverageIssues(activity, 4)).toEqual([expect.stringContaining('屏蔽 5 环')])
    activity.choices![0].monsterFilter!.maximumChallengeRating = 10
    expect(dnd5eSummonChoiceCoverageIssues(activity, 4)).toEqual([])
    delete activity.choices![0].monsterFilter!.maximumChallengeRating
    expect(dnd5eSummonChoiceCoverageIssues(activity, 4)).toEqual([])
    activity.choices![0].monsterFilter!.maximumChallengeRating = 5
    summon.maximumChallengeRating = { kind: 'constant', value: 5 }
    expect(dnd5eSummonChoiceCoverageIssues(activity, 4)).toEqual([])
    summon.maximumChallengeRating = { kind: 'reference', reference: { kind: 'actor-level' } }
    expect(dnd5eSummonChoiceCoverageIssues(activity, 4)).toEqual([])
  })
  it.each([
    { creatureTypes: [] }, { creatureTypes: ['imaginary'] }, { creatureTypes: ['beast', 'beast'] },
    { subtype: '' }, { subtype: 1 }, { maximumChallengeRating: -1 },
    { maximumChallengeRating: 31 }, { maximumChallengeRating: NaN }, { maximumChallengeRating: '1' },
  ])('rejects malformed monster filters: %j', filter => {
    const activity = structuredClone(catalogueActivity)
    activity.choices![0].monsterFilter = filter as NonNullable<typeof activity.choices>[number]['monsterFilter']
    expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('monsterFilter'))).toBe(true)
  })
  it('rejects a monster filter attached to another option source', () => {
    const activity = structuredClone(catalogueActivity)
    activity.choices![0].optionsFrom = 'actor-languages'
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.choices[0].monsterFilter is invalid')
  })
  it('only asks for a summon profile when its selected branch can run', () => {
    const activity = structuredClone(catalogueActivity)
    activity.outcomes[0].when = { kind: 'choice', choiceId: 'mode', optionId: 'summon' }
    expect(dnd5eActivityChoiceIsRelevantV1(activity, { id: 'creature' }, { mode: 'other' })).toBe(false)
    expect(dnd5eActivityChoiceIsRelevantV1(activity, { id: 'creature' }, { mode: 'summon' })).toBe(true)
  })
  it('builds a closed SRD beast selector and rejects a forged non-beast target form', () => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'beast-form', name: 'Beast form',
      activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 2 },
      automation: automationCapabilityFromLegacyStatus('full'),
      choices: [{ id: 'form', label: 'Form', optionsFrom: 'srd-beast-forms', options: [] }],
      outcomes: [{ id: 'change', when: { kind: 'always' }, operations: [{ id: 'change', kind: 'transform-creature',
        target: 'target', formChoiceId: 'form', profile: 'polymorph', durationRounds: 10, concentration: true,
        maximumChallengeRating: 'target-half-level-or-challenge-rating', hitPointMode: 'retain-with-form-temporary-hp' }] }],
    }
    const options = dnd5eActivityLanguageChoicesV1(activity).choices![0].options
    expect(options.some(option => option.id === 'srd-5.1:wolf')).toBe(true)
    expect(options.some(option => option.id === 'srd-5.1:adult-red-dragon')).toBe(false)
    expect(activity.choices![0].options).toEqual([])
    const actor = { id: 'actor', controller: 'player' as const, level: 10, proficiencyBonus: 4,
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, armorClass: 12, currentHp: 30, maxHp: 30, conditions: [] }
    const input = { activity, actor, targets: [{ ...actor, id: 'target' }], rolls: {}, choices: { form: 'srd-5.1:wolf' } }
    expect(resolveDnd5eActivity(input)).toMatchObject({ ok: true,
      proposals: [expect.objectContaining({ kind: 'transform-creature', formId: 'srd-5.1:wolf' })] })
    expect(resolveDnd5eActivity({ ...input, choices: { form: 'srd-5.1:adult-red-dragon' } }).ok).toBe(false)
    expect(resolveDnd5eActivity({ ...input, targetFormIds: { target: 'srd-5.1:adult-red-dragon' } }).ok).toBe(false)
  })
  it('does not request inventory input for the mapped Purify Food and Drink branch', () => {
    const spell = dnd5ePluginSpellDefinition('purify-food-and-drink')!
    const activity = dnd5ePluginSpellActivity(spell)!
    const mappedOutcomes = activity.outcomes.filter((outcome) =>
      dnd5eActivityOutcomeAllowsChoicesV1(outcome, { mode: 'mapped-consumables' }),
    )

    expect(mappedOutcomes.some((outcome) => outcome.operations.some((operation) =>
      operation.kind === 'purify-map-consumables'))).toBe(true)
    expect(mappedOutcomes.some((outcome) => outcome.operations.some((operation) =>
      operation.kind === 'purify-inventory-item'))).toBe(false)
  })
})

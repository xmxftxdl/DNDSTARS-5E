import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { dnd5eShareKnownLanguage } from '../sharedLanguage'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect, type Dnd5eActiveEffectModifiers } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eStandardConditionId } from '../conditions'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'conversation', name: 'Conversation', activation: { kind: 'action' },
  target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
  requirements: [{ kind: 'shared-language' }, { kind: 'can-hear-source' }],
  consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 3 } }] }],
  automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'conversation' },
}

it.each([
  { source: ['通用语'], target: [' Common '], expected: true },
  { source: ['地下通用语'], target: ['通用语'], expected: false },
  { source: ['deep speech; Elvish'], target: ['精灵语'], expected: true },
  { source: ['moon-tongue'], target: ['Moon-Tongue'], expected: true },
  { source: ['—'], target: ['—'], expected: false },
  { source: ['any one language'], target: ['Common'], expected: false },
  { source: ['all languages'], target: ['all languages'], expected: true },
  { source: ['所有语言'], target: ['Common'], expected: true },
  { source: ['all languages'], target: ['any one language'], expected: false },
  { source: ['understands Common but cannot speak'], target: ['Common'], expected: false },
  { source: [], target: ['Common'], expected: false },
])('requires concrete language overlap (%j)', ({source, target, expected}) => {
  expect(dnd5eShareKnownLanguage(source, target)).toBe(expected)
  expect(dnd5eShareKnownLanguage(undefined, target)).toBe(false)
})

function state(targetLanguages: string[], deafened = false) {
  const creature = (id: string, initiative: number, languages: string[]) => createDnd5eCombatant({
    id, name: id, controller: 'player', initiative, languages, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
  })
  const source = creature('source', 20, ['通用语']), target = creature('target', 10, targetLanguages)
  target.conditions = deafened ? ['deafened'] : []
  if (deafened) target.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'deafened', targetId: 'target', source: { kind: 'feature', actorId: 'source' } })]
  const result = startDnd5eHeadlessCombat('language', [source, target])
  result.distanceFeetByCombatantPair = { ['source\u0000target']: 5 }
  return result
}

it('validates and classifies the public shared-language condition', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
})

it('rejects missing or foreign speaking subjects', () => {
  for (const requirement of [{ kind: 'can-speak' }, { kind: 'can-speak', subject: 'listener' }]) {
    const invalid = { ...activity, requirements: [requirement] } as unknown as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(invalid)).not.toEqual([])
  }
})

const comprehension = { languageCapabilities: { understandSpoken: 'all' as const } }
const tongues = { languageCapabilities: { speechUnderstoodBy: 'any-creature-knowing-a-language' as const } }
const restriction = { understandLanguages: false as const, intelligibleCommunication: false as const }
const cases: { languages: string[]; deafened?: boolean; succeeds: boolean; comprehension?: boolean; targetModifier?: Dnd5eActiveEffectModifiers; sourceModifier?: Dnd5eActiveEffectModifiers; suspended?: boolean; sourceLanguages?: string[]; speech?: 'actor' | 'target'; speechCondition?: Dnd5eStandardConditionId; speechSilence?: boolean; sourceCreatureType?: string; targetCreatureType?: string; sourceCommunication?: string[]; targetCommunication?: string[] }[] = [
  { languages: [], comprehension: true, targetCreatureType: 'beast', sourceCommunication: ['beast'], succeeds: true },
  { languages: ['Common'], sourceLanguages: [], comprehension: true, sourceCreatureType: 'beast', targetCommunication: ['beast'], succeeds: true },
  { languages: [], comprehension: true, targetCreatureType: 'monstrosity', sourceCommunication: ['beast'], succeeds: false },
  { languages: [], comprehension: true, targetCreatureType: 'beast', succeeds: false },
  { languages: [], targetCreatureType: 'beast', sourceCommunication: ['beast'], succeeds: false },
  { languages: [], comprehension: true, targetCreatureType: 'beast', sourceCommunication: ['beast'], deafened: true, succeeds: false },
  { languages: [], comprehension: true, targetCreatureType: 'beast', sourceCommunication: ['beast'], sourceModifier: { languageRestriction: restriction }, succeeds: false },
  { languages: ['Common'], sourceLanguages: [], comprehension: true, sourceCreatureType: 'beast', targetCommunication: ['beast'], targetModifier: { languageRestriction: restriction }, succeeds: false },
  { languages: ['Common'], speech: 'actor', succeeds: true },
  { languages: ['Common'], speech: 'target', succeeds: true },
  { languages: ['Common'], speech: 'actor', sourceLanguages: ['understands Common but cannot speak'], succeeds: false },
  { languages: ['understands Common but cannot speak'], speech: 'target', succeeds: false },
  { languages: ['Common'], speech: 'actor', speechSilence: true, succeeds: false },
  { languages: ['Common'], speech: 'target', speechSilence: true, succeeds: false },
  { languages: ['Common'], speech: 'target', speechCondition: 'paralyzed', succeeds: false },
  { languages: ['Common'], speech: 'target', speechCondition: 'petrified', succeeds: false },
  { languages: ['Common'], speech: 'target', speechCondition: 'unconscious', succeeds: false },
  { languages: ['Common'], speech: 'target', speechCondition: 'incapacitated', succeeds: true },
  { languages: ['Common'], speech: 'target', deafened: true, succeeds: true },
  { languages: ['Common'], speech: 'actor', sourceModifier: { actionRestriction: { prohibited: ['speech'] } }, succeeds: false },
  { languages: ['Common'], speech: 'target', targetModifier: { actionRestriction: { prohibited: ['speech'] } }, succeeds: false },
  { languages: ['Common'], speech: 'target', targetModifier: { actionRestriction: { prohibited: ['speech'] } }, suspended: true, succeeds: true },
  { languages: ['Common'], speech: 'target', targetModifier: { actionRestriction: { prohibited: ['attack'] } }, succeeds: true },
  { languages: ['Common'], succeeds: true },
  { languages: ['Elvish'], succeeds: false },
  { languages: ['Common'], deafened: true, succeeds: false },
  { languages: ['Common'], comprehension: true, succeeds: true },
  { languages: ['Elvish'], comprehension: true, succeeds: false },
  { languages: ['Elvish'], targetModifier: comprehension, succeeds: false },
  { languages: ['Elvish'], comprehension: true, targetModifier: comprehension, succeeds: true },
  { languages: ['Elvish'], comprehension: true, targetModifier: comprehension, suspended: true, succeeds: false },
  { languages: ['Elvish'], comprehension: true, sourceModifier: tongues, succeeds: true },
  { languages: [], comprehension: true, sourceModifier: tongues, succeeds: false },
  { languages: ['Common'], comprehension: true, targetModifier: { ...comprehension, languageRestriction: restriction }, succeeds: false },
  { languages: ['Common'], comprehension: true, sourceModifier: { ...tongues, languageRestriction: restriction }, succeeds: false },
  { languages: ['Common'], comprehension: true, targetModifier: { languageRestriction: restriction }, suspended: true, succeeds: true },
  { languages: ['Elvish'], comprehension: true, deafened: true, targetModifier: comprehension, succeeds: false },
  { languages: ['Common'], comprehension: true, sourceLanguages: [], targetModifier: comprehension, succeeds: false },
]
it.each(cases)('uses authoritative communication facts in both execution routes (%j)', ({ languages, deafened, succeeds, comprehension: needsComprehension, targetModifier, sourceModifier, suspended, sourceLanguages, speech, speechCondition, speechSilence, sourceCreatureType, targetCreatureType, sourceCommunication, targetCommunication }) => {
  const definition: Dnd5eActivityDefinitionV1 = speech ? { ...activity, requirements: [{ kind: 'can-speak', subject: speech }] } : needsComprehension ? { ...activity, requirements: [{ kind: 'can-understand-source-language' }, { kind: 'can-hear-source' }] } : activity
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1(definition).missingComponents).toEqual([])
  const packageId = 'local.language-test'
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [definition] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Language', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: activity.id, name: activity.name, description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  try {
    const initial = state(languages, deafened)
    initial.combatants.source.creatureType = sourceCreatureType
    initial.combatants.target.creatureType = targetCreatureType
    initial.combatants.source.communicationCreatureTypes = sourceCommunication
    initial.combatants.target.communicationCreatureTypes = targetCommunication
    if (sourceLanguages) initial.combatants.source.languages = sourceLanguages
    if (speech) {
      const speaker = initial.combatants[speech === 'actor' ? 'source' : 'target']
      speaker.soundSuppressed = speechSilence
      if (speechCondition) {
        speaker.conditions = [...speaker.conditions, speechCondition]
        speaker.classState.activeEffects = [...(speaker.classState.activeEffects ?? []), createDnd5eConditionEffect({ condition: speechCondition, targetId: speaker.id, source: { kind: 'feature', actorId: 'source' } })]
      }
    }
    for (const [id, modifiers] of [['source', sourceModifier], ['target', targetModifier]] as const) {
      if (modifiers) initial.combatants[id].classState.activeEffects = [
        ...(initial.combatants[id].classState.activeEffects ?? []),
        createDnd5eMechanicalEffect({ definitionId: `language:${id}`, label: 'Language', source: { kind: 'feature', actorId: id }, targetId: id, modifiers, suspendedBy: suspended ? ['test-suppression'] : undefined }),
      ]
    }
    initial.combatants.source.pluginFeatureIds = [`${packageId}:${activity.id}`]
    const plugin = resolveDnd5eHeadlessAction(initial, { type: 'plugin', pluginId: packageId, actionId: activity.id, featureId: `${packageId}:${activity.id}`, actorId: 'source', targetId: 'target', distanceFeet: 5, rolls: {}, payload: { communicationCreatureTypes: ['beast'], languages: ['Common'], canHearActivitySource: true, canSpeakAudibly: true, languageCapabilities: { understandSpoken: true } } })
    expect(plugin.ok, plugin.ok ? 'succeeded' : plugin.reason).toBe(succeeds)
    const command = { schemaVersion: 1 as const, commandId: 'language-command', actorId: 'source', packageId, packageVersion: '1.0.0', activityId: activity.id, targetIds: ['target'], expectedRevision: 1, communicationCreatureTypes: ['beast'], languages: ['Common'], canSpeakAudibly: true, languageCapabilities: { understandSpoken: true } }
    const direct = resolveRegisteredDnd5eActivityInCombatV1({ state: initial, combatRevision: 1, command, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(direct.result.ok, JSON.stringify(direct.result)).toBe(succeeds)
    for (const result of [plugin, direct.result]) {
      const finalState = 'state' in result ? result.state : initial
      expect(finalState.combatants.source.turn.actionAvailable).toBe(!succeeds)
      expect(finalState.combatants.target.temporaryHp).toBe(succeeds ? 3 : 0)
    }
    expect(initial.combatants.source.turn.actionAvailable).toBe(true)
  } finally { dispose(); registration.dispose() }
})

import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict, type Dnd5eActiveEffectModifiers } from '../activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'talk', name: 'Talk', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1 },
  effects: [{ schemaVersion: 1, id: 'talking', name: 'Talking', stacking: 'replace', duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' }, sourceLink: { requiresSourceCommunication: true, requiresSharedLanguage: true }, modifiers: [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: 1 } }] }],
  outcomes: [{ id: 'start', when: { kind: 'always' }, operations: [{ id: 'start', kind: 'apply-effect', target: 'target', effectId: 'talking' }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
}

it('validates explicit communication requirements and rejects non-boolean opt-ins', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const key of ['requiresSourceCommunication', 'requiresSharedLanguage']) for (const value of [false, 'true', 1]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.effects![0].sourceLink!, { [key]: value })
    expect(validateDnd5eActivityDefinitionV1(invalid).join(' ')).toContain(key + ' is invalid')
  }
})

it.each(['clear', 'silent-source', 'deaf-target', 'mute-source', 'unconscious-target', 'other-language', 'magic-understanding', 'magic-not-shared', 'restricted-understanding', 'suspended-restriction'] as const)('maintains or permanently interrupts the sourced communication effect (%s)', scenario => {
  const creature = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, languages: ['Common'], proficiencyBonus: 2,
    armorClass: 15, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('talking', [creature('source', 20), creature('target', 10)])
  const source = state.combatants.source, target = state.combatants.target
  const sourceLink = { requiresSourceCommunication: true as const, ...(scenario === 'magic-understanding' ? {} : { requiresSharedLanguage: true as const }) }
  target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'talking', definitionId: 'talking', label: 'Talking', source: { kind: 'feature', actorId: 'source' }, targetId: 'target', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-end' }, modifiers: { speedBonusFeet: 1 }, removal: { sourceLink } })]
  const persisted = JSON.parse(JSON.stringify(target.classState.activeEffects))
  expect(validateDnd5eActiveEffectsStrict(persisted).issues).toEqual([])
  expect(normalizeDnd5eActiveEffects(persisted)[0].removal?.sourceLink).toMatchObject(sourceLink)
  const mechanical = (actorId: 'source' | 'target', modifiers: Dnd5eActiveEffectModifiers, suspended = false) => {
    const actor = state.combatants[actorId]
    actor.classState.activeEffects = [...(actor.classState.activeEffects ?? []), createDnd5eMechanicalEffect({ id: 'restriction', definitionId: 'restriction', label: 'Restriction', source: { kind: 'feature', actorId }, targetId: actorId, modifiers, suspendedBy: suspended ? ['suppressed'] : undefined })]
  }
  if (scenario === 'silent-source') source.soundSuppressed = true
  if (scenario === 'mute-source') mechanical('source', { actionRestriction: { prohibited: ['speech'] } })
  if (scenario === 'deaf-target' || scenario === 'unconscious-target') {
    const condition = scenario === 'deaf-target' ? 'deafened' : 'unconscious'
    target.conditions = [condition]
    target.classState.activeEffects!.push(createDnd5eConditionEffect({ condition, targetId: 'target', source: { kind: 'feature', actorId: 'source' } }))
  }
  if (['other-language', 'magic-understanding', 'magic-not-shared'].includes(scenario)) target.languages = ['Elvish']
  if (scenario === 'magic-understanding' || scenario === 'magic-not-shared') mechanical('target', { languageCapabilities: { understandSpoken: 'all' } })
  if (scenario === 'restricted-understanding' || scenario === 'suspended-restriction') mechanical('target', { languageRestriction: { understandLanguages: false, intelligibleCommunication: false } }, scenario === 'suspended-restriction')
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'source' })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('Expected turn progression')
  const stays = ['clear', 'magic-understanding', 'suspended-restriction'].includes(scenario)
  expect(result.state.combatants.target.classState.activeEffects?.some(effect => effect.id === 'talking') ?? false).toBe(stays)
  expect(state).toEqual(before)
  if (!stays) {
    const restored = result.state
    restored.combatants.source.soundSuppressed = false
    for (const actor of Object.values(restored.combatants)) { actor.languages = ['Common']; actor.conditions = []; actor.classState.activeEffects = actor.classState.activeEffects?.filter(effect => effect.id === 'talking') }
    const next = resolveDnd5eHeadlessAction(restored, { type: 'end-turn', actorId: 'target' })
    expect(next.ok).toBe(true)
    expect(next.state.combatants.target.classState.activeEffects?.some(effect => effect.id === 'talking') ?? false).toBe(false)
  }
})

it.each(['unchanged', 'grant-removed', 'beast-transformed', 'deafened', 'language-restricted'] as const)(
  'rechecks beast communication throughout a maintained effect (%s)', scenario => {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      languages: id === 'source' ? ['Common'] : [], creatureType: id === 'source' ? 'humanoid' : 'beast',
      communicationCreatureTypes: id === 'source' ? ['beast'] : undefined })
    const initial = startDnd5eHeadlessCombat('beast-communication', [make('source', 20), make('target', 10)])
    initial.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'maintained', definitionId: 'maintained',
      label: 'Maintained communication', source: { kind: 'feature', actorId: 'source' }, targetId: 'target',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-end' }, modifiers: { speedBonusFeet: 1 },
      removal: { sourceLink: { requiresSourceCommunication: true } } })]
    const first = resolveDnd5eHeadlessAction(initial, { type: 'end-turn', actorId: 'source' })
    expect(first.ok).toBe(true)
    expect(first.state.combatants.target.classState.activeEffects?.some(effect => effect.id === 'maintained')).toBe(true)
    const current = JSON.parse(JSON.stringify(first.state)) as typeof first.state
    if (scenario === 'grant-removed') current.combatants.source.communicationCreatureTypes = []
    if (scenario === 'beast-transformed') current.combatants.target.creatureType = 'monstrosity'
    if (scenario === 'deafened') current.combatants.target.classState.activeEffects!.push(createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'target', source: { kind: 'feature', actorId: 'source' } }))
    if (scenario === 'language-restricted') current.combatants.target.classState.activeEffects!.push(createDnd5eMechanicalEffect({
      definitionId: 'restricted', label: 'Restricted', source: { kind: 'feature', actorId: 'source' }, targetId: 'target',
      modifiers: { languageRestriction: { understandLanguages: false, intelligibleCommunication: false } } }))
    const second = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId: 'target' })
    expect(second.ok).toBe(true)
    expect(second.state.combatants.target.classState.activeEffects?.some(effect => effect.id === 'maintained') ?? false).toBe(scenario === 'unchanged')
    expect(initial.combatants.source.communicationCreatureTypes).toEqual(['beast'])
  },
)

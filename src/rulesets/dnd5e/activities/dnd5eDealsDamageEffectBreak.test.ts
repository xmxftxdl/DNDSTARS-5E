import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { normalizeDnd5eActiveEffects, createDnd5eMechanicalEffect } from '../activeEffects'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5eActivityActorSnapshotFromCombatantV1 as snapshot } from './dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'free' },
  target: { kind: 'creature', relation: 'any', count: 1, includeSelf: true },
  automation: automationCapabilityFromLegacyStatus('full'),
  effects: [{ schemaVersion: 1, id: 'fresh', name: 'Fresh', duration: { kind: 'permanent' },
    stacking: 'replace', breakOn: ['deals-damage'], modifiers: [{ kind: 'armor-class', mode: 'add', value: { kind: 'constant', value: 1 } }] }],
  outcomes: [{ id: 'pulse', when: { kind: 'always' }, operations: [
    { id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 2 }, damageType: 'fire' },
    { id: 'new-effect', kind: 'apply-effect', target: 'actor', effectId: 'fresh' },
  ] }],
}
function combat() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('damage-break', [make('actor', 20), make('target', 10)])
  for (const actor of Object.values(state.combatants)) actor.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([
    createDnd5eMechanicalEffect({ id: `${actor.id}-old`, definitionId: 'old', label: 'Old', targetId: actor.id,
      source: { kind: 'feature', actorId: actor.id }, breakOn: ['deals-damage'], modifiers: { armorClassBonus: 1 } }),
  ])))
  return state
}

for (const route of ['direct', 'compiled'] as const) it.each(['damage', 'immune', 'self'] as const)(`${route}: only committed sourced damage breaks preexisting dealer effects (%s)`, mode => {
  const state = combat(), targetId = mode === 'self' ? 'actor' : 'target'
  if (mode === 'immune') state.combatants.target.damageImmunities = ['fire']
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.damage-break', name: 'Test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: 'Pulse', summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    state.combatants.actor.pluginFeatureIds = ['test.damage-break:pulse']
    const resolution = resolveDnd5eActivity({ activity, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants[targetId])], rolls: {} })
    const result = route === 'direct'
      ? commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: activity.id, targetIds: [targetId], resolution })
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'test.damage-break', actionId: activity.id,
        featureId: 'test.damage-break:pulse', actorId: 'actor', targetId, distanceFeet: 0, rolls: {} })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    const effects = result.state.combatants.actor.classState.activeEffects ?? []
    expect(effects.some(effect => effect.definitionId === 'old')).toBe(mode === 'immune')
    expect(effects.some(effect => effect.definitionId.includes(':fresh')), JSON.stringify({effects, events:result.events})).toBe(true)
    expect(result.state.combatants.target.classState.activeEffects?.some(effect => effect.definitionId === 'old')).toBe(true)
    expect(state.combatants.actor.classState.activeEffects).toHaveLength(1)
  } finally { dispose() }
})

it('attributes periodic damage on another turn to its source', () => {
  const state = combat()
  state.initiativeIndex = 1
  const burn = createDnd5eMechanicalEffect({ id: 'burn', definitionId: 'burn', label: 'Burn', targetId: 'target',
    source: { kind: 'spell', actorId: 'actor' }, periodicDamage: { timing: 'target-turn-end', count: 1, sides: 4, type: 'fire' } })
  state.combatants.target.classState.activeEffects!.push(burn)
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'target',
    activeEffectPeriodicDamageRolls: [{ targetId: 'target', effectId: burn.id, rolls: [2] }] })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  expect((result.state.combatants.actor.classState.activeEffects ?? []).some(effect => effect.definitionId === 'old')).toBe(false)
  expect(result.state.combatants.target.classState.activeEffects?.some(effect => effect.definitionId === 'old')).toBe(true)
})

it('breaks an effect granted before damage in the same activity', () => {
  const state = combat()
  const reordered = structuredClone(activity)
  reordered.outcomes[0].operations = [...reordered.outcomes[0].operations].reverse()
  const resolution = resolveDnd5eActivity({ activity: reordered, actor: snapshot(state.combatants.actor),
    targets: [snapshot(state.combatants.target)], rolls: {} })
  const result = commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: activity.id, targetIds: ['target'], resolution })
  expect(result.ok).toBe(true)
  expect(result.state.combatants.actor.classState.activeEffects ?? []).toHaveLength(0)
  expect(result.events.filter(event => event.type === 'active-effect-removed' && event.reason === 'deals-damage')).toHaveLength(2)
})

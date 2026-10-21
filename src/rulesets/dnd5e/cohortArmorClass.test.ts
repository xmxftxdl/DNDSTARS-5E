import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeDnd5eCohortArmorClass, dnd5eCohortArmorClassBonus } from './cohortArmorClass'
import { normalizeDnd5eActiveEffects, dnd5eActiveArmorClassBonus } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, dnd5eTargetArmorClassForAttack, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { normalizeCharacter } from '../../store/characters'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'

const definition: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'cohort', name: 'Cohort',
  activation: { kind: 'action', cost: 1 }, target: { kind: 'creature', relation: 'any', count: 3 },
  automation: automationCapabilityFromLegacyStatus('full'), consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
  effects: [{ schemaVersion: 1, id: 'defense', name: 'Defense', stacking: 'replace',
    duration: { kind: 'rounds', rounds: 100800, expiresAt: 'source-turn-end' },
    modifiers: [{ kind: 'armor-class', mode: 'add', value: { kind: 'constant', value: 2 }, cohortProximity: { maximumFeet: 30, match: 'all' } }] }],
  outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'defense', kind: 'apply-effect', effectId: 'defense', target: 'target' }] }] }
function fixture() {
  return startDnd5eHeadlessCombat('cohort', ['caster', 'a', 'b', 'unrelated'].map(id => createDnd5eCombatant({ id, name: id,
    controller: 'player', concentrating: false,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, initiative: id === 'caster' ? 20 : 10 })))
}

it('binds only this application cohort, retains identities after reload, and uses current distance for AC', () => {
  const state = fixture()
  state.combatants.b.classState.wardingBondParticipantCharacterId = 'character-b'
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster)
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const resolution = resolveDnd5eActivity({ activity: definition, actor: snapshot,
    targets: ['a', 'b'].map(id => dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[id])), rolls: {} })
  expect(resolution.ok).toBe(true)
  const result = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: definition.id,
    targetIds: ['a', 'b'], resolution, source: { kind: 'spell', id: 'test.cohort:spell', packageId: 'test.cohort' } })
  if (!result.ok) throw Error(JSON.stringify(result))
  const reloaded = structuredClone(result.state)
  for (const id of ['a', 'b']) {
    const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(reloaded.combatants[id].classState.activeEffects)))
    expect(effects[0].modifiers?.cohortArmorClass?.recipients).toEqual([{ actorId: 'a' }, { actorId: 'b', characterId: 'character-b' }])
    reloaded.combatants[id].classState.activeEffects = effects
    expect(dnd5eActiveArmorClassBonus(effects)).toBe(0)
  }
  expect(reloaded.combatants.unrelated.classState.activeEffects ?? []).toEqual([])
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'caster', 'a')).toBe(10)
  for (const [distance, expected] of [[30, 12], [30.01, 10], [5, 12]] as const) {
    reloaded.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: distance }
    expect(dnd5eTargetArmorClassForAttack(reloaded, 'caster', 'a')).toBe(expected)
  }
  reloaded.combatants['moved-b'] = { ...reloaded.combatants.b, id: 'moved-b' }
  delete reloaded.combatants.b
  reloaded.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'moved-b')]: 30 }
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'caster', 'a')).toBe(12)
  reloaded.combatants.duplicate = { ...reloaded.combatants['moved-b'], id: 'duplicate' }
  expect(dnd5eTargetArmorClassForAttack(reloaded, 'caster', 'a')).toBe(10)
  expect(state.combatants.caster.turn.actionAvailable).toBe(true)
  expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
  const character = normalizeCharacter({ id: 'a', name: 'A', dnd5eCombatState: {
    schemaVersion: 2, activeEffects: result.state.combatants.a.classState.activeEffects } })
  const beforeExpiry = advanceDnd5eCampaignTimedActiveEffects(character, 10079)
  expect(beforeExpiry.dnd5eCombatState?.activeEffects?.[0].modifiers?.cohortArmorClass?.recipients).toHaveLength(2)
  expect(advanceDnd5eCampaignTimedActiveEffects(character, 10080).dnd5eCombatState?.activeEffects ?? []).toEqual([])
})

it('rejects a one-member cohort atomically before consuming the action', () => {
  const state = fixture(), original = structuredClone(state)
  const resolution = resolveDnd5eActivity({ activity: definition,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.a)], rolls: {} })
  const result = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: definition.id, targetIds: ['a'], resolution })
  expect(result.ok).toBe(false)
  expect(JSON.parse(JSON.stringify(result.state))).toEqual(JSON.parse(JSON.stringify(original)))
  expect(result.events).toEqual([])
  expect(state).toEqual(original)
})

it('supports explicitly any/all peers without granting bonuses to nonmembers or unknown distances', () => {
  const rule = { bonus: 2, maximumFeet: 30, match: 'all', recipients: ['a', 'b', 'c'].map(actorId => ({ actorId })) }
  const context = { bearer: { actorId: 'a' }, distanceTo: (peer: { actorId: string }) => peer.actorId === 'b' ? 30 : undefined }
  expect(dnd5eCohortArmorClassBonus(rule, context)).toBe(0)
  expect(dnd5eCohortArmorClassBonus({ ...rule, match: 'any' }, context)).toBe(2)
  expect(dnd5eCohortArmorClassBonus(rule, { ...context, bearer: { actorId: 'unrelated' } })).toBe(0)
  for (const malformed of [{ ...rule, recipients: [] }, { ...rule, maximumFeet: -1 }, { ...rule, bonus: 2.5 },
    { ...rule, recipients: [{ actorId: 'a' }, { actorId: 'a' }] }, { ...rule, forged: true }]) {
    expect(normalizeDnd5eCohortArmorClass(malformed)).toBeUndefined()
  }
})

it('rejects malformed cohort declarations and participant IDs at the import boundary', () => {
  for (const rule of [{ maximumFeet: -1, match: 'all' }, { maximumFeet: 30, match: 'unknown' },
    { maximumFeet: 30, match: 'all', recipients: ['forged'] }]) {
    const bad = structuredClone(definition)
    ;(bad.effects![0].modifiers![0] as any).cohortProximity = rule
    expect(validateDnd5eActivityDefinitionV1(bad).length).toBeGreaterThan(0)
  }
  const duplicate = structuredClone(definition)
  duplicate.effects![0].modifiers = [duplicate.effects![0].modifiers![0], duplicate.effects![0].modifiers![0]]
  expect(validateDnd5eActivityDefinitionV1(duplicate).length).toBeGreaterThan(0)
})

it('binds and validates the same recipient cohort through the registered compiled Headless route', () => {
  const packageId = 'test.cohort-compiled'
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Cohort test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full',
      action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  try {
    const state = fixture()
    state.combatants.caster.pluginFeatureIds = [`${packageId}:${definition.id}`]
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 30 }
    const cast = (targetIds: string[]) => resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId,
      actionId: definition.id, featureId: `${packageId}:${definition.id}`, actorId: 'caster', targetIds, distanceFeet: 0 })
    const result = cast(['a', 'b'])
    if (!result.ok) throw Error(JSON.stringify(result))
    expect(dnd5eTargetArmorClassForAttack(result.state, 'caster', 'a')).toBe(12)
    expect(result.state.combatants.b.classState.activeEffects?.[0].modifiers?.cohortArmorClass?.recipients).toEqual([{ actorId: 'a' }, { actorId: 'b' }])
    expect(cast(['a']).ok).toBe(false)
    expect(state.combatants.caster.turn.actionAvailable).toBe(true)
    expect(state.combatants.a.classState.activeEffects ?? []).toEqual([])
  } finally { dispose() }
})

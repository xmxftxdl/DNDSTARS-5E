import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import { dnd5eBenefitHistoryRecordId } from './spellAuthorityState'
import { normalizeDnd5eBenefitRenewalRecord, dnd5eBenefitHistoryCanRenew } from './benefitHistoryRenewal'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction,
  type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import { registerDnd5eRulesPlugin } from './pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'

const packageId = 'test.benefit-renewal', benefitKey = 'wedding'
const definition: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'wedding', name: 'Wedding',
  activation: { kind: 'action', cost: 1 }, target: { kind: 'creature', relation: 'any', minimumCount: 2, count: 10, rangeFeet: 10 },
  automation: automationCapabilityFromLegacyStatus('full'), consumption: [
    { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
    { kind: 'resource', resourceId: `${packageId}:focus`, amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
  effects: [{ schemaVersion: 1, id: 'defense', name: 'Defense', stacking: 'replace', duration: { kind: 'rounds', rounds: 100800, expiresAt: 'source-turn-end' },
    modifiers: [{ kind: 'armor-class', mode: 'add', value: { kind: 'constant', value: 2 }, cohortProximity: { maximumFeet: 30, match: 'all' } }] }],
  outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [
    { id: 'history', kind: 'establish-spell-authority', target: 'target', recordKind: 'benefit-history', benefitKey,
      benefitRenewal: { kind: 'recipient-death', match: 'any' } },
    { id: 'defense', kind: 'apply-effect', effectId: 'defense', target: 'target' }] }] }
function fixture() {
  const state = startDnd5eHeadlessCombat('renewal', ['caster', 'a', 'b', 'new-spouse'].map((id, index) => createDnd5eCombatant({
    id, name: id, controller: 'player', concentrating: false, initiative: 20 - index,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 } })))
  state.combatants.caster.campaignWorldMinute = 100
  state.combatants.caster.classId = 'cleric'
  state.combatants.caster.classLevels = { cleric: 1 }
  state.combatants.caster.classResources[`${packageId}:focus`] = { current: 10, max: 10 }
  state.combatants.caster.pluginFeatureIds = [`${packageId}:${definition.id}`]
  state.combatants.b.classState.wardingBondParticipantCharacterId = 'character-b'
  state.distanceFeetByCombatantPair = Object.fromEntries(['a', 'b', 'new-spouse'].map(id => [dnd5eCombatantPairKey('caster', id), 5]))
  return state
}

it.each(['commit', 'compiled-plugin'] as const)('preserves benefit history and renews only on current certified partner death through %s', route => {
  const focusId = `${packageId}:focus`
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Renewal test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerResource({ id: 'focus', label: 'Focus', classId: 'cleric', maximum: 10, resetOn: 'long-rest' })
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full',
      action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  const cast = (state: Dnd5eHeadlessCombatState, targetIds: string[], actorId = 'caster') => {
    if (route === 'compiled-plugin') return resolveDnd5eHeadlessAction(state, { type: 'plugin', actorId,
      pluginId: packageId, actionId: definition.id, featureId: `${packageId}:${definition.id}`, targetIds, distanceFeet: 5 })
    const actor = state.combatants[actorId]
    const resolution = resolveDnd5eActivity({ activity: definition, actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, state),
      targets: targetIds.map(id => dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[id], actor, state)),
      rolls: {}, distanceFeetByTargetId: Object.fromEntries(targetIds.map(id => [id, 5])) })
    return commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: definition.id, targetIds, resolution,
      source: { kind: 'spell', id: `${packageId}:ceremony`, packageId } })
  }
  try {
    const unknownClock = fixture(), beforeClock = structuredClone(unknownClock)
    delete unknownClock.combatants.caster.campaignWorldMinute
    const noClock = cast(unknownClock, ['a', 'b'])
    expect(noClock.ok).toBe(false)
    expect(noClock.state.combatants.caster.turn).toEqual(beforeClock.combatants.caster.turn)
    expect(noClock.state.combatants.caster.classResources).toEqual(beforeClock.combatants.caster.classResources)
    const first = cast(fixture(), ['a', 'b'])
    if (!first.ok) throw Error(JSON.stringify(first))
    const recordId = dnd5eBenefitHistoryRecordId(packageId, benefitKey)
    const record = first.state.combatants.a.classState.spellAuthorityRecords![recordId]
    expect(record).toMatchObject({ kind: 'benefit-history', renewal: { kind: 'recipient-death', match: 'any',
      recipients: [{ actorId: 'a' }, { actorId: 'b', characterId: 'character-b' }] } })
    const expired = advanceDnd5eCampaignTimedActiveEffects(normalizeCharacter({ id: 'a', name: 'A', dnd5eCombatState: {
      schemaVersion: 2, activeEffects: first.state.combatants.a.classState.activeEffects,
      spellAuthorityRecords: first.state.combatants.a.classState.spellAuthorityRecords } }), 10080)
    expect(expired.dnd5eCombatState?.activeEffects ?? []).toEqual([])
    expect(expired.dnd5eCombatState?.spellAuthorityRecords?.[recordId]).toEqual(record)
    const reloaded = JSON.parse(JSON.stringify(first.state)) as Dnd5eHeadlessCombatState
    reloaded.combatants.a.classState.activeEffects = expired.dnd5eCombatState?.activeEffects
    reloaded.combatants.a.classState.spellAuthorityRecords = expired.dnd5eCombatState?.spellAuthorityRecords
    reloaded.combatants.caster.turn.actionAvailable = true
    const denied = (state: Dnd5eHeadlessCombatState) => {
      const before = structuredClone(state), result = cast(state, ['a', 'new-spouse'])
      expect(result.ok).toBe(false)
      expect(JSON.parse(JSON.stringify(result.state))).toEqual(JSON.parse(JSON.stringify(before)))
      expect(state).toEqual(before)
      expect(result.state.combatants.caster.classResources[focusId].current).toBe(before.combatants.caster.classResources[focusId].current)
    }
    denied(reloaded)
    reloaded.combatants.b.currentHp = 0
    denied(reloaded)
    const missing = structuredClone(reloaded)
    delete missing.combatants.b
    denied(missing)
    reloaded.combatants.b.deathSaves.dead = true
    const mixed = structuredClone(reloaded)
    mixed.combatants['new-spouse'].classState.spellAuthorityRecords = { [recordId]: {
      schemaVersion: 1, id: recordId, kind: 'benefit-history', sourceActorId: 'caster', subjectActorId: 'new-spouse',
      sourceActivityId: definition.id, sourcePackageId: packageId, benefitKey, createdWorldMinute: 0,
      renewal: { kind: 'recipient-death', match: 'any', recipients: [{ actorId: 'new-spouse' }, { actorId: 'caster' }] } } }
    denied(mixed)
    const differentCaster = structuredClone(reloaded)
    differentCaster.combatants['new-spouse'] = { ...structuredClone(differentCaster.combatants.caster), id: 'new-spouse', name: 'Other caster' }
    differentCaster.initiativeIndex = differentCaster.initiativeOrder.indexOf('new-spouse')
    differentCaster.distanceFeetByCombatantPair![dnd5eCombatantPairKey('new-spouse', 'a')] = 5
    const changedCaster = cast(differentCaster, ['a', 'caster'], 'new-spouse')
    if (!changedCaster.ok) throw Error(JSON.stringify(changedCaster))
    expect(changedCaster.state.combatants.a.classState.spellAuthorityRecords![recordId].sourceActorId).toBe('new-spouse')
    const revived = structuredClone(reloaded)
    revived.combatants.b.currentHp = 10; revived.combatants.b.deathSaves.dead = false
    denied(revived)
    reloaded.combatants['moved-b'] = { ...reloaded.combatants.b, id: 'moved-b' }
    delete reloaded.combatants.b
    const eligible = cast(reloaded, ['a', 'new-spouse'])
    if (!eligible.ok) throw Error(JSON.stringify(eligible))
    expect(eligible.state.combatants.caster.classResources[focusId].current).toBe(first.state.combatants.caster.classResources[focusId].current - 1)
    expect(eligible.state.combatants.a.classState.spellAuthorityRecords![recordId]).toMatchObject({ renewal: {
      recipients: [{ actorId: 'a' }, { actorId: 'new-spouse' }] } })
    eligible.state.combatants.caster.turn.actionAvailable = true
    denied(eligible.state)
  } finally { dispose() }
})

it('rejects malformed renewal policy and authored participant lists; legacy history never gains a renewal loophole', () => {
  for (const policy of [{ kind: 'unknown', match: 'any' }, { kind: 'recipient-death', match: 'unknown' },
    { kind: 'recipient-death', match: 'any', recipients: [{ actorId: 'forged' }] }]) {
    const bad = structuredClone(definition)
    ;(bad.outcomes[0].operations[0] as any).benefitRenewal = policy
    expect(validateDnd5eActivityDefinitionV1(bad).length).toBeGreaterThan(0)
  }
  const bad = structuredClone(definition)
  ;(bad.outcomes[0].operations[0] as any).benefitRecipients = [{ actorId: 'forged' }]
  expect(validateDnd5eActivityDefinitionV1(bad).length).toBeGreaterThan(0)
  expect(normalizeDnd5eBenefitRenewalRecord({ kind: 'recipient-death', match: 'any', recipients: [] })).toBeUndefined()
  expect(dnd5eBenefitHistoryCanRenew({ schemaVersion: 1, id: 'history', kind: 'benefit-history', sourceActorId: 'caster',
    subjectActorId: 'a', sourceActivityId: 'wedding', createdWorldMinute: 0, sourcePackageId: packageId, benefitKey },
    { kind: 'recipient-death', match: 'any' }, () => true)).toBe(false)
})

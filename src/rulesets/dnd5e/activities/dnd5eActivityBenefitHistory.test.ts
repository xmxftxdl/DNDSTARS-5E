import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../../store/characters'
import { advanceDnd5eCampaignTimedActiveEffects } from '../campaignTimeRules'
import { commitDnd5eActivityExecution, createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { dnd5eBenefitHistoryRecordId } from '../spellAuthorityState'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const packageId = 'test.lifetime-rites'
function activity(benefitKey: string): Dnd5eActivityDefinitionV1 {
  return { schemaVersion: 1, id: benefitKey, name: benefitKey, activation: { kind: 'action', cost: 1 },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 10 }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'bonus', name: 'Bonus', duration: { kind: 'rounds', rounds: 14400, expiresAt: 'source-turn-end' }, stacking: 'replace',
      modifiers: [{ kind: 'optional-bonus-die', sides: 4, appliesTo: [benefitKey === 'coming-of-age' ? 'ability-check' : 'saving-throw'], consumeOnUse: false }] }],
    outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [
      { id: 'bonus', kind: 'apply-effect', target: 'target', effectId: 'bonus' },
      { id: 'record', kind: 'establish-spell-authority', target: 'target', recordKind: 'benefit-history', benefitKey },
    ] }] }
}
function initial() {
  const actors = ['first', 'second', 'recipient'].map((id, index) => {
    const actor = createDnd5eCombatant({ id, name: id, controller: 'player', initiative: 30 - index * 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20,
      speed: 30, temporaryHp: 0, concentrating: false, position: { x: 0, y: 0 } })
    actor.campaignWorldMinute = 1000
    actor.pluginFeatureIds = ['coming-of-age', 'dedication'].map(id => `${packageId}:${id}`)
    return actor
  })
  const state = startDnd5eHeadlessCombat('benefit-history', actors)
  state.distanceFeetByCombatantPair = Object.fromEntries(['first', 'second'].map(id => [dnd5eCombatantPairKey(id, 'recipient'), 0]))
  return state
}

it.each(['commit', 'compiled-plugin'] as const)('keeps recipient benefit history across expiry, reload and caster change through %s', route => {
  const activities = ['coming-of-age', 'dedication'].map(activity)
  for (const definition of activities) expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Lifetime rites test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    for (const definition of activities) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
      api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
    }
  } })
  function cast(state: Dnd5eHeadlessCombatState, casterId: string, definition: Dnd5eActivityDefinitionV1) {
    if (route === 'compiled-plugin') return resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: definition.id,
      featureId: `${packageId}:${definition.id}`, actorId: casterId, targetId: 'recipient', distanceFeet: 0 })
    const resolution = resolveDnd5eActivity({ activity: definition,
      actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[casterId], state.combatants[casterId], state),
      targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.recipient, state.combatants[casterId], state)],
      rolls: {}, distanceFeetByTargetId: { recipient: 0 } })
    return commitDnd5eActivityExecution(state, { actorId: casterId, activityId: definition.id, targetIds: ['recipient'], resolution,
      source: { kind: 'spell', id: 'ceremony', packageId } })
  }
  try {
    const before = initial(), original = structuredClone(before)
    const first = cast(before, 'first', activities[0])
    expect(first.ok, JSON.stringify(first)).toBe(true)
    expect(before).toEqual(original)
    expect(first.state.combatants.first.turn.actionAvailable).toBe(false)
    const id = dnd5eBenefitHistoryRecordId(packageId, 'coming-of-age')
    expect(first.state.combatants.recipient.classState.spellAuthorityRecords?.[id]).toMatchObject({ kind: 'benefit-history', sourceActorId: 'first', benefitKey: 'coming-of-age' })
    expect(first.state.combatants.first.classState.spellAuthorityRecords).toBeUndefined()
    const recipient = first.state.combatants.recipient
    const character = normalizeCharacter({ id: 'recipient', name: 'Recipient', dnd5eCombatState: { schemaVersion: 2,
      activeEffects: recipient.classState.activeEffects, spellAuthorityRecords: recipient.classState.spellAuthorityRecords } })
    const expired = advanceDnd5eCampaignTimedActiveEffects(character, 1440)
    expect(expired.dnd5eCombatState?.activeEffects ?? []).toHaveLength(0)
    expect(expired.dnd5eCombatState?.spellAuthorityRecords?.[id]).toBeDefined()
    const reloaded = JSON.parse(JSON.stringify(first.state)) as Dnd5eHeadlessCombatState
    reloaded.combatants.recipient.classState.activeEffects = expired.dnd5eCombatState?.activeEffects
    reloaded.combatants.recipient.classState.spellAuthorityRecords = expired.dnd5eCombatState?.spellAuthorityRecords
    reloaded.initiativeIndex = reloaded.initiativeOrder.indexOf('second')
    const baseline = structuredClone(reloaded)
    const repeated = cast(reloaded, 'second', activities[0])
    expect(repeated.ok).toBe(false)
    expect(reloaded).toEqual(baseline)
    expect(repeated.state).toEqual(baseline)
    expect(repeated.events).toEqual([])
    const differentRite = cast(reloaded, 'second', activities[1])
    expect(differentRite.ok, JSON.stringify(differentRite)).toBe(true)
    expect(Object.values(differentRite.state.combatants.recipient.classState.spellAuthorityRecords ?? {})).toHaveLength(2)
  } finally { dispose() }
})

it('rejects missing, malformed and misplaced benefit keys at the import boundary', () => {
  const invalidScope=activity('coming-of-age')
  const invalidOperation=invalidScope.outcomes[0].operations[1]
  Object.assign(invalidOperation,{benefitScope:'global-client'})
  expect(validateDnd5eActivityDefinitionV1(invalidScope).some(issue=>issue.includes('benefitScope'))).toBe(true)
  for (const key of [undefined, '', 'Invalid Key', 'a'.repeat(81)]) {
    const definition = activity('coming-of-age')
    const operation = definition.outcomes[0].operations[1]
    if (operation.kind !== 'establish-spell-authority') throw Error('wrong operation')
    operation.benefitKey = key
    expect(validateDnd5eActivityDefinitionV1(definition).some(issue => issue.includes('benefitKey'))).toBe(true)
  }
  const definition = activity('coming-of-age')
  const operation = definition.outcomes[0].operations[1]
  if (operation.kind !== 'establish-spell-authority') throw Error('wrong operation')
  operation.recordKind = 'soul-vessel'
  expect(validateDnd5eActivityDefinitionV1(definition).some(issue => issue.includes('benefitKey'))).toBe(true)
})

it.each(['commit','compiled-plugin'] as const)('enforces shared history across packages, legacy history and reload through %s', route => {
  const secondPackage='test.lifetime-rites-repacked'
  for(const [firstScope,nextScope,allowed] of [[undefined,undefined,true],['ruleset',undefined,false],[undefined,'ruleset',false],['ruleset','ruleset',false]] as const){
    const definitions=[activity('coming-of-age'),activity('coming-of-age')]
    for(const [index,scope] of [firstScope,nextScope].entries()){
      const op=definitions[index].outcomes[0].operations[1]
      if(op.kind!=='establish-spell-authority')throw Error('wrong operation')
      op.benefitScope=scope
      expect(validateDnd5eActivityDefinitionV1(definitions[index])).toEqual([])
    }
    const packages=[packageId,secondPackage]
    const disposers=packages.map((id,index)=>registerDnd5eRulesPlugin({manifest:{id,name:id,version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definitions[index]))
      api.registerFeature({id:definitions[index].id,name:'Rite',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(definitions[index])})
    }}))
    try{
      const before=initial();for(const actor of Object.values(before.combatants))actor.pluginFeatureIds=[...actor.pluginFeatureIds,`${secondPackage}:coming-of-age`]
      const cast=(state:Dnd5eHeadlessCombatState,index:number)=>{
        const casterId=index?'second':'first',definition=definitions[index],pkg=packages[index]
        if(route==='compiled-plugin')return resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:pkg,actionId:definition.id,featureId:`${pkg}:${definition.id}`,actorId:casterId,targetId:'recipient',distanceFeet:0})
        const resolution=resolveDnd5eActivity({activity:definition,actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[casterId],state.combatants[casterId],state),targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.recipient,state.combatants[casterId],state)],rolls:{},distanceFeetByTargetId:{recipient:0}})
        return commitDnd5eActivityExecution(state,{actorId:casterId,activityId:definition.id,targetIds:['recipient'],resolution,source:{kind:'spell',id:'ceremony',packageId:pkg}})
      }
      const first=cast(before,0);expect(first.ok,JSON.stringify(first)).toBe(true)
      const reloaded=JSON.parse(JSON.stringify(first.state)) as Dnd5eHeadlessCombatState
      reloaded.combatants.recipient.classState.activeEffects=[]
      reloaded.initiativeIndex=reloaded.initiativeOrder.indexOf('second')
      const baseline=structuredClone(reloaded),second=cast(reloaded,1)
      expect(second.ok,JSON.stringify(second)).toBe(allowed)
      expect(reloaded).toEqual(baseline)
      if(!allowed){expect(second.state).toEqual(baseline);expect(second.events).toEqual([]);expect(second.state.combatants.second.turn.actionAvailable).toBe(true)}
    }finally{for(const dispose of disposers.reverse())dispose()}
  }
})

it('rejects an ineligible recipient before changing any other recipient or consuming action', () => {
  const state = initial(), definition = activity('coming-of-age')
  definition.target = { kind: 'creature', relation: 'any', count: 2, rangeFeet: 10 }
  for (const operation of definition.outcomes[0].operations) {
    if ('target' in operation) operation.target = 'all-targets'
  }
  const recordId = dnd5eBenefitHistoryRecordId(packageId, 'coming-of-age')
  state.combatants.recipient.classState.spellAuthorityRecords = { [recordId]: { schemaVersion: 1, id: recordId, kind: 'benefit-history',
    sourceActorId: 'second', subjectActorId: 'recipient', sourceActivityId: 'coming-of-age', createdWorldMinute: 1000,
    sourcePackageId: packageId, benefitKey: 'coming-of-age' } }
  const original = structuredClone(state)
  const resolution = resolveDnd5eActivity({ activity: definition,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.first, state.combatants.first, state),
    targets: ['second', 'recipient'].map(id => dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[id], state.combatants.first, state)),
    rolls: {}, distanceFeetByTargetId: { second: 0, recipient: 0 } })
  expect(resolution.ok).toBe(true)
  const result = commitDnd5eActivityExecution(state, { actorId: 'first', activityId: definition.id, targetIds: ['second', 'recipient'], resolution,
    source: { kind: 'spell', id: 'ceremony', packageId } })
  expect(result.ok).toBe(false)
  expect(result.events).toEqual([])
  expect(result.state).toEqual(original)
  expect(state).toEqual(original)
})

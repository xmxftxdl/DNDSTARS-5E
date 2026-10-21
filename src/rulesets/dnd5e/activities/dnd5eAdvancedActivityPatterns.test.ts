import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { prepareDnd5eActivityContinuationV1, finishDnd5eActivityContinuationV1 } from './dnd5eActivityContinuation'
import { afterEach, describe, expect, it } from 'vitest'
import { compileDnd5eActivityPatternV1 as compile } from './dnd5eActivityPatterns'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1, dnd5eActivityActorSnapshotFromCombatantV1 as snapshot } from './dnd5eActivityCombatAuthority'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, reconcileDnd5eSourceLinkedRelations, endDnd5eConcentration, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import type { Dnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import advancedExample from '../../../../examples/activity-advanced.json?raw'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { exportDnd5eStarMod, readDnd5eStarMod, exportLegacyDnd5eStarMod, readLegacyDnd5eStarMod } from '../starModAdapter'

afterEach(clearDnd5eActivityRegistryForTests)
const base = { schemaVersion: 1 as const, id: 'root', name: 'Test', source: { kind: 'feature' as const, id: 'root' }, target: { kind: 'creature' as const, relation: 'any' as const, count: 1, rangeFeet: 60 } }
function fixture() {
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20, level: 8, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, proficiencyBonus: 3, armorClass: 14, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, saveDc: 15, position: { x: 0, y: 0 }, concentrating: false, pluginFeatureIds: ['local.advanced:root'] })
  const target = createDnd5eCombatant({ ...actor, id: 'target', name: 'Target', controller: 'dm', initiative: 10 })
  const other = createDnd5eCombatant({ ...target, id: 'other', initiative: 5 })
  const state = startDnd5eHeadlessCombat('advanced', [actor, target, other])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 10, [dnd5eCombatantPairKey('actor', 'other')]: 15, [dnd5eCombatantPairKey('target', 'other')]: 5 }
  return state
}
const command: Dnd5eExecuteActivityCommandV1 = { schemaVersion: 1, commandId: 'cast-1', actorId: 'actor', packageId: 'local.advanced', packageVersion: '1.0.0', activityId: 'root', targetIds: ['target'], expectedRevision: 1 }

describe('B-class Host mechanisms', () => {
  it('compiles Host beast choices and willing saves, preserving per-target forms through settlement', () => {
    const activity = compile({ ...base, target: { ...base.target, count: 2 }, pattern: 'transformation', forms: [], formsFrom: 'srd-beast-forms', check: { kind: 'save', ability: 'wis', allowWillingFailure: true }, transformation: { target: 'target', profile: 'polymorph', durationRounds: 10, concentration: true, maximumChallengeRating: 'target-half-level-or-challenge-rating', hitPointMode: 'retain-with-form-temporary-hp' } })
    const state = fixture()
    const resolution = resolveDnd5eActivity({ activity, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants.target), snapshot(state.combatants.other)], choices: { form: 'srd-5.1:wolf' }, targetFormIds: { other: 'srd-5.1:cat' }, willingTargetIds: ['target', 'other'], checkRollModes: { 'check:target': 'normal', 'check:other': 'normal' }, rolls: { 'save:target': { values: [20] }, 'save:other': { values: [20] } }, distanceFeetByTargetId: { target: 10, other: 15 } })
    expect(resolution.ok, JSON.stringify(resolution)).toBe(true)
    const result = commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: activity.id, targetIds: ['target', 'other'], resolution, source: { kind: 'feature', id: 'root' } })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.target.statBlockId).toBe('srd-5.1:wolf')
    expect(result.state.combatants.other.statBlockId).toBe('srd-5.1:cat')
  })
  it('B5 starts concentration before native transformation settlement and preserves it across reconciliation', () => {
    const activity = compile({ ...base, pattern: 'transformation', forms: [{ id: 'srd-5.1:wolf', label: 'Wolf' }], transformation: { target: 'target', profile: 'polymorph', durationRounds: 10, concentration: true, maximumChallengeRating: 'target-level-or-challenge-rating' } })
    registerDnd5eActivityPackage({ packageId: 'local.advanced', packageVersion: '1.0.0', activities: [activity] })
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.advanced', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: 'root', name: 'Root', summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
    try {
      const cast = resolveDnd5eHeadlessAction(fixture(), { type: 'plugin', pluginId: 'local.advanced', actionId: 'root', featureId: 'local.advanced:root', actorId: 'actor', targetId: 'target', targetIds: ['target'], distanceFeet: 10, rolls: {}, payload: { activityChoices: { form: 'srd-5.1:wolf' } } })
      expect(cast.ok, JSON.stringify(cast)).toBe(true)
      expect(cast.state.combatants.actor.concentrating).toBe(true)
      reconcileDnd5eSourceLinkedRelations(cast.state)
      expect(cast.state.combatants.target.statBlockId).toBe('srd-5.1:wolf')
      endDnd5eConcentration(cast.state, cast.state.combatants.actor, [])
      expect(cast.state.combatants.target.currentHp).toBe(30)
    } finally { dispose() }
  })
  it('imports the portable example and compiles carried rolls out of the next roll request', async () => {
    const prepared = await prepareDnd5eLocalContentJson(advancedExample)
    const next = prepared.package.content.activities!.find(activity => activity.id === 'chain-demo-next')!
    expect(next.carriedRollIds).toEqual(['prior-damage'])
    expect(compileDnd5eActivityHeadlessAction(next).rolls).toEqual([])
    const reimported = await readLegacyDnd5eStarMod(await exportLegacyDnd5eStarMod(prepared.package))
    expect(reimported?.package.content.activities).toEqual(prepared.package.content.activities)
  })
  it('B5 accepts different declared forms per target and rejects an undeclared form', () => {
    const state = fixture()
    const activity = compile({ ...base, target: { ...base.target, count: 2 }, source: { kind: 'spell', id: 'different-bodies' }, pattern: 'transformation', forms: [{ id: 'srd-5.1:wolf', label: 'Wolf' }, { id: 'srd-5.1:cat', label: 'Cat' }], transformation: { target: 'target', profile: 'polymorph', durationRounds: 10, concentration: true, maximumChallengeRating: 'target-half-level-or-challenge-rating', hitPointMode: 'retain-with-form-temporary-hp' } })
    const input = { activity, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants.target), snapshot(state.combatants.other)], rolls: {}, choices: { form: 'srd-5.1:wolf' }, distanceFeetByTargetId: { target: 10, other: 15 }, targetFormIds: { other: 'srd-5.1:cat' } }
    const resolution = resolveDnd5eActivity(input)
    const result = commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: activity.id, targetIds: ['target', 'other'], resolution, source: { kind: 'spell', id: 'different-bodies' } })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.target.statBlockId).toBe('srd-5.1:wolf')
    expect(result.state.combatants.other.statBlockId).toBe('srd-5.1:cat')
    expect(resolveDnd5eActivity({ ...input, targetFormIds: { other: 'not-declared' } }).ok).toBe(false)
  })
  it('B5 permits a consenting shapechanger and leaves an unwilling shapechanger unchanged', () => {
    for (const willing of [false,true]) {
      const state=fixture();state.combatants.target.shapechanger=true
      const activity=compile({...base,source:{kind:'spell',id:'consented-body'},pattern:'transformation',forms:[{id:'srd-5.1:wolf',label:'Wolf'}],choices:[{id:'seen',label:'Seen',options:[{id:'confirmed',label:'Yes'}]}],check:{kind:'save',ability:'wis'},transformation:{target:'target',profile:'polymorph',durationRounds:10,concentration:true,maximumChallengeRating:'target-half-level-or-challenge-rating',hitPointMode:'retain-with-form-temporary-hp',allowWillingShapechanger:true,seenConfirmationChoiceId:'seen'}})
      if(activity.checks?.[0].kind==='saving-throw')activity.checks[0].allowWillingFailure=true
      const resolution=resolveDnd5eActivity({activity,actor:snapshot(state.combatants.actor),targets:[snapshot(state.combatants.target)],rolls:{'save:target':{values:[willing?20:1]}},choices:{form:'srd-5.1:wolf',seen:'confirmed'},willingTargetIds:willing?['target']:[],checkRollModes:{'check:target':'normal'},distanceFeetByTargetId:{target:10}})
      const result=commitDnd5eActivityExecution(state,{actorId:'actor',activityId:activity.id,targetIds:['target'],resolution,source:{kind:'spell',id:'consented-body'}})
      expect(result.ok,JSON.stringify(result)).toBe(true)
      expect(result.state.combatants.target.classState.wildShapeFormId).toBe(willing?'srd-5.1:wolf':undefined)
    }
  })
  it('B1 runs through the native plugin action path and exposes only the live continuation', () => {
    const root = compile({ ...base, pattern: 'roll-effect', result: { kind: 'damage', amount: { kind: 'dice', count: 1, sides: 6, rollId: 'damage' }, damageType: 'fire' }, continuation: { nextActivityId: 'jump', maximumSteps: 2, excludePreviousTargets: true, carryRolls: [{ from: 'damage', to: 'prior-damage' }] } })
    const jump = compile({ ...base, id: 'jump', requiresContinuationFrom: 'root', carriedRollIds: ['prior-damage'], activation: { kind: 'free' }, pattern: 'roll-effect', result: { kind: 'damage', amount: { kind: 'dice', count: 1, sides: 6, rollId: 'prior-damage' }, damageType: 'cold' } })
    registerDnd5eActivityPackage({ packageId: 'local.advanced', packageVersion: '1.0.0', activities: [root, jump] })
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.advanced', name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      for (const activity of [root, jump]) {
        api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
        api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
      }
    } })
    try {
      const first = resolveDnd5eHeadlessAction(fixture(), { type: 'plugin', pluginId: 'local.advanced', actionId: 'root', featureId: 'local.advanced:root', actorId: 'actor', targetId: 'target', targetIds: ['target'], transactionId: 'native-1', distanceFeet: 10, rolls: { damage: { values: [4], modifier: 0, total: 4 } } })
      expect(first.ok, JSON.stringify(first)).toBe(true)
      expect(first.state.combatants.actor.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('jump'))).toBe(true)
      const second = resolveDnd5eHeadlessAction(first.state, { type: 'plugin', pluginId: 'local.advanced', actionId: 'jump', featureId: 'local.advanced:jump', actorId: 'actor', targetId: 'other', targetIds: ['other'], hostEntitlement: { kind: 'active-effect', effectId: 'continuation:native-1' }, transactionId: 'native-2', distanceFeet: 15, rolls: {} })
      expect(second.ok, JSON.stringify(second)).toBe(true)
      expect(second.state.combatants.other.currentHp).toBe(26)
      expect(second.state.combatants.actor.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('jump'))).toBe(false)
    } finally { dispose() }
  })
  it('B5 supports retained HP, locked form temporary HP, and exact overflow damage', () => {
    const state = fixture()
    const activity = compile({ ...base, source: { kind: 'spell', id: 'temporary-body' }, pattern: 'transformation', forms: [{ id: 'srd-5.1:wolf', label: 'Wolf' }], transformation: { target: 'target', profile: 'polymorph', durationRounds: 10, concentration: true, maximumChallengeRating: 'target-half-level-or-challenge-rating', hitPointMode: 'retain-with-form-temporary-hp' } })
    const resolution = resolveDnd5eActivity({ activity, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants.target)], rolls: {}, choices: { form: 'srd-5.1:wolf' }, distanceFeetByTargetId: { target: 10 } })
    const cast = commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: activity.id, targetIds: ['target'], resolution, source: { kind: 'spell', id: 'temporary-body' } })
    expect(cast.ok, JSON.stringify(cast)).toBe(true)
    expect(cast.state.combatants.target).toMatchObject({ currentHp: 30, maxHp: 30, temporaryHp: 11 })
    const offer = compile({ ...base, activation: { kind: 'free' }, pattern: 'roll-effect', result: { kind: 'temporary-hit-points', amount: { kind: 'constant', value: 40 } } })
    const offered = resolveDnd5eActivity({ activity: offer, actor: snapshot(cast.state.combatants.actor), targets: [snapshot(cast.state.combatants.target)], rolls: {}, distanceFeetByTargetId: { target: 10 } })
    const offeredCommit = commitDnd5eActivityExecution(cast.state, { actorId: 'actor', activityId: offer.id, targetIds: ['target'], resolution: offered })
    expect(offeredCommit.ok).toBe(true)
    expect(offeredCommit.state.combatants.target.temporaryHp).toBe(11)
    const damage = resolveDnd5eHeadlessAction(cast.state, { type: 'attack', actorId: 'actor', targetId: 'target', d20: 15, attackModifier: 10, spendAction: false, damage: { count: 1, sides: 20, bonus: 0, rolls: [15], type: 'fire' } })
    expect(damage.ok, JSON.stringify(damage)).toBe(true)
    expect(damage.state.combatants.target.currentHp).toBe(26)
    expect(damage.state.combatants.target.temporaryHp).toBe(0)
    expect(damage.state.combatants.target.classState.wildShapeFormId).toBeUndefined()
  })
  it('B1 saves authoritative dice, continues once, rejects duplicate targets and expires at turn change', () => {
    const root = compile({ ...base, pattern: 'roll-effect', result: { kind: 'damage', amount: { kind: 'dice', count: 2, sides: 6, rollId: 'damage' }, damageType: 'fire' }, continuation: { nextActivityId: 'jump', maximumSteps: 3, excludePreviousTargets: true, maximumDistanceFromPreviousTargetFeet: 30, when: { kind: 'equal-dice', rollId: 'damage', first: 0, second: 1 }, carryRolls: [{ from: 'damage', to: 'prior-damage' }] } })
    const jump = compile({ ...base, id: 'jump', requiresContinuationFrom: 'root', activation: { kind: 'free' }, pattern: 'roll-effect', result: { kind: 'damage', amount: { kind: 'dice', count: 2, sides: 6, rollId: 'prior-damage' }, damageType: 'cold' } })
    registerDnd5eActivityPackage({ packageId: 'local.advanced', packageVersion: '1.0.0', activities: [root, jump] })
    const first = resolveRegisteredDnd5eActivityInCombatV1({ state: fixture(), command, combatRevision: 1, authoritativeRolls: { damage: { values: [3, 3] } }, confirmedBy: 'actor' })
    expect(first.phase, JSON.stringify(first)).toBe('commit')
    if (first.phase !== 'commit' || !first.result.ok) throw new Error(JSON.stringify(first))
    const state = JSON.parse(JSON.stringify(first.result.state)) as typeof first.result.state
    expect(state.combatants.target.currentHp).toBe(24)
    expect(state.activityContinuations?.['cast-1'].nextActivityId).toBe('jump')
    const next = { ...command, commandId: 'cast-2', activityId: 'jump', continuationId: 'cast-1', targetIds: ['other'], expectedRevision: 2 }
    const attempt = (cmd: Dnd5eExecuteActivityCommandV1, rolls = {}) => resolveRegisteredDnd5eActivityInCombatV1({ state, command: cmd, combatRevision: 2, authoritativeRolls: rolls, confirmedBy: 'actor' })
    expect(attempt({ ...next, targetIds: ['target'] })).toMatchObject({ phase: 'resolve', result: { ok: false, details: ['continuation-target-already-used'] } })
    expect(attempt(next, { 'prior-damage': { values: [6, 6] } })).toMatchObject({ phase: 'resolve', result: { ok: false, details: ['continuation-roll-overwrite'] } })
    expect(attempt({ ...next, continuationId: undefined })).toMatchObject({ phase: 'resolve', result: { ok: false } })
    const second = attempt(next)
    if (second.phase !== 'commit' || !second.result.ok) throw new Error(JSON.stringify(second))
    expect(second.result.state.combatants.other.currentHp).toBe(24)
    expect(second.result.state.activityContinuations?.['cast-1'].nextActivityId).toBeUndefined()
    expect(resolveRegisteredDnd5eActivityInCombatV1({ state: second.result.state, command: { ...next, expectedRevision: 3 }, combatRevision: 3, authoritativeRolls: {}, confirmedBy: 'actor' })).toMatchObject({ phase: 'resolve', result: { ok: false } })
    state.round++
    expect(attempt(next)).toMatchObject({ phase: 'resolve', result: { ok: false } })
    // Failed continuations cannot consume another action or damage another target.
    expect(state.combatants.other.currentHp).toBe(30)
  })

  it('B5 preserves a custom-named transformation and restores the exact original body at concentration end', () => {
    const state = fixture()
    const activity = compile({ ...base, source: { kind: 'spell', id: 'custom-body' }, pattern: 'transformation', forms: [{ id: 'srd-5.1:wolf', label: 'Wolf' }], transformation: { target: 'target', profile: 'polymorph', durationRounds: 10, concentration: true, maximumChallengeRating: 'target-level-or-challenge-rating' } })
    const resolution = resolveDnd5eActivity({ activity, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants.target)], rolls: {}, choices: { form: 'srd-5.1:wolf' }, distanceFeetByTargetId: { target: 10 } })
    const commit = commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: activity.id, targetIds: ['target'], resolution, source: { kind: 'spell', id: 'custom-body', packageId: 'local.advanced' } })
    expect(commit.ok, JSON.stringify(commit)).toBe(true)
    reconcileDnd5eSourceLinkedRelations(commit.state)
    expect(commit.state.combatants.target.statBlockId).toBe('srd-5.1:wolf')
    expect(commit.state.combatants.target.currentHp).toBe(11)
    endDnd5eConcentration(commit.state, commit.state.combatants.actor, [])
    reconcileDnd5eSourceLinkedRelations(commit.state)
    expect(commit.state.combatants.target.currentHp).toBe(30)
    expect(commit.state.combatants.target.abilities).toEqual(state.combatants.target.abilities)
    expect(commit.state.combatants.target.classState.wildShapeFormId).toBeUndefined()
  })
})

for (const stopAfter of [1, 5]) it(`allows a terminal action after ${stopAfter} attacks and closes the chain`, () => {
  const rule = {nextActivityId:'next',finishActivityId:'finish',maximumSteps:5,excludePreviousTargets:true}
  const root = compile({...base,pattern:'roll-effect',result:{kind:'damage',amount:{kind:'constant',value:1},damageType:'force'},continuation:rule})
  const next = {...root,id:'next',requiresContinuationFrom:'root'}
  const finish = {...root,id:'finish',requiresContinuationFrom:'root',continuation:undefined}
  registerDnd5eActivityPackage({packageId:command.packageId,packageVersion:command.packageVersion,activities:[root,next,finish]})
  const state = fixture()
  for(let i=0;i<stopAfter;i++) {
    const step = {...command,commandId:`step-${i}`,activityId:i?'next':'root',targetIds:[`victim-${i}`],continuationId:i?'step-0':undefined}
    const pending = prepareDnd5eActivityContinuationV1(state,step,i?next:root,{})
    expect(pending.error).toBeUndefined()
    finishDnd5eActivityContinuationV1(state,step,i?next:root,{},[],pending.pending)
  }
  const end = {...command,commandId:'end',activityId:'finish',targetIds:['actor'],continuationId:'step-0'}
  const prepared = prepareDnd5eActivityContinuationV1(state,end,finish,{})
  expect(prepared.error).toBeUndefined()
  expect(prepared.pending?.visitedTargetIds).toHaveLength(stopAfter)
  const grants = state.combatants.actor.classState.activeEffects?.flatMap(e=>e.grantedActivities??[])
  expect(grants).toContain('finish')
  if(stopAfter===5) expect(grants).not.toContain('next')
  const expired = structuredClone(state);expired.round++
  expect(prepareDnd5eActivityContinuationV1(expired,end,finish,{}).error).toBe('invalid-or-expired-continuation')
  finishDnd5eActivityContinuationV1(state,end,finish,{},[],prepared.pending)
  expect(state.combatants.actor.classState.activeEffects?.flatMap(e=>e.grantedActivities??[])).toEqual([])
  expect(prepareDnd5eActivityContinuationV1(state,end,finish,{}).error).toBeTruthy()
  expect(prepareDnd5eActivityContinuationV1(state,{...end,activityId:'next',commandId:'late',targetIds:['unused']},next,{}).error).toBeTruthy()
})

it.each([1, 15])('native terminal movement preserves the complete attack batch despite misses and forged payload targets after archive import (%s)', async attack => {
  const root = compile({...base,target:{...base.target,count:2},pattern:'roll-effect',result:{kind:'damage',amount:{kind:'constant',value:1},damageType:'force'},continuation:{finishActivityId:'finish',maximumSteps:1,excludePreviousTargets:true}})
  root.checks = [{ id:'strike',kind:'attack-roll',rollId:'strike',scope:'per-target',rollMode:'normal',attackBonus:{kind:'constant',value:0},delivery:'melee' }]
  root.outcomes[0].when = {kind:'check',checkId:'strike',result:'success'}
  const finish = {...root,id:'finish',activation:{kind:'free' as const},target:{kind:'self' as const},checks:undefined,requiresContinuationFrom:'root',continuation:undefined,outcomes:[{id:'finish',when:{kind:'always' as const},operations:[{kind:'move' as const,id:'move',target:'actor' as const,mode:'teleport' as const,distanceFeet:{kind:'constant' as const,value:1000},continuationTargetRadiusFeet:5}]}]}
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format:'dndstars5e-unified-content',schemaVersion:1,
    manifest:{id:command.packageId,name:'Synthetic terminal batch',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only',contentCategory:'mixed'},
    assets:[],definitions:[{schemaVersion:1,namespace:command.packageId,version:'1.0.0',kind:'feature',id:'root',name:'Batch',automation:root.automation,
      payload:{id:'root',name:'Batch',summary:'Synthetic',description:'Synthetic fixture',automation:'full'},activities:[root,finish]}],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  expect(decoded.bundle.definitions[0].activities).toEqual([root,finish])
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const first=resolveDnd5eHeadlessAction(fixture(),{type:'plugin',pluginId:command.packageId,actionId:'root',featureId:'local.advanced:root',actorId:'actor',targetId:'target',targetIds:['target','other'],transactionId:'native-start',distanceFeet:10,rolls:{'strike:target':{values:[attack],modifier:0,total:attack},'strike:other':{values:[15],modifier:0,total:15}}})
    expect(first.ok,JSON.stringify(first)).toBe(true)
    expect(first.state.combatants.target.currentHp).toBe(attack===1?30:29)
    expect(first.state.combatants.other.currentHp).toBe(29)
    const end=resolveDnd5eHeadlessAction(first.state,{type:'plugin',pluginId:command.packageId,actionId:'finish',featureId:'local.advanced:root',actorId:'actor',targetId:'actor',targetIds:['actor'],transactionId:'native-end',hostEntitlement:{kind:'active-effect',effectId:'continuation:native-start'},rolls:{},payload:{continuationTargetIds:['actor'],activityContinuationId:'native-start'}})
    expect(end.ok,JSON.stringify(end)).toBe(true)
    expect(JSON.stringify(end)).toContain('"continuationTargetIds":["target","other"]')
    expect(end.state.combatants.actor.classState.activeEffects?.flatMap(e=>e.grantedActivities??[])).toEqual([])
  } finally {dispose()}
})

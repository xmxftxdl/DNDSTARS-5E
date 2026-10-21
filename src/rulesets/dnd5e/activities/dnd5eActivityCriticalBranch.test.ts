import { dnd5eActivityAttackDamageRollBudgets, dnd5eAttackDamageRollBudgets } from '../attackDamageRollBudget'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const actor={id:'actor',controller:'player',level:3,proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,conditions:[],
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10}}
function activity():Dnd5eActivityDefinitionV1 {
  return {schemaVersion:1,id:'two-attacks',name:'Two attacks',activation:{kind:'free'},
    automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'creature',count:2,relation:'any',rangeFeet:30},
    checks:['a','b'].map(id=>({id,kind:'attack-roll',rollId:id,scope:'per-target',rollMode:'normal',attackBonus:{kind:'constant',value:10}})),
    outcomes:['a','b'].map(id=>({id,when:{kind:'check',checkId:id,result:'success'},operations:[{id,kind:'damage',target:'target',damageType:'fire',critical:'double-dice',amount:{kind:'dice',rollId:`damage-${id}`,count:1,sides:6}}]}))}
}
it.each([false,true])('does not borrow a different attack critical (superset=%s)',superset=>{
  const result=resolveDnd5eActivity({activity:activity(),actor,targets:[{...actor,id:'target',controller:'dm'}],distanceFeetByTargetId:{target:5},
    allowCriticalDiceSuperset:superset,rolls:{'a:target':{values:[20]},'b:target':{values:[15]},'damage-a':{values:[2,3]},'damage-b':{values:superset?[4,6]:[4]}}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(!result.ok)return
  const damage=result.proposals.filter(p=>p.kind === 'deal-damage')
  expect(damage.map(p=>p.amount)).toEqual([5,4])
  expect(damage.map(p=>p.attackCheckKeys)).toEqual([['a:target'],['b:target']])
})
it.each(['always','actor','all-targets'] as const)('keeps critical attribution scoped for %s damage',mode=>{
  const definition=activity();definition.checks=definition.checks!.slice(0,1);definition.outcomes=definition.outcomes.slice(0,1)
  const operation=definition.outcomes[0].operations[0]
  if(operation.kind !== 'damage')throw Error('Expected damage')
  if(mode === 'always')definition.outcomes[0].when={kind:'always'}
  else operation.target=mode
  const result=resolveDnd5eActivity({activity:definition,actor,targets:[{...actor,id:'crit',controller:'dm'},{...actor,id:'normal',controller:'dm'}],
    distanceFeetByTargetId:{crit:5,normal:5},allowCriticalDiceSuperset:true,
    rolls:{'a:crit':{values:[20]},'a:normal':{values:[15]},'damage-a':{values:[2,3]}}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(!result.ok)return
  const damage=result.proposals.filter(p=>p.kind === 'deal-damage')
  expect(damage.map(p=>p.amount)).toEqual(mode === 'actor' ? [2] : mode === 'always' ? [2,2] : [5,2])
  expect(damage.map(p=>p.attackCheckKeys)).toEqual(mode === 'actor' ? [undefined] : mode === 'always' ? [undefined,undefined] : [['a:crit'],['a:normal']])
})

it.each(['registered','compiled'] as const)('preserves per-attack critical damage after archive export/import through %s',async entry=>{
  const namespace='test.critical-branches',definition=activity()
  definition.legacySource={kind:'feature',id:definition.id}
  const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],
    manifest:{id:namespace,name:'Critical branches',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only'},
    definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:definition.id,name:definition.name,
      automation:automationCapabilityFromLegacyStatus('full'),payload:{id:definition.id,name:definition.name,summary:'Test',description:'Test',automation:'full'},activities:[definition]}]}
  const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const make=(id:string,initiative:number)=>createDnd5eCombatant({...actor,id,name:id,initiative,controller:id === 'actor' ? 'player' : 'dm',
      temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:id === 'actor' ? [`${namespace}:${definition.id}`] : []})
    let state=startDnd5eHeadlessCombat('branches',[make('actor',20),make('target',10)])
    const moved=resolveDnd5eHeadlessAction(state,{type:'move',actorId:'actor',to:{x:10,y:0},distance:10,straightLine:true})
    expect(moved.ok).toBe(true)
    state=JSON.parse(JSON.stringify(moved.state))
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:5}
    const rolls={'a:target':{values:[20],modifier:0,total:20},'b:target':{values:[15],modifier:0,total:15},
      'damage-a':{values:[2,3],modifier:0,total:5},'damage-b':{values:entry === 'compiled' ? [4,6] : [4],modifier:0,total:entry === 'compiled' ? 10 : 4}}
    const result=entry === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,confirmedBy:'actor',authoritativeRolls:rolls,
      command:{schemaVersion:1,commandId:'branches',actorId:'actor',packageId:namespace,packageVersion:'1.0.0',activityId:definition.id,targetIds:['target'],expectedRevision:1}}).result
      : resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:namespace,actionId:definition.id,featureId:`${namespace}:${definition.id}`,actorId:'actor',targetId:'target',targetIds:['target'],distanceFeet:5,rolls})
    expect(result.ok,result.ok ? undefined : result.reason).toBe(true)
    if(!result.ok)throw Error(result.reason)
    expect(result.state.combatants.target.currentHp).toBe(21)
    const attacks=result.events.filter(e=>e.type === 'attack-resolved')
    expect(attacks.map(e=>e.damageType)).toEqual(['fire','fire'])
    expect(attacks.map(e=>e.precedingStraightMovementFeet)).toEqual([10,undefined])
    expect(result.state.combatants.actor.classState.straightMovementStreak).toBeUndefined()
    expect(attacks.map(e=>dnd5eAttackDamageRollBudgets.get(e)?.claimed)).toEqual([true,true])
    expect(dnd5eAttackDamageRollBudgets.get(attacks[0])).not.toBe(dnd5eAttackDamageRollBudgets.get(attacks[1]))
    expect(dnd5eAttackDamageRollBudgets.get(JSON.parse(JSON.stringify(attacks[0])))).toBeUndefined()
    const evidence=result.events.filter(e=>e.type === 'activity-formula-roll-resolved')
    expect(evidence.map(e=>e.attackCheckKeys)).toEqual([['a:target'],['b:target']])
    expect(evidence.map(e=>e.dice[0].count)).toEqual([2,1])
    expect(state.combatants.target.currentHp).toBe(30)
  } finally {dispose()}
})

it.each(['target','actor'] as const)('inherits a triggering critical only for eligible recipients: %s',recipient=>{
  const definition=activity();definition.checks=[];definition.outcomes=definition.outcomes.slice(0,1)
  definition.outcomes[0].when={kind:'always'}
  const operation=definition.outcomes[0].operations[0]
  if(operation.kind !== 'damage')throw Error('Expected damage')
  operation.target=recipient
  definition.invocation={kind:'triggered',event:'attack-hit',confirmation:'automatic'}
  const result=resolveDnd5eActivity({activity:definition,actor,targets:[{...actor,id:'target',controller:'dm'}],distanceFeetByTargetId:{target:5},
    confirmedBy:'system',triggerContext:{eventId:'hit',event:'attack-hit',source:{kind:'attack',mode:'melee',result:'critical-hit'},eligibleActorIds:['actor'],eligibleTargetIds:['target']},
    allowCriticalDiceSuperset:true,rolls:{'damage-a':{values:[2,3]}}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok)expect(result.proposals.filter(p=>p.kind === 'deal-damage').map(p=>p.amount)).toEqual([recipient === 'target' ? 5 : 2])
})


it.each(['fixed','rolled','grant-source'] as const)('preserves attack damage ownership and pool identity: %s',mode=>{
  const definition=activity()
  if(mode !== 'rolled')for(const outcome of definition.outcomes){
    const operation=outcome.operations[0]
    if(operation.kind === 'damage')operation.amount={kind:'constant',value:4}
  }
  const result=resolveDnd5eActivity({activity:definition,actor,targets:[{...actor,id:'target',controller:'dm'}],distanceFeetByTargetId:{target:5},
    rolls:{'a:target':{values:[15]},'b:target':{values:[15]},'damage-a':{values:[4]},'damage-b':{values:[4]}}})
  if(!result.ok)throw Error(JSON.stringify(result))
  const damage=result.proposals.filter(p=>p.kind === 'deal-damage')
  if(mode === 'grant-source')damage[0].damageSource='grant-source'
  const budgets=dnd5eActivityAttackDamageRollBudgets(result.checks,damage)
  expect(budgets.get('a:target')?.budget.claimed).toBe(mode !== 'fixed')
  expect(budgets.get('b:target')?.budget.claimed).toBe(mode === 'rolled')
  expect(budgets.get('a:target')?.damageType).toBe('fire')
  expect(budgets.get('a:target')?.budget).not.toBe(budgets.get('b:target')?.budget)
  const joint=dnd5eActivityAttackDamageRollBudgets(result.checks,[...damage,{...damage[0],attackCheckKeys:['a:target','b:target']}])
  expect(joint.get('a:target')?.budget).toBe(joint.get('b:target')?.budget)
  expect(joint.get('b:target')?.budget.claimed).toBe(mode !== 'fixed')
  const legacy=dnd5eActivityAttackDamageRollBudgets(result.checks,[{...damage[0],attackCheckKeys:undefined}])
  expect([...legacy.values()].map(e=>e.budget.claimed)).toEqual([true,true])
  expect([...legacy.values()].map(e=>e.damageType)).toEqual([undefined,undefined])
  const unrelated=dnd5eActivityAttackDamageRollBudgets(result.checks,[{...damage[0],targetId:'actor'},{...damage[1],attackDamage:undefined}])
  expect([...unrelated.values()].map(e=>e.budget.claimed)).toEqual([false,false])
})

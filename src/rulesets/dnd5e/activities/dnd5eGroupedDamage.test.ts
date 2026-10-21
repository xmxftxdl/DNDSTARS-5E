import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { createDnd5eActivityDamageCommitSession, createDnd5eDamageCommitSession } from '../damageCommitSession'
import { validDnd5eActivityDamageGroup } from './dnd5eActivityDamageGroups'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
const namespace = 'test.damage-group'
const activity: Dnd5eActivityDefinitionV1 = {
 schemaVersion: 1, id: 'group', name: 'Grouped damage', activation: {kind:'action'},
 legacySource:{kind:'feature',id:'group'}, automation:automationCapabilityFromLegacyStatus('full'),
 target:{kind:'creature',relation:'any',count:1}, consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],
 checks:[{id:'save',rollId:'save',kind:'saving-throw',ability:'dex',dc:{kind:'constant',value:13},scope:'per-target',rollMode:'host-derived'}],
 outcomes: (['success','failure'] as const).map(result=>({id:result,when:{kind:'check',checkId:'save',result},operations:[
  {id:result+'-weapon',kind:'damage',target:'target',damageType:'piercing',magical:true,damageGroup:{id:result,multiplier:result==='success'?0.5:1},amount:{kind:'dice',rollId:'weapon',count:1,sides:10}},
  {id:result+'-extra',kind:'damage',target:'target',damageType:'force',magical:true,damageGroup:{id:result,multiplier:result==='success'?0.5:1},amount:{kind:'dice',rollId:'extra',count:1,sides:6}},
 ]})),
}
it('rejects incompatible or interrupted damage groups at import',()=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 for(const mutation of [
  (a:any)=>a.outcomes[0].operations[1].damageGroup.multiplier=1,
  (a:any)=>a.outcomes[0].operations[1].magical=false,
  (a:any)=>a.outcomes[0].operations.splice(1,0,{id:'position',kind:'reveal-target-location',target:'target'}),
  (a:any)=>a.outcomes[0].operations.pop(),
  (a:any)=>a.target.count=2,
  (a:any)=>a.outcomes[0].operations[0].damageGroup.multiplier=2,
  (a:any)=>a.outcomes[0].operations.forEach((op:any)=>op.damageGroup.multiplier=2),
  (a:any)=>a.outcomes[0].operations.forEach((op:any)=>op.damageGroup.id='invalid id'),
 ]){const malformed=structuredClone(activity);mutation(malformed);expect(validateDnd5eActivityDefinitionV1(malformed).length).toBeGreaterThan(0)}
})
it('exports/reimports and settles one typed occurrence through direct and compiled Host paths',async()=>{
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,
 manifest:{id:namespace,name:'Grouped damage',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],
 definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'group',name:'Grouped damage',automation:activity.automation,activities:[activity],payload:{id:'group',name:'Grouped damage',summary:'Synthetic',description:'Synthetic',automation:'full'}}]}
 const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 try{
 const cases=[
  {res:[],imm:[],vul:[],half:6,full:12},
  {res:['piercing'],imm:[],vul:[],half:3,full:7},
  {res:['force'],imm:[],vul:[],half:4,full:10},
  {res:['piercing','force'],imm:[],vul:[],half:2,full:5},
  {res:[],imm:['piercing'],vul:[],half:1,full:3},
  {res:[],imm:['force'],vul:[],half:4,full:9},
  {res:[],imm:['piercing','force'],vul:[],half:0,full:0},
  {res:[],imm:[],vul:['piercing'],half:10,full:21},
  {res:[],imm:[],vul:['force'],half:7,full:15},
  {res:[],imm:[],vul:['piercing','force'],half:12,full:24},
  {res:['piercing'],imm:[],vul:['piercing'],half:5,full:11},
 ] as const
 for(const defense of cases)for(const save of [1,20])for(const temporaryHp of [0,5]){
  const actors=['actor','target'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:20-i,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:i?temporaryHp:0,speed:30,position:{x:i*50,y:0},concentrating:false,pluginFeatureIds:i?[]:[namespace+':group']}))
  const state=startDnd5eHeadlessCombat('group',actors)
  state.combatants.target.damageResistances=[...defense.res];state.combatants.target.damageImmunities=[...defense.imm];state.combatants.target.damageVulnerabilities=[...defense.vul]
  const before=JSON.stringify(state)
  const rolls={weapon:{values:[9],modifier:0,total:9},extra:{values:[3],modifier:0,total:3},'save:target':{values:[save],modifier:0,total:save}}
  const direct=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command:{schemaVersion:1,commandId:'group',actorId:'actor',packageId:namespace,packageVersion:'1.0.0',activityId:'group',targetIds:['target'],expectedRevision:1},authoritativeRolls:rolls,confirmedBy:'actor'})
  const compiled=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:namespace,actionId:'group',featureId:namespace+':group',actorId:'actor',targetId:'target',targetIds:['target'],rolls,payload:{}})
  for(const result of [direct.result,compiled]){
   expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error('group resolution failed')
   const amount=save===20?defense.half:defense.full
   expect(result.state.combatants.target.currentHp).toBe(100-Math.max(0,amount-temporaryHp))
   expect(result.state.combatants.target.temporaryHp).toBe(Math.max(0,temporaryHp-amount))
   expect(result.events.filter(e=>e.type==='damage-applied')).toHaveLength(1)
   expect(result.events.filter(e=>e.type==='activity-formula-roll-resolved').map(e=>'total'in e?e.total:undefined)).toEqual([9,3])
   expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
   expect(JSON.parse(JSON.stringify(result.state)).combatants.target.currentHp).toBe(result.state.combatants.target.currentHp)
  }
  expect(JSON.stringify(state)).toBe(before)
 }
 }finally{dispose()}
})

it('rejects malformed Host group packets before settlement',()=>{
 const components=[{operationId:'first',amount:9,damageType:'piercing'},{operationId:'second',amount:3,damageType:'force'}] as const
 expect(validDnd5eActivityDamageGroup(components,0.5)).toBe(true)
 for(const invalid of [[],[null], [components[0],null], [components[0],components[0]], [components[0],{...components[1],amount:0.5}], [components[0],{...components[1],damageType:'fake'}], [components[0],{...components[1],amount:1_000_001}]]) expect(validDnd5eActivityDamageGroup(invalid as any,0.5)).toBe(false)
 expect(validDnd5eActivityDamageGroup(components,2)).toBe(false)
 expect(validDnd5eActivityDamageGroup(undefined,0.5)).toBe(false)
 expect(validDnd5eActivityDamageGroup(undefined,undefined)).toBe(true)
})

it.each(['temporary-hp','resistance','immunity','vulnerability','decline','cancel','stale'] as const)('keeps one grouped occurrence across pause/replay (%s)', async mode=>{
 const guarded: Dnd5eActivityDefinitionV1={schemaVersion:1,id:'guard',name:'Guard',activation:{kind:'reaction'},target:{kind:'self'},
  legacySource:{kind:'feature',id:'guard'},automation:activity.automation,
  invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},
  consumption:[{kind:'resource',resourceId:namespace+':guard-uses',amount:{kind:'constant',value:1},consumeOn:'confirm'}],
  effects:[{schemaVersion:1,id:'guard-effect',name:'Guard effect',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},stacking:'replace',modifiers:
   mode==='resistance'?[{kind:'damage-resistance',damageType:'piercing'}]:mode==='immunity'?[{kind:'damage-immunity',damageType:'piercing'}]:mode==='vulnerability'?[{kind:'damage-vulnerability',damageType:'piercing'}]:[]}],
  outcomes:[{id:'protect',when:{kind:'always'},operations:[{id:'lifetime',kind:'apply-effect',target:'actor',effectId:'guard-effect'},
   ...(mode==='temporary-hp'?[{id:'temporary',kind:'temporary-hit-points' as const,target:'actor' as const,amount:{kind:'constant' as const,value:5},sourceEffectId:'guard-effect'}]:[])]}],
 }
 const charged={...activity,consumption:[...activity.consumption??[],{kind:'resource' as const,resourceId:namespace+':shot-uses',amount:{kind:'constant' as const,value:1},consumeOn:'confirm' as const}]}
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,
 manifest:{id:namespace,name:'Grouped damage',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],
 definitions:[charged,guarded].map(a=>({schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:a.id,name:a.name,automation:a.automation,activities:[a],payload:{id:a.id,name:a.name,summary:'Synthetic',description:'Synthetic',automation:'full',resources:[{id:a.id==='group'?'shot-uses':'guard-uses',label:'Uses',maximum:1,resetOn:'short-rest'}]}}))}
 const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 try{for(const route of ['direct','compiled']){
  const actors=['actor','target'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:20-i,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:i*50,y:0},concentrating:false,pluginFeatureIds:[namespace+(i?':guard':':group')]}))
  const state=startDnd5eHeadlessCombat('group-reaction',actors)
  state.combatants.actor.classResources[namespace+':shot-uses']={current:1,max:1}
  state.combatants.target.classResources[namespace+':guard-uses']={current:1,max:1}
  const before=structuredClone(state)
  const rolls={weapon:{values:[9],modifier:0,total:9},extra:{values:[3],modifier:0,total:3},'save:target':{values:[20],modifier:0,total:20}}
  let offers=0
  const pause=()=>{offers++;return true}
  const session=route==='direct'?createDnd5eActivityDamageCommitSession({state,combatRevision:1,command:{schemaVersion:1,commandId:'group',actorId:'actor',packageId:namespace,packageVersion:'1.0.0',activityId:'group',targetIds:['target'],expectedRevision:1},authoritativeRolls:rolls,confirmedBy:'actor'},pause)
   :createDnd5eDamageCommitSession(state,{type:'plugin',pluginId:namespace,actionId:'group',featureId:namespace+':group',actorId:'actor',targetId:'target',targetIds:['target'],rolls,payload:{}},pause)
  const pending=session.run(state)
  expect(pending.status,JSON.stringify(pending)).toBe('pending');if(pending.status!=='pending')throw Error('missing grouped checkpoint')
  expect(pending.checkpoint).toMatchObject({amount:6,damageTypes:['piercing','force'],occurrence:0,phase:'raw-typed-damage-before-defenses'})
  expect(state).toEqual(before)
  if(mode==='cancel'){
   session.cancel();expect(session.decline(state,pending.checkpoint)).toMatchObject({status:'rejected',reason:'session-ended'});expect(state).toEqual(before);continue
  }
  if(mode==='stale'){
   state.combatants.target.currentHp=99;expect(session.decline(state,pending.checkpoint)).toMatchObject({status:'rejected',reason:'stale-state'});expect(state.combatants.actor.classResources[namespace+':shot-uses'].current).toBe(1);continue
  }
  expect(session.decline(state,{...pending.checkpoint,amount:5})).toMatchObject({status:'rejected',reason:'stale-checkpoint'})
  rolls.weapon.values=[1];rolls.extra.values=[1]
  const outcome=mode==='decline'?session.decline(state,pending.checkpoint):session.accept(state,pending.checkpoint,{
   command:{schemaVersion:1,commandId:'guard',actorId:'target',packageId:namespace,packageVersion:'1.0.0',activityId:'guard',targetIds:['target'],expectedRevision:1,triggerEventId:pending.triggerEventId},combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',
  })
  expect(outcome.status,JSON.stringify(outcome)).toBe('resolved');if(outcome.status!=='resolved')throw Error('group did not settle')
  const result='phase' in outcome.result?outcome.result.result:outcome.result
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error('group failed')
  const hp={decline:94,'temporary-hp':99,resistance:97,immunity:99,vulnerability:90}[mode]
  expect(result.state.combatants.target.currentHp).toBe(hp)
  expect(result.events.filter(e=>e.type==='damage-applied')).toHaveLength(1)
  expect(result.state.combatants.actor.classResources[namespace+':shot-uses'].current).toBe(0)
  expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
  expect(result.state.combatants.target.classResources[namespace+':guard-uses'].current).toBe(mode==='decline'?1:0)
  expect(result.state.combatants.target.turn.reactionAvailable).toBe(mode==='decline')
  expect(offers).toBe(1)
  expect(session.decline(state,pending.checkpoint)).toMatchObject({status:'rejected',reason:'session-ended'})
  expect(state).toEqual(before)
 }}finally{dispose()}
})

it.each(['early-reduction','reduction','resistance','transfer'] as const)('settles grouped %s once with a declared protector', async mode=>{
 const guardPlugin='test.group-protector', subclass=guardPlugin+':protector', featureId=subclass+'.guard'
 const disposeGuard=registerDnd5eRulesPlugin({manifest:{id:guardPlugin,name:'Synthetic protector',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0'},setup(api){
  api.registerDeclarativeSubclass({schemaVersion:1,id:'protector',classId:'fighter',name:'Synthetic protector',summary:'Test only',abilities:[{
   schemaVersion:1,id:'guard',name:'Guard',description:'Synthetic mitigation',level:3,trigger:{kind:'before-damage-taken'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'ally',rangeFeet:30,includeSelf:true},effects:[],automation:'full',
   mechanic:mode==='resistance'?{kind:'damage-mitigation-interrupt',mode:'resistance',protects:'ally-or-self',damageTypes:['piercing','force']}:
    {kind:'damage-mitigation-interrupt',mode:mode==='transfer'?'transfer':'reduction',protects:'ally-or-self',maximumAmount:5,...(mode==='early-reduction'?{reductionTiming:'before-defenses' as const}:{})},
  }]})
 }})
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,
 manifest:{id:namespace,name:'Grouped damage',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],
 definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'group',name:'Grouped damage',automation:activity.automation,activities:[activity],payload:{id:'group',name:'Grouped damage',summary:'Synthetic',description:'Synthetic',automation:'full'}}]}
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1((await readDnd5eStarMod(await exportDnd5eStarMod(bundle))).bundle))
 try{
  const actors=['actor','target','protector'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:20-i,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:i*5,y:0},concentrating:false,pluginFeatureIds:i===0?[namespace+':group']:i===2?[featureId]:[],...(i===2?{level:3,classId:'fighter',classLevels:{fighter:3},subclassId:subclass,subclassIds:{fighter:subclass}}:{})}))
  const state=startDnd5eHeadlessCombat('group-mitigation',actors),before=structuredClone(state)
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('protector','target')]:5,[dnd5eCombatantPairKey('actor','target')]:5}
  const action={type:'plugin' as const,pluginId:namespace,actionId:'group',featureId:namespace+':group',actorId:'actor',targetId:'target',targetIds:['target'],rolls:{weapon:{values:[9],modifier:0,total:9},extra:{values:[3],modifier:0,total:3},'save:target':{values:[20],modifier:0,total:20}},payload:{},damageMitigationInterrupts:[{sourceId:'protector',targetId:'target',featureId}]}
  const result=resolveDnd5eHeadlessAction(state,action)
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error('mitigation failed')
  expect(result.state.combatants.target.currentHp).toBe(mode==='resistance'?98:99)
  expect(result.state.combatants.protector.currentHp).toBe(mode==='transfer'?95:100)
  expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
  expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.actorId==='protector'&&e.resource==='reaction')).toHaveLength(1)
  expect(result.events.filter(e=>e.type==='damage-applied'&&e.targetId==='target')).toHaveLength(1)
  if(mode!=='resistance')expect(result.events.filter(e=>e.type==='damage-mitigation-interrupt-applied').reduce((sum,e)=>sum+('prevented'in e?e.prevented:0),0)).toBe(5)
  const retry=resolveDnd5eHeadlessAction(result.state,action)
  expect(retry.ok).toBe(false);expect(retry.state.combatants.target.currentHp).toBe(result.state.combatants.target.currentHp)
  expect(state.combatants).toEqual(before.combatants)
 }finally{dispose();disposeGuard()}
})

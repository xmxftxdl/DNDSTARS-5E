import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from '../unifiedContent'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,type Dnd5eAction} from '../headlessCombatEngine'
import {createDnd5eRegisteredWeaponHitSession} from './dnd5eRegisteredWeaponHitSession'
import {resolveDnd5eActionWithDamageReactions} from '../damageReactionFlow'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

it.each([false,true])('commits shared hit damage and self AC atomically (critical=%s)',async critical=>{
 const ns='test.hit-defense',full=automationCapabilityFromLegacyStatus('full')
 const die={kind:'dice' as const,rollId:'inspiration',count:1,sides:6}
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'defense',name:'Defense',activation:{kind:'free'},
  invocation:{kind:'triggered',event:'attack-hit',confirmation:'actor-choice',retention:'single-event'},target:{kind:'creature',relation:'enemy',count:1},
  requirements:[{kind:'once-per-turn',key:'flourish'},{kind:'turn-owner',owner:'actor'},{kind:'attack-origin',origins:['attack-action']},{kind:'attack-weapon-category',categories:['simple','martial']}],
  consumption:[{kind:'resource',resourceId:'inspiration',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
  effects:[{schemaVersion:1,id:'ac',name:'Defense',stacking:'replace',duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-start'},modifiers:[{kind:'armor-class',mode:'add',value:die}]}],
  outcomes:[{id:'hit',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:die,damageType:'inherit-primary',critical:'double-dice'},
   {id:'ac',kind:'apply-effect',target:'actor',effectId:'ac'}]}],automation:full,legacySource:{kind:'feature',id:'defense'}}
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:ns,name:'Defense',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],definitions:[{
  schemaVersion:1,namespace:ns,version:'1.0.0',kind:'feature',id:'defense',name:'Defense',automation:full,activities:[activity],payload:{id:'defense',name:'Defense',summary:'Synthetic',description:'Synthetic',automation:'full'}}]}
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
 try{
  const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:id==='actor'?'player':'dm',initiative:id==='actor'?20:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,classResources:{inspiration:{current:2,max:2}}})
  const actor=make('actor'),target=make('target');actor.pluginFeatureIds=[ns+':defense'];target.damageResistances=['slashing']
  const state=startDnd5eHeadlessCombat('defense',[actor,target]),before=structuredClone(state)
  const attack:Dnd5eAction={type:'attack',actorId:'actor',targetId:'target',attackModifier:5,d20:critical?20:18,damage:{count:1,sides:6,bonus:0,rolls:critical?[3,3]:[3],type:'slashing'},classDamageContext:{mode:'melee',weaponId:'sword',weaponCategory:'martial',weaponDamageSides:6,finesse:false,strengthBased:true,damageType:'slashing',adjacentEnemyOfTarget:false}}
  for(const accepted of [false,true]){
   const session=createDnd5eRegisteredWeaponHitSession({state,action:attack,combatRevision:1,packageId:ns,packageVersion:'1.0.0',activityId:'defense',eventBatchId:'hit'})
   const pending=session.run(state);expect(pending.status,JSON.stringify(pending)).toBe('pending')
   const done=session.resume(state,accepted,{inspiration:{values:critical?[3,5]:[3]}})
   expect(done.status).toBe('resolved');if(done.status!=='resolved')throw Error('pending')
   expect(done.result.ok,JSON.stringify(done.result)).toBe(true)
   let current=JSON.parse(JSON.stringify(done.result.state))
   expect(current.combatants.actor.classResources.inspiration.current).toBe(accepted?1:2)
   expect(current.combatants.target.currentHp).toBe(30-Math.floor(((critical?6:3)+(accepted?(critical?8:3):0))/2))
   expect(current.combatants.actor.classState.activeEffects?.some((e:any)=>e.modifiers?.armorClassBonus===3)??false).toBe(accepted)
   expect(done.result.events.filter(e=>e.type==='damage-applied')).toHaveLength(1)
   const ended=resolveDnd5eHeadlessAction(current,{type:'end-turn',actorId:'actor'});expect(ended.ok).toBe(true);current=ended.state
   const enemyAttack=resolveDnd5eHeadlessAction(current,{type:'attack',actorId:'target',targetId:'actor',attackModifier:0,d20:11,damage:{count:1,sides:4,bonus:0,rolls:accepted?[]:[2],type:'piercing'}})
   expect(enemyAttack.ok,JSON.stringify(enemyAttack)).toBe(true)
   expect(enemyAttack.state.combatants.actor.currentHp).toBe(accepted?30:28)
   const next=resolveDnd5eHeadlessAction(enemyAttack.state,{type:'end-turn',actorId:'target'});expect(next.ok).toBe(true)
   expect(next.state.combatants.actor.classState.activeEffects?.some(e=>e.modifiers?.armorClassBonus===3)??false).toBe(false)
  }
  const prompts:string[]=[]
  const driven=await resolveDnd5eActionWithDamageReactions({state,action:attack,combatRevision:1,authorityUnchanged:()=>true,
   confirm:async request=>{prompts.push(request.activity.id);return {accepted:true}},roll:async request=>Array(request.count).fill(3)})
  expect(driven.ok,JSON.stringify(driven)).toBe(true)
  expect(prompts).toEqual(['defense'])
  expect(driven.state.combatants.actor.classResources.inspiration.current).toBe(1)
  expect(driven.state.combatants.actor.classState.activeEffects?.some(e=>e.modifiers?.armorClassBonus===3)).toBe(true)
  expect(state).toEqual(before)
 }finally{dispose()}
},20000)

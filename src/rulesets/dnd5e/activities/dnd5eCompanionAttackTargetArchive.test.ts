import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {exportDnd5eStarMod,readDnd5eStarMod} from '../starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from '../unifiedContent'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from '../headlessCombatEngine'
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type { Dnd5eCompanionAttackKind } from '../companionAttackKind'

it.each((['registered','compiled'] as const).flatMap(path=>[undefined,'weapon','grapple','shove-prone','shove-push'].map(attackKind=>({path,attackKind:attackKind as Dnd5eCompanionAttackKind|undefined}))))('binds imported attack kind and target: $path $attackKind',async ({path,attackKind})=>{
 const namespace='test.chosen-attack',automation=automationCapabilityFromLegacyStatus('full')
 const activity:any={schemaVersion:1,id:'order',name:'Order',activation:{kind:'bonus-action'},automation,legacySource:{kind:'feature',id:'order'},
  target:{kind:'creature',count:2,relation:'any',rangeFeet:60},
  consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],
  outcomes:[{id:'order',when:{kind:'always'},operations:[{id:'order',kind:'command-owned-companion',target:'target',sourceActivityId:'summon',command:'attack',requiresAttackTarget:true,allowsMovementDestination:true}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 activity.outcomes[0].operations[0].attackKind=attackKind
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(validateDnd5eActivityDefinitionV1({...activity,outcomes:[{...activity.outcomes[0],operations:[{...activity.outcomes[0].operations[0],command:'dodge'}]}]}).length).toBeGreaterThan(0)
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:namespace,name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only'},
  definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'order',name:'Order',automation,payload:{id:'order',name:'Order',summary:'Synthetic',description:'Synthetic',automation:'full'},activities:[activity]}]}
 const archive=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 expect(archive.bundle.definitions[0].activities).toEqual([activity])
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(archive.bundle))
 try{
  const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:id==='owner'?'player':'dm',initiative:id==='owner'?20:10,
   abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,
   pluginFeatureIds:id==='owner'?[namespace+':order']:[]})
  const current=startDnd5eHeadlessCombat('test',['owner','first','second','chosen','other'].map(make))
  for(const id of ['first','second'])Object.assign(current.combatants[id],{summonedSourceCombatantId:'owner',summonedSourcePackageId:namespace,summonedSourceActivityId:'summon',summonedCommandPolicy:'persistent-order'})
  current.distanceFeetByCombatantPair=Object.fromEntries(['first','second'].map(id=>[dnd5eCombatantPairKey('owner',id),30]))
  current.companionScene={geometry:null,projectedTokenIds:[],map:{id:'scene',name:'Scene',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
   tokens:['first','second'].map((id,index)=>({id,label:id,type:'enemy' as const,size:1,x:25+index*50,y:25,emoji:'',color:''}))}}
  const run=(state:typeof current,chosen:unknown,movement?:unknown)=>path==='registered'?resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,confirmedBy:'actor',authoritativeRolls:{},
   command:{schemaVersion:1,commandId:'order',actorId:'owner',packageId:namespace,packageVersion:'1.0.0',activityId:'order',targetIds:['first','second'],expectedRevision:1,companionAttackTargets:chosen as any,companionMovementDestinations:movement as any}}).result:
   resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:namespace,featureId:namespace+':order',actionId:'order',actorId:'owner',targetId:'first',targetIds:['first','second'],distanceFeet:30,payload:{companionAttackTargets:chosen as any,companionMovementDestinations:movement as any}})
  const destinations={order:{first:{mapId:'scene',x:125,y:125},second:{mapId:'scene',x:225,y:125}}}
  const moving=run(current,{order:'chosen'},destinations)
  expect(moving.ok,JSON.stringify(moving)).toBe(true)
  if(moving.ok){
   const restored=JSON.parse(JSON.stringify(moving.state)) as typeof current
   for(const id of ['first','second'] as const){
    expect(restored.combatants[id].classState.companionCommand?.movementDestination).toEqual(destinations.order[id])
    expect(restored.combatants[id].position).toEqual(current.combatants[id].position)
   }
   expect(restored.combatants.owner.turn.bonusActionAvailable).toBe(false)
   expect(restored.combatants.owner.turn.actionAvailable).toBe(true)
  }
  for(const destination of [{mapId:'other',x:125,y:125},{mapId:'scene',x:500,y:125},{mapId:'scene',x:-1,y:125},{mapId:'scene',x:NaN,y:125},{mapId:'scene',x:125,y:125,teleport:true}]){
   const before=structuredClone(current)
   expect(run(current,{order:'chosen'},{order:{...destinations.order,second:destination}}).ok).toBe(false)
   expect(current).toEqual(before)
  }
  const held=run(current,{order:'chosen'},{order:{first:null,second:null}})
  expect(held.ok).toBe(true)
  if(held.ok)expect(held.state.combatants.first.classState.companionCommand?.movementDestination).toBeUndefined()
  for(const selected of [undefined,{},[],{order:'missing'},{order:'first'},{order:1}]){
   const before=structuredClone(current);expect(run(current,selected).ok).toBe(false);expect(current).toEqual(before)
  }
  const dead=structuredClone(current);dead.combatants.chosen.currentHp=0;dead.combatants.chosen.deathSaves.dead=true
  expect(run(dead,{order:'chosen'}).ok).toBe(false)
  const result=run(current,{order:'chosen'});expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
  expect(result.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
  for(const id of ['first','second'])expect(result.state.combatants[id].classState.companionCommand).toMatchObject({attackTargetId:'chosen',command:'attack',persistentOrder:true})
  for(const id of ['first','second'])expect(result.state.combatants[id].classState.companionCommand?.attackKind).toBe(attackKind)
  const saved=JSON.parse(JSON.stringify(result.state)) as typeof current
  saved.initiativeIndex=saved.initiativeOrder.indexOf('first')
  const attack=(targetId:string)=>resolveDnd5eHeadlessAction(saved,{type:'attack',actorId:'first',targetId,attackModifier:5,d20:15,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}})
  expect(attack('other').ok).toBe(false)
  if(attackKind && attackKind!=='weapon'){
   expect(attack('chosen').ok).toBe(false)
   saved.combatants.chosen.position={x:5,y:0}
   saved.combatants.chosen.controller='player'
   saved.distanceFeetByCombatantPair![dnd5eCombatantPairKey('first','chosen')]=5
   const special=(targetId:string)=>resolveDnd5eHeadlessAction(saved,attackKind==='grapple'
    ?{type:'grapple',actorId:'first',targetId,actorD20:20,targetD20:1,targetDefense:'athletics'}
    :{type:'shove',actorId:'first',targetId,actorD20:20,targetD20:1,targetDefense:'athletics',outcome:attackKind==='shove-prone'?'prone':'push',pushTo:{x:10,y:0},pushDistanceFeet:5})
   expect(special('other').ok).toBe(false)
   const resolved=special('chosen')
   expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
   if(resolved.ok)expect(resolved.state.combatants.first.turn.actionAvailable).toBe(false)
   return
  }
  const hit=attack('chosen');expect(hit.ok,JSON.stringify(hit)).toBe(true)
  if(hit.ok){expect(hit.state.combatants.chosen.currentHp).toBe(97);expect(hit.state.combatants.other.currentHp).toBe(100)}
 }finally{dispose()}
})

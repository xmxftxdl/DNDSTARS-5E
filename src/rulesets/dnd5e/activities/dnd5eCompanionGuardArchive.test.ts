import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {exportDnd5eStarMod,readDnd5eStarMod} from '../starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from '../unifiedContent'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from '../headlessCombatEngine'
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'

it.each(['registered','compiled'] as const)('imports a guard order, validates its region and rechecks intruders at attack time: %s',async path=>{
 const namespace='test.guard-order',automation=automationCapabilityFromLegacyStatus('full')
 const operation={id:'guard',kind:'command-owned-companion',target:'target',sourceActivityId:'summon',command:'attack',requiresGuardArea:true}
 const activity:any={schemaVersion:1,id:'guard',name:'Guard',activation:{kind:'bonus-action'},automation,legacySource:{kind:'feature',id:'guard'},
  target:{kind:'creature',count:2,relation:'any',rangeFeet:60},consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],
  outcomes:[{id:'guard',when:{kind:'always'},operations:[operation]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(validateDnd5eActivityDefinitionV1({...activity,outcomes:[{...activity.outcomes[0],operations:[{...operation,requiresAttackTarget:true}]}]}).length).toBeGreaterThan(0)
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:namespace,name:'Guard test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only'},
  definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'guard',name:'Guard',automation,payload:{id:'guard',name:'Guard',summary:'Synthetic',description:'Synthetic',automation:'full'},activities:[activity]}]}
 const archive=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 expect(archive.bundle.definitions[0].activities).toEqual([activity])
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(archive.bundle))
 try{
  const current=startDnd5eHeadlessCombat('guard',['owner','first','second','inside','outside'].map((id,index)=>createDnd5eCombatant({id,name:id,
   controller:index<3?'player':'dm',initiative:id==='owner'?20:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,
   armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:id==='outside'?325:125,y:125},concentrating:false,
   pluginFeatureIds:id==='owner'?[namespace+':guard']:[]})))
  for(const id of ['first','second'])Object.assign(current.combatants[id],{summonedSourceCombatantId:'owner',summonedSourcePackageId:namespace,summonedSourceActivityId:'summon',summonedCommandPolicy:'persistent-order'})
  current.distanceFeetByCombatantPair=Object.fromEntries(['first','second'].map(id=>[dnd5eCombatantPairKey('owner',id),30]))
  current.companionScene={geometry:null,projectedTokenIds:[],map:{id:'scene',name:'Scene',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
   tokens:Object.values(current.combatants).map(actor=>({id:actor.id,label:actor.id,type:actor.controller==='player'?'player':'enemy',size:1,x:actor.position.x,y:actor.position.y,emoji:'',color:''}))}}
  const run=(selection:unknown)=>path==='registered'?resolveRegisteredDnd5eActivityInCombatV1({state:current,combatRevision:1,confirmedBy:'actor',authoritativeRolls:{},
   command:{schemaVersion:1,commandId:'guard',actorId:'owner',packageId:namespace,packageVersion:'1.0.0',activityId:'guard',targetIds:['first','second'],expectedRevision:1,companionGuardAreas:selection as any}}).result:
   resolveDnd5eHeadlessAction(current,{type:'plugin',pluginId:namespace,featureId:namespace+':guard',actionId:'guard',actorId:'owner',targetId:'first',targetIds:['first','second'],distanceFeet:0,payload:{companionGuardAreas:selection as any}})
  const area={mapId:'scene',minX:50,minY:50,maxX:250,maxY:250}
  for(const selected of [undefined,{},[],{guard:{...area,mapId:'other'}},{guard:{...area,maxX:501}},{guard:{...area,minX:250}},{guard:{...area,maxY:NaN}},{guard:{...area,allTargets:true}}]){
   const before=structuredClone(current);expect(run(selected).ok).toBe(false);expect(current).toEqual(before)
  }
  const result=run({guard:area});expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
  expect(result.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
  const saved=JSON.parse(JSON.stringify(result.state)) as typeof current
  for(const id of ['first','second'])expect(saved.combatants[id].classState.companionCommand).toMatchObject({guardArea:area,command:'attack',persistentOrder:true})
  saved.initiativeIndex=saved.initiativeOrder.indexOf('first')
  const attack=(state:typeof saved,targetId:string)=>resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'first',targetId,attackModifier:5,d20:15,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}})
  expect(attack(saved,'outside').ok).toBe(false)
  expect(attack(saved,'second').ok).toBe(false)
  const departed=structuredClone(saved);departed.combatants.inside.position.x=350
  expect(attack(departed,'inside').ok).toBe(false)
  const hidden=structuredClone(saved);hidden.combatants.inside.conditions=['invisible']
  expect(attack(hidden,'inside').ok).toBe(false)
  const hit=attack(saved,'inside');expect(hit.ok,JSON.stringify(hit)).toBe(true)
  if(hit.ok)expect(hit.state.combatants.inside.currentHp).toBe(97)
  const dodge=resolveDnd5eHeadlessAction(saved,{type:'dodge',actorId:'first'})
  expect(dodge.ok).toBe(true)
 }finally{dispose()}
})

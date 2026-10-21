import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {migrateMapsState,type BattleMap} from '../../../store/maps'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,commitDnd5eActivityExecution} from '../headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {applyDnd5eActivityMapHandoffsV1,resolveDnd5eActivityAreaMapSelectionV1} from './dnd5eActivityMapInteraction'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

it.each(['direct','compiled'] as const)('settles an imported empty cold area through %s authority and map handoff',route=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'cold-area',name:'Synthetic cold area',activation:{kind:'action'},
  automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'spell',id:'cold-area'},
  target:{kind:'area',origin:'point',shape:'cube',widthFeet:10,lengthFeet:10,heightFeet:10,placeRangeFeet:60,relation:'any'},
  choices:[{id:'element',label:'Element',options:[{id:'cold',label:'Cold'},{id:'fire',label:'Fire'}]}],
  consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],
  checks:[{id:'save',kind:'saving-throw',ability:'dex',rollId:'save',scope:'per-target',rollMode:'host-derived',dc:{kind:'constant',value:12}}],
  outcomes:[{id:'failed-save',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:7},damageType:'cold',damageTypeChoiceId:'element'}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.coldarea',name:'Cold',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
  api.registerFeature({id:'cold-area',name:'Cold',summary:'Synthetic',description:'Synthetic',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})
 }})
 const registration=registerDnd5eActivityPackage({packageId:'test.coldarea',packageVersion:'1.0.0',activities:[activity]})
 try{
  const caster=createDnd5eCombatant({id:'caster',name:'Caster',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:25,y:25},concentrating:false})
  const state=startDnd5eHeadlessCombat('cold-area',[caster,{...structuredClone(caster),id:'opponent',controller:'dm',initiative:10}]);state.combatants.caster.pluginFeatureIds=['test.coldarea:cold-area']
  const map:BattleMap={id:'cold-map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
   tokens:[{id:'caster',type:'player',label:'Caster',x:25,y:25,size:1,color:'',emoji:''}],dnd5ePluginAreas:[{
    id:'water',pluginId:'test.water',featureId:'water',label:'Water',color:'#0ff',sourceCharacterId:'other',sourceTokenId:'other',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,
    anchorMode:'fixed',anchorCell:{col:4,row:4},cells:[{col:4,row:3},{col:4,row:4},{col:4,row:5}],
    rectGeometry:{lengthFeet:10,widthFeet:1,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{freezesOnColdSpell:true}}]}
  const selected=resolveDnd5eActivityAreaMapSelectionV1({activity,map,actorToken:map.tokens[0],anchorCell:{col:4,row:4}})!
  expect(selected).toBeTruthy();expect(selected.targetIds).toEqual([])
  const actor=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster)
  for(const element of ['cold','fire']){
   const resolution=resolveDnd5eActivity({activity,actor,targets:[],rolls:{},choices:{element},areaPlacement:selected.areaPlacement,areaPlacementDistanceFeet:selected.areaPlacementDistanceFeet})
   expect(resolution.ok,JSON.stringify(resolution)).toBe(true)
   if(!resolution.ok)throw Error('resolution')
   expect(resolution.areaSpellDamageTypes).toEqual([element]);expect(resolution.proposals).toEqual([])
   const result=route==='direct'?commitDnd5eActivityExecution(state,{actorId:'caster',activityId:activity.id,targetIds:[],resolution,source:{kind:'spell',id:activity.id,packageId:'test.coldarea'}}):
    resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.coldarea',actionId:activity.id,featureId:'test.coldarea:cold-area',actorId:'caster',targetId:'caster',targetIds:[],targetCell:selected.anchorCell,activityAreaPlacement:selected.areaPlacement,activityAreaPlacementDistanceFeet:selected.areaPlacementDistanceFeet,payload:{activityChoices:{element}},rolls:{}})
   expect(result.ok,result.ok?'':result.reason).toBe(true)
   if(!result.ok||!result.activityHandoffs)throw Error('handoffs')
   expect(result.activityHandoffs.areaSpellDamageTypes).toEqual([element])
   expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
   const request={map,activity,packageId:'test.coldarea',actionId:'cast',actorId:'caster',round:1,selection:{},areaSelection:selected,handoffs:result.activityHandoffs}
   const applied=applyDnd5eActivityMapHandoffsV1(request)
   expect(applied.ok,JSON.stringify(applied)).toBe(true)
   if(!applied.ok)throw Error(applied.reason)
   const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[applied.map]}))).maps[0]
   expect(restored.dnd5ePluginAreas!.filter(a=>a.linkedParentAreaId==='water')).toHaveLength(element==='cold'?4:0)
   if(element==='cold')expect(applyDnd5eActivityMapHandoffsV1({...request,areaSelection:undefined}).ok).toBe(false)
  }
  const feature=resolveDnd5eActivity({activity:{...activity,legacySource:{kind:'feature',id:'cold-area'}},actor,targets:[],rolls:{},choices:{element:'cold'},areaPlacement:selected.areaPlacement,areaPlacementDistanceFeet:selected.areaPlacementDistanceFeet})
  expect(feature.ok&&feature.areaSpellDamageTypes).toBeUndefined()
 }finally{registration.dispose();dispose()}
})

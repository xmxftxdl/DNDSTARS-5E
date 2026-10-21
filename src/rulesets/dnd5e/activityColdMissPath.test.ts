import {freezeDnd5eWaterWallsFromEvents} from './waterWallFreezing'
import {migrateMapsState} from '../../store/maps'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './activities/dnd5eActivityFeatureActionAdapter'
import {expect,it} from 'vitest'
import {compileDnd5eActivityPatternV1} from './activities/dnd5eActivityPatterns'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './activities/dnd5eActivityCombatAuthority'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,commitDnd5eActivityExecution,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from './headlessCombatEngine'

for(const route of ['direct','compiled'] as const) for(const damageType of ['cold','fire'] as const) it.each([1,15])(`imported ${damageType} attack via ${route} on d20 %s`,d20=>{
 const activity=compileDnd5eActivityPatternV1({schemaVersion:1,id:'cold-ray',name:'Cold ray fixture',source:{kind:'spell',id:'cold-ray'},target:{kind:'creature',relation:'any',count:1,rangeFeet:60},pattern:'roll-effect',check:{kind:'attack'},result:{kind:'damage',damageType,amount:{kind:'constant',value:7}}})
 const registration=registerDnd5eActivityPackage({packageId:'test.coldmiss',packageVersion:'1.0.0',activities:[activity]})
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.coldmiss',name:'Cold miss',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity));api.registerFeature({id:'cold-ray',name:'Cold ray',summary:'Fixture',description:'Fixture',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})}})
 try{
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,classId:'wizard',level:5,abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},proficiencyBonus:3,saveDc:14,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:25,y:200},concentrating:false})
  const target=createDnd5eCombatant({...actor,id:'target',controller:'dm',initiative:10,position:{x:425,y:200}})
  const state=startDnd5eHeadlessCombat('cold-miss',[actor,target])
  state.combatants.actor.pluginFeatureIds=['test.coldmiss:cold-ray']
  state.coordinateUnitsPerFoot=10;state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:40}
  state.companionScene={map:{id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[{id:'water',pluginId:'test.water',featureId:'wall',label:'Water',color:'#0ff',sourceCharacterId:'owner',sourceTokenId:'actor',slotLevel:3,sourceSpellSaveDc:14,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:[{col:4,row:3},{col:4,row:4},{col:4,row:5}],rectGeometry:{widthFeet:1,lengthFeet:10,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{freezesOnColdSpell:true}}]},geometry:null,projectedTokenIds:['actor','target']}
  const resolution=resolveDnd5eActivity({activity,actor:{...dnd5eActivityActorSnapshotFromCombatantV1(actor),spellAttackBonus:6},targets:[dnd5eActivityActorSnapshotFromCombatantV1(target)],rolls:{'attack:target':{values:[d20]}},checkRollModes:{'check:target':'normal'},distanceFeetByTargetId:{target:40}})
  expect(resolution.ok,JSON.stringify(resolution)).toBe(true)
  const result=route==='compiled'?resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.coldmiss',actionId:activity.id,featureId:'test.coldmiss:cold-ray',actorId:'actor',targetId:'target',targetIds:['target'],distanceFeet:40,rolls:{'attack:target':{values:[d20],modifier:0,total:d20}}}):commitDnd5eActivityExecution(state,{actorId:'actor',activityId:activity.id,targetIds:['target'],resolution,source:{kind:'spell',id:'cold-ray',packageId:'test.coldmiss'}})
  expect(result.ok,result.ok?'':result.reason).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(d20===1?30:23)
  const frozen=freezeDnd5eWaterWallsFromEvents({map:state.companionScene.map,round:1,events:result.events})
  const loaded=migrateMapsState(JSON.parse(JSON.stringify({maps:[frozen]}))).maps[0]
  const children=loaded.dnd5ePluginAreas!.filter(area=>area.linkedParentAreaId==='water')
  expect(children).toHaveLength(damageType==='cold'?1:0)
  if(damageType==='cold'){
   expect(children[0]).toMatchObject({entityProfile:{armorClass:5,hitPoints:15},entityCurrentHitPoints:15})
   expect(freezeDnd5eWaterWallsFromEvents({map:loaded,round:1,events:result.events})).toBe(loaded)
  }
  expect(result.events.filter(e=>e.type==='cold-spell-path-resolved')).toHaveLength(damageType==='cold'?1:0)
 }finally{registration.dispose();dispose()}
})

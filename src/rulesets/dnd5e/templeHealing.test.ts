import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry} from '../../lib/mapGeometry'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,applyDnd5eHeadlessHealing,commitDnd5eActivityExecution} from './headlessCombatEngine'
import {prepareDnd5eTempleStructure} from './templeStructure'
import type {BattleMap} from '../../store/maps'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './activities/dnd5eActivityCombatAuthority'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './activities/dnd5eActivityFeatureActionAdapter'

function fixture(){
 const map:BattleMap={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const built=prepareDnd5eTempleStructure({map,geometry:createEmptyMapGeometry(map.id),origin:{x:500,y:500},widthFeet:30,depthFeet:20,heightFeet:15,elevationFeet:0,rotationDegrees:0,
 structureId:'temple:healing',casterId:'builder',authorizedCreatureIds:[],worldMinute:0,createdAt:1,hostileCreatureTypes:['fiend'],lighting:'none',sourceSaveDc:18,sourceWisdomModifier:5})
 if(!built.ok)throw Error(built.reason)
 const cleric=createDnd5eCombatant({id:'cleric',name:'Cleric',controller:'player',initiative:20,abilities:{str:10,dex:10,con:12,int:10,wis:18,cha:10},proficiencyBonus:3,armorClass:14,currentHp:10,maxHp:50,temporaryHp:0,speed:30,position:{x:600,y:600},elevationFeet:5,concentrating:false,classId:'cleric',level:5,
 classSelections:{'spell-prepared':['cure-wounds']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}}})
 const enemy=createDnd5eCombatant({...cleric,id:'enemy',name:'Enemy',controller:'dm',initiative:1,position:{x:1500,y:1500}})
 const state=startDnd5eHeadlessCombat('temple-healing',[cleric,enemy])
 state.mapId=map.id
 state.companionScene={map,geometry:normalizeMapGeometry(JSON.parse(JSON.stringify(built.geometry)))!,worldMinute:1,projectedTokenIds:['cleric']}
 return {state,target:state.combatants.cleric}
}
it('adds the temple caster Wisdom to an actual healing spell, once, and spends one slot',()=>{
 const {state}=fixture()
 const result=resolveDnd5eHeadlessAction(state,{type:'cast-spell',actorId:'cleric',targetId:'cleric',spellId:'cure-wounds',slotLevel:1,effectRolls:[3]})
 expect(result.ok,result.ok?undefined:result.reason).toBe(true)
 if(!result.ok)return
 expect(result.state.combatants.cleric.currentHp).toBe(22)
 expect(result.state.combatants.cleric.classResources['dnd5e-spell-slot-1'].current).toBe(0)
 expect(state.combatants.cleric.currentHp).toBe(10)
})
it.each(['outside','above','not-created','invalid-clock','expired','removed','wrong-map','cantrip','feature','nonmagical','prevented'] as const)('does not grant an indoor spell bonus for %s',kind=>{
 const {state,target}=fixture()
 if(kind==='outside')target.position={x:900,y:600}
 if(kind==='above')target.elevationFeet=15
 if(kind==='not-created')state.companionScene!.geometry!.structureLifetimes![0].createdWorldMinute=2
 if(kind==='invalid-clock')state.companionScene!.worldMinute=NaN
 if(kind==='expired')state.companionScene!.worldMinute=1440
 if(kind==='removed')state.companionScene!.geometry!.structureLifetimes=[]
 if(kind==='wrong-map')state.mapId='other'
 if(kind==='prevented')target.simulacrumCannotRegainHitPoints=true
 const healed=applyDnd5eHeadlessHealing(target,3,[],kind!=='nonmagical',kind==='feature'?undefined:{state,spellLevel:kind==='cantrip'?0:1})
 expect(healed).toBe(kind==='prevented'?0:3)
})
it('caps HP and never stacks overlapping instances of the same spell',()=>{
 const {state,target}=fixture()
 const structure=state.companionScene!.geometry!.structureLifetimes![0]
 state.companionScene!.geometry!.structureLifetimes!.push({...structure,id:'second',templeWard:{...structure.templeWard!,healingBonus:3}})
 expect(applyDnd5eHeadlessHealing(target,3,[],true,{state,spellLevel:1})).toBe(8)
 target.currentHp=49
 expect(applyDnd5eHeadlessHealing(target,3,[],true,{state,spellLevel:1})).toBe(1)
})
it('applies periodic spell healing on the recipient turn and does not repeat on a move',()=>{
 const {state}=fixture()
 const target=state.combatants.enemy
 target.position={x:600,y:600}
 target.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'regenerate',label:'Regenerate',targetId:target.id,
 source:{kind:'spell',actorId:'cleric',rulesId:'regenerate',spellLevel:7,magical:true},
 periodicHealing:{timing:'target-turn-start',amount:1},duration:{type:'rounds',remainingRounds:600,tickOn:'target-turn-end'}})]
 const first=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'cleric'})
 expect(first.ok,first.ok?undefined:first.reason).toBe(true)
 if(!first.ok)return
 expect(first.state.combatants.enemy.currentHp).toBe(16)
 const second=resolveDnd5eHeadlessAction(first.state,{type:'move',actorId:'enemy',to:{x:600,y:600},distance:0})
 expect(second.ok,second.ok?undefined:second.reason).toBe(true)
 expect(second.state.combatants.enemy.currentHp).toBe(16)
})
it.each(['spell','feature','item'] as const)('uses the authoritative %s source when committing a data-only Activity',kind=>{
 const {state,target}=fixture()
 const activity:Dnd5eActivityDefinitionV1=JSON.parse(JSON.stringify({schemaVersion:1,id:'temple-heal-audit',name:'Healing',activation:{kind:'action'},target:{kind:'self'},
 automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'resolve',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:3}}]}]}))
 const resolution=resolveDnd5eActivity({activity,actor:dnd5eActivityActorSnapshotFromCombatantV1(target),targets:[dnd5eActivityActorSnapshotFromCombatantV1(target)],rolls:{},castLevel:1})
 expect(resolution.ok,JSON.stringify(resolution)).toBe(true)
 const result=commitDnd5eActivityExecution(state,{actorId:target.id,activityId:activity.id,targetIds:[],castLevel:1,resolution,source:{kind,id:'healing-audit',packageId:'local.temple.audit'}})
 expect(result.ok,result.ok?undefined:result.reason).toBe(true)
 expect(result.state.combatants.cleric.currentHp).toBe(kind==='spell'?18:13)
 expect(state.combatants.cleric.currentHp).toBe(10)
})
it.each(['spell','feature'] as const)('passes registered %s source metadata through the installed Activity compiler',kind=>{
 const {state,target}=fixture()
 const pluginId='local.temple.compiler-audit'
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'heal',name:'Healing',activation:{kind:'action'},target:{kind:'self'},legacySource:{kind,id:'heal'},
 automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'resolve',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:3}}]}]}
 const registration=registerDnd5eActivityPackage({packageId:pluginId,packageVersion:'1.0.0',activities:[JSON.parse(JSON.stringify(activity))]})
 const dispose=registerDnd5eRulesPlugin({manifest:{id:pluginId,name:'Healing audit',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
  api.registerFeature({id:'heal',name:'Healing',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})
 }})
 try{
  target.pluginFeatureIds=[`${pluginId}:heal`]
  const result=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId,actionId:'heal',featureId:`${pluginId}:heal`,actorId:target.id,targetId:target.id,targetIds:[target.id],castLevel:1,rolls:{}})
  expect(result.ok,result.ok?undefined:result.reason).toBe(true)
  expect(result.state.combatants.cleric.currentHp).toBe(kind==='spell'?18:13)
 }finally{dispose();registration.dispose()}
})

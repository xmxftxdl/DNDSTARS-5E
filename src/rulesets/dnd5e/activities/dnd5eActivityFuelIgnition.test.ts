import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createEmptyMapGeometry } from '../../../lib/mapGeometry'
import type { BattleMap } from '../../../store/maps'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'flame',name:'Flame',activation:{kind:'action'},
 target:{kind:'area',origin:'point',shape:'cube',widthFeet:5,lengthFeet:5,heightFeet:5,relation:'any',includeSelf:true},automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'flame'},
 outcomes:[{id:'change',when:{kind:'always'},operations:[{id:'alter',kind:'ignite-area-fuel'}]}]}

it.each(['self','missing-height','extra-policy'])('rejects invalid fuel ignition declaration %s',mutation=>{
 const invalid=structuredClone(activity)
 if(mutation==='self')invalid.target={kind:'self'}
 if(mutation==='missing-height'&&invalid.target.kind==='area')delete invalid.target.heightFeet
 if(mutation==='extra-policy')Object.assign(invalid.outcomes[0].operations[0],{includeCarried:true})
 expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
})

it.each(['direct','compiled'] as const)('carries an imported flame declaration through %s Headless into validated map changes',async route=>{
 const definition=JSON.parse(JSON.stringify(activity)) as Dnd5eActivityDefinitionV1
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1(definition).missingComponents).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1(definition).capability.level).toBe('full')
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.flame',name:'Flame test',version:'1.0.0',apiVersion:2,
  rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
  api.registerFeature({id:'flame',name:'Flame',summary:'Synthetic',description:'Synthetic',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(definition)})
 }})
 const registration=registerDnd5eActivityPackage({packageId:'test.flame',packageVersion:'1.0.0',activities:[definition]})
 try{
 const caster=createDnd5eCombatant({id:'caster',name:'Caster',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},
  proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('combat',[caster,{...structuredClone(caster),id:'enemy',controller:'dm',initiative:10}])
 state.combatants.caster.pluginFeatureIds=['test.flame:flame']
 const actor=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster)
 const placement={x:0,y:0,elevationFeet:0,widthFeet:5,lengthFeet:5,heightFeet:5}
 const result=route==='compiled'?resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.flame',actionId:'flame',featureId:'test.flame:flame',actorId:'caster',targetId:'caster',targetIds:[],targetCell:{col:0,row:0},activityAreaPlacement:placement,activityAreaPlacementDistanceFeet:0,rolls:{}})
  :commitDnd5eActivityExecution(state,{actorId:'caster',activityId:'flame',targetIds:[],
   resolution:resolveDnd5eActivity({activity:definition,actor,targets:[],areaPlacement:placement,areaPlacementDistanceFeet:0,rolls:{}}),source:{kind:'feature',id:'flame',packageId:'test.flame'}})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 if(!result.ok||!result.activityHandoffs)throw Error('Missing flame handoff')
 expect(result.activityHandoffs.areaFuelIgnitions).toHaveLength(1)
 expect(result.activityHandoffs.areaFuelIgnitions).toMatchObject([{kind:'ignite-area-fuel',operationId:'alter'}])
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,showGrid:true,gridOffsetX:0,gridOffsetY:0,
  tokens:[{id:'caster',characterId:'owner',type:'player',label:'Caster',emoji:'C',color:'#fff',size:1,x:0,y:50}]}
 const geometry={...createEmptyMapGeometry('map',1),lights:[{id:'fire',kind:'light' as const,label:'Fire',enabled:true,points:[{x:50,y:50}] as [{x:number;y:number}],
  brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',elevationFeet:0,createdAt:1,
  controlledFlame:{id:'fire',magical:false,burning:false,extentFeet:5,fuelAvailable:true,custody:'unattended' as const,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',alterations:[]}}]}
 const request={map,flameGeometries:[geometry],activity:definition,packageId:'test.flame',actionId:'cast',actorId:'caster',round:1,worldMinute:480,
 handoffs:result.activityHandoffs,selection:{},areaSelection:{anchorCell:{col:1,row:1},cells:[{col:1,row:1}],targetIds:[],areaPlacement:{x:50,y:50,elevationFeet:0},areaPlacementDistanceFeet:5}}
 const before=structuredClone(request)
 const applied=applyDnd5eActivityMapHandoffsV1(request)
 expect(applied.ok,JSON.stringify(applied)).toBe(true);if(!applied.ok)throw Error(applied.reason)
 expect(applied.geometryLightUpserts).toHaveLength(1)
 expect(applied.geometryLightUpserts[0].controlledFlame).toMatchObject({burning:true,custody:'unattended'})
 expect(request).toEqual(before)
 expect(applyDnd5eActivityMapHandoffsV1({...request,areaSelection:undefined})).toMatchObject({ok:false})
 const worn=structuredClone(geometry);worn.lights[0].controlledFlame.custody='worn' as any
 const excluded=applyDnd5eActivityMapHandoffsV1({...request,flameGeometries:[worn]})
 expect(excluded.ok&&excluded.geometryLightUpserts).toEqual([])
 }finally{registration.dispose();dispose()}
})

import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {applyDnd5eActivityMapHandoffsV1} from './dnd5eActivityMapInteraction'
import {createEmptyMapGeometry} from '../../../lib/mapGeometry'
import type {BattleMap} from '../../../store/maps'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'flame',name:'Flame',activation:{kind:'action'},
 target:{kind:'area',origin:'point',shape:'rect',widthFeet:5,lengthFeet:5,heightFeet:5,relation:'any',includeSelf:true},automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'flame'},
 outcomes:[{id:'change',when:{kind:'always'},operations:[{id:'alter',kind:'control-map-water',change:{kind:'freeze'}}]}]}

it.each(['unknown-kind','bad-opacity','untrusted-occupancy'])('rejects malformed water operation %s',mutation=>{
 const invalid=structuredClone(activity)
 const operation=invalid.outcomes[0].operations[0] as any
 if(mutation==='unknown-kind')operation.change.kind='make-water'
 if(mutation==='bad-opacity')operation.change={kind:'appearance',color:'#0088ff',opacity:2}
 if(mutation==='untrusted-occupancy')operation.containsCreatures=false
 expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
})

it.each(['direct','compiled'] as const)('carries an imported water declaration through %s Headless into map authority handoffs',async route=>{
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
 expect(result.activityHandoffs.mapWaterChanges).toHaveLength(1)
 expect(result.activityHandoffs.mapWaterChanges).toMatchObject([{kind:'control-map-water',change:{kind:'freeze'},operationId:'alter'}])
 const map:BattleMap={id:'map',name:'Water map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'caster',type:'player',characterId:'owner',label:'Caster',x:100,y:100,size:1,color:'',emoji:''}]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.ambientLight='bright'
 geometry.obstacles.push({id:'water',kind:'obstacle',label:'Water',points:[{x:200,y:100},{x:250,y:100},{x:250,y:150},{x:200,y:150}],baseHeightFeet:0,heightFeet:5,
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1,
  controlledWater:{id:'water',positionFeet:{x:22.5,y:12.5,z:0},dimensionsFeet:{x:5,y:5,z:5},color:'#0088ff',opacity:0.5,alterations:[],appliedActionIds:[]}})
 const request={map,activity:definition,packageId:'test.flame',actionId:'cast',actorId:'caster',round:1,worldMinute:10,
  supportsStructureCommit:true,flameGeometries:[geometry],handoffs:result.activityHandoffs,
  selection:{watersByOperationId:{alter:{waterId:'water',region:{center:{x:225,y:125},dimensionsFeet:{x:5,y:5,z:5},baseElevationFeet:0}}}}}
 const before=structuredClone(request)
 const applied=applyDnd5eActivityMapHandoffsV1(request)
 expect(applied.ok).toBe(true);if(!applied.ok)throw Error(applied.reason)
 expect(applied.structureGeometry?.obstacles.every(o=>o.controlledWater?.alterations.some(e=>e.kind==='freeze'&&e.casterId==='character:owner'))).toBe(true)
 expect(request).toEqual(before)
 expect(applyDnd5eActivityMapHandoffsV1({...request,supportsStructureCommit:false}).ok).toBe(false)
 expect(applyDnd5eActivityMapHandoffsV1({...request,selection:{}}).ok).toBe(false)
 const occupied=structuredClone(map);occupied.tokens.push({...map.tokens[0],id:'enemy',characterId:'other',x:225,y:125})
 expect(applyDnd5eActivityMapHandoffsV1({...request,map:occupied}).ok).toBe(false)
 const remote={...applied.structureGeometry!,mapId:'remote'}
 const dismissRequest={...request,actionId:'dismiss',flameGeometries:[geometry,remote],
  handoffs:{...result.activityHandoffs,mapWaterChanges:[{kind:'control-map-water' as const,operationId:'alter',change:{kind:'dismiss' as const}}]},
  selection:{watersByOperationId:{alter:{dismissEffectId:'cast:alter'}}}}
 expect(applyDnd5eActivityMapHandoffsV1(dismissRequest).ok).toBe(false)
 const dismissed=applyDnd5eActivityMapHandoffsV1({...dismissRequest,supportsOtherMapGeometryCommit:true})
 expect(dismissed.ok).toBe(true);if(!dismissed.ok)throw Error(dismissed.reason)
 expect(dismissed.structureGeometry).toBeUndefined()
 expect(dismissed.otherMapGeometryUpdates).toHaveLength(1)
 expect(dismissed.otherMapGeometryUpdates![0].obstacles.every(o=>o.controlledWater?.alterations.length===0)).toBe(true)
 const foreign=structuredClone(dismissRequest);foreign.map.tokens[0].characterId='stranger'
 expect(applyDnd5eActivityMapHandoffsV1({...foreign,supportsOtherMapGeometryCommit:true}).ok).toBe(false)
 }finally{registration.dispose();dispose()}
})

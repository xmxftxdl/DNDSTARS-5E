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
import { requestControlledFlameSelection } from '../controlledFlameSelection'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'flame',name:'Flame',activation:{kind:'action'},
 target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'flame'},
 outcomes:[{id:'change',when:{kind:'always'},operations:[{id:'alter',kind:'control-map-flame',change:{kind:'illumination',multiplier:2}}]}]}

it.each(['inspect','extinguish'] as const)('binds %s to the actual nonmagical fire at the area origin',kind=>{
 const definition:Dnd5eActivityDefinitionV1={...activity,
  target:{kind:'area',origin:'point',shape:'circle',radiusFeet:10,placeRangeFeet:60,relation:'any',includeSelf:true},
  outcomes:[{id:'source',when:{kind:'always'},operations:[{id:'source-fire',kind:'control-map-flame',change:{kind},requireAreaOrigin:true}]}]}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,showGrid:true,gridOffsetX:0,gridOffsetY:0,
  tokens:[{id:'caster',characterId:'owner',type:'player',label:'Caster',emoji:'C',color:'#fff',size:1,x:25,y:25}]}
 const light={id:'fire',kind:'light' as const,label:'Fire',enabled:true,points:[{x:75,y:75}] as [{x:number;y:number}],
  brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',elevationFeet:0,createdAt:1,
  controlledFlame:{id:'fire',magical:false,burning:true,extentFeet:5,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',alterations:[]}}
 const geometry={...createEmptyMapGeometry('map',1),lights:[light]}
 const areaSelection=resolveDnd5eActivityAreaMapSelectionV1({activity:definition,map,actorToken:map.tokens[0],anchorCell:{col:1,row:1}})!
 const actor={id:'caster',controller:'players' as const,level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:10,conditions:[],currentHp:20,maxHp:20}
 const resolved=resolveDnd5eActivity({activity:definition,actor,targets:[{...actor,id:'one'},{...actor,id:'two'}],rolls:{},areaPlacement:areaSelection.areaPlacement,areaPlacementDistanceFeet:areaSelection.areaPlacementDistanceFeet})
 expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
 if(!resolved.ok)throw Error('missing resolution')
 const changes=resolved.proposals.filter((p):p is Extract<typeof p,{kind:'control-map-flame'}>=>p.kind==='control-map-flame')
 expect(changes).toHaveLength(1)
 const request={map,flameGeometries:[geometry],activity:definition,packageId:'test.flame',actionId:'origin-cast',actorId:'caster',round:1,worldMinute:480,areaSelection,
  handoffs:{persistentAreas:[],summons:[],movements:[],invocations:[],mapFlameChanges:changes},selection:{}}
 const before=structuredClone(request)
 const applied=applyDnd5eActivityMapHandoffsV1(request)
 expect(applied.ok,JSON.stringify(applied)).toBe(true)
 if(applied.ok)expect(applied.geometryLightUpserts).toEqual(kind==='inspect'?[]:[expect.objectContaining({controlledFlame:expect.objectContaining({burning:false})})])
 expect(request).toEqual(before)
 expect(applyDnd5eActivityMapHandoffsV1({...request,areaSelection:undefined}).ok).toBe(false)
 for(const mutation of ['empty','magical','extinguished','large','wrong-height','other-cell','disabled'] as const){
  const changed=structuredClone(request)
  const fire=changed.flameGeometries[0].lights[0]
  if(mutation==='empty')changed.flameGeometries[0].lights=[]
  if(mutation==='magical')fire.controlledFlame.magical=true
  if(mutation==='extinguished')fire.controlledFlame.burning=false
  if(mutation==='large')fire.controlledFlame.extentFeet=10
  if(mutation==='wrong-height')fire.elevationFeet=10
  if(mutation==='other-cell')fire.points[0].x=125
  if(mutation==='disabled')fire.enabled=false
  expect(applyDnd5eActivityMapHandoffsV1(changed).ok,mutation).toBe(false)
  expect(applyDnd5eActivityMapHandoffsV1({...changed,selection:{flamesByOperationId:{'source-fire':{lightId:'fire'}}}}).ok,`explicit ${mutation}`).toBe(false)
 }
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
 try{
 const caster=createDnd5eCombatant({id:'caster',name:'Caster',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},
  proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('combat',[caster,{...structuredClone(caster),id:'enemy',controller:'dm',initiative:10}])
 state.combatants.caster.pluginFeatureIds=['test.flame:flame']
 const actor=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster)
 const result=route==='compiled'?resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.flame',actionId:'flame',featureId:'test.flame:flame',actorId:'caster',targetId:'caster',rolls:{}})
  :commitDnd5eActivityExecution(state,{actorId:'caster',activityId:'flame',targetIds:['caster'],
   resolution:resolveDnd5eActivity({activity:definition,actor,targets:[actor],rolls:{}}),source:{kind:'feature',id:'flame',packageId:'test.flame'}})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 if(!result.ok||!result.activityHandoffs)throw Error('Missing flame handoff')
 expect(result.activityHandoffs.mapFlameChanges).toHaveLength(1)
 expect(result.activityHandoffs.mapFlameChanges).toMatchObject([{kind:'control-map-flame',operationId:'alter',change:{kind:'illumination',multiplier:2}}])
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,showGrid:true,gridOffsetX:0,gridOffsetY:0,
  tokens:[{id:'caster',characterId:'owner',type:'player',label:'Caster',emoji:'C',color:'#fff',size:1,x:0,y:50}]}
 const geometry={...createEmptyMapGeometry('map',1),lights:[{id:'fire',kind:'light' as const,label:'Fire',enabled:true,points:[{x:50,y:50}] as [{x:number;y:number}],
  brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',elevationFeet:0,createdAt:1,
  controlledFlame:{id:'fire',magical:false,burning:true,extentFeet:5,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',alterations:[]}}]}
  const selected = await requestControlledFlameSelection({
   readScene:()=>({map,geometries:[geometry],actorTokenId:'caster',casterId:'character:owner',actionId:'cast:alter',worldMinute:480}),
   intent:result.activityHandoffs.mapFlameChanges![0].change,
   choose:async options=>{expect(options).toHaveLength(1);return options[0].id},
  })
  expect(selected).toEqual({lightId:'fire'})
  if(!selected)throw Error('Missing flame selection')
  const request={map,flameGeometries:[geometry],activity:definition,packageId:'test.flame',actionId:'cast',actorId:'caster',round:1,worldMinute:480,
   handoffs:result.activityHandoffs,selection:{flamesByOperationId:{alter:selected}}}
 const applied=applyDnd5eActivityMapHandoffsV1(request)
 expect(applied.ok,JSON.stringify(applied)).toBe(true)
 if(applied.ok)expect(applied.geometryLightUpserts[0]?.controlledFlame?.alterations).toEqual([expect.objectContaining({id:'cast:alter',casterId:'character:owner',multiplier:2})])

 if (!applied.ok) throw Error('Missing initial application')
 const otherGeometry = {...geometry, mapId:'other-map', lights:[structuredClone(applied.geometryLightUpserts[0])]}
 const dismissRequest = {...request, flameGeometries:[geometry,otherGeometry],
  handoffs:{...request.handoffs,mapFlameChanges:[{...request.handoffs.mapFlameChanges![0],change:{kind:'dismiss' as const}}]},
  selection:{flamesByOperationId:{alter:{mapId:'other-map',lightId:'fire',effectId:'cast:alter'}}}}
 const beforeDismiss = structuredClone(dismissRequest)
 const dismissed = applyDnd5eActivityMapHandoffsV1(dismissRequest)
 expect(dismissed.ok).toBe(true)
 if (!dismissed.ok) throw Error('Cross-map dismissal failed')
 expect(dismissed.geometryLightUpserts).toEqual([])
 expect(dismissed.otherMapLightUpserts).toEqual([{mapId:'other-map',light:expect.objectContaining({id:'fire',
  controlledFlame:expect.objectContaining({alterations:[]})})}])
 expect(dismissRequest).toEqual(beforeDismiss)
 expect(applyDnd5eActivityMapHandoffsV1({...dismissRequest,
  selection:{flamesByOperationId:{alter:{lightId:'fire',effectId:'cast:alter'}}}}).ok).toBe(false)
 expect(applyDnd5eActivityMapHandoffsV1({...dismissRequest,handoffs:request.handoffs}).ok).toBe(false)
 const foreign = structuredClone(dismissRequest)
 foreign.flameGeometries[1].lights[0].controlledFlame!.alterations[0].casterId='character:stranger'
 expect(applyDnd5eActivityMapHandoffsV1(foreign).ok).toBe(false)
 expect(geometry.lights[0].controlledFlame.alterations).toEqual([])
 expect(applyDnd5eActivityMapHandoffsV1({...request,flameGeometries:undefined}).ok).toBe(false)
 expect(applyDnd5eActivityMapHandoffsV1({...request,selection:{}}).ok).toBe(false)
 }finally{dispose()}
})

it.each([null,{}, {kind:'spread',destinationId:'injected'}, {kind:'illumination',multiplier:3}, {kind:'shape',description:'image',promptForAppearance:'yes'},
 {kind:'illumination',multiplier:2,color:'red'}, {kind:'shape',description:''}, {kind:'dismiss',casterId:'other'}])('rejects malformed or authority-injecting flame intent %j',change=>{
 const invalid=structuredClone(activity)
 Object.assign(invalid.outcomes[0].operations[0],{change})
 expect(validateDnd5eActivityDefinitionV1(invalid).some(error=>error.includes('flame'))).toBe(true)
})

it('allows explicit player appearance prompts only for shape and illumination',()=>{
 for(const change of [{kind:'shape',description:'image',promptForAppearance:true}, {kind:'illumination',multiplier:1,promptForAppearance:true}]){
  const candidate=structuredClone(activity)
  Object.assign(candidate.outcomes[0].operations[0],{change})
  expect(validateDnd5eActivityDefinitionV1(candidate)).toEqual([])
 }
})

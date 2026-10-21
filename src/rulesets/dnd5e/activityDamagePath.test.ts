import {planDnd5eMapResultApplication} from './mapBridge'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './activities/dnd5eActivityCombatAuthority'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {expect,it} from 'vitest'
import {resolveDnd5ePersistentAreaTrigger,commitDnd5eActivityExecution,dnd5eCombatantPairKey,createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './activities/dnd5eActivityFeatureActionAdapter'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
const make=(id:string,x:number)=>createDnd5eCombatant({id,name:id,controller:id==='actor'?'player':'dm',initiative:id==='actor'?20:10,abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x,y:225},concentrating:false})
it.each(['fire','slashing','cold','efreeti','efreeti-resistant','efreeti-bonus'] as const)('weapon damage crossing water: %s',type=>{
 const state=startDnd5eHeadlessCombat('weapon-water',[make('actor',200),make('target',250)])
 state.coordinateUnitsPerFoot=10
 state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:5}
 const wall:Dnd5ePluginArea={id:'wall',pluginId:'test.wall',featureId:'wall',label:'Wall',color:'#0ff',sourceCharacterId:'owner',sourceTokenId:'actor',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:[{col:4,row:3},{col:4,row:4},{col:4,row:5}],rectGeometry:{widthFeet:1,lengthFeet:10,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{halvedDamageTypes:['fire'],freezesOnColdSpell:true}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[wall]}
 state.companionScene={map,geometry:null,projectedTokenIds:['actor','target']}
 const monster=type.startsWith('efreeti')
 if(monster)state.combatants.actor.statBlockId='srd-5.1:efreeti'
 if(type==='efreeti-resistant')state.combatants.target.damageResistances=['fire']
 if(type==='efreeti-bonus')state.combatants.actor.classState.monsterMechanicRollModifiers=[{id:'water-test-damage',mechanicOwnerId:'actor',mechanicId:'water-test',roll:'damage',mode:'bonus',bonus:4}]
 const result=resolveDnd5eHeadlessAction(state,monster?
  {type:'monster-action',actorId:'actor',actionId:'scimitar',rolls:[{targetId:'target',d20:15,damageRolls:[[3,4],[3,4]]}]}:
  {type:'attack',actorId:'actor',targetId:'target',attackModifier:5,d20:15,damage:{count:2,sides:8,bonus:0,rolls:[6,7],type:type as 'fire'|'slashing'|'cold'}})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 expect(result.state.combatants.target.currentHp).toBe(type==='fire'?94:type==='efreeti'?84:type==='efreeti-resistant'?86:type==='efreeti-bonus'?80:87)
 expect(result.events.some(event=>event.type==='cold-spell-path-resolved')).toBe(false)
 expect(state.combatants.target.currentHp).toBe(100)
})
;(['direct','point-before','point-after','resistance','immunity','vulnerability','cold','missing-wall','irreducible','expired-round','expired-time','grant-before','grant-after'] as const).forEach(mode=>it.each(mode.startsWith('grant')?['compiled'] as const:['compiled','direct'] as const)('Activity damage '+mode+' via %s',route=>{
 const actor=make('actor',25),target=make('target',425),state=startDnd5eHeadlessCombat('test',[actor,target])
 state.coordinateUnitsPerFoot=10;state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:40}
 const point=mode.startsWith('point')
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'fire',name:'Synthetic fire',activation:{kind:'free'},automation:automationCapabilityFromLegacyStatus('full'),
  target:point?{kind:'area',relation:'any',origin:'point',shape:'sphere',radiusFeet:60,placeRangeFeet:120}:{kind:'creature',relation:'any',count:1,rangeFeet:120,...(mode.startsWith('grant')?{rangeOrigin:'granting-area' as const}:{})},
  outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',damageType:mode==='cold'?'cold':'fire',amount:{kind:'constant',value:13},cannotBeReduced:mode==='irreducible'}]}]}
 const wall:Dnd5ePluginArea={id:'wall',pluginId:'test.wall',featureId:'wall',label:'Wall',color:'#0ff',sourceCharacterId:'owner',sourceTokenId:'actor',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:Array.from({length:7},(_,i)=>({col:4,row:1+i})),rectGeometry:{widthFeet:1,lengthFeet:30,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{halvedDamageTypes:['fire']}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:mode==='missing-wall'?[]:[wall]}
 state.companionScene={map,geometry:null,projectedTokenIds:['actor','target']}
 if(mode.startsWith('grant'))map.dnd5ePluginAreas!.push({...wall,id:'grant',blocking:undefined,anchorCell:{col:mode==='grant-after'?6:2,row:4},grantedActivities:[{activityId:'fire'}]})
 if(mode==='expired-round')wall.expiresAfterRound=0
 if(mode==='expired-time'){wall.expiresAtWorldMinute=100;state.companionScene.worldMinute=100}
 state.combatants.actor.pluginFeatureIds=['test.path:fire']
 if(mode==='resistance')state.combatants.target.damageResistances=['fire']
 if(mode==='immunity')state.combatants.target.damageImmunities=['fire']
 if(mode==='vulnerability')state.combatants.target.damageVulnerabilities=['fire']
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.path',name:'Path',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity));api.registerFeature({id:'fire',name:'Fire',summary:'Synthetic',description:'Synthetic',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})}})
 const registration=registerDnd5eActivityPackage({packageId:'test.path',packageVersion:'1.0.0',activities:[activity]})
 try{
 const placement=point?{x:mode==='point-after'?325:125,y:225,elevationFeet:0,radiusFeet:60}:undefined
 const resolution=resolveDnd5eActivity({activity,actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor),targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target)],rolls:{},distanceFeetByTargetId:{target:40},areaPlacement:placement,areaPlacementDistanceFeet:10})
 expect(resolution.ok).toBe(true)
 const result=route==='direct'?commitDnd5eActivityExecution(state,{actorId:'actor',activityId:'fire',targetIds:['target'],resolution,source:{kind:'feature',id:'fire',packageId:'test.path'}}):resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.path',actionId:'fire',...(mode.startsWith('grant')?{hostEntitlement:{kind:'persistent-area' as const,areaId:'grant'}}:{}),featureId:'test.path:fire',actorId:'actor',targetId:'target',targetIds:['target'],distanceFeet:40,rolls:{},...(point?{targetCell:{col:mode==='point-after'?6:2,row:4},activityAreaPlacement:{x:mode==='point-after'?325:125,y:225,elevationFeet:0,radiusFeet:60},activityAreaPlacementDistanceFeet:10}:{})})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 const expected=mode==='resistance'?3:mode==='immunity'?0:mode==='vulnerability'?12:['cold','missing-wall','irreducible','point-after','expired-round','expired-time','grant-after'].includes(mode)?13:6
 expect(result.state.combatants.target.currentHp).toBe(100-expected)
 expect(state.combatants.target.currentHp).toBe(100)
 }finally{registration.dispose();dispose()}
}))

it.each(['before','after','above','missing'] as const)('persistent damage uses area origin: %s', mode=>{
 const actor=make('actor',25),target=make('target',425),state=startDnd5eHeadlessCombat('persistent-path',[actor,target])
 const wall:Dnd5ePluginArea={id:'wall',pluginId:'test.wall',featureId:'wall',label:'Wall',color:'#0ff',sourceCharacterId:'owner',sourceTokenId:'actor',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:Array.from({length:7},(_,i)=>({col:4,row:1+i})),rectGeometry:{widthFeet:1,lengthFeet:30,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{halvedDamageTypes:['fire']}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[wall]}
 state.companionScene={map,geometry:null,projectedTokenIds:['actor','target']}

 const areaOrigin=mode==='missing'?undefined:{x:mode==='after'?325:125,y:225,elevationFeet:mode==='above'?40:0}
 const result=resolveDnd5ePersistentAreaTrigger(state,{areaId:'fire-area',areaOrigin,sourceId:'actor',targetId:'target',
  trigger:{id:'burn',label:'Burn',timing:'on-enter',damage:{count:1,sides:20,type:'fire'}},damageRolls:[13]})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 expect(result.state.combatants.target.currentHp).toBe(mode==='before'?94:87)
 expect(state.combatants.target.currentHp).toBe(100)
})

it.each(['bolt-hit','bolt-miss','ball-before','ball-after','ball-save'] as const)('native fire damage: %s',mode=>{
 const actor=createDnd5eCombatant({...make('actor',25),classId:'wizard',level:5,
  classSelections:{'spell-cantrips':['fire-bolt'],'spell-prepared':['fireball']},classResources:{'dnd5e-spell-slot-3':{current:1,max:1}}})
 const target=make('target',425),state=startDnd5eHeadlessCombat('native-path',[actor,target])
 state.coordinateUnitsPerFoot=10;state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:40}
 const wall:Dnd5ePluginArea={id:'wall',pluginId:'test.wall',featureId:'wall',label:'Wall',color:'#0ff',sourceCharacterId:'owner',sourceTokenId:'actor',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:Array.from({length:7},(_,i)=>({col:4,row:1+i})),rectGeometry:{widthFeet:1,lengthFeet:30,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{halvedDamageTypes:['fire']}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[wall]}
 state.companionScene={map,geometry:null,projectedTokenIds:['actor','target']}

 const bolt=mode.startsWith('bolt')
 const result=resolveDnd5eHeadlessAction(state,{type:'cast-spell',actorId:'actor',targetId:'target',targetIds:['target'],spellId:bolt?'fire-bolt':'fireball',slotLevel:bolt?0:3,
  ...(bolt?{d20:mode==='bolt-miss'?1:15}:{savingThrowD20:mode==='ball-save'?20:1,damagePathOrigin:{x:mode==='ball-after'?325:125,y:225,elevationFeet:0}}),
  effectRolls:bolt?(mode==='bolt-miss'?[]:[6,7]):Array(8).fill(3)})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 const damage=mode==='bolt-miss'?0:mode==='bolt-hit'?6:mode==='ball-after'?24:mode==='ball-save'?6:12
 expect(result.state.combatants.target.currentHp).toBe(100-damage)
 expect(state.combatants.target.currentHp).toBe(100)
 if(!bolt)expect(result.state.combatants.actor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
})

it.each(['enabled','miss','monster-hit','monster-miss','undeclared','expired','paused','above'] as const)('projects a real cold spell path into water freezing: %s',mode=>{
 const monster=mode==='monster-hit'||mode==='monster-miss',miss=mode==='miss'||mode==='monster-miss'
 const actor=createDnd5eCombatant({...make('actor',25),statBlockId:monster?'srd-5.1:lich':undefined,position:{x:25,y:240},classId:'wizard',level:5,classSelections:{'spell-cantrips':['ray-of-frost']}})
 const target=createDnd5eCombatant({...make('target',425),position:{x:425,y:240}}),state=startDnd5eHeadlessCombat('cold-path',[actor,target])
 state.coordinateUnitsPerFoot=10;state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:40}
 const wall:Dnd5ePluginArea={id:'wall',pluginId:'test.wall',featureId:'wall',label:'Wall',color:'#0ff',sourceCharacterId:'owner',sourceTokenId:'actor',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:Array.from({length:7},(_,i)=>({col:4,row:1+i})),rectGeometry:{widthFeet:1,lengthFeet:30,gridAligned:false,direction:{dc:0,dr:1}},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{halvedDamageTypes:['fire']}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[wall]}
 state.companionScene={map,geometry:null,projectedTokenIds:['actor','target']}

 wall.blocking={...wall.blocking,freezesOnColdSpell:mode==='undeclared'?undefined:true}
 if(mode==='expired')wall.expiresAfterRound=0
 if(mode==='paused')wall.modeState={paused:true,profiles:[{id:'water'}],selectedModeId:'water',changeReceipts:[]}
 if(mode==='above')wall.vertical={mode:'volume',baseElevationFeet:10,heightFeet:10}
 map.tokens=[actor,target].map(t=>({id:t.id,type:'enemy' as const,label:t.name,x:t.position!.x,y:t.position!.y,size:1,color:'',emoji:'',hp:100,maxHp:100}))
 const result=resolveDnd5eHeadlessAction(state,monster?
  {type:'monster-core-spell',actorId:'actor',spellId:'ray-of-frost',slotLevel:0,resolution:{schemaVersion:1,targetIds:['target'],d20:miss?1:15,effectRolls:[[1,2,2,2]]}}:
  {type:'cast-spell',actorId:'actor',targetId:'target',spellId:'ray-of-frost',slotLevel:0,d20:miss?1:15,effectRolls:miss?[]:[3,4]})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 expect(result.state.combatants.target.currentHp).toBe(miss?100:93)
 expect(result.events.some(e=>e.type==='cold-spell-path-resolved')).toBe(true)
 const apply=(current:BattleMap)=>planDnd5eMapResultApplication({state:result.state,map:current,characters:[],characterIdByCombatantId:{},events:[...result.events]})
 const first=apply(map),ice=first.map.dnd5ePluginAreas!.filter(a=>a.linkedParentAreaId==='wall')
 expect(ice).toHaveLength(mode==='enabled'||miss||monster?1:0)
 if(mode!=='enabled'&&!miss&&!monster)return
 expect(ice[0].entityProfile).toMatchObject({armorClass:5,hitPoints:15})
 expect(ice[0].wallSurfaceSections).toEqual([{startFeet:15,endFeet:20,bottomFeet:0,topFeet:5}])
 expect(apply(first.map).map.dnd5ePluginAreas!.filter(a=>a.linkedParentAreaId==='wall')).toHaveLength(1)
 expect(map.dnd5ePluginAreas).toHaveLength(1)
})

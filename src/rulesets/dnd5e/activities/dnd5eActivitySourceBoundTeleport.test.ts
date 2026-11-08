import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
export const dependencyId='test.source-bound-provider'
/** Explicit installed providers. Ordinary Bestow Curse has no warlock-curse tag. */
export const relentless:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'source-bound-teleport',name:'Source-bound teleport',
 automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'source-bound-teleport',magical:true},
 activation:{kind:'bonus-action'},target:{kind:'creature',count:1,relation:'any',requiresLineOfSight:true},
 requirements:[{kind:'class-level',classId:'warlock',minimum:7},
  {kind:'active-effect',subject:'target',source:'self',present:true,anyOf:[
   {tags:['curse','hex'],sourceRulesId:dependencyId+':hex',sourcePluginId:dependencyId},
   {tags:['curse','dnd5e:warlock-curse'],sourceRulesId:'bestow-curse',sourcePluginId:dependencyId}]}],
 consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],
 outcomes:[{id:'teleport',when:{kind:'always'},operations:[{id:'landing',kind:'move',target:'actor',mode:'teleport',
  distanceFeet:{kind:'constant',value:30},maximumDistanceFromActorFeet:30,selectedTargetRadiusFeet:5,
  requiresVisibleDestination:true,ignoresOpportunityAttacks:true,verticalDestination:'space'}]}]}

import {beforeEach,expect,it} from 'vitest'
import {setMapGeometryRuntime} from '../../../lib/mapGeometry'
import type {BattleMap} from '../../../store/maps'
import {resolveDnd5eActivity,type Dnd5eActivityActorSnapshot} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {applyDnd5eActivityMapHandoffsV1,dnd5eActivityContinuationTeleportCells} from './dnd5eActivityMapInteraction'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {createDnd5eCombatant} from '../headlessCombatEngine'
import {createDnd5eMechanicalEffect} from '../activeEffects'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
beforeEach(()=>setMapGeometryRuntime([]))
it('derives exact provenance and live provider presence from the authoritative effect and registry',()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:dependencyId,name:'Provider',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'Private'},setup(){}})
 const owner=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:12,proficiencyBonus:3,currentHp:30,maxHp:30,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 owner.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'real-owned-curse',label:'Curse',targetId:'actor',source:{kind:'feature',actorId:'actor',pluginId:dependencyId,rulesId:'actual-curse'},modifiers:{},tags:['curse']})]
 try{expect(dnd5eActivityActorSnapshotFromCombatantV1(owner).activeEffectDefinitionIds?.[0]).toMatchObject({sourceRulesId:'actual-curse',sourcePluginId:dependencyId,sourcePluginAvailable:true})}finally{dispose()}
 expect(dnd5eActivityActorSnapshotFromCombatantV1(owner).activeEffectDefinitionIds?.[0]).toMatchObject({sourceRulesId:'actual-curse',sourcePluginId:dependencyId,sourcePluginAvailable:false})
})
const actor:Dnd5eActivityActorSnapshot={id:'actor',controller:'players',level:7,classLevels:{warlock:7},proficiencyBonus:3,abilities:{str:10,dex:10,con:14,int:10,wis:10,cha:18},conditions:[],armorClass:12,currentHp:40,maxHp:40}
const effect={definitionId:'actual-hex',sourceActorId:'actor',sourceRulesId:dependencyId+':hex',sourcePluginId:dependencyId,sourcePluginAvailable:true,tags:['curse','hex']}
const victim:Dnd5eActivityActorSnapshot={...actor,id:'victim',controller:'dm',activeEffectDefinitionIds:[effect]}
const resolve=(target=victim)=>resolveDnd5eActivity({activity:relentless,actor,targets:[target],rolls:{},continuationTargetIds:['forged-continuation-target']})
function map():BattleMap{return {id:'relentless-map',name:'Map',width:1000,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'actor',type:'player',label:'Actor',x:75,y:75,size:1,color:'#ffffff',emoji:'A'},{id:'victim',type:'enemy',label:'Victim',x:425,y:75,size:1,color:'#ffffff',emoji:'V'}]}}
it('validates explicit source and Host derives selected target identity rather than continuation/payload ids',()=>{
 expect(validateDnd5eActivityDefinitionV1(relentless)).toEqual([])
 const result=resolve();expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
 expect(result.proposals.find(p=>p.kind==='move')).toMatchObject({targetId:'actor',selectedTargetIds:['victim'],selectedTargetRadiusFeet:5,distanceFeet:30})
})
it.each(['other-owner','other-namespace','tag-only','wizard-bestow','suspended','uninstalled'])('rejects %s as the actual teleport binding',mode=>{
 const other={...effect,...(mode==='other-owner'?{sourceActorId:'other'}:mode==='other-namespace'?{sourcePluginId:'fake'}:mode==='tag-only'?{sourceRulesId:'fake'}:mode==='wizard-bestow'?{sourceRulesId:'bestow-curse',tags:['curse','bestow-curse']}:mode==='uninstalled'?{sourcePluginAvailable:false}:{suspended:true})}
 expect(resolve({...victim,activeEffectDefinitionIds:[other]}).ok).toBe(false)
})
it.each([-1,101,NaN])('strictly rejects invalid selected-target radius%s',radius=>{
 const bad=structuredClone(relentless),operation=bad.outcomes[0].operations[0];if(operation.kind!=='move')throw Error('Movement expected')
 operation.selectedTargetRadiusFeet=radius
 expect(validateDnd5eActivityDefinitionV1(bad).some(error=>error.includes('selectedTargetRadiusFeet'))).toBe(true)
})
it('uses a real Sign-derived curse, not a generic wizard spell',()=>{
 expect(resolve({...victim,activeEffectDefinitionIds:[{...effect,sourceRulesId:'bestow-curse',tags:['curse','dnd5e:warlock-curse']}]}).ok).toBe(true)
})
it('teleports30ft next to a visible curse35ft away through the real Map path without extra target range',()=>{
 const current=map(),result=resolve();expect(result.ok).toBe(true);if(!result.ok)return
 const movements=result.proposals.filter(p=>p.kind==='move')
 const apply=(col:number,extra:Partial<(typeof movements)[number]>={})=>applyDnd5eActivityMapHandoffsV1({map:current,activity:relentless,packageId:'test',actionId:'relentless',actorId:'actor',round:1,handoffs:{movements:movements.map(m=>({...m,...extra})),persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{'landing':{col,row:1}}}})
 expect(apply(7).ok).toBe(true)
 expect(apply(6).ok).toBe(false)
 expect(apply(8).ok).toBe(false)
 expect(apply(7,{selectedTargetIds:['nonexistent']}).ok).toBe(false)
 expect(apply(1).ok).toBe(false)
 expect(dnd5eActivityContinuationTeleportCells({map:current,actorToken:current.tokens[0],movement:movements[0]})).toContainEqual({col:7,row:1})
 current.tokens.push({...current.tokens[1],id:'occupant',x:375})
 expect(apply(7).ok).toBe(false)
})
it('allows unsupported visible air space without granting flight and enforces both3D bounds and volume occupancy',()=>{
 const current=map(),result=resolve();if(!result.ok)throw Error(result.reason)
 current.tokens[1].elevationFeet=30
 const movements=result.proposals.filter(p=>p.kind==='move')
 const apply=(height:number)=>applyDnd5eActivityMapHandoffsV1({map:current,activity:relentless,packageId:'test',actionId:'relentless-air',actorId:'actor',round:1,handoffs:{movements,persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{'landing':{col:7,row:1,elevationFeet:height}}}})
 const air=apply(25);expect(air.ok,JSON.stringify(air)).toBe(true)
 if(air.ok)expect(air.map.tokens[0]).toMatchObject({x:375,elevationFeet:25})
 expect(apply(20).ok).toBe(true)
 expect(apply(19).ok).toBe(false)
 expect(apply(35).ok).toBe(false)
 expect(apply(-1).ok).toBe(false)
 current.tokens.push({...current.tokens[1],id:'air-occupant',x:375,elevationFeet:25})
 expect(apply(25).ok).toBe(false)
})
it('revalidates source and destination antimagic volumes at the actual teleport Map commit',()=>{
 const current=map(),result=resolve();if(!result.ok)throw Error(result.reason)
 const movements=result.proposals.filter(p=>p.kind==='move')
 const run=(col:number,height=0)=>{
  current.dnd5ePluginAreas=[{id:'amf',pluginId:'test',featureId:'antimagic',sourceTokenId:'victim',sourceCharacterId:'',label:'Antimagic',color:'#9955ff',anchorCell:{col,row:1},cells:[{col,row:1}],createdRound:1,expiresAfterRound:100,includeSelf:true,relation:'any',occupantModifiers:{suppressesMagic:true},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:20}}]
  return applyDnd5eActivityMapHandoffsV1({map:current,activity:relentless,packageId:'test',actionId:'amf-space',actorId:'actor',round:1,handoffs:{movements,persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{'landing':{col:7,row:1,elevationFeet:height}}}})
 }
 expect(run(1).ok).toBe(false)
 expect(run(7).ok).toBe(false)
 current.tokens[1].elevationFeet=30
 expect(run(7,25).ok).toBe(true)
})

import {beforeEach,expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import type {BattleMap} from '../../../store/maps'
import {setMapGeometryRuntime} from '../../../lib/mapGeometry'
import {resolveDnd5eActivity,type Dnd5eActivityActorSnapshot} from './dnd5eActivityExecutor'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {applyDnd5eActivityMapHandoffsV1} from './dnd5eActivityMapInteraction'
beforeEach(()=>setMapGeometryRuntime([]))
const actor:Dnd5eActivityActorSnapshot={id:'actor',controller:'players',level:7,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:18},conditions:[],armorClass:12,currentHp:30,maxHp:30}
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'anchor-reference',name:'Reference anchor',automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'anchor-reference',magical:true},activation:{kind:'bonus-action'},target:{kind:'creature',count:1,relation:'any'},outcomes:[{id:'reference-and-damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:1},damageType:'psychic',magical:true},{id:'landing',kind:'move',target:'actor',mode:'teleport',distanceFeet:{kind:'constant',value:30},maximumDistanceFromActorFeet:30,selectedTargetRadiusFeet:5,verticalDestination:'space',requiresVisibleDestination:true,ignoresOpportunityAttacks:true}]}]}
function resolve(suppressed:boolean){return resolveDnd5eActivity({activity,actor,targets:[{...actor,id:'anchor',controller:'dm',magicSuppressed:suppressed}],rolls:{},movementAnchorTargetIds:['forged-player-anchor']})}
it('preserves the validated reference identity while still suppressing magical effects on the affected anchor',()=>{
 const result=resolve(true);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.proposals.some(p=>p.kind==='deal-damage')).toBe(false)
 expect(result.proposals.find(p=>p.kind==='move')).toMatchObject({targetId:'actor',selectedTargetIds:['anchor']})
})
it('keeps ordinary affected-target damage and derives the reference from actual selection instead of caller input',()=>{
 const result=resolve(false);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.proposals.find(p=>p.kind==='deal-damage')).toMatchObject({targetId:'anchor',amount:1})
 expect(result.proposals.find(p=>p.kind==='move')).toMatchObject({targetId:'actor',selectedTargetIds:['anchor']})
})
it('commits only field-external source/landing references and rejects unknown anchor identity',()=>{
 const result=resolve(true);if(!result.ok)throw Error(result.reason)
 const movements=result.proposals.filter(p=>p.kind==='move')
 const map:BattleMap={id:'reference-map',name:'Map',width:1000,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'actor',type:'player',label:'Actor',x:75,y:75,size:1,color:'#ffffff',emoji:'A'},{id:'anchor',type:'enemy',label:'Anchor',x:425,y:75,size:1,color:'#ffffff',emoji:'T'}]}
 const apply=(col:number,ids:readonly string[]=['anchor'])=>applyDnd5eActivityMapHandoffsV1({map:{...map,dnd5ePluginAreas:[{id:'amf',pluginId:'test',featureId:'antimagic',label:'Antimagic',sourceTokenId:'anchor',sourceCharacterId:'',color:'#9955ff',cells:[{col,row:1}],anchorCell:{col,row:1},createdRound:1,expiresAfterRound:100,includeSelf:true,relation:'any',occupantModifiers:{suppressesMagic:true},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:20}}]},activity,packageId:'test',actorId:'actor',actionId:'reference',round:1,handoffs:{movements:movements.map(m=>({...m,selectedTargetIds:ids})),persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{landing:{col:7,row:1,elevationFeet:0}}}})
 expect(apply(8).ok).toBe(true)
 expect(apply(1).ok).toBe(false)
 expect(apply(7).ok).toBe(false)
 expect(apply(8,['missing']).ok).toBe(false)
})

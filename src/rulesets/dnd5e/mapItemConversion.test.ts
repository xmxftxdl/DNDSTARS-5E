import {beforeEach,expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {setMapGeometryRuntime,createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {migrateMapsState} from '../../store/maps'
import {settleDnd5eMapItemConversion,dnd5eMapItemConversionBinding} from './mapItemConversion'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import {applyDnd5eActivityMapHandoffsV1,resolveDnd5eActivityAreaMapSelectionV1} from './activities/dnd5eActivityMapInteraction'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
const sourceId='srd-5.1:item:gold-dust-25gp',targetId='srd-5.1:item:holy-water-flask'
const proposal={kind:'convert-map-inventory-item' as const,operationId:'convert',originalTemplateIds:[sourceId],templateId:targetId,quantity:1}
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'conversion',name:'Synthetic conversion',activation:{kind:'action'},
 automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'area',origin:'point',relation:'any',shape:'rect',widthFeet:5,lengthFeet:5,
 heightFeet:5,placeRangeFeet:5,gridAligned:true},outcomes:[{id:'result',when:{kind:'always'},operations:[{id:'convert',kind:proposal.kind,
 originalTemplateIds:proposal.originalTemplateIds,templateId:targetId,quantity:1}]}]}
function fixture(quantity=1):BattleMap{return {id:'conversion-map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
 tokens:[{id:'actor',label:'Caster',type:'player',characterId:'caster',x:25,y:25,size:1,color:'',emoji:''},
 {id:'vial',label:'Not inferred from name',type:'obstacle',x:75,y:25,size:1,color:'',emoji:'',
 dnd5eObjectState:{schemaVersion:1,inventoryItem:{templateId:sourceId,quantity,receiptId:'physical-original'}}}]}}
const run=(map:BattleMap,p=proposal)=>settleDnd5eMapItemConversion({map,activity,actorTokenId:'actor',anchorCell:{col:1,row:0},actionId:'cast',proposal:p})
beforeEach(()=>setMapGeometryRuntime([]))
it.each([1,3])('permanently converts one physical unit from a stack of %s, retaining the remainder and reload',quantity=>{
 const map=fixture(quantity),before=structuredClone(map),binding=dnd5eMapItemConversionBinding(map,{col:1,row:0},[sourceId])
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const result=run(map);expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error('conversion')
 expect(map).toEqual(before)
 expect(result.map.tokens.find(t=>t.dnd5eObjectState?.inventoryItem?.templateId===targetId)?.dnd5eObjectState?.inventoryItem).toMatchObject({quantity:1,receiptId:'conversion:cast:convert'})
 expect(result.map.tokens.filter(t=>t.dnd5eObjectState?.inventoryItem?.templateId===sourceId).map(t=>t.dnd5eObjectState!.inventoryItem!.quantity)).toEqual(quantity===1?[]:[2])
 const reload=migrateMapsState({maps:[JSON.parse(JSON.stringify(result.map))]}) as {maps:BattleMap[]}
 expect(reload.maps[0].tokens.some(t=>t.dnd5eObjectState?.inventoryItem?.templateId===targetId)).toBe(true)
 expect(run(result.map).ok).toBe(false)
 expect(dnd5eMapItemConversionBinding(result.map,{col:1,row:0},[sourceId])).not.toBe(binding)
})
it.each(['missing','ambiguous','unknown-template','insufficient','magical','carried','remote','high','replaced','complex'] as const)('refuses %s without mutating any map object',mode=>{
 const map=fixture(),p=structuredClone(proposal)
 if(mode==='missing')map.tokens.pop()
 if(mode==='ambiguous')map.tokens.push({...map.tokens[1],id:'other'})
 if(mode==='unknown-template')p.templateId='missing:item'
 if(mode==='insufficient')p.quantity=2
 if(mode==='magical')map.tokens[1].dnd5eObjectState!.magical=true
 if(mode==='carried')map.tokens[1].dnd5eObjectState!.wornOrCarried=true
 if(mode==='remote')map.tokens[0].x=325
 if(mode==='high')map.tokens[1].elevationFeet=50
 if(mode==='replaced')map.tokens[1].dnd5eObjectState!.inventoryItem!.templateId=targetId
 if(mode==='complex')map.tokens[1].dnd5eObjectState!.remains={kind:'bone-pile'}
 const before=structuredClone(map);expect(run(map,p).ok).toBe(false);expect(map).toEqual(before)
})
it('applies an actual Activity map handoff and refuses two conversions atomically',()=>{
 const map=fixture(),areaSelection=resolveDnd5eActivityAreaMapSelectionV1({activity,map,actorToken:map.tokens[0],anchorCell:{col:1,row:0}})!
 const input={map,activity,packageId:'test.conversion',actionId:'cast',actorId:'actor',round:1,areaSelection,selection:{},
 handoffs:{summons:[],persistentAreas:[],movements:[],invocations:[],mapItemConversions:[proposal]}}
 const result=applyDnd5eActivityMapHandoffsV1(input);expect(result.ok,JSON.stringify(result)).toBe(true)
 const before=structuredClone(map)
 expect(applyDnd5eActivityMapHandoffsV1({...input,handoffs:{...input.handoffs,mapItemConversions:[proposal,proposal]}}).ok).toBe(false)
 expect(map).toEqual(before)
})
it('refuses a closed barrier and preserves unrelated object contamination when conversion succeeds',()=>{
 const map=fixture(),geometry=createEmptyMapGeometry(map.id,1)
 geometry.doors.push({id:'barrier',kind:'door',label:'Barrier',points:[{x:50,y:0},{x:50,y:500}],
  state:'closed',openState:'closed',lockState:'unlocked',physicalState:'intact',secret:false,
  blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20,createdAt:1})
 setMapGeometryRuntime([geometry]);expect(run(map).ok).toBe(false)
 setMapGeometryRuntime([]);map.tokens[1].dnd5eObjectState!.consumable={kind:'drink',contaminants:['poison']}
 const converted=run(map);expect(converted.ok).toBe(true)
 if(!converted.ok)throw Error('conversion')
 expect(converted.map.tokens[1].dnd5eObjectState?.consumable?.contaminants).toEqual(['poison'])
})
it('binds normalized physical identity independently of object key insertion order',()=>{
 const map=fixture(),binding=dnd5eMapItemConversionBinding(map,{col:1,row:0},[sourceId])
 const item=map.tokens[1].dnd5eObjectState!.inventoryItem!
 map.tokens[1].dnd5eObjectState={inventoryItem:{receiptId:item.receiptId,quantity:item.quantity,templateId:item.templateId},schemaVersion:1}
 expect(dnd5eMapItemConversionBinding(map,{col:1,row:0},[sourceId])).toBe(binding)
})

import type {BattleMap,Token} from '../../store/maps'
import {mapGeometryTokenElevation,type MapGeometryState} from '../../lib/mapGeometry'
import {normalizeStructureLifetimes} from '../../../shared/structure-lifetime.mjs'
import {dnd5eStructureObjectOutsideBoundary} from './structureObjectBoundary'
import {dnd5eInventoryItemTemplate} from './items'
import {dnd5eMapPhysicalItemTemplate} from './mapInventoryItemAuthoring'

/** Host resolves the food template from the imported module, never a player-supplied template override. */
export function prepareDnd5eMightyFortressFeast(input:{
 map:BattleMap;geometry:MapGeometryState;structureId:string;actorTokenId:string;
 worldMinute:number;expectedWorldDay:number;requestId:string;guests:number;mealTemplateId?:string;
}):{ok:true;map:BattleMap;geometry:MapGeometryState;remainingGuests:number}|{ok:false;reason:string} {
 const fail=(reason:string)=>({ok:false as const,reason})
 if(input.map.id!==input.geometry.mapId||!Number.isSafeInteger(input.worldMinute)||input.worldMinute<0||
  input.expectedWorldDay!==Math.floor(input.worldMinute/1440))return fail('fortress-feast-clock-changed')
 if(!Number.isInteger(input.guests)||input.guests<1||input.guests>100||!input.requestId||input.requestId.trim()!==input.requestId||input.requestId.length>160)return fail('fortress-feast-request-invalid')
 const records=normalizeStructureLifetimes(input.geometry.structureLifetimes)
 const record=records?.find(record=>record.id===input.structureId),services=record?.fortressServices
 if(!records||!record||record.replacementGroup!=='mighty-fortress'||!services||input.worldMinute<record.createdWorldMinute||
  (record.expiresWorldMinute!=null&&record.expiresWorldMinute<=input.worldMinute))return fail('fortress-feast-unavailable')
 const actor=input.map.tokens.find(token=>token.id===input.actorTokenId)
 if(!actor||actor.type==='obstacle'||actor.dnd5eSpellEffect||(actor.hp!=null&&actor.hp<=0)||
  ![record.casterId,...services.authorizedCreatureIds].includes(actor.characterId??actor.id))return fail('fortress-feast-unauthorized')
 const binding={schemaVersion:1 as const,mapId:input.map.id,structureId:record.id}
 try {
  if(dnd5eStructureObjectOutsideBoundary({binding,geometry:{maps:[input.geometry]},
   mapId:input.map.id,position:{x:actor.x,y:actor.y,elevationFeet:mapGeometryTokenElevation(input.geometry,actor)}}))return fail('fortress-feast-outside')
 }catch{return fail('fortress-feast-boundary-unavailable')}
 if(services.mealDay>input.expectedWorldDay)return fail('fortress-feast-clock-changed')
 const today=services.mealDay===input.expectedWorldDay?services:{...services,mealDay:input.expectedWorldDay,mealsServed:0,mealReceipts:[]}
 if(today.mealReceipts.includes(input.requestId))return fail('fortress-feast-already-served')
 if(today.mealsServed+input.guests>100)return fail('fortress-feast-daily-limit')
 if(services.mealTemplateId&&input.mealTemplateId&&services.mealTemplateId!==input.mealTemplateId)return fail('fortress-feast-recipe-mismatch')
 const template=dnd5eInventoryItemTemplate(services.mealTemplateId??input.mealTemplateId??'')
 if(!template||template.category!=='consumable'||!dnd5eMapPhysicalItemTemplate(template))return fail('fortress-feast-template-unavailable')
 const id=`fortress-meal:${crypto.randomUUID()}`
 const token:Token={id,type:'obstacle',label:`九道菜宴席（${input.guests} 人份）`,x:actor.x,y:actor.y,
  elevationFeet:mapGeometryTokenElevation(input.geometry,actor),size:1,color:'#d4a34c',emoji:'',dnd5eObjectState:{schemaVersion:1,
   structureBinding:binding,magical:true,consumable:{kind:'food',contaminants:[]},
   ...(typeof template.weightLb==='number'?{weightPounds:template.weightLb*input.guests}:{}),
   inventoryItem:{templateId:template.id,quantity:input.guests,receiptId:id}}}
 const nextServices={...today,mealsServed:today.mealsServed+input.guests,mealReceipts:[...today.mealReceipts,input.requestId]}
 return {ok:true,map:{...input.map,tokens:[...input.map.tokens,token]},geometry:{...input.geometry,
  structureLifetimes:records.map(candidate=>candidate.id===record.id?{...candidate,fortressServices:nextServices}:candidate)},remainingGuests:100-nextServices.mealsServed}
}

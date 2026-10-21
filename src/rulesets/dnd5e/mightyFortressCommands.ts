import type {BattleMap} from '../../store/maps'
import {mapGeometryTokenElevation,type MapGeometryState} from '../../lib/mapGeometry'
import {normalizeStructureLifetimes} from '../../../shared/structure-lifetime.mjs'
import {dnd5eStructureObjectOutsideBoundary} from './structureObjectBoundary'

/** Assigns orders only. An order is not evidence that its requested physical action occurred. */
export function prepareDnd5eFortressServantCommand(input:{
 map:BattleMap;geometry:MapGeometryState;structureId:string;actorTokenId:string;worldMinute:number;
 servantNumbers:readonly number[];instruction:string;
}):{ok:true;geometry:MapGeometryState}|{ok:false;reason:string}{
 const fail=(reason:string)=>({ok:false as const,reason})
 if(input.map.id!==input.geometry.mapId||!Number.isSafeInteger(input.worldMinute)||input.worldMinute<0||
  !Array.isArray(input.servantNumbers)||!input.servantNumbers.length||input.servantNumbers.length>100||
  new Set(input.servantNumbers).size!==input.servantNumbers.length||input.servantNumbers.some(n=>!Number.isInteger(n)||n<1||n>100)||
  typeof input.instruction!=='string'||input.instruction.length>1000)return fail('fortress-command-invalid')
 const records=normalizeStructureLifetimes(input.geometry.structureLifetimes)
 const record=records?.find(record=>record.id===input.structureId),services=record?.fortressServices
 if(!records||!record||record.replacementGroup!=='mighty-fortress'||!services?.servants||
  input.worldMinute<record.createdWorldMinute||(record.expiresWorldMinute!=null&&input.worldMinute>=record.expiresWorldMinute))return fail('fortress-command-unavailable')
 const actor=input.map.tokens.find(token=>token.id===input.actorTokenId)
 if(!actor||actor.type==='obstacle'||actor.dnd5eSpellEffect||(actor.hp!=null&&actor.hp<=0)||
  ![record.casterId,...services.authorizedCreatureIds].includes(actor.characterId??actor.id))return fail('fortress-command-unauthorized')
 try{
  if(dnd5eStructureObjectOutsideBoundary({binding:{mapId:input.map.id,structureId:record.id},
   geometry:{maps:[input.geometry]},mapId:input.map.id,position:{x:actor.x,y:actor.y,elevationFeet:mapGeometryTokenElevation(input.geometry,actor)}}))return fail('fortress-command-outside')
 }catch{return fail('fortress-command-boundary-unavailable')}
 const instruction=input.instruction.trim(),numbers=new Set(input.servantNumbers)
 if(services.servants.some(servant=>numbers.has(servant.number)&&servant.tokenId&&
  !input.map.tokens.some(token=>token.id===servant.tokenId&&token.type==='obstacle'&&token.hp!=null&&token.hp>0&&
   token.dnd5eObjectState?.structureBinding?.mapId===input.map.id&&token.dnd5eObjectState.structureBinding.structureId===record.id)))return fail('fortress-command-servant-unavailable')
 const servants=services.servants.map(servant=>numbers.has(servant.number)?{number:servant.number,...(servant.tokenId?{tokenId:servant.tokenId}:{}),
  ...(instruction?{assignment:{actorId:actor.characterId??actor.id,instruction}}:{})}:servant)
 return {ok:true,geometry:{...input.geometry,structureLifetimes:records.map(candidate=>candidate.id===record.id?
  {...record,fortressServices:{...services,servants}}:candidate)}}
}

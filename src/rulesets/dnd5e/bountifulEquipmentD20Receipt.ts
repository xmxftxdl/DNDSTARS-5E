import type {PreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import type {OriginalD20Ready} from './allyNaturalOneCheckpoint'
import type {BountifulEquipmentD20Selection} from './bountifulEquipmentD20Mechanics'
import {bountifulPreparedController} from './bountifulPreparedController'
import {dnd5eAttackRollRerollCandidates} from './inventoryHeadlessEffects'
import {normalizeDnd5eInventory} from './items'

interface Identity{
 roomId:string;mapId:string;combatId:string;parentId:string;sourceOccurrence:number
 readyOrdinal:number;rawRollId:string;hostMemberId:string
 roller:{tokenId:string;characterId:string;memberId:string}
}
interface EquipmentChoice{decision:'reroll';dieIndex:number;instanceId:string;effectId:string;resourceId:string}
export type BountifulEquipmentD20Command=
 |{phase:'equipment-choice';promptId:string;decision:'keep'}
 |({phase:'equipment-choice';promptId:string}&EquipmentChoice)
 |{phase:'equipment-roll';promptId:string;rollRequestId:string;value:number}
 |{phase:'equipment-confirm';promptId:string;rollRequestId:string;rawValue:number;value:number}
export interface BountifulEquipmentD20Response{
 id:string;roomId:string;mapId:string;combatId:string;parentId:string;roomMemberId:string
 sourceMode:'dm'|'player';actorTokenId:string;characterId:string;command:BountifulEquipmentD20Command
}
export interface BountifulEquipmentD20Receipt{
 schemaVersion:1;kind:'equipment-reroll';id:string;identity:Identity;ready:OriginalD20Ready
 inventorySignature:string
 candidates:readonly {instanceId:string;effectId:string;resourceId:string;itemName:string;dieIndices:readonly number[]}[]
 choice?:{requestId:string;memberId:string;decision:'keep'}|({requestId:string;memberId:string}&EquipmentChoice)
 raw?:{requestId:string;memberId:string;value:number}
 confirmed?:{requestId:string;memberId:string;rawValue:number;value:number}
 processed:readonly {id:string;signature:string}[]
}
const face=(value:number)=>Number.isInteger(value)&&value>=1&&value<=20
const text=(value:string,max=1000)=>typeof value==='string'&&!!value&&value.trim()===value&&value.length<=max
export function bountifulEquipmentD20PromptId(identity:Identity){return JSON.stringify(['bountiful-equipment-d20',identity.roomId,identity.mapId,identity.parentId,identity.sourceOccurrence,identity.readyOrdinal,identity.rawRollId])}
export const bountifulEquipmentD20RollId=(receipt:BountifulEquipmentD20Receipt)=>receipt.id+':owned-reroll'
export function bountifulEquipmentD20Phase(receipt:BountifulEquipmentD20Receipt){return !receipt.choice?'owner-choice':receipt.choice.decision==='keep'||receipt.confirmed?'complete':!receipt.raw?'roller':'host-confirmation'}

/** Data factory only. The persistent Host issuer must first reread the real
 * private parent/resources and reproduce this exact prepared ready snapshot.
 * A client-created object has no power to enter a parent or consume a cost. */
export function createBountifulEquipmentD20Receipt(input:{identity:Identity;prepared:PreparedDnd5eEquipmentAttack;ready:OriginalD20Ready}):BountifulEquipmentD20Receipt|undefined{
 const {identity,prepared,ready}=input
 const controller=bountifulPreparedController(prepared,ready.actorId,identity.hostMemberId)
 if(!text(identity.roomId)||!text(identity.mapId)||!text(identity.combatId)||!text(identity.parentId,500)||!text(identity.rawRollId)||!text(identity.hostMemberId)||identity.mapId!==prepared.map.id||identity.combatId!==prepared.state.combatId||identity.parentId!==prepared.action.id||!Number.isSafeInteger(identity.sourceOccurrence)||identity.sourceOccurrence<0||identity.sourceOccurrence>511||!Number.isSafeInteger(identity.readyOrdinal)||identity.readyOrdinal<0||identity.readyOrdinal!==ready.ordinal||ready.kind!=='attack'||ready.actorId!==prepared.actorToken.id||identity.roller.tokenId!==ready.actorId||identity.roller.characterId!==controller.characterId||identity.roller.memberId!==controller.memberId)throw Error('bountiful-equipment-receipt:actual-ready-source-required')
 if(!ready.rollMode||ready.values.length!==(ready.rollMode==='normal'?1:2)||ready.originalRolls.length!==ready.values.length||ready.values.some(value=>!face(value))||ready.originalRolls.some(value=>!face(value))||new Set(ready.finalizedDice).size!==ready.finalizedDice.length||ready.finalizedDice.some(index=>!Number.isInteger(index)||index<0||index>=ready.values.length))throw Error('bountiful-equipment-receipt:invalid-original-dice')
 const dieIndices=ready.values.flatMap((_,index)=>ready.finalizedDice.includes(index)?[]:[index])
 const candidates=dnd5eAttackRollRerollCandidates(prepared.actor,prepared.profile.weaponId).map(row=>({instanceId:row.instanceId,effectId:row.effectId,resourceId:row.effect.resourceId,itemName:row.itemName,dieIndices:[...dieIndices]}))
 if(!dieIndices.length||!candidates.length)return undefined
 return {schemaVersion:1,kind:'equipment-reroll',id:bountifulEquipmentD20PromptId(identity),identity:structuredClone(identity),ready:structuredClone(ready),inventorySignature:JSON.stringify(normalizeDnd5eInventory(prepared.actor)),candidates,processed:[]}
}
/** Only a server-stamped append row enters here. No SharedChoice response or
 * client-supplied principal is treated as the authenticated original roller. */
export function applyBountifulEquipmentD20Response(receipt:BountifulEquipmentD20Receipt,response:BountifulEquipmentD20Response):BountifulEquipmentD20Receipt{
 const {identity}=receipt,command=response.command
 if(receipt.id!==bountifulEquipmentD20PromptId(identity)||!text(response.id)||response.roomId!==identity.roomId||response.mapId!==identity.mapId||response.combatId!==identity.combatId||response.parentId!==identity.parentId||command.promptId!==receipt.id||!['dm','player'].includes(response.sourceMode)||response.sourceMode==='dm'&&response.roomMemberId!==identity.hostMemberId)throw Error('bountiful-equipment-receipt:wrong-parent-or-principal')
 const signature=JSON.stringify(response),seen=receipt.processed.find(row=>row.id===response.id)
 if(seen){if(seen.signature!==signature)throw Error('bountiful-equipment-receipt:changed-replayed-response');return structuredClone(receipt)}
 const phase=bountifulEquipmentD20Phase(receipt),next=structuredClone(receipt)
 if(command.phase==='equipment-choice'){
  const allowed=command.decision==='keep'?['phase','promptId','decision']:['phase','promptId','decision','dieIndex','instanceId','effectId','resourceId']
  if(Object.keys(command).some(key=>!allowed.includes(key))||phase!=='owner-choice'||response.roomMemberId!==identity.roller.memberId||response.actorTokenId!==identity.roller.tokenId||response.characterId!==identity.roller.characterId)throw Error('bountiful-equipment-receipt:owner-choice-required')
  if(command.decision==='keep')next.choice={requestId:response.id,memberId:response.roomMemberId,decision:'keep'}
  else{
   const candidate=receipt.candidates.find(row=>row.instanceId===command.instanceId&&row.effectId===command.effectId&&row.resourceId===command.resourceId&&row.dieIndices.includes(command.dieIndex))
   if(command.decision!=='reroll'||!candidate)throw Error('bountiful-equipment-receipt:unavailable-original-die-or-item')
   next.choice={requestId:response.id,memberId:response.roomMemberId,decision:'reroll',dieIndex:command.dieIndex,instanceId:candidate.instanceId,effectId:candidate.effectId,resourceId:candidate.resourceId}
  }
 }else if(command.phase==='equipment-roll'){
  if(Object.keys(command).some(key=>!['phase','promptId','rollRequestId','value'].includes(key))||phase!=='roller'||response.roomMemberId!==identity.roller.memberId||response.actorTokenId!==identity.roller.tokenId||response.characterId!==identity.roller.characterId||command.rollRequestId!==bountifulEquipmentD20RollId(receipt)||!face(command.value))throw Error('bountiful-equipment-receipt:original-roller-required')
  next.raw={requestId:command.rollRequestId,memberId:response.roomMemberId,value:command.value}
 }else if(command.phase==='equipment-confirm'){
  if(Object.keys(command).some(key=>!['phase','promptId','rollRequestId','rawValue','value'].includes(key))||phase!=='host-confirmation'||response.sourceMode!=='dm'||response.roomMemberId!==identity.hostMemberId||response.actorTokenId!==identity.roller.tokenId||response.characterId!==identity.roller.characterId||command.rollRequestId!==bountifulEquipmentD20RollId(receipt)||command.rawValue!==receipt.raw?.value||!face(command.value))throw Error('bountiful-equipment-receipt:host-confirmation-required')
  next.confirmed={requestId:command.rollRequestId,memberId:response.roomMemberId,rawValue:command.rawValue,value:command.value}
 }else throw Error('bountiful-equipment-receipt:invalid-command')
 next.processed=[...receipt.processed,{id:response.id,signature}]
 return next
}
export function selectionFromBountifulEquipmentD20Receipt(receipt:BountifulEquipmentD20Receipt):BountifulEquipmentD20Selection|undefined{
 if(bountifulEquipmentD20Phase(receipt)!=='complete')throw Error('bountiful-equipment-receipt:decision-pending')
 if(receipt.choice?.decision==='keep')return undefined
 if(!receipt.choice||!receipt.confirmed||!receipt.raw||receipt.confirmed.rawValue!==receipt.raw.value||receipt.confirmed.requestId!==bountifulEquipmentD20RollId(receipt)||receipt.confirmed.memberId!==receipt.identity.hostMemberId)throw Error('bountiful-equipment-receipt:real-confirmed-result-required')
 return {parentId:receipt.identity.parentId,readyOrdinal:receipt.identity.readyOrdinal,dieIndex:receipt.choice.dieIndex,originalValue:receipt.ready.values[receipt.choice.dieIndex],replacement:receipt.confirmed.value,instanceId:receipt.choice.instanceId,effectId:receipt.choice.effectId,resourceId:receipt.choice.resourceId}
}

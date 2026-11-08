import type {BountifulEquipmentD20Command} from './bountifulEquipmentD20Receipt'
import {createSharedPlayerActionEnvelope} from '../../lib/playerActionSync'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BountifulOriginalDieCommand} from './bountifulLuckReceipt'
export interface BountifulEquipmentContext{parentId:string;occurrence:number;combatId:string;actorTokenId:string;characterId:string;promptId:string;rollRequestId?:string}
export interface BountifulChoiceContext{parentId:string;occurrence:number;combatId:string;actorTokenId:string;characterId:string;ownerId:string;featureId:string}
export interface BountifulRollContext{parentId:string;occurrence:number;combatId:string;actorTokenId:string;characterId:string;rollRequestId:string}
export function bountifulResponseId(context:{parentId:string;occurrence:number},phase:string){const text=JSON.stringify([context.parentId,context.occurrence,phase]);let first=2166136261,second=2246822519;for(let index=0;index<text.length;index++){first=Math.imul(first^text.charCodeAt(index),16777619);second=Math.imul(second^text.charCodeAt(index),3266489917)}return'bountiful-response:'+(first>>>0).toString(36)+(second>>>0).toString(36)}
export type BountifulNativeLuckyContext=Omit<BountifulRollContext,'rollRequestId'>
type Gateway=Pick<SharedRoomGatewayPort,'appendPlayerActionRequest'>
async function append(input:{mapId:string;context:BountifulRollContext|BountifulChoiceContext|BountifulEquipmentContext|BountifulNativeLuckyContext;command:BountifulOriginalDieCommand|BountifulEquipmentD20Command;phaseId:string;round:number;initiativeIndex:number},gateway:Gateway){
 const {context}=input
 if(!context.parentId||!Number.isSafeInteger(context.occurrence)||context.occurrence<0||!context.combatId||!context.actorTokenId||!context.characterId)throw Error('bountiful-client:invalid-context')
 const action=createSharedPlayerActionEnvelope({mapId:input.mapId,combatId:context.combatId,sourceMode:getRoomSession()?.role==='dm'?'dm':'player',actorTokenId:context.actorTokenId,characterId:context.characterId,round:input.round,initiativeIndex:input.initiativeIndex,nextSeq:()=>0,patch:{type:'dnd5e-bountiful-luck',bountifulLuck:{parentId:context.parentId,occurrence:context.occurrence,command:input.command}}})
 if(!action)throw Error('bountiful-client:envelope-unavailable')
 action.id=bountifulResponseId(context,input.phaseId);await gateway.appendPlayerActionRequest(action);return action.id
}
export async function submitBountifulOwnerChoice(input:{mapId:string;context:BountifulChoiceContext;optionId:string;round:number;initiativeIndex:number},gateway:Gateway){
 if(!['decline',input.context.featureId].includes(input.optionId))return undefined
 if(input.context.ownerId!==input.context.actorTokenId)throw Error('bountiful-client:owner-context-mismatch')
 return append({...input,phaseId:'owner:'+input.context.ownerId+':'+input.context.featureId,command:{phase:'reaction',ownerId:input.context.ownerId,featureId:input.context.featureId,decision:input.optionId==='decline'?'decline':'use'}},gateway)
}
export async function submitBountifulOriginalReroll(input:{mapId:string;context:BountifulRollContext;values:readonly number[];round:number;initiativeIndex:number},gateway:Gateway){
 if(!input.context.rollRequestId||input.values.length!==1||!Number.isInteger(input.values[0])||input.values[0]<1||input.values[0]>20)throw Error('bountiful-client:invalid-reroll')
 return append({...input,phaseId:'roll',command:{phase:'roll',rollRequestId:input.context.rollRequestId,value:input.values[0]}},gateway)
}
export async function submitBountifulHostConfirmation(input:{mapId:string;context:BountifulRollContext;rawValue:number;value:number;round:number;initiativeIndex:number},gateway:Gateway){
 if(getRoomSession()?.role!=='dm')throw Error('bountiful-client:host-required')
 if(![input.rawValue,input.value].every(value=>Number.isInteger(value)&&value>=1&&value<=20))throw Error('bountiful-client:invalid-confirmation')
 return append({...input,phaseId:'confirm',command:{phase:'confirm',rollRequestId:input.context.rollRequestId,rawValue:input.rawValue,value:input.value}},gateway)
}
export async function submitBountifulOwnedDiceResult(input:{mapId:string;combatId?:string;requestId:string;characterId?:string;values:readonly number[];round:number;initiativeIndex:number},gateway:Gateway&Pick<SharedRoomGatewayPort,'loadResource'>){
 if(!input.characterId)return undefined
 const combat=await gateway.loadResource<{active?:boolean;combatId?:string;bountifulLuckPrompts?:readonly {kind?:'equipment-reroll';promptId?:string;sourceOccurrence?:number;parentId:string;occurrence:number;mapId:string;combatId:string;phase:string;rollerTokenId:string;rollerCharacterId?:string;rollRequestId?:string}[]}>('combat')
 // The normal dice transport keeps the public inactive boundary. Its exact
 // protected prompt supplies the issued parent scope, without changing combat.
 const sceneTransport=combat?.active===false&&combat.combatId===input.combatId
 const matches=combat?.bountifulLuckPrompts?.filter(row=>row.phase==='roll'&&row.mapId===input.mapId&&(row.combatId===input.combatId||sceneTransport)&&row.rollerCharacterId===input.characterId&&row.rollRequestId===input.requestId)??[]
 const prompt=matches.length===1?matches[0]:undefined
 if(!prompt)return undefined
 if(prompt.kind==='equipment-reroll'){
  if(!prompt.promptId||!Number.isSafeInteger(prompt.sourceOccurrence))throw Error('bountiful-client:invalid-equipment-prompt')
  return submitBountifulEquipmentReroll({...input,context:{parentId:prompt.parentId,occurrence:prompt.sourceOccurrence!,combatId:prompt.combatId,actorTokenId:prompt.rollerTokenId,characterId:input.characterId,promptId:prompt.promptId,rollRequestId:input.requestId}},gateway)
 }
 return submitBountifulOriginalReroll({...input,context:{parentId:prompt.parentId,occurrence:prompt.occurrence,combatId:prompt.combatId,actorTokenId:prompt.rollerTokenId,characterId:input.characterId,rollRequestId:input.requestId}},gateway)
}

/** The public prompt contains no principal, private parent or mutable state.
 * The Host rereads this append request and the actual issued source. */
export async function submitBountifulEquipmentChoice(input:{mapId:string;context:BountifulEquipmentContext;optionId:string;round:number;initiativeIndex:number},gateway:Gateway){
 const {context}=input
 let command:BountifulEquipmentD20Command
 if(input.optionId==='keep')command={phase:'equipment-choice',promptId:context.promptId,decision:'keep'}
 else{
  let value:unknown;try{value=JSON.parse(input.optionId)}catch{return undefined}
  if(!Array.isArray(value)||value.length!==5||value[0]!=='reroll'||![value[1],value[2],value[3]].every(row=>typeof row==='string'&&!!row)||!Number.isInteger(value[4])||value[4]<0||value[4]>1)return undefined
  command={phase:'equipment-choice',promptId:context.promptId,decision:'reroll',instanceId:value[1],effectId:value[2],resourceId:value[3],dieIndex:value[4]}
 }
 return append({...input,phaseId:'equipment-choice:'+context.promptId,command},gateway)
}
export async function submitBountifulEquipmentReroll(input:{mapId:string;context:BountifulEquipmentContext;values:readonly number[];round:number;initiativeIndex:number},gateway:Gateway){
 if(!input.context.rollRequestId||input.values.length!==1||!Number.isInteger(input.values[0])||input.values[0]<1||input.values[0]>20)throw Error('bountiful-client:invalid-equipment-reroll')
 return append({...input,phaseId:'equipment-roll:'+input.context.promptId,command:{phase:'equipment-roll',promptId:input.context.promptId,rollRequestId:input.context.rollRequestId,value:input.values[0]}},gateway)
}
export async function submitBountifulEquipmentHostConfirmation(input:{mapId:string;context:BountifulEquipmentContext;rawValue:number;value:number;round:number;initiativeIndex:number},gateway:Gateway){
 if(getRoomSession()?.role!=='dm')throw Error('bountiful-client:host-required')
 if(!input.context.rollRequestId||![input.rawValue,input.value].every(value=>Number.isInteger(value)&&value>=1&&value<=20))throw Error('bountiful-client:invalid-equipment-confirmation')
 return append({...input,phaseId:'equipment-confirm:'+input.context.promptId,command:{phase:'equipment-confirm',promptId:input.context.promptId,rollRequestId:input.context.rollRequestId,rawValue:input.rawValue,value:input.value}},gateway)
}
function contextData(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)}
export function isBountifulEquipmentContext(value:unknown):value is BountifulEquipmentContext{
 return contextData(value)&&['parentId','combatId','actorTokenId','characterId','promptId'].every(key=>typeof value[key]==='string'&&!!value[key])&&typeof value.occurrence==='number'&&Number.isSafeInteger(value.occurrence)&&value.occurrence>=0&&(value.rollRequestId===undefined||typeof value.rollRequestId==='string')
}
export function isBountifulChoiceContext(value:unknown):value is BountifulChoiceContext{
 return contextData(value)&&['parentId','combatId','actorTokenId','characterId','ownerId','featureId'].every(key=>typeof value[key]==='string'&&!!value[key])&&typeof value.occurrence==='number'&&Number.isSafeInteger(value.occurrence)&&value.occurrence>=0
}

export async function submitBountifulNativeLuckyChoice(input:{mapId:string;context:BountifulNativeLuckyContext;decision:'use'|'decline';round:number;initiativeIndex:number},gateway:Gateway){if(!['use','decline'].includes(input.decision))throw Error('bountiful-client:invalid-native-lucky-choice');return append({...input,phaseId:'native-lucky',command:{phase:'native-lucky',decision:input.decision}},gateway)}

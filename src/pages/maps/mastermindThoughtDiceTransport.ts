import{getRoomSession}from'../../lib/roomSession'
import{requestSharedMastermindThoughtReading}from'../../lib/sharedApi'
import{issueMastermindThoughtContestRolls,prepareMastermindThoughtContestPrefix}from'./mastermindThoughtContestPrefix'
import{readMastermindThoughtContestOriginal,type MastermindThoughtOriginal,type MastermindThoughtGateway}from'./mastermindThoughtReadingParent'

type Operation='roll-request'|'raw'|'confirm'
type Api=<T>(operation:Operation,input:unknown)=>Promise<T>
export interface MastermindThoughtDiceRequest{id:string;parentId:string;mapId:string;role:'owner'|'reader';rollerTokenId:string;rollerCharacterId:string;controllerMemberId:string;mode:'normal'|'advantage'|'disadvantage';count:number;sides:20;phase:'raw'|'dm-confirm'|'confirmed';rawValues?:number[];confirmedValues?:number[]}
const identity=(requestId:string)=>{const match=/^(mastermind-thought-reading:[a-f0-9]{32}):(owner|reader)$/.exec(requestId);return match?{id:match[1],role:match[2]as'owner'|'reader'}:undefined}
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i])
export async function readMastermindThoughtDiceRequest(requestId:string,api:Api=requestSharedMastermindThoughtReading){const parent=identity(requestId);if(!parent)return undefined;const reply=await api<{request:MastermindThoughtDiceRequest}>('roll-request',{id:parent.id,requestId}),row=reply.request;if(!row||row.id!==requestId||row.parentId!==parent.id||row.role!==parent.role)throw Error('thought-dice:issued-request-required');return row}

/** Actual owner DiceBox completion, before publishing its delegated result. */
export async function submitMastermindThoughtOwnedRaw(input:{requestId:string;mapId:string;characterId?:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedMastermindThoughtReading){const row=await readMastermindThoughtDiceRequest(input.requestId,api);if(!row)return;const session=getRoomSession();if(!session||session.memberId!==row.controllerMemberId||row.mapId!==input.mapId||row.rollerCharacterId!==input.characterId||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('thought-dice:actual-roller-required');await api('raw',{id:row.parentId,role:row.role,requestId:row.id,values:[...input.values]})}

/** Host physical raw is captured before the DM confirmation is opened. A PC
 * raw has to already exist from its separate authenticated actual button. */
export async function lockMastermindThoughtRawBeforeConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedMastermindThoughtReading){let row=await readMastermindThoughtDiceRequest(input.requestId,api);if(!row)return;const session=getRoomSession();if(session?.role!=='dm'||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('thought-dice:actual-host-request-required');if(!row.rawValues){if(row.controllerMemberId!==session.memberId)throw Error('thought-dice:authenticated-player-raw-pending');await api('raw',{id:row.parentId,role:row.role,requestId:row.id,values:[...input.values]});row=await readMastermindThoughtDiceRequest(input.requestId,api)}if(!row?.rawValues||!same(row.rawValues,input.values))throw Error('thought-dice:original-raw-mismatch')}

/** The actual independently adopted DM faces, never substituted for raw. */
export async function confirmMastermindThoughtPool(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedMastermindThoughtReading){const row=await readMastermindThoughtDiceRequest(input.requestId,api);if(!row)return;const session=getRoomSession();if(session?.role!=='dm'||!row.rawValues||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('thought-dice:actual-confirmation-required');await api('confirm',{id:row.parentId,role:row.role,requestId:row.id,values:[...input.values]})}

export interface MastermindThoughtPhysicalPorts{
 /** This port must explicitly skip DM confirmation, so its return is physical
  * raw rather than an already adopted scalar. Delegated PC raw is posted by
  * the actual player completion callback before its result event. */
 rollOriginalWithoutConfirmation(request:MastermindThoughtDiceRequest):Promise<readonly number[]>
 /** Open the real DM confirmation using this same durable id/roller. Its
  * canonical callback records confirmation through the separate endpoint. */
 confirmStored(request:MastermindThoughtDiceRequest,raw:readonly number[]):Promise<readonly number[]>
}
export async function collectMastermindThoughtContestPhysical(original:MastermindThoughtOriginal,gateway:MastermindThoughtGateway,ui:MastermindThoughtPhysicalPorts){
 await readMastermindThoughtContestOriginal(original,gateway);
 const issued=await issueMastermindThoughtContestRolls(original,gateway),api:Api=(operation,input)=>gateway.request(operation,input);
 for(const request of issued){
  await readMastermindThoughtContestOriginal(original,gateway);
  let row=await readMastermindThoughtDiceRequest(request.requestId,api);if(!row)throw Error('thought-dice:issued-request-required');
  if(row.confirmedValues)continue;
  if(!row.rawValues){const raw=await ui.rollOriginalWithoutConfirmation(row);await lockMastermindThoughtRawBeforeConfirmation({requestId:row.id,rollerTokenId:row.rollerTokenId,sides:row.sides,values:raw},api);row=await readMastermindThoughtDiceRequest(request.requestId,api)}
  if(!row?.rawValues)throw Error('thought-dice:authenticated-original-raw-required');
  await ui.confirmStored(row,row.rawValues);
  const confirmed=await readMastermindThoughtDiceRequest(request.requestId,api);if(!confirmed?.confirmedValues)throw Error('thought-dice:authenticated-confirmation-required');
 }
 const prefix=await prepareMastermindThoughtContestPrefix(original,gateway);if(!prefix)throw Error('thought-dice:authenticated-prefix-required');return prefix
}


/** Controller routing for this exact server-issued pool. Token faction is
 * presentation; it cannot replace the authenticated current controller. */
export async function readMastermindThoughtPlayerDiceOwner(input:{requestId:string;mapId:string;rollerTokenId?:string;rollerCharacterId?:string;count:number;sides:number},api:Api=requestSharedMastermindThoughtReading){
 if(!input.requestId.startsWith('mastermind-thought-reading:'))return undefined;
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('thought-dice:actual-host-required');
 const row=await readMastermindThoughtDiceRequest(input.requestId,api);
 if(!row||row.mapId!==input.mapId||row.rollerTokenId!==input.rollerTokenId||row.rollerCharacterId!==input.rollerCharacterId||row.count!==input.count||row.sides!==input.sides||!row.controllerMemberId)throw Error('thought-dice:exact-issued-pool-required');
 return{characterId:row.rollerCharacterId,memberId:row.controllerMemberId,hostMemberId:session.memberId};
}

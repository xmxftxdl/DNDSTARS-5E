import {getRoomSession} from '../../lib/roomSession'
import {requestSharedArcaneBasePrefix} from "../../composition/browserSharedRoomResources"
import type {ArcaneBasePrefixTransport} from './arcaneBasePrefixRolls'

export interface ArcaneBasePrefixDiceRequest {
  requestId:string;mapId:string;combatId:string;rollerTokenId:string;rollerCharacterId:string;controllerMemberId:string
  phase:'waiting';kind:'d20'|'dice';count:number;sides:number
  raw?:{values:number[]};confirmed?:{values:number[];originalValues:number[]}
}
type Api=<T>(operation:'begin'|'issue'|'raw'|'confirm'|'request',input:Record<string,unknown>)=>Promise<T>
const isPrefix=(id:string)=>/^host-arcane-base:[a-f0-9]{32}$/.test(id)
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i])
export const arcaneBasePrefixTransport:ArcaneBasePrefixTransport={
  begin:input=>requestSharedArcaneBasePrefix('begin',input),issue:input=>requestSharedArcaneBasePrefix('issue',input),
}
export async function readArcaneBasePrefixDiceRequest(requestId:string,api:Api=requestSharedArcaneBasePrefix){
  if(!isPrefix(requestId))return undefined
  const reply=await api<{request:ArcaneBasePrefixDiceRequest}>('request',{requestId}),row=reply.request
  if(!row||row.requestId!==requestId||row.phase!=='waiting')throw Error('arcane-base-prefix-issued-request-required')
  return row
}
/** Called after the actual player DiceBox resolves, before its result event. */
export async function submitArcaneBasePrefixOwnedRaw(input:{requestId:string;mapId:string;characterId?:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedArcaneBasePrefix){
  const row=await readArcaneBasePrefixDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.memberId!==row.controllerMemberId||row.mapId!==input.mapId||row.rollerCharacterId!==input.characterId||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('arcane-base-prefix-original-dice-owner-required')
  if(row.raw){if(!same(row.raw.values,input.values))throw Error('arcane-base-prefix-original-raw-mismatch');return}
  try{await api('raw',{requestId:row.requestId,rollerTokenId:row.rollerTokenId,sides:row.sides,values:[...input.values]})}
  catch(error){const saved=await readArcaneBasePrefixDiceRequest(input.requestId,api);if(!saved?.raw||!same(saved.raw.values,input.values))throw error}
}
/** Host-owned raw is captured before the real confirmation UI opens. A PC's
 * raw must already have arrived through its own authenticated POST. */
export async function lockArcaneBasePrefixRawBeforeConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedArcaneBasePrefix){
  let row=await readArcaneBasePrefixDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.role!=='dm'||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('arcane-base-prefix-original-host-request-required')
  if(!row.raw){
    if(row.controllerMemberId!==session.memberId)throw Error('arcane-base-prefix-authenticated-player-raw-pending')
    try{await api('raw',{requestId:row.requestId,rollerTokenId:row.rollerTokenId,sides:row.sides,values:[...input.values]})}
    catch(error){const saved=await readArcaneBasePrefixDiceRequest(input.requestId,api);if(!saved?.raw||!same(saved.raw.values,input.values))throw error}
    row=await readArcaneBasePrefixDiceRequest(input.requestId,api)
  }
  if(!row?.raw||!same(row.raw.values,input.values))throw Error('arcane-base-prefix-original-raw-mismatch')
}
/** This is separate from raw capture, and records the actual DM-adopted pool. */
export async function confirmArcaneBasePrefixPool(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedArcaneBasePrefix){
  const row=await readArcaneBasePrefixDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.role!=='dm'||!row.raw||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('arcane-base-prefix-original-confirmation-required')
  if(row.confirmed){if(!same(row.confirmed.values,input.values)||!same(row.confirmed.originalValues,row.raw.values))throw Error('arcane-base-prefix-original-confirmation-mismatch');return}
  try{await api('confirm',{requestId:row.requestId,values:[...input.values]})}
  catch(error){const saved=await readArcaneBasePrefixDiceRequest(input.requestId,api);if(!saved?.confirmed||!same(saved.confirmed.values,input.values)||!same(saved.confirmed.originalValues,row.raw.values))throw error}
}

/** Only the real issued private prefix read can route this particular die to
 * its authenticated PC controller. Team side never grants raw-roll authority. */
export async function readArcaneBasePrefixPlayerDiceOwner(input:{requestId:string;mapId:string;combatId:string;rollerTokenId?:string;rollerCharacterId?:string},api:Api=requestSharedArcaneBasePrefix){
  if(!isPrefix(input.requestId))return undefined
  const session=getRoomSession();if(session?.role!=='dm')throw Error('arcane-base-prefix-original-host-request-required')
  const row=await readArcaneBasePrefixDiceRequest(input.requestId,api)
  if(!row||row.mapId!==input.mapId||row.combatId!==input.combatId||row.rollerTokenId!==input.rollerTokenId||row.rollerCharacterId!==input.rollerCharacterId||row.kind!=='d20'||row.count!==1||row.sides!==20)throw Error('arcane-base-prefix-original-dice-owner-required')
  if(row.controllerMemberId===session.memberId)return undefined
  return{roomId:session.roomId,hostMemberId:session.memberId,requestId:row.requestId,tokenId:row.rollerTokenId,characterId:row.rollerCharacterId,memberId:row.controllerMemberId}
}

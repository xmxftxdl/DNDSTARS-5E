import {getRoomSession} from '../../lib/roomSession'
import {requestSharedArcaneMovement} from "../../composition/browserSharedRoomResources"
import type {ArcaneMovementChoiceTransport} from './arcaneMovementHazardCheckpoint'

export interface ArcaneMovementDiceRequest {
  requestId:string;parentId:string;mapId:string;combatId:string;rollerTokenId:string;rollerCharacterId:string;controllerMemberId:string
  kind:'d20'|'dice';count:number;sides:number
  raw?:number[];confirmed?:number[]
}
type Api=<T>(operation:'begin'|'issue'|'raw'|'confirm'|'request'|'checkpoint',input:Record<string,unknown>)=>Promise<T>
const isPrefix=(id:string)=>/^host-arcane-move:[a-f0-9]{32}$/.test(id)
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i])
export const arcaneMovementTransport:ArcaneMovementChoiceTransport={issue:input=>requestSharedArcaneMovement('issue',input),request:async requestId=>(await requestSharedArcaneMovement<{request:ArcaneMovementDiceRequest}>('request',{requestId})).request,checkpoint:input=>requestSharedArcaneMovement('checkpoint',input)}
export async function readArcaneMovementDiceRequest(requestId:string,api:Api=requestSharedArcaneMovement){
  if(!isPrefix(requestId))return undefined
  const reply=await api<{request:ArcaneMovementDiceRequest}>('request',{requestId}),row=reply.request
  if(!row||row.requestId!==requestId)throw Error('arcane-movement-issued-request-required')
  return row
}
/** Called after the actual player DiceBox resolves, before its result event. */
export async function submitArcaneMovementOwnedRaw(input:{requestId:string;mapId:string;characterId?:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedArcaneMovement){
  const row=await readArcaneMovementDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.memberId!==row.controllerMemberId||row.mapId!==input.mapId||row.rollerCharacterId!==input.characterId||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('arcane-movement-original-dice-owner-required')
  if(row.raw){if(!same(row.raw,input.values))throw Error('arcane-movement-original-raw-mismatch');return}
  try{await api('raw',{requestId:row.requestId,values:[...input.values]})}
  catch(error){const saved=await readArcaneMovementDiceRequest(input.requestId,api);if(!saved?.raw||!same(saved.raw,input.values))throw error}
}
/** Host-owned raw is captured before the real confirmation UI opens. A PC's
 * raw must already have arrived through its own authenticated POST. */
export async function lockArcaneMovementRawBeforeConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedArcaneMovement){
  let row=await readArcaneMovementDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.role!=='dm'||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('arcane-movement-original-host-request-required')
  if(!row.raw){
    if(row.controllerMemberId!==session.memberId)throw Error('arcane-movement-authenticated-player-raw-pending')
    try{await api('raw',{requestId:row.requestId,values:[...input.values]})}
    catch(error){const saved=await readArcaneMovementDiceRequest(input.requestId,api);if(!saved?.raw||!same(saved.raw,input.values))throw error}
    row=await readArcaneMovementDiceRequest(input.requestId,api)
  }
  if(!row?.raw||!same(row.raw,input.values))throw Error('arcane-movement-original-raw-mismatch')
}
/** This is separate from raw capture, and records the actual DM-adopted pool. */
export async function confirmArcaneMovementPool(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedArcaneMovement){
  const row=await readArcaneMovementDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.role!=='dm'||!row.raw||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('arcane-movement-original-confirmation-required')
  if(row.confirmed){if(!same(row.confirmed,input.values))throw Error('arcane-movement-original-confirmation-mismatch');return}
  try{await api('confirm',{requestId:row.requestId,values:[...input.values]})}
  catch(error){const saved=await readArcaneMovementDiceRequest(input.requestId,api);if(!saved?.confirmed||!same(saved.confirmed,input.values))throw error}
}

/** Only the real issued private prefix read can route this particular die to
 * its authenticated PC controller. Team side never grants raw-roll authority. */
export async function readArcaneMovementPlayerDiceOwner(input:{requestId:string;mapId:string;combatId:string;rollerTokenId?:string;rollerCharacterId?:string},api:Api=requestSharedArcaneMovement){
  if(!isPrefix(input.requestId))return undefined
  const session=getRoomSession();if(session?.role!=='dm')throw Error('arcane-movement-original-host-request-required')
  const row=await readArcaneMovementDiceRequest(input.requestId,api)
  if(!row||row.mapId!==input.mapId||row.combatId!==input.combatId||row.rollerTokenId!==input.rollerTokenId||row.rollerCharacterId!==input.rollerCharacterId||row.kind!=='d20'||row.count!==1||row.sides!==20)throw Error('arcane-movement-original-dice-owner-required')
  if(row.controllerMemberId===session.memberId)return undefined
  return{roomId:session.roomId,hostMemberId:session.memberId,requestId:row.requestId,tokenId:row.rollerTokenId,characterId:row.rollerCharacterId,memberId:row.controllerMemberId}
}

import {getRoomSession} from '../../lib/roomSession'
import {requestSharedScBasePrefix} from "../../composition/browserSharedRoomResources"
import type {ScBasePrefixTransport} from './scBasePrefixRolls'

export interface ScBasePrefixDiceRequest {
  requestId:string;mapId:string;combatId:string;rollerTokenId:string;rollerCharacterId:string;controllerMemberId:string
  phase:'waiting';kind:'d20'|'dice';count:number;sides:number
  raw?:{values:number[]};confirmed?:{values:number[];originalValues:number[]}
}
type Api=<T>(operation:'begin'|'issue'|'raw'|'confirm'|'request',input:unknown)=>Promise<T>
const isPrefix=(id:string)=>/^host-sc-base:[a-f0-9]{32}$/.test(id)
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i])
export const scBasePrefixTransport:ScBasePrefixTransport={
  begin:input=>requestSharedScBasePrefix('begin',input),issue:input=>requestSharedScBasePrefix('issue',input),
}
export async function readScBasePrefixDiceRequest(requestId:string,api:Api=requestSharedScBasePrefix){
  if(!isPrefix(requestId))return undefined
  const reply=await api<{request:ScBasePrefixDiceRequest}>('request',{requestId}),row=reply.request
  if(!row||row.requestId!==requestId||row.phase!=='waiting')throw Error('sc-base-prefix-issued-request-required')
  return row
}
/** Called after the actual player DiceBox resolves, before its result event. */
export async function submitScBasePrefixOwnedRaw(input:{requestId:string;mapId:string;characterId?:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedScBasePrefix){
  const row=await readScBasePrefixDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.memberId!==row.controllerMemberId||row.mapId!==input.mapId||row.rollerCharacterId!==input.characterId||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('sc-base-prefix-original-dice-owner-required')
  await api('raw',{requestId:row.requestId,rollerTokenId:row.rollerTokenId,sides:row.sides,values:[...input.values]})
}
/** Host-owned raw is captured before the real confirmation UI opens. A PC's
 * raw must already have arrived through its own authenticated POST. */
export async function lockScBasePrefixRawBeforeConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedScBasePrefix){
  let row=await readScBasePrefixDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.role!=='dm'||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('sc-base-prefix-original-host-request-required')
  if(!row.raw){
    if(row.controllerMemberId!==session.memberId)throw Error('sc-base-prefix-authenticated-player-raw-pending')
    await api('raw',{requestId:row.requestId,rollerTokenId:row.rollerTokenId,sides:row.sides,values:[...input.values]})
    row=await readScBasePrefixDiceRequest(input.requestId,api)
  }
  if(!row?.raw||!same(row.raw.values,input.values))throw Error('sc-base-prefix-original-raw-mismatch')
}
/** This is separate from raw capture, and records the actual DM-adopted pool. */
export async function confirmScBasePrefixPool(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedScBasePrefix){
  const row=await readScBasePrefixDiceRequest(input.requestId,api);if(!row)return
  const session=getRoomSession()
  if(!session||session.role!=='dm'||!row.raw||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('sc-base-prefix-original-confirmation-required')
  await api('confirm',{requestId:row.requestId,values:[...input.values]})
}

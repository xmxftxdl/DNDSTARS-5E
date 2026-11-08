import{getRoomSession}from'../../lib/roomSession'
import type{MastermindSpellWindowGateway}from'./mastermindSpellWindowParent'
import type{MastermindSpellWindowDiceRequest}from'./mastermindSpellWindowDiceTransport'
type Api=MastermindSpellWindowGateway['source']
type Invoke=<T>(operation:string,input:unknown)=>Promise<T>
const invoke=(api:Api)=>api as unknown as Invoke
export const isMastermindSpellWardOwnDiceRequest=(id:string)=>id.startsWith('mm-spell-ward-own:')
const equal=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((n,i)=>n===b[i])
const faces=(v:unknown):v is number[]=>Array.isArray(v)&&v.length===1&&Number.isSafeInteger(v[0])&&v[0]>=1&&v[0]<=20
export async function readMastermindSpellWardOwnDiceRequest(requestId:string,api:Api):Promise<MastermindSpellWindowDiceRequest|undefined>{
 if(!isMastermindSpellWardOwnDiceRequest(requestId))return
 if(!/^mm-spell-ward-own:[a-f0-9]{64}$/.test(requestId))throw Error('spell-ward-own-dice:exact-issued-request-required')
 const{request:r}=await invoke(api)<{request:MastermindSpellWindowDiceRequest}>('ward-own-request',{requestId})
 if(!r||r.id!==requestId||!r.parentId||!r.mapId||!r.controllerMemberId||!r.rollerCharacterId||!r.rollerTokenId||!Number.isSafeInteger(r.windowIndex)||r.windowIndex<0||r.kind!=='saving'||r.mode!=='normal'||r.count!==1||r.sides!==20||!/^mm-spell-ward-pool:[a-f0-9]{64}$/.test(r.originalWardRequestId??'')||!['issued','raw','confirmed'].includes(r.phase)||r.raw!==undefined&&!faces(r.raw)||r.confirmed!==undefined&&(!r.raw||!faces(r.confirmed)))throw Error('spell-ward-own-dice:exact-issued-request-required')
 return r
}
export async function submitMastermindSpellWardOwnRaw(input:{requestId:string;mapId:string;characterId?:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api){
 const r=await readMastermindSpellWardOwnDiceRequest(input.requestId,api),session=getRoomSession()
 if(!r||!session||session.memberId!==r.controllerMemberId||r.mapId!==input.mapId||r.rollerCharacterId!==input.characterId||r.rollerTokenId!==input.rollerTokenId||input.sides!==20||!faces(input.values))throw Error('spell-ward-own-dice:actual-controller-physical-required')
 await invoke(api)('ward-own-raw',{parentId:r.parentId,windowIndex:r.windowIndex,requestId:r.originalWardRequestId,ownRequestId:r.id,values:[...input.values]})
}
export async function lockMastermindSpellWardOwnRaw(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api){
 let r=await readMastermindSpellWardOwnDiceRequest(input.requestId,api);const session=getRoomSession()
 if(!r||session?.role!=='dm'||r.rollerTokenId!==input.rollerTokenId||input.sides!==20||!faces(input.values))throw Error('spell-ward-own-dice:actual-host-confirmation-required')
 if(!r.raw){if(r.controllerMemberId!==session.memberId)throw Error('spell-ward-own-dice:independent-player-original-required');await invoke(api)('ward-own-raw',{parentId:r.parentId,windowIndex:r.windowIndex,requestId:r.originalWardRequestId,ownRequestId:r.id,values:[...input.values]});r=await readMastermindSpellWardOwnDiceRequest(input.requestId,api)}
 if(!r?.raw||!equal(r.raw,input.values))throw Error('spell-ward-own-dice:exact-independent-original-required')
}
export async function confirmMastermindSpellWardOwnDice(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api){
 const r=await readMastermindSpellWardOwnDiceRequest(input.requestId,api),session=getRoomSession()
 if(!r||session?.role!=='dm'||!r.raw||r.rollerTokenId!==input.rollerTokenId||input.sides!==20||!faces(input.values))throw Error('spell-ward-own-dice:actual-independent-adoption-required')
 await invoke(api)('ward-own-confirm',{parentId:r.parentId,windowIndex:r.windowIndex,requestId:r.originalWardRequestId,ownRequestId:r.id,values:[...input.values]})
}
export async function readMastermindSpellWardOwnPlayerDiceOwner(input:{requestId:string;mapId:string;rollerTokenId?:string;rollerCharacterId?:string;count:number;sides:number},api:Api){
 const session=getRoomSession(),r=await readMastermindSpellWardOwnDiceRequest(input.requestId,api)
 if(!r||session?.role!=='dm'||!session.roomId||!session.memberId||r.mapId!==input.mapId||r.rollerTokenId!==input.rollerTokenId||r.rollerCharacterId!==input.rollerCharacterId||input.count!==1||input.sides!==20)throw Error('spell-ward-own-dice:actual-issued-owner-required')
 return{characterId:r.rollerCharacterId,memberId:r.controllerMemberId,hostMemberId:session.memberId}
}

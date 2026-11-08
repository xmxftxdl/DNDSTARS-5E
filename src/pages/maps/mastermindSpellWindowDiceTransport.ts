import*as wardOwn from'./mastermindSpellWardOwnDiceTransport'
import*as nativeWard from'./mastermindNativeWardDiceTransport'
import*as wardSaving from'./mastermindWardSavingDiceTransport'
import*as wardOriginal from'./mastermindWardOriginalDiceTransport'
import{getRoomSession}from'../../lib/roomSession'
import{requestSharedMastermindSpellWindow}from'../../lib/sharedApi'
import type{MastermindSpellWindowGateway}from'./mastermindSpellWindowParent'
type Api=MastermindSpellWindowGateway['source']
const isSpellWardBountifulRequest=(id:string)=>id.startsWith('mm-spell-ward-bountiful-pool:')
const isSpellWindowRequest=(id:string)=>id.startsWith('mm-spell-pool:')||id.startsWith('mm-spell-ward-pool:')||isSpellWardBountifulRequest(id)
export interface MastermindSpellWindowDiceRequest{
 id:string;parentId:string;mapId:string;windowIndex:number;kind:'attack'|'damage'|'saving';count:number;sides:number;
 rollerTokenId:string;rollerCharacterId:string;controllerMemberId:string;originalWardRequestId?:string;bountifulOccurrence?:number;
 mode?:'normal'|'advantage'|'disadvantage';phase:'issued'|'raw'|'confirmed';raw?:number[];confirmed?:number[]
}
const equal=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((n,i)=>n===b[i])
export async function readMastermindSpellWindowDiceRequest(requestId:string,api:Api=requestSharedMastermindSpellWindow){
 if(wardOwn.isMastermindSpellWardOwnDiceRequest(requestId))return wardOwn.readMastermindSpellWardOwnDiceRequest(requestId,api)
 if(!(isSpellWindowRequest(requestId)))return undefined
 if(!/^mm-spell-(?:ward-(?:bountiful-)?)?pool:[a-f0-9]{64}$/.test(requestId))throw Error('spell-window-dice:exact-issued-request-required')
 const reply=await api<{request:MastermindSpellWindowDiceRequest}>('request',{requestId}),row=reply.request;if(!row||row.id!==requestId||!row.controllerMemberId||!Number.isSafeInteger(row.windowIndex)||!Number.isSafeInteger(row.count)||row.count<1||!Number.isSafeInteger(row.sides)||row.sides<2||!['attack','damage','saving'].includes(row.kind)||row.kind==='saving'!==(requestId.startsWith('mm-spell-ward-pool:')||isSpellWardBountifulRequest(requestId))||isSpellWardBountifulRequest(requestId)&&(!/^mm-spell-ward-pool:[a-f0-9]{64}$/.test(row.originalWardRequestId??'')||row.mode!=='normal'||row.count!==1)||Object.hasOwn(row,'bountifulOccurrence')&&(!isSpellWardBountifulRequest(row.id)||!Number.isSafeInteger(row.bountifulOccurrence)||row.bountifulOccurrence!<1||row.bountifulOccurrence!>=64)||!['issued','raw','confirmed'].includes(row.phase)||['attack','saving'].includes(row.kind)&&(row.sides!==20||row.count!==(row.mode==='normal'?1:2)))throw Error('spell-window-dice:exact-issued-request-required');return row
}
/** The canonical controller's actual physical completion, before its delegated
 * result event. A faction or effective redirected target is never an owner. */
export async function submitMastermindSpellWindowOwnedRaw(input:{requestId:string;mapId:string;characterId?:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedMastermindSpellWindow){
 if(wardOwn.isMastermindSpellWardOwnDiceRequest(input.requestId))return wardOwn.submitMastermindSpellWardOwnRaw(input,api)
 if(nativeWard.isMastermindNativeWardRequest(input.requestId))return nativeWard.submitMastermindNativeWardOwnedRaw(input)
 if(wardSaving.isMastermindWardSavingRequest(input.requestId))return wardSaving.submitMastermindWardSavingOwnedRaw(input)
 if(wardOriginal.isMastermindWardOriginalRequest(input.requestId))return wardOriginal.submitMastermindWardOriginalOwnedRaw(input)
 const row=await readMastermindSpellWindowDiceRequest(input.requestId,api);if(!row)return;const session=getRoomSession();if(!session||session.memberId!==row.controllerMemberId||row.mapId!==input.mapId||row.rollerCharacterId!==input.characterId||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('spell-window-dice:actual-roller-required');await api(isSpellWardBountifulRequest(row.id)?'ward-bountiful-raw':'raw',{parentId:row.parentId,windowIndex:row.windowIndex,requestId:row.originalWardRequestId??row.id,...(isSpellWardBountifulRequest(row.id)?(row.bountifulOccurrence?{occurrence:row.bountifulOccurrence}:{}):{rollerTokenId:row.rollerTokenId}),values:[...input.values]})
}
/** Called after actual raw exists and before opening independent confirmation.
 * A remote raw must already have been posted by its real player callback. */
export async function lockMastermindSpellWindowRawBeforeConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedMastermindSpellWindow){
 if(wardOwn.isMastermindSpellWardOwnDiceRequest(input.requestId))return wardOwn.lockMastermindSpellWardOwnRaw(input,api)
 if(nativeWard.isMastermindNativeWardRequest(input.requestId))return nativeWard.lockMastermindNativeWardRawBeforeConfirmation(input)
 if(wardSaving.isMastermindWardSavingRequest(input.requestId))return wardSaving.lockMastermindWardSavingRawBeforeConfirmation(input)
 if(wardOriginal.isMastermindWardOriginalRequest(input.requestId))return wardOriginal.lockMastermindWardOriginalRawBeforeConfirmation(input)
 let row=await readMastermindSpellWindowDiceRequest(input.requestId,api);if(!row)return;const session=getRoomSession();if(session?.role!=='dm'||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('spell-window-dice:actual-Host-request-required');if(!row.raw){if(row.controllerMemberId!==session.memberId)throw Error('spell-window-dice:authenticated-player-raw-pending');await api(isSpellWardBountifulRequest(row.id)?'ward-bountiful-raw':'raw',{parentId:row.parentId,windowIndex:row.windowIndex,requestId:row.originalWardRequestId??row.id,...(isSpellWardBountifulRequest(row.id)?(row.bountifulOccurrence?{occurrence:row.bountifulOccurrence}:{}):{rollerTokenId:row.rollerTokenId}),values:[...input.values]});row=await readMastermindSpellWindowDiceRequest(input.requestId,api)}if(!row?.raw||!equal(row.raw,input.values))throw Error('spell-window-dice:original-raw-mismatch')
}
/** The actual Host-adopted faces use their own write; they never manufacture
 * the physical raw or replace a canonical player's click. */
export async function confirmMastermindSpellWindowPool(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},api:Api=requestSharedMastermindSpellWindow){
 if(wardOwn.isMastermindSpellWardOwnDiceRequest(input.requestId))return wardOwn.confirmMastermindSpellWardOwnDice(input,api)
 if(nativeWard.isMastermindNativeWardRequest(input.requestId))return nativeWard.confirmMastermindNativeWardPool(input)
 if(wardSaving.isMastermindWardSavingRequest(input.requestId))return wardSaving.confirmMastermindWardSavingPool(input)
 if(wardOriginal.isMastermindWardOriginalRequest(input.requestId))return wardOriginal.confirmMastermindWardOriginalPool(input)
 const row=await readMastermindSpellWindowDiceRequest(input.requestId,api);if(!row)return;const session=getRoomSession();if(session?.role!=='dm'||!row.raw||row.rollerTokenId!==input.rollerTokenId||row.sides!==input.sides||row.count!==input.values.length)throw Error('spell-window-dice:actual-confirmation-required');await api(isSpellWardBountifulRequest(row.id)?'ward-bountiful-confirm':'confirm',{parentId:row.parentId,windowIndex:row.windowIndex,requestId:row.originalWardRequestId??row.id,...(isSpellWardBountifulRequest(row.id)?(row.bountifulOccurrence?{occurrence:row.bountifulOccurrence}:{}):{rollerTokenId:row.rollerTokenId}),values:[...input.values]})
}
export async function readMastermindSpellWindowPlayerDiceOwner(input:{requestId:string;mapId:string;rollerTokenId?:string;rollerCharacterId?:string;count:number;sides:number},api:Api=requestSharedMastermindSpellWindow){
 if(wardOwn.isMastermindSpellWardOwnDiceRequest(input.requestId))return wardOwn.readMastermindSpellWardOwnPlayerDiceOwner(input,api)
 if(nativeWard.isMastermindNativeWardRequest(input.requestId))return nativeWard.readMastermindNativeWardPlayerDiceOwner(input)
 if(wardSaving.isMastermindWardSavingRequest(input.requestId))return wardSaving.readMastermindWardSavingPlayerDiceOwner(input)
 if(wardOriginal.isMastermindWardOriginalRequest(input.requestId))return wardOriginal.readMastermindWardOriginalPlayerDiceOwner(input)
 if(!(isSpellWindowRequest(input.requestId)))return undefined;const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('spell-window-dice:actual-Host-required');const row=await readMastermindSpellWindowDiceRequest(input.requestId,api);if(!row||row.mapId!==input.mapId||row.rollerTokenId!==input.rollerTokenId||row.rollerCharacterId!==input.rollerCharacterId||row.count!==input.count||row.sides!==input.sides)throw Error('spell-window-dice:exact-issued-pool-required');return{characterId:row.rollerCharacterId,memberId:row.controllerMemberId,hostMemberId:session.memberId}
}

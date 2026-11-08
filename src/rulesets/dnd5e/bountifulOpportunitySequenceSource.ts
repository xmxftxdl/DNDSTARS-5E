import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{durableD20RollId}from'../../lib/rollConfirmation'
import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{readDnd5eOpportunitySequenceRawSource,readCapturedDnd5eOpportunitySequenceRawSource,prepareDnd5eOpportunityMoveSequence}from'./opportunityMoveSequence'
type Prepared=Extract<ReturnType<typeof prepareDnd5eOpportunityMoveSequence>,{ok:true}>['prepared']
type Gateway=Pick<SharedRoomGatewayPort,'publishEvent'>
export interface BountifulOpportunitySequenceRawRoute{readonly originalOpportunitySequenceRaw:unique symbol}
type RouteProof={roomId:string;memberId:string;requestId:string;count:1|2;actorTokenId:string;characterId?:string;rollerMemberId:string;parentId:string;mapId:string;combatId:string;rawValues?:readonly number[]}
const confirmedOriginals=new WeakMap<RouteProof,readonly number[]>(),clockRoutes=new WeakMap<object,{source:ReturnType<typeof readDnd5eOpportunitySequenceRawSource>;signature:string;current:()=>ReturnType<typeof readDnd5eOpportunitySequenceRawSource>}>()
const routes=new WeakMap<object,RouteProof>(),requestProofs=new Map<string,WeakRef<RouteProof>>()
export async function issueBountifulOpportunitySequenceRawSource(prepared:Prepared,error:unknown,input:{cursor:number;issuerMode:'dm'|'player'},gateway:Gateway):Promise<BountifulOpportunitySequenceRawRoute>{
 return issueActualSequenceSource(readDnd5eOpportunitySequenceRawSource(prepared,error),input,gateway,()=>readDnd5eOpportunitySequenceRawSource(prepared,error))
}
export async function issueCapturedBountifulOpportunitySequenceRawSource(error:unknown,input:{cursor:number;issuerMode:'dm'|'player'},gateway:Gateway){return issueActualSequenceSource(readCapturedDnd5eOpportunitySequenceRawSource(error),input,gateway,()=>readCapturedDnd5eOpportunitySequenceRawSource(error))}
async function issueActualSequenceSource(source:ReturnType<typeof readDnd5eOpportunitySequenceRawSource>,input:{cursor:number;issuerMode:'dm'|'player'},gateway:Gateway,current:()=>ReturnType<typeof readDnd5eOpportunitySequenceRawSource>):Promise<BountifulOpportunitySequenceRawRoute>{
 const prepared=source.prepared,host=getRoomSession(),actor=prepared.map.tokens.find(token=>token.id===source.pending.actorTokenId),character=prepared.characters.find(row=>row.id===actor?.characterId)
 if(host?.role!=='dm'||!Number.isSafeInteger(input.cursor)||input.cursor<1||!['dm','player'].includes(input.issuerMode))throw Error('opportunity-sequence:actual-host-cursor-required')
 if(!actor)throw Error('opportunity-sequence:canonical-original-roller-required')
 const count=source.pending.rollMode==='normal'?1:2,requestId=durableD20RollId({mapId:prepared.map.id,sourceMode:input.issuerMode,transactionId:prepared.action.id,occurrenceIndex:input.cursor-1})+(count===2?':pool:2d20':'')
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'issue',parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId,rawRollId:requestId,rawCursor:input.cursor,issuerMode:input.issuerMode,count,source:encodeSecondChanceParentWire(source)})
 if(getRoomSession()?.roomId!==host.roomId||getRoomSession()?.memberId!==host.memberId||getRoomSession()?.role!=='dm')throw Error('opportunity-sequence:host-changed')
 const route=Object.freeze({})as BountifulOpportunitySequenceRawRoute
 for(const[id,proof]of requestProofs)if(!proof.deref())requestProofs.delete(id)
 if(requestProofs.size>4096)throw Error('opportunity-sequence:active-route-limit')
 const proof:RouteProof={roomId:host.roomId,memberId:host.memberId,requestId,count,actorTokenId:source.pending.actorTokenId,...(character?{characterId:character.id}:{}),rollerMemberId:character?.roomMemberId??host.memberId,parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId};clockRoutes.set(route,{source,signature:JSON.stringify(encodeSecondChanceParentWire(source)),current});routes.set(route,proof);requestProofs.set(requestId,new WeakRef(proof));return route
}
export function readBountifulOpportunitySequenceRawRoute(route:BountifulOpportunitySequenceRawRoute){const row=routes.get(route),host=getRoomSession();if(!row||host?.role!=='dm'||host.roomId!==row.roomId||host.memberId!==row.memberId)throw Error('opportunity-sequence:actual-issued-route-required');return{...row}}
/** The actual page may route an OA roller on either combat side to its real
 * player. Only this issued opaque route can override display-side inference. */
export function readBountifulOpportunitySequencePlayerDiceOwner(route:unknown,requestId:string,actorId?:string){
 if(route===undefined)return undefined
 const row=route&&typeof route==='object'?routes.get(route):undefined,host=getRoomSession()
 if(!row||host?.role!=='dm'||host.roomId!==row.roomId||host.memberId!==row.memberId||requestId!==row.requestId||actorId!==row.actorTokenId)throw Error('opportunity-sequence:exact-issued-player-dice-route-required')
 if(row.rollerMemberId===row.memberId)return undefined
 if(!row.characterId)throw Error('opportunity-sequence:canonical-PC-roller-required')
 return{actorId:row.actorTokenId,characterId:row.characterId,memberId:row.rollerMemberId,hostMemberId:row.memberId}
}
/** Refresh an issued route only from the protected original-book transport.
 * The server still independently matches these raw faces before confirmation. */
export async function restoreBountifulOpportunitySequenceOriginalRaw(route:BountifulOpportunitySequenceRawRoute,loadPrivateOriginal:()=>Promise<{rows:readonly{requestId:string;actorId:string;raw?:{memberId:string;values:readonly number[]};confirmed?:{values:readonly number[]}}[]}>){
 const issued=readBountifulOpportunitySequenceRawRoute(route),book=await loadPrivateOriginal(),slot=book.rows.find(row=>row.requestId===issued.requestId)
 readBountifulOpportunitySequenceRawRoute(route)
 if(!slot||slot.actorId!==issued.actorTokenId)throw Error('opportunity-sequence:actual-issued-original-book-required')
 if(!slot.raw)return undefined
 if(slot.raw.memberId!==issued.rollerMemberId||slot.raw.values.length!==issued.count||slot.raw.values.some(value=>!Number.isInteger(value)||value<1||value>20))throw Error('opportunity-sequence:actual-original-raw-required')
 const proof=routes.get(route)!
 if(proof.rawValues&&JSON.stringify(proof.rawValues)!==JSON.stringify(slot.raw.values))throw Error('opportunity-sequence:original-raw-immutable')
 proof.rawValues=[...slot.raw.values]
 const clock=clockRoutes.get(route),wire=(book as{source?:unknown}).source
 if(slot.confirmed&&clock&&JSON.stringify(wire)===clock.signature){if(slot.confirmed.values.length!==issued.count||slot.confirmed.values.some(value=>!Number.isInteger(value)||value<1||value>20)||clock.signature!==JSON.stringify(encodeSecondChanceParentWire(clock.current())))throw Error('opportunity-original-clock:exact-protected-confirmation-required');confirmedOriginals.set(proof,[...slot.confirmed.values])}
 return{rawValues:[...slot.raw.values],...(slot.confirmed?{values:[...slot.confirmed.values]}:{})}
}
export function readBountifulOpportunitySequenceLockedRaw(route:unknown,requestId:string,actorId:string|undefined,count:number,sides:number){
 if(route===undefined)return undefined
 readBountifulOpportunitySequencePlayerDiceOwner(route,requestId,actorId)
 const proof=route&&typeof route==='object'?routes.get(route):undefined
 if(!proof||proof.count!==count||sides!==20)throw Error('opportunity-sequence:exact-issued-raw-scope-required')
 return proof.rawValues?[...proof.rawValues]:undefined
}
/** Lock the real locally rolled Host pool before its DM edit UI. A player
 * controlled pool can never be supplied through this Host-only producer. */
export async function recordBountifulOpportunitySequenceHostRaw(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},gateway:Gateway){
 const row=requestProofs.get(input.requestId)?.deref();if(!row)return
 const host=getRoomSession()
 if(host?.role!=='dm'||host.roomId!==row.roomId||host.memberId!==row.memberId||input.rollerTokenId!==row.actorTokenId||input.sides!==20)throw Error('opportunity-sequence:actual-host-raw-scope-required')
 if(row.rollerMemberId!==row.memberId)return
 if(input.values.length!==row.count||input.values.some(value=>!Number.isInteger(value)||value<1||value>20))throw Error('opportunity-sequence:exact-host-original-pool-required')
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'host-raw',requestId:row.requestId,parentId:row.parentId,mapId:row.mapId,combatId:row.combatId,rawValues:[...input.values]})
}
/** Called from the existing real DM confirmation producer while it still
 * owns both the original PC physical faces and the independently adopted pool. */
export async function recordBountifulOpportunitySequenceHostConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;rawValues:readonly number[];values:readonly number[]},gateway:Gateway){
 const row=requestProofs.get(input.requestId)?.deref();if(!row)return
 const host=getRoomSession(),faces=(values:readonly number[])=>values.length===row.count&&values.every(value=>Number.isInteger(value)&&value>=1&&value<=20)
 if(host?.role!=='dm'||host.roomId!==row.roomId||host.memberId!==row.memberId||input.rollerTokenId!==row.actorTokenId||input.sides!==20||!faces(input.rawValues)||!faces(input.values))throw Error('opportunity-sequence:actual-host-confirmation-scope-required')
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'confirm',requestId:row.requestId,parentId:row.parentId,mapId:row.mapId,combatId:row.combatId,rawValues:[...input.rawValues],values:[...input.values]})
  confirmedOriginals.set(row,[...input.values])
}
/** Called by the concrete independent Host confirmation, preserving raw and
 * adopted faces separately. A fabricated route cannot enter this producer. */
export async function confirmBountifulOpportunitySequenceOriginal(route:BountifulOpportunitySequenceRawRoute,raw:readonly number[],values:readonly number[],gateway:Gateway){
 const row=readBountifulOpportunitySequenceRawRoute(route),faces=(v:readonly number[])=>v.length===row.count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=20)
 if(!faces(raw)||!faces(values))throw Error('opportunity-sequence:exact-issued-pool-required')
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'confirm',requestId:row.requestId,parentId:row.parentId,mapId:row.mapId,combatId:row.combatId,rawValues:[...raw],values:[...values]})
 readBountifulOpportunitySequenceRawRoute(route);confirmedOriginals.set(routes.get(route)!,[...values])
}

/** This read-only mechanical clock comes only from the actual native raw
 * issuance and its successful existing Host confirmation. It is not a receipt
 * mint or world permission; a caller clock/prepared DTO cannot register here. */
export function readBountifulOpportunitySequenceOriginalClockRoute(route:unknown,source:{prepared:Prepared;attacks:Readonly<Record<string,unknown>>;transactionId?:string;hostOriginalOpportunityRolls?:readonly unknown[]}){
 const raw=readBountifulOpportunitySequenceRawRoute(route as BountifulOpportunitySequenceRawRoute),proof=route&&typeof route==='object'?clockRoutes.get(route):undefined,held=route&&typeof route==='object'?routes.get(route):undefined,confirmed=held&&confirmedOriginals.get(held)
 if(!proof||!held||!confirmed||proof.signature!==JSON.stringify(encodeSecondChanceParentWire(proof.current()))||JSON.stringify(encodeSecondChanceParentWire(source.prepared))!==JSON.stringify(encodeSecondChanceParentWire(proof.source.prepared))||source.transactionId!==raw.parentId||proof.source.pending.actorTokenId!==raw.actorTokenId||Reflect.ownKeys(source).some(key=>typeof key!=='string'||!['prepared','attacks','transactionId','hostOriginalOpportunityRolls'].includes(key)))throw Error('opportunity-original-clock:actual-confirmed-native-source-required')
 const current=source.attacks[raw.actorTokenId] as{d20?:number;d20Second?:number;damageRolls?:readonly number[]}|undefined,prior=Object.fromEntries(proof.source.preceding.map(row=>[row.actorTokenId,row.rolls]))
 if(!current||JSON.stringify([current.d20,...(current.d20Second===undefined?[]:[current.d20Second])])!==JSON.stringify(confirmed)||!Array.isArray(current.damageRolls)||current.damageRolls.length||Object.keys(source.attacks).length!==Object.keys(prior).length+1||Object.entries(prior).some(([actor,rolls])=>JSON.stringify(source.attacks[actor])!==JSON.stringify(rolls)))throw Error('opportunity-original-clock:exact-current-original-prefix-required')
 return{parentId:raw.parentId,effectTimestamp:proof.source.prepared.input.firstHostNow}
}

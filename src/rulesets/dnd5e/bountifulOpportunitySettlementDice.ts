import{readCapturedDnd5eOpportunitySequenceMovementCheckpoint}from'./opportunityMoveSequence'
import{bountifulOpportunityMovementSegmentSettlementSource}from'../../../shared/bountiful-opportunity-settlement.mjs'
import{bountifulHostPreparedWireSignature}from'../../../shared/bountiful-host-operation.mjs'
import{readCapturedDnd5eOpportunitySequenceCollectorCheckpoint,readCapturedDnd5eOpportunitySequencePostNativeCheckpoint}from'./opportunityMoveSequence'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{readBountifulOpportunitySequenceWindow,type BountifulOpportunitySequenceWindow}from'./bountifulOpportunitySequenceWindow'
import {readBountifulOpportunityCollectedOriginal} from './bountifulOpportunityMoveOriginalFlow'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {readBountifulOpportunityMovePrefix,readBountifulOpportunityIssuedMove} from './bountifulOpportunityMoveAck'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {bountifulNativeDiceController} from '../../../shared/bountiful-native-dice-controller.mjs'
import {canonicalBountifulOpportunitySettlement,bountifulOpportunitySettlementSource,bountifulOpportunityCollectorSettlementSource,bountifulOpportunityPostNativeSettlementSource} from '../../../shared/bountiful-opportunity-settlement.mjs'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import{readBountifulOpportunitySequencePrefixWindow,type BountifulOpportunitySequencePrefixWindow}from'./bountifulOpportunitySequencePrefixWindow'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
type Row=NonNullable<BountifulOriginalDieReceipt['opportunitySettlementRolls']>[number]
type Context={rollerTokenId?:string;rollerCharacterId?:string;durableRollRequestId?:string;bountifulOpportunitySettlementRoute?:object;rollKind?:'attack'|'ability-check'|'saving-throw'|'damage'|'other';d20RollKind?:'attack'|'ability-check'|'saving-throw'}
type Combat={_sync?:{revision?:number};bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
const hash=async(value:unknown)=>'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonicalBountifulOpportunitySettlement(value))))),n=>n.toString(16).padStart(2,'0')).join('')
const equal=(a:unknown,b:unknown)=>JSON.stringify(canonicalBountifulOpportunitySettlement(a))===JSON.stringify(canonicalBountifulOpportunitySettlement(b))
type RouteProof={rawValues?:readonly number[];spec:Row['spec'];requestId:string;check:()=>void;refresh?:()=>Promise<unknown>}
const issuedRoutes=new WeakMap<object,RouteProof>(),issuedRequests=new Map<string,WeakRef<RouteProof>>()
/** A real prefix-issued route can identify a PC on either combat side. JSON
 * markers, ID prefixes and generic caller payloads have no such authority. */
export function readBountifulOpportunitySettlementDiceRoute(route:unknown,requestId:string,actorId?:string){
 if(route===undefined)return undefined
 const proof=route&&typeof route==='object'?issuedRoutes.get(route):undefined,session=getRoomSession()
 if(!proof||session?.role!=='dm'||session.roomId!==proof.spec.roomId||session.memberId!==proof.spec.hostMemberId||proof.requestId!==requestId||actorId!==proof.spec.actorId)throw Error('bountiful-opportunity-journal:exact-issued-dice-route-required')
 proof.check()
 return proof.spec.characterId&&proof.spec.memberId!==proof.spec.hostMemberId?{actorId:proof.spec.actorId,characterId:proof.spec.characterId,memberId:proof.spec.memberId,hostMemberId:proof.spec.hostMemberId}:undefined
}
/** A supplied JSON marker cannot suppress the original presentation path. */
export function hasBountifulOpportunitySettlementDiceRoute(route:unknown,requestId:string,actorId?:string){
 if(route===undefined)return false
 readBountifulOpportunitySettlementDiceRoute(route,requestId,actorId)
 return true
}
/** Read the real issuer registry; an ID namespace or JSON object is no proof.
 * Current private source reload retains the parent's world/version checks. */
export async function hasIssuedBountifulOpportunitySettlementRequest(requestId:string,rollerTokenId?:string){
 const proof=issuedRequests.get(requestId)?.deref();if(!proof)return false
 const host=getRoomSession();if(host?.role!=='dm'||host.roomId!==proof.spec.roomId||host.memberId!==proof.spec.hostMemberId||proof.requestId!==requestId||rollerTokenId!==proof.spec.actorId)throw Error('bountiful-opportunity-journal:exact-issued-presentation-required')
 proof.check();await proof.refresh?.();proof.check();return true
}
/** Only a genuine route can expose the previously authenticated original raw.
 * A copied route or caller-provided array never becomes a restored die. */
export function readBountifulOpportunitySettlementLockedRaw(route:unknown,requestId:string,actorId:string|undefined,count:number,sides:number){
 if(route===undefined)return undefined
 readBountifulOpportunitySettlementDiceRoute(route,requestId,actorId)
 const proof=route&&typeof route==='object'?issuedRoutes.get(route):undefined
 if(!proof||proof.spec.count!==count||proof.spec.sides!==sides)throw Error('bountiful-opportunity-journal:exact-issued-raw-scope-required')
 return proof.rawValues?[...proof.rawValues]:undefined
}
/** Called by the concrete Host dice confirmation producer while it still owns
 * the unedited face. It cannot manufacture another member's original die. */
export async function recordBountifulOpportunitySettlementHostRaw(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},gateway:Pick<SharedRoomGatewayPort,'publishEvent'>){
 const proof=issuedRequests.get(input.requestId)?.deref()
 if(!proof)return
 const session=getRoomSession()
 proof.check()
 if(session?.role!=='dm'||session.roomId!==proof.spec.roomId||session.memberId!==proof.spec.hostMemberId||input.rollerTokenId!==proof.spec.actorId||input.sides!==proof.spec.sides)throw Error('bountiful-opportunity-journal:actual-host-raw-scope-required')
 if(proof.spec.memberId!==proof.spec.hostMemberId)return
 if(input.values.length!==proof.spec.count||input.values.some(value=>!Number.isInteger(value)||value<1||value>input.sides))throw Error('bountiful-opportunity-journal:invalid-host-raw')
 await gateway.publishEvent('bountiful-opportunity-settlement-host-raw-dm-to-host',{requestId:proof.requestId,spec:proof.spec,rawValues:[...input.values]})
}
/** The real Host confirmation producer holds the exact route and original
 * physical faces before publishing its adopted presentation. Server authority
 * independently matches PC raw and this exact source/pool before locking. */
export async function recordBountifulOpportunitySettlementHostConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;rawValues:readonly number[];values:readonly number[]},gateway:Pick<SharedRoomGatewayPort,'publishEvent'>){
 const proof=issuedRequests.get(input.requestId)?.deref()
 if(!proof)return
 const session=getRoomSession();proof.check()
 if(session?.role!=='dm'||session.roomId!==proof.spec.roomId||session.memberId!==proof.spec.hostMemberId||input.rollerTokenId!==proof.spec.actorId||input.sides!==proof.spec.sides)throw Error('bountiful-opportunity-journal:actual-host-confirmation-scope-required')
 for(const values of[input.rawValues,input.values])if(values.length!==proof.spec.count||values.some(value=>!Number.isInteger(value)||value<1||value>proof.spec.sides))throw Error('bountiful-opportunity-journal:exact-confirmation-pool-required')
 await gateway.publishEvent('bountiful-opportunity-settlement-confirm-dm-to-host',{requestId:proof.requestId,spec:proof.spec,rawValues:[...input.rawValues],values:[...input.values]})
}
/** This records no mechanic result graph. Each roll is tied to the actual
 * issued OA prefix, protected source, canonical roller and private HTTP raw. */
export function createBountifulOpportunitySettlementDice(input:{action:SharedPlayerActionState;prefix:object;phase?:'post-native'|'movement-hazards';authorityUnchanged:()=>boolean},gateway:Gateway){
 const phase=input.phase??'post-native'
 return createIssuedSettlementDice({action:input.action,phase,check:()=>{(phase==='post-native'?readBountifulOpportunityMovePrefix:readBountifulOpportunityIssuedMove)(input.action,input.prefix);if(!input.authorityUnchanged())throw Error('bountiful-opportunity-journal:stale-prefix')}},gateway)
}
export function createBountifulOpportunityAttackLateDice(boundary:object,gateway:Gateway){
 const actual=readBountifulOpportunityCollectedOriginal(boundary)
 return createIssuedSettlementDice({action:actual.action,phase:'attack-late',check:()=>{const current=readBountifulOpportunityCollectedOriginal(boundary);if(current.action!==actual.action||!current.authorityUnchanged())throw Error('bountiful-opportunity-journal:stale-collected-original')}},gateway)
}
export function createBountifulOpportunitySequenceAttackLateDice(window:BountifulOpportunitySequenceWindow,gateway:Gateway){
 const actual=readBountifulOpportunitySequenceWindow(window);if(!actual.hit)throw Error('opportunity-sequence-journal:actual-hit-required')
 return createIssuedSettlementDice({action:actual.action,phase:'attack-late',sequence:{actorId:actual.actorId,...actual.damage},check:()=>{const current=readBountifulOpportunitySequenceWindow(window);if(!equal(current,actual))throw Error('opportunity-sequence-journal:changed-native-window')}},gateway)
}
/** Reuse the actual room raw and independent Host confirmation producers for
 * an ordinary hit before this move has any Bountiful receipt. */
export function createBountifulOpportunitySequencePrefixDice(window:BountifulOpportunitySequencePrefixWindow,gateway:Gateway){
 const actual=readBountifulOpportunitySequencePrefixWindow(window)
 if(!actual.hit)throw Error('opportunity-sequence-prefix:actual-hit-required')
 let ordinal:number|undefined
 const check=()=>{readBountifulOpportunitySequencePrefixWindow(window)}
 const roll=async<C extends Context>(count:number,sides:number,label:string,targetName:string,context:C|undefined,run:(context:C&{durableRollRequestId:string})=>Promise<number[]>)=>{
  check()
  if(count!==actual.damage.count||sides!==actual.damage.sides||context?.rollerTokenId!==actual.actorId||context.rollKind!=='damage')throw Error('opportunity-sequence-prefix:exact-native-damage-pool-required')
  const host=getRoomSession(),book=await actual.load(),source=book.prefixSource,projection=bountifulOpportunitySettlementSource(source,'attack-late',actual.actorId),rows=book.prefixSettlementRolls??[]
  if(host?.role!=='dm'||!projection||!actual.action.combatId)throw Error('opportunity-sequence-prefix:actual-private-source-required')
  const[maps,characters]=await Promise.all([gateway.loadResource<{maps:BattleMap[]}>('maps'),gateway.loadResource<{characters:Character[]}>('characters')]),map=maps?.maps.find(row=>row.id===actual.action.mapId),owned=map&&bountifulNativeDiceController(map,characters?.characters??[],actual.actorId,host.roomId)
  if(!owned||context.rollerCharacterId!==undefined&&context.rollerCharacterId!==owned.character?.id)throw Error('opportunity-sequence-prefix:canonical-roller-required')
  const existing=rows.find(row=>row.spec.actorId===actual.actorId)
  ordinal=existing?.spec.ordinal??rows.length
  const spec:Row['spec']={parentId:actual.action.id,roomId:host.roomId,mapId:actual.action.mapId,combatId:actual.action.combatId,hostMemberId:host.memberId,phase:'attack-late',ordinal:ordinal++,sourceDigest:await hash(projection),actorId:actual.actorId,...(owned.character?{characterId:owned.character.id}:{}),memberId:owned.character?.roomMemberId??host.memberId,count,sides,rollKind:'damage',label,...(targetName?{targetName}:{})},requestId='bountiful-opportunity-settlement:'+(await hash(spec)).slice(7)
  if(existing){if(existing.requestId!==requestId||!equal(existing.spec,spec))throw Error('opportunity-sequence-prefix:changed-original-roll');if(existing.values)return[...existing.values]}
  await gateway.publishEvent('bountiful-opportunity-settlement-source-dm-to-host',{requestId,spec})
  const locked=(await actual.load()).prefixSettlementRolls.find(row=>row.requestId===requestId)
  if(locked){if(!equal(locked.spec,spec))throw Error('opportunity-sequence-prefix:changed-confirmed-source');if(locked.values)return[...locked.values]}
  for(const[id,ref]of issuedRequests)if(!ref.deref())issuedRequests.delete(id)
  if(issuedRequests.size>4096)throw Error('bountiful-opportunity-journal:active-route-limit')
  const route=Object.freeze({}),proof={spec,requestId,check,...(locked?.rawValues?{rawValues:[...locked.rawValues]}:{})}
  issuedRoutes.set(route,proof);issuedRequests.set(requestId,new WeakRef(proof))
  const values=await run({...context,durableRollRequestId:requestId,bountifulOpportunitySettlementRoute:route})
  check()
  if(values.length!==count||values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('opportunity-sequence-prefix:invalid-adopted-roll')
  await gateway.publishEvent('bountiful-opportunity-settlement-confirm-dm-to-host',{requestId,spec,values})
  const final=await actual.load(),confirmed=final.prefixSettlementRolls.find(row=>row.requestId===requestId)
  if(!equal(bountifulOpportunitySettlementSource(final.prefixSource,'attack-late',actual.actorId),projection)||!confirmed?.values||!equal(confirmed.spec,spec)||!equal(confirmed.values,values))throw Error('opportunity-sequence-prefix:server-confirmed-publication-required')
  return[...confirmed.values]
 }
 return{roll,async finish(){check();const rows=(await actual.load()).prefixSettlementRolls;if(ordinal===undefined||rows.length!==ordinal||rows.some(row=>!row.values))throw Error('opportunity-sequence-prefix:complete-original-roll-sequence-required');return structuredClone(rows)}}
}
type CollectorBook={collectorCheckpointSource?:unknown;collectorSource?:unknown;prefixSource?:unknown;prefixSettlementRolls?:Row[]}
/** Every central late pool retains its actual OA window separately from the
 * canonical creature rolling it. The source comes from the protected original
 * book or genuine first receipt, never from a supplied result snapshot. */
export function createBountifulOpportunitySequenceCollectorDice(checkpoint:object,gateway:Gateway,loadPrivateOriginal:()=>Promise<CollectorBook>){
 const fact=readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(checkpoint),action=fact.source.prepared.action,actorId=fact.request.actorTokenId,checkpointSource=encodeSecondChanceParentWire({prepared:fact.source.prepared,pending:fact.request,preceding:fact.preceding}),expectedProjection=bountifulOpportunityCollectorSettlementSource(checkpointSource,actorId)
 let ordinal:number|undefined
 const check=()=>{const current=readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(checkpoint);if(!equal(current,fact))throw Error('opportunity-sequence-collector-journal:changed-native-checkpoint')}
 const load=async()=>{
  check()
  const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(action.id,0)]
  const host=getRoomSession()
  if(host?.role!=='dm')throw Error('opportunity-sequence-collector-journal:actual-host-required')
  if(first){
   if(first.consumed||first.originalAdapterId!=='opportunity-move-sequence'||first.identity.roomId!==host.roomId||first.identity.hostMemberId!==host.memberId||!equal(first.originalRoomAction,action))throw Error('opportunity-sequence-collector-journal:actual-first-parent-required')

  }
  const book=await loadPrivateOriginal()
  check()
  return{source:book.collectorCheckpointSource,rows:book.prefixSettlementRolls??[]}
 }
 const own=(row:Row)=>(row.spec.opportunityActorId??row.spec.actorId)===actorId&&row.spec.phase==='attack-late'
 const roll=async<C extends Context>(count:number,sides:number,label:string,targetName:string,context:C|undefined,run:(context:C&{durableRollRequestId:string})=>Promise<number[]>)=>{
  check()
  const before=await load(),projection=bountifulOpportunityCollectorSettlementSource(before.source,actorId),host=getRoomSession()
  if(host?.role!=='dm'||!projection||!expectedProjection||!equal(projection,expectedProjection)||!context?.rollerTokenId||!Number.isSafeInteger(count)||count<1||count>100||!Number.isSafeInteger(sides)||sides<2||sides>1000)throw Error('opportunity-sequence-collector-journal:actual-original-pool-required')
  const[maps,characters]=await Promise.all([gateway.loadResource<{maps:BattleMap[]}>('maps'),gateway.loadResource<{characters:Character[]}>('characters')]),map=maps?.maps.find(row=>row.id===action.mapId),owned=map&&bountifulNativeDiceController(map,characters?.characters??[],context.rollerTokenId,host.roomId)
  if(!owned||context.rollerCharacterId!==undefined&&context.rollerCharacterId!==owned.character?.id)throw Error('opportunity-sequence-collector-journal:canonical-roller-required')
  if(ordinal===undefined)ordinal=before.rows.find(own)?.spec.ordinal??before.rows.filter(row=>row.spec.phase==='attack-late').length
  const spec:Row['spec']={parentId:action.id,roomId:host.roomId,mapId:action.mapId,combatId:action.combatId!,hostMemberId:host.memberId,phase:'attack-late',ordinal:ordinal++,sourceDigest:await hash(projection),opportunityActorId:actorId,actorId:owned.token.id,...(owned.character?{characterId:owned.character.id}:{}),memberId:owned.character?.roomMemberId??host.memberId,count,sides,rollKind:context.rollKind??context.d20RollKind??'other',label,...(targetName?{targetName}:{})},requestId='bountiful-opportunity-settlement:'+(await hash(spec)).slice(7)
  const saved=before.rows.find(row=>row.spec.phase===spec.phase&&row.spec.ordinal===spec.ordinal)
  if(saved){if(saved.requestId!==requestId||!equal(saved.spec,spec))throw Error('opportunity-sequence-collector-journal:changed-original-roll');if(saved.values)return[...saved.values]}
  await gateway.publishEvent('bountiful-opportunity-settlement-source-dm-to-host',{requestId,spec})
  const resumed=await load(),locked=resumed.rows.find(row=>row.requestId===requestId)
  if(!equal(bountifulOpportunityCollectorSettlementSource(resumed.source,actorId),projection))throw Error('opportunity-sequence-collector-journal:changed-original-source')
  if(locked){if(!equal(locked.spec,spec))throw Error('opportunity-sequence-collector-journal:changed-issued-source');if(locked.values)return[...locked.values]}
  for(const[id,ref]of issuedRequests)if(!ref.deref())issuedRequests.delete(id)
  if(issuedRequests.size>4096)throw Error('bountiful-opportunity-journal:active-route-limit')
  const route=Object.freeze({}),proof={spec,requestId,check,refresh:load,...(locked?.rawValues?{rawValues:[...locked.rawValues]}:{})}
  issuedRoutes.set(route,proof);issuedRequests.set(requestId,new WeakRef(proof))
  const values=await run({...context,durableRollRequestId:requestId,bountifulOpportunitySettlementRoute:route})
  check()
  if(values.length!==count||values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('opportunity-sequence-collector-journal:invalid-adopted-pool')
  await gateway.publishEvent('bountiful-opportunity-settlement-confirm-dm-to-host',{requestId,spec,values})
  const final=await load(),confirmed=final.rows.find(row=>row.requestId===requestId)
  if(!equal(bountifulOpportunityCollectorSettlementSource(final.source,actorId),projection)||!confirmed?.values||!equal(confirmed.spec,spec)||!equal(confirmed.values,values))throw Error('opportunity-sequence-collector-journal:actual-confirmed-pool-required')
  return[...confirmed.values]
 }
 return{roll,async finish(){
  const current=await load(),rows=current.rows.filter(row=>row.spec.phase==='attack-late'),windowRows=rows.filter(own)
  if(!expectedProjection||!equal(bountifulOpportunityCollectorSettlementSource(current.source,actorId),expectedProjection))throw Error('opportunity-sequence-collector-journal:changed-original-source')
  if(windowRows.some(row=>!row.values)||ordinal!==undefined&&rows.length!==ordinal)throw Error('opportunity-sequence-collector-journal:complete-original-roll-sequence-required')
  return structuredClone(windowRows)
 }}
}
type PostNativeBook={prefixSettlementRolls?:Row[];collectorWindows?:Array<{actorId:string;windowIndex:number;complete:boolean;completionSource?:unknown;postNativeRegistered?:boolean;postNativeComplete?:boolean}>}
/** Real Base pools bind to the exact protected completed window, separately from the roller. */
export function createBountifulOpportunitySequencePostNativeDice(checkpoint:object,gateway:Gateway,loadPrivateOriginal:()=>Promise<PostNativeBook>){
 const fact=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint),action=fact.source.prepared.action,actorId=fact.request.actorTokenId,windowIndex=fact.request.windowIndex
 const expectedAttacks=Object.fromEntries([...fact.preceding.map(row=>row.actorTokenId),actorId].map(id=>[id,fact.source.attacks[id]])),expectedPrepared=bountifulHostPreparedWireSignature(encodeSecondChanceParentWire({prepared:fact.source.prepared}))
 const project=(wire:unknown)=>{const p=bountifulOpportunityPostNativeSettlementSource(wire,actorId,windowIndex),scope=p?.opportunityPostNative as {attacks?:unknown}|undefined;return p&&p.preparedSignature===expectedPrepared&&equal(scope?.attacks,expectedAttacks)?p:null}
 const expectedProjection=true
 let ordinal:number|undefined
  const consumed:Row[]=[]
  const adopted=(row:Row)=>{if(!row.values)throw Error('opportunity-sequence-post-native-journal:actual-confirmed-pool-required');consumed.push(structuredClone(row));return[...row.values]}
 const check=()=>{const current=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint);if(!equal(current,fact))throw Error('opportunity-sequence-post-native-journal:changed-native-checkpoint')}
 const load=async()=>{
  check()
  const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(action.id,0)]
  const host=getRoomSession()
  if(host?.role!=='dm')throw Error('opportunity-sequence-post-native-journal:actual-host-required')
  if(first){
   if(first.consumed||first.originalAdapterId!=='opportunity-move-sequence'||first.identity.roomId!==host.roomId||first.identity.hostMemberId!==host.memberId||!equal(first.originalRoomAction,action))throw Error('opportunity-sequence-post-native-journal:actual-first-parent-required')

  }
  const book=await loadPrivateOriginal()
  check()
  const window=book.collectorWindows?.find(row=>row.windowIndex===windowIndex&&row.actorId===actorId)
  if(!window?.complete||!window.postNativeRegistered||!project(window.completionSource))throw Error('opportunity-sequence-post-native-journal:registered-completed-window-required')
  return{source:window.completionSource,rows:book.prefixSettlementRolls??[]}
 }
 const own=(row:Row)=>(row.spec.opportunityActorId??row.spec.actorId)===actorId&&row.spec.phase==='post-native'&&row.spec.postNativeWindowIndex===windowIndex
 const roll=async<C extends Context>(count:number,sides:number,label:string,targetName:string,context:C|undefined,run:(context:C&{durableRollRequestId:string})=>Promise<number[]>)=>{
  check()
  const before=await load(),projection=project(before.source),host=getRoomSession()
  if(host?.role!=='dm'||!projection||!expectedProjection||!context?.rollerTokenId||!Number.isSafeInteger(count)||count<1||count>100||!Number.isSafeInteger(sides)||sides<2||sides>1000)throw Error('opportunity-sequence-post-native-journal:actual-original-pool-required')
  const[maps,characters]=await Promise.all([gateway.loadResource<{maps:BattleMap[]}>('maps'),gateway.loadResource<{characters:Character[]}>('characters')]),map=maps?.maps.find(row=>row.id===action.mapId),owned=map&&bountifulNativeDiceController(map,characters?.characters??[],context.rollerTokenId,host.roomId)
  if(!owned||context.rollerCharacterId!==undefined&&context.rollerCharacterId!==owned.character?.id)throw Error('opportunity-sequence-post-native-journal:canonical-roller-required')
  if(ordinal===undefined)ordinal=before.rows.find(own)?.spec.ordinal??before.rows.filter(row=>row.spec.phase==='post-native').length
  const spec:Row['spec']={parentId:action.id,roomId:host.roomId,mapId:action.mapId,combatId:action.combatId!,hostMemberId:host.memberId,phase:'post-native',ordinal:ordinal++,sourceDigest:await hash(projection),opportunityActorId:actorId,postNativeWindowIndex:windowIndex,actorId:owned.token.id,...(owned.character?{characterId:owned.character.id}:{}),memberId:owned.character?.roomMemberId??host.memberId,count,sides,rollKind:context.rollKind??context.d20RollKind??'other',label,...(targetName?{targetName}:{})},requestId='bountiful-opportunity-settlement:'+(await hash(spec)).slice(7)
  const saved=before.rows.find(row=>row.spec.phase===spec.phase&&row.spec.ordinal===spec.ordinal)
  if(saved){if(saved.requestId!==requestId||!equal(saved.spec,spec))throw Error('opportunity-sequence-post-native-journal:changed-original-roll');if(saved.values)return adopted(saved)}
  await gateway.publishEvent('bountiful-opportunity-settlement-source-dm-to-host',{requestId,spec})
  const resumed=await load(),locked=resumed.rows.find(row=>row.requestId===requestId)
  if(!equal(project(resumed.source),projection))throw Error('opportunity-sequence-post-native-journal:changed-original-source')
  if(locked){if(!equal(locked.spec,spec))throw Error('opportunity-sequence-post-native-journal:changed-issued-source');if(locked.values)return adopted(locked)}
  for(const[id,ref]of issuedRequests)if(!ref.deref())issuedRequests.delete(id)
  if(issuedRequests.size>4096)throw Error('bountiful-opportunity-journal:active-route-limit')
  const route=Object.freeze({}),proof={spec,requestId,check,refresh:load,...(locked?.rawValues?{rawValues:[...locked.rawValues]}:{})}
  issuedRoutes.set(route,proof);issuedRequests.set(requestId,new WeakRef(proof))
  const values=await run({...context,durableRollRequestId:requestId,bountifulOpportunitySettlementRoute:route})
  check()
  if(values.length!==count||values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('opportunity-sequence-post-native-journal:invalid-adopted-pool')
  await gateway.publishEvent('bountiful-opportunity-settlement-confirm-dm-to-host',{requestId,spec,values})
  const final=await load(),confirmed=final.rows.find(row=>row.requestId===requestId)
  if(!equal(project(final.source),projection)||!confirmed?.values||!equal(confirmed.spec,spec)||!equal(confirmed.values,values))throw Error('opportunity-sequence-post-native-journal:actual-confirmed-pool-required')
  return adopted(confirmed)
 }
 return{roll,async readConsumedPools(){await load();return structuredClone(consumed)},async finish(){
  const current=await load(),rows=current.rows.filter(row=>row.spec.phase==='post-native'),windowRows=rows.filter(own)
  if(!project(current.source))throw Error('opportunity-sequence-post-native-journal:changed-original-source')
  if(windowRows.some(row=>!row.values)||(ordinal===undefined?windowRows.length!==0:windowRows.some(row=>row.spec.ordinal>=ordinal!)))throw Error('opportunity-sequence-post-native-journal:complete-original-roll-sequence-required')
  return structuredClone(windowRows)
 }}
}
type MovementBook={movementSegments?:{segmentIndex:number;registered:boolean;complete:boolean;source:unknown}[];prefixSettlementRolls?:Row[]}
export function createBountifulOpportunitySequenceMovementDice(checkpoint:object,gateway:Gateway,loadPrivateOriginal:()=>Promise<MovementBook>){
 const fact=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(checkpoint),action=fact.source.prepared.action,segmentIndex=fact.request.segmentIndex
 const expectedAttacks=Object.fromEntries(fact.preceding.map(row=>row.actorTokenId).map(id=>[id,fact.source.attacks[id]])),expectedPrepared=bountifulHostPreparedWireSignature(encodeSecondChanceParentWire({prepared:fact.source.prepared}))
 const project=(wire:unknown)=>{const p=bountifulOpportunityMovementSegmentSettlementSource(wire,segmentIndex),scope=p?.opportunityMovementSegment as {attacks?:unknown}|undefined;return p&&p.preparedSignature===expectedPrepared&&equal(scope?.attacks,expectedAttacks)?p:null}
 const expectedProjection=true
 let ordinal:number|undefined
  const consumed:Row[]=[]
  const adopted=(row:Row)=>{if(!row.values)throw Error('opportunity-sequence-movement-journal:actual-confirmed-pool-required');consumed.push(structuredClone(row));return[...row.values]}
 const check=()=>{const current=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(checkpoint);if(!equal(current,fact))throw Error('opportunity-sequence-movement-journal:changed-native-checkpoint')}
 const load=async()=>{
  check()
  const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(action.id,0)]
  const host=getRoomSession()
  if(host?.role!=='dm')throw Error('opportunity-sequence-movement-journal:actual-host-required')
  if(first){
   if(first.consumed||first.originalAdapterId!=='opportunity-move-sequence'||first.identity.roomId!==host.roomId||first.identity.hostMemberId!==host.memberId||!equal(first.originalRoomAction,action))throw Error('opportunity-sequence-movement-journal:actual-first-parent-required')

  }
  const book=await loadPrivateOriginal()
  check()
  const window=book.movementSegments?.find(row=>row.segmentIndex===segmentIndex)
  if(!window?.registered||!project(window.source))throw Error('opportunity-sequence-movement-journal:registered-completed-window-required')
  return{source:window.source,rows:book.prefixSettlementRolls??[]}
 }
 const own=(row:Row)=>row.spec.phase==='movement-hazards'&&row.spec.movementSegmentIndex===segmentIndex
 const roll=async<C extends Context>(count:number,sides:number,label:string,targetName:string,context:C|undefined,run:(context:C&{durableRollRequestId:string})=>Promise<number[]>)=>{
  check()
  const before=await load(),projection=project(before.source),host=getRoomSession()
  if(host?.role!=='dm'||!projection||!expectedProjection||!context?.rollerTokenId||!Number.isSafeInteger(count)||count<1||count>100||!Number.isSafeInteger(sides)||sides<2||sides>1000)throw Error('opportunity-sequence-movement-journal:actual-original-pool-required')
  const[maps,characters]=await Promise.all([gateway.loadResource<{maps:BattleMap[]}>('maps'),gateway.loadResource<{characters:Character[]}>('characters')]),map=maps?.maps.find(row=>row.id===action.mapId),owned=map&&bountifulNativeDiceController(map,characters?.characters??[],context.rollerTokenId,host.roomId)
  if(!owned||context.rollerCharacterId!==undefined&&context.rollerCharacterId!==owned.character?.id)throw Error('opportunity-sequence-movement-journal:canonical-roller-required')
  if(ordinal===undefined)ordinal=before.rows.find(own)?.spec.ordinal??before.rows.filter(row=>row.spec.phase==='movement-hazards').length
  const spec:Row['spec']={parentId:action.id,roomId:host.roomId,mapId:action.mapId,combatId:action.combatId!,hostMemberId:host.memberId,phase:'movement-hazards',ordinal:ordinal++,sourceDigest:await hash(projection),movementSegmentIndex:segmentIndex,actorId:owned.token.id,...(owned.character?{characterId:owned.character.id}:{}),memberId:owned.character?.roomMemberId??host.memberId,count,sides,rollKind:context.rollKind??context.d20RollKind??'other',label,...(targetName?{targetName}:{})},requestId='bountiful-opportunity-settlement:'+(await hash(spec)).slice(7)
  const saved=before.rows.find(row=>row.spec.phase===spec.phase&&row.spec.ordinal===spec.ordinal)
  if(saved){if(saved.requestId!==requestId||!equal(saved.spec,spec))throw Error('opportunity-sequence-movement-journal:changed-original-roll');if(saved.values)return adopted(saved)}
  await gateway.publishEvent('bountiful-opportunity-settlement-source-dm-to-host',{requestId,spec})
  const resumed=await load(),locked=resumed.rows.find(row=>row.requestId===requestId)
  if(!equal(project(resumed.source),projection))throw Error('opportunity-sequence-movement-journal:changed-original-source')
  if(locked){if(!equal(locked.spec,spec))throw Error('opportunity-sequence-movement-journal:changed-issued-source');if(locked.values)return adopted(locked)}
  for(const[id,ref]of issuedRequests)if(!ref.deref())issuedRequests.delete(id)
  if(issuedRequests.size>4096)throw Error('bountiful-opportunity-journal:active-route-limit')
  const route=Object.freeze({}),proof={spec,requestId,check,refresh:load,...(locked?.rawValues?{rawValues:[...locked.rawValues]}:{})}
  issuedRoutes.set(route,proof);issuedRequests.set(requestId,new WeakRef(proof))
  const values=await run({...context,durableRollRequestId:requestId,bountifulOpportunitySettlementRoute:route})
  check()
  if(values.length!==count||values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('opportunity-sequence-movement-journal:invalid-adopted-pool')
  await gateway.publishEvent('bountiful-opportunity-settlement-confirm-dm-to-host',{requestId,spec,values})
  const final=await load(),confirmed=final.rows.find(row=>row.requestId===requestId)
  if(!equal(project(final.source),projection)||!confirmed?.values||!equal(confirmed.spec,spec)||!equal(confirmed.values,values))throw Error('opportunity-sequence-movement-journal:actual-confirmed-pool-required')
  return adopted(confirmed)
 }
 return{roll,async readConsumedPools(){await load();return structuredClone(consumed)},async finish(){
  const current=await load(),rows=current.rows.filter(row=>row.spec.phase==='movement-hazards'),windowRows=rows.filter(own)
  if(!project(current.source))throw Error('opportunity-sequence-movement-journal:changed-original-source')
  if(windowRows.some(row=>!row.values)||(ordinal===undefined?windowRows.length!==0:windowRows.some(row=>row.spec.ordinal>=ordinal!)))throw Error('opportunity-sequence-movement-journal:complete-original-roll-sequence-required')
  return structuredClone(windowRows)
 }}
}
function createIssuedSettlementDice(input:{action:SharedPlayerActionState;phase:'attack-late'|'post-native'|'movement-hazards';check:()=>void;sequence?:{actorId:string;count:number;sides:number}},gateway:Gateway){
 let ordinal:number|undefined=input.sequence?undefined:0
 const {phase,check}=input
 const roll=async<C extends Context>(count:number,sides:number,label:string,targetName:string,context:C|undefined,run:(context:C&{durableRollRequestId:string})=>Promise<number[]>)=>{
  check()
  if(input.sequence&&(count!==input.sequence.count||sides!==input.sequence.sides||context?.rollerTokenId!==input.sequence.actorId||context?.rollKind!=='damage'))throw Error('opportunity-sequence-journal:exact-native-damage-pool-required')
  const session=getRoomSession(),combat=await gateway.loadResource<Combat>('combat'),key=bountifulOriginalParentReceiptId(input.action.id,0),first=combat?.bountifulOriginalParents?.[key]
  if(session?.role!=='dm'||!first||phase!=='attack-late'&&!first.continuation||first.consumed||first.originalAdapterId!==(input.sequence?'opportunity-move-sequence':'opportunity-move')||first.identity.hostMemberId!==session.memberId||first.identity.roomId!==session.roomId||!context?.rollerTokenId)throw Error('bountiful-opportunity-journal:actual-original-roller-required')
  const [maps,characters]=await Promise.all([gateway.loadResource<{maps:BattleMap[]}>('maps'),gateway.loadResource<{characters:Character[]}>('characters')]),map=maps?.maps.find(row=>row.id===input.action.mapId),owned=map&&bountifulNativeDiceController(map,characters?.characters??[],context.rollerTokenId,session.roomId)
  if(!owned||context.rollerCharacterId!==undefined&&context.rollerCharacterId!==owned.character?.id)throw Error('bountiful-opportunity-journal:canonical-roller-required')
  const source=input.sequence?(first.continuation?.source??first.originalParent):(phase==='attack-late'?first.originalParent:first.continuation?.source),projection=bountifulOpportunitySettlementSource(source,phase,input.sequence?.actorId)
  if(!projection)throw Error('bountiful-opportunity-journal:actual-source-required')
  if(ordinal===undefined){const rows=first.opportunitySettlementRolls?.filter(row=>row.spec.phase===phase)??[],own=rows.find(row=>row.spec.actorId===input.sequence!.actorId);ordinal=own?.spec.ordinal??rows.length}
  const spec:Row['spec']={parentId:input.action.id,roomId:session.roomId,mapId:input.action.mapId,combatId:first.identity.combatId,hostMemberId:session.memberId,phase,ordinal:ordinal++,sourceDigest:await hash(projection),actorId:owned.token.id,...(owned.character?{characterId:owned.character.id}:{}),memberId:owned.character?.roomMemberId??session.memberId,count,sides,rollKind:context.rollKind??context.d20RollKind??'other',label,...(targetName?{targetName}:{})}
  const requestId='bountiful-opportunity-settlement:'+(await hash(spec)).slice(7),saved=(first.opportunitySettlementRolls??[]).find(row=>row.spec.phase===spec.phase&&row.spec.ordinal===spec.ordinal)
  if(saved){if(saved.requestId!==requestId||!equal(saved.spec,spec))throw Error('bountiful-opportunity-journal:changed-original-roll');if(saved.values)return [...saved.values]}
  await gateway.publishEvent('bountiful-opportunity-settlement-source-dm-to-host',{requestId,spec})
  check()
  const resumed=await gateway.loadResource<Combat>('combat'),locked=resumed?.bountifulOriginalParents?.[key]?.opportunitySettlementRolls?.find(row=>row.requestId===requestId)
  if(locked){if(!equal(locked.spec,spec))throw Error('bountiful-opportunity-journal:changed-confirmed-source');if(locked.values)return [...locked.values]}
  for(const [id,ref]of issuedRequests)if(!ref.deref())issuedRequests.delete(id)
  if(issuedRequests.size>4096)throw Error('bountiful-opportunity-journal:active-route-limit')
  const route=Object.freeze({}),proof={spec,requestId,check,...(locked?.rawValues?{rawValues:[...locked.rawValues]}:{})}
  issuedRoutes.set(route,proof);issuedRequests.set(requestId,new WeakRef(proof))
  const values=await run({...context,durableRollRequestId:requestId,bountifulOpportunitySettlementRoute:route})
  check()
  if(values.length!==count||values.some(value=>!Number.isInteger(value)||value<1||value>sides))throw Error('bountiful-opportunity-journal:invalid-adopted-roll')
  await gateway.publishEvent('bountiful-opportunity-settlement-confirm-dm-to-host',{requestId,spec,values})
  const current=await gateway.loadResource<Combat>('combat'),prior=current?.bountifulOriginalParents?.[key]
  if(!current||!prior||prior.consumed||!equal(prior.continuation,first.continuation))throw Error('bountiful-opportunity-journal:changed-parent')
  const existing=prior.opportunitySettlementRolls?.find(row=>row.requestId===requestId)
  if(!existing?.values||!equal(existing.spec,spec)||!equal(existing.values,values))throw Error('bountiful-opportunity-journal:server-confirmed-publication-required')
  return [...existing.values]

 }
 return {roll,async finish(){
  check()
  const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)],rows=first?.opportunitySettlementRolls?.filter(row=>row.spec.phase===phase)??[]
  if(ordinal===undefined||rows.length!==ordinal||rows.some(row=>!row.values))throw Error('bountiful-opportunity-journal:complete-original-roll-sequence-required')
  return structuredClone(rows)
 }}
}

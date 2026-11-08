import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureBountifulOriginalRawIssuer}from'./bountifulOriginalRawIssuer'
import{captureDnd5eOpportunitySequenceNativeAttack,resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{previewDnd5eOpportunityAttack}from'./opportunityAttackAction'
import type{BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'

type Source=Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0]&{transactionId:string;hostOriginalOpportunityRolls:readonly({actorId:string;values:readonly number[];hostOriginalRollIssuerMode:'dm'|'player';hostOriginalRollId:string;hostOriginalDiceCursor:number})[]}
type Row=NonNullable<BountifulOriginalDieReceipt['opportunitySettlementRolls']>[number]
export type BountifulOpportunitySequencePrivateBook={source:SecondChanceParentWire;prefixSource?:SecondChanceParentWire;prefixSettlementRolls:Row[];rows:{requestId:string;actorId:string;originalIssuer:{mode:'dm'|'player';cursor:number};confirmed?:{values:number[]}}[]}
type Gateway=Pick<SharedRoomGatewayPort,'publishEvent'>
export interface BountifulOpportunitySequencePrefixWindow{readonly nativePreBountifulOriginalWindow:unique symbol}
type Proof={roomId:string;memberId:string;source:Source;actorId:string;damage:{count:number;sides:number};hit:boolean;critical:boolean;unchanged:()=>boolean;load:()=>Promise<BountifulOpportunitySequencePrivateBook>}
const windows=new WeakMap<object,Proof>()
/** Data recovery only. Authenticated original/confirmation authority remains
 * in the private HTTP book and is independently checked on every publication. */
export function readBountifulOpportunitySequenceProtectedOriginal(book:BountifulOpportunitySequencePrivateBook,parentId:string):Source{
 const original=decodeSecondChanceParentWire(book.source)as{prepared:Source['prepared']},prior=book.prefixSource?decodeSecondChanceParentWire(book.prefixSource)as Source:undefined,rows=book.rows
 const priorDamage=(actorId:string)=>{const choice=prior?.attacks[actorId];if(choice&&'reactionDecision'in choice)throw Error('opportunity-sequence-prefix:declined-window-has-no-original');return choice?.damageRolls??[]}
 if(original.prepared.action.id!==parentId||!rows.length||rows.some(row=>!row.confirmed))throw Error('opportunity-sequence-prefix:confirmed-original-book-required')
 return{prepared:original.prepared,transactionId:parentId,attacks:Object.fromEntries(rows.map(row=>[row.actorId,{d20:row.confirmed!.values[0],...(row.confirmed!.values.length===2?{d20Second:row.confirmed!.values[1]}:{}),damageRolls:[...(priorDamage(row.actorId))]}])),hostOriginalOpportunityRolls:rows.map(row=>({actorId:row.actorId,values:[...row.confirmed!.values],...captureBountifulOriginalRawIssuer({mapId:original.prepared.map.id,parentId,mode:row.originalIssuer.mode,rollId:row.requestId,cursor:row.originalIssuer.cursor,raw:row.confirmed!.values})}))}
}
/** The server independently compares every raw slot and any preceding damage
 * with its private journal. This data publication cannot mint a die or result. */
export async function recordBountifulOpportunitySequencePrefixOriginal(source:Source,gateway:Gateway){
 if(getRoomSession()?.role!=='dm')throw Error('opportunity-sequence-prefix:actual-host-required')
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'record-prefix-source',parentId:source.prepared.action.id,mapId:source.prepared.map.id,combatId:source.prepared.state.combatId,source:encodeSecondChanceParentWire(source)})
}
/** A real ordinary OA original may precede the first natural-one offer. Its
 * physical dice are anchored in the existing original book, without inventing
 * a Bountiful receipt or adopting a caller-provided state. */
export async function captureBountifulOpportunitySequencePrefixWindow(input:{parentId:string;actorId:string;authorityUnchanged:()=>boolean;loadPrivateOriginal:()=>Promise<BountifulOpportunitySequencePrivateBook>},gateway:Gateway):Promise<BountifulOpportunitySequencePrefixWindow>{
 const host=getRoomSession();if(host?.role!=='dm'||!input.authorityUnchanged())throw Error('opportunity-sequence-prefix:actual-host-required')
 const book=await input.loadPrivateOriginal(),source=readBountifulOpportunitySequenceProtectedOriginal(book,input.parentId)
 if(book.rows.at(-1)?.actorId!==input.actorId)throw Error('opportunity-sequence-prefix:confirmed-current-original-required')
 const session=createDnd5eOriginalD20Session(source,resolveDnd5eOpportunityMoveSequenceOriginal,input.actorId,'attack')
 let ready:ReturnType<typeof session.run>
 try{ready=session.run(source.prepared.state)}finally{session.cancel()}
 if(ready.status!=='original-d20-ready'||ready.request.actorId!==input.actorId)throw Error('opportunity-sequence-prefix:real-bountiful-decision-required')
 const prepared=captureDnd5eOpportunitySequenceNativeAttack(input.parentId,input.actorId,()=>{const replay=createDnd5eOriginalD20Session(source,resolveDnd5eOpportunityMoveSequenceOriginal,'__native-prefix-preparation__','attack');try{return replay.run(source.prepared.state)}finally{replay.cancel()}}),preview=previewDnd5eOpportunityAttack(prepared,ready.request.values[0]!,ready.request.values[1])
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'record-prefix-source',parentId:input.parentId,mapId:source.prepared.map.id,combatId:source.prepared.state.combatId,source:encodeSecondChanceParentWire(source)})
 if(getRoomSession()?.roomId!==host.roomId||getRoomSession()?.memberId!==host.memberId||!input.authorityUnchanged())throw Error('opportunity-sequence-prefix:host-changed')
 const window=Object.freeze({})as BountifulOpportunitySequencePrefixWindow;windows.set(window,{roomId:host.roomId,memberId:host.memberId,source,actorId:input.actorId,hit:preview.hit,critical:preview.critical,damage:{count:prepared.damage.count*(preview.critical?2:1),sides:prepared.damage.sides},unchanged:input.authorityUnchanged,load:input.loadPrivateOriginal});return window
}
export function readBountifulOpportunitySequencePrefixWindow(window:object){
 const proof=windows.get(window),host=getRoomSession();if(!proof||host?.role!=='dm'||host.roomId!==proof.roomId||host.memberId!==proof.memberId||!proof.unchanged())throw Error('opportunity-sequence-prefix:exact-native-window-required')
 return{action:structuredClone(proof.source.prepared.action),actorId:proof.actorId,hit:proof.hit,critical:proof.critical,damage:{...proof.damage},source:structuredClone(proof.source),load:proof.load}
}
export async function recordBountifulOpportunitySequencePrefixDamage(window:BountifulOpportunitySequencePrefixWindow,values:readonly number[],gateway:Gateway){
 const proof=readBountifulOpportunitySequencePrefixWindow(window),book=await proof.load(),source=decodeSecondChanceParentWire(book.prefixSource!)as Source,rows=book.prefixSettlementRolls.filter(row=>row.spec.actorId===proof.actorId&&row.spec.rollKind==='damage')
 if(!proof.hit||values.length!==proof.damage.count||rows.some(row=>!row.values)||JSON.stringify(rows.flatMap(row=>row.values!))!==JSON.stringify(values))throw Error('opportunity-sequence-prefix:exact-confirmed-damage-required')
 const next={...source,attacks:{...source.attacks,[proof.actorId]:{...source.attacks[proof.actorId],damageRolls:[...values]}}}
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{sourceKind:'opportunity-sequence-v1',phase:'record-prefix-source',parentId:proof.action.id,mapId:proof.action.mapId,combatId:proof.action.combatId,source:encodeSecondChanceParentWire(next)})
 return next
}

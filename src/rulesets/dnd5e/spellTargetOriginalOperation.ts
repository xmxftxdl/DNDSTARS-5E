import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'./pluginApi'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{readDnd5eActualMissingSpellTargetOriginal}from'./spellTargetOriginalSession'
import{readDnd5eSpellcastingOriginalOperation,type Dnd5eSpellcastingOriginalOperation}from'./spellcastingOriginalOperation'
import{readSpellcastingOriginalSavingNativePool,type SpellcastingOriginalSavingDiceRoute}from'./spellcastingOriginalSavingDiceRoute'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import type{MissingSpellTargetOriginal}from'./missingSpellTargetOriginal'

type Native=ReturnType<typeof readDnd5eActualMissingSpellTargetOriginal>
type Pool=Awaited<ReturnType<typeof readSpellcastingOriginalSavingNativePool>>
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const same=(a:unknown,b:unknown)=>signature(a)===signature(b)
declare const issuedOperation:unique symbol
export type Dnd5eSpellTargetOriginalOperation={readonly[issuedOperation]:true}
const issued=new WeakMap<object,{result:MissingSpellTargetOriginal;caster:Dnd5eSpellcastingOriginalOperation;route:SpellcastingOriginalSavingDiceRoute;native:Native;pool:Pool;roomId:string;memberId:string}>()
function host(){const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('spell-target-original:actual-host-required');return value}
const base=(source:Native['source'])=>Object.fromEntries(Object.entries(source).filter(([key])=>!['spellcastingSavingThrows','hostOriginalD20Replay'].includes(key)))
async function facts(result:MissingSpellTargetOriginal,caster:Dnd5eSpellcastingOriginalOperation,route:SpellcastingOriginalSavingDiceRoute){
 const actual=readDnd5eActualMissingSpellTargetOriginal(result),original=readDnd5eSpellcastingOriginalOperation(caster),pool=await readSpellcastingOriginalSavingNativePool(route,caster),source=actual.source,p=source.prepared,r=result.requirement,rows=source.spellcastingSavingThrows
 if(actual.resolve!==resolvePreparedDnd5eSpellCast||actual.effectTimestamp!==original.effectTimestamp||actual.effectTimestamp!==pool.effectTimestamp||!same(base(source),base(original.source))||!p.savingThrow||p.targetSavingThrows!==undefined||p.targetSpellAttacks!==undefined||p.targetToken.id!==r.targetId||p.actorToken.id!==r.actorId||p.spell.id!==r.spellId||r.actorId!==pool.rollerTokenId||source.savingThrowD20!==undefined||source.savingThrowD20Second!==undefined||!rows||rows.length!==1||rows[0].effectId!==pool.effectId||rows[0].d20!==pool.values[0]||rows[0].d20Second!==(pool.count===2?pool.values[1]:undefined)||r.requiredDiceCount!==(r.rollMode==='normal'?1:2))throw Error('spell-target-original:actual-same-caster-single-save-required')
 // The raw first caster row remains unchanged. Native has just completed it
 // under the independently verified replay before reaching this target loop.
 if(Object.keys(rows[0]).some(key=>!['effectId','d20','d20Second'].includes(key)))throw Error('spell-target-original:plain-authenticated-first-caster-required')
 return{actual,pool}
}
/** Genuine Native missing result plus that same caster's real private first
 * pool. A prepared DTO, result clone or another original family cannot issue. */
export async function captureDnd5eSpellTargetOriginalOperation(result:MissingSpellTargetOriginal,caster:Dnd5eSpellcastingOriginalOperation,route:SpellcastingOriginalSavingDiceRoute):Promise<Dnd5eSpellTargetOriginalOperation>{
 const current=host(),value=await facts(result,caster,route);const after=host();if(current.roomId!==after.roomId||current.memberId!==after.memberId)throw Error('spell-target-original:changed-host');const operation=Object.freeze({})as Dnd5eSpellTargetOriginalOperation;issued.set(operation,{result,caster,route,native:value.actual,pool:value.pool,roomId:current.roomId,memberId:current.memberId});return operation
}
export async function readDnd5eSpellTargetOriginalOperation(operation:object){
 const current=host(),row=issued.get(operation);if(!row||row.roomId!==current.roomId||row.memberId!==current.memberId)throw Error('spell-target-original:actual-issued-operation-required');const next=await facts(row.result,row.caster,row.route);if(!same(next.actual.source,row.native.source)||next.actual.effectTimestamp!==row.native.effectTimestamp||!same(next.pool,row.pool))throw Error('spell-target-original:unchanged-current-operation-required');return{source:next.actual.source,requirement:structuredClone(row.result.requirement),snapshot:structuredClone(row.result.snapshot),effectTimestamp:next.actual.effectTimestamp,caster:{effectId:next.pool.effectId,requestId:next.pool.requestId,rawValues:[...next.pool.rawValues],values:[...next.pool.values]}}
}

// This read-only witness survives release of the missing-target collector. It
// cannot be used as an operation, route, raw issuer or world authorization.
const publicationSources=new WeakMap<object,{row:NonNullable<ReturnType<typeof issued.get>>;native:Awaited<ReturnType<typeof readDnd5eSpellTargetOriginalOperation>>;epoch:string}>()
function sourceEpoch(source:Native['source']){const ids=[...new Set(Object.values(source.prepared.state.combatants).flatMap(c=>c.pluginFeatureIds))].sort();return signature(ids.map(id=>[id,dnd5ePluginFeatureDefinition(id),dnd5ePluginFeatureCurrentEnvelopeFullV1(id)]))}
export async function captureSpellTargetOriginalPublicationSource(operation:Dnd5eSpellTargetOriginalOperation){
 const native=await readDnd5eSpellTargetOriginalOperation(operation),row=issued.get(operation)!,token=Object.freeze({});publicationSources.set(token,{row,native,epoch:sourceEpoch(native.source)});return token
}
export async function readSpellTargetOriginalPublicationSource(token:object){
 const record=publicationSources.get(token),current=host();if(!record||current.roomId!==record.row.roomId||current.memberId!==record.row.memberId)throw Error('spell-target-publication:actual-source-witness-required')
 const row=record.row,original=readDnd5eSpellcastingOriginalOperation(row.caster),pool=await readSpellcastingOriginalSavingNativePool(row.route,row.caster)
 if(original.resolve!==resolvePreparedDnd5eSpellCast||original.effectTimestamp!==record.native.effectTimestamp||!same(base(original.source),base(record.native.source))||!same(pool,row.pool)||sourceEpoch(record.native.source)!==record.epoch)throw Error('spell-target-publication:changed-current-source')
 const after=host();if(after.roomId!==row.roomId||after.memberId!==row.memberId)throw Error('spell-target-publication:changed-host');return{effectTimestamp:record.native.effectTimestamp}
}

import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readDnd5eSpellcastingOriginalOperation,type Dnd5eSpellcastingOriginalOperation}from'./spellcastingOriginalOperation'
import{readSpellcastingOriginalSavingNativePool,type SpellcastingOriginalSavingDiceRoute}from'./spellcastingOriginalSavingDiceRoute'
import{createDnd5eAllyOriginalCollectionSession,readDnd5eActualOriginalAllyBoundary,readDnd5eStormCastOriginalOperation,withDnd5eStormCastOriginalReplayScope}from'./damageCommitSession'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'

type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type Native=ReturnType<typeof readDnd5eSpellcastingOriginalOperation>
type Pool=Awaited<ReturnType<typeof readSpellcastingOriginalSavingNativePool>>
const signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v)),same=(a:unknown,b:unknown)=>signature(a)===signature(b)
const sameNative=(a:Native,b:Native)=>{const{resolve:ar,...ad}=a,{resolve:br,...bd}=b;return ar===br&&same(ad,bd)}
const live=new WeakMap<object,{guard:()=>void;source:Source;native:Native;pool:Pool}>()
declare const qualification:unique symbol
export type Dnd5eSpellcastingBountifulOriginalQualification={readonly[qualification]:true}
const issued=new WeakMap<object,{stage:object;source:Source;signature:string;request:ReturnType<typeof readDnd5eActualOriginalAllyBoundary>['request'];native:Native;pool:Pool}>()

/** The exact genuine missing operation and its own immutable raw/adopted book
 * supply this first caster operation. No target-save/attack/zero pool is used. */
export async function createDnd5eSpellcastingBountifulOriginalBoundary(operation:Dnd5eSpellcastingOriginalOperation,route:SpellcastingOriginalSavingDiceRoute){
 const host=getRoomSession();if(host?.role!=='dm'||!host.roomId||!host.memberId)throw Error('caster-bounty:actual-host-required')
 const native=readDnd5eSpellcastingOriginalOperation(operation),pool=await readSpellcastingOriginalSavingNativePool(route,operation)
 if(pool.parentId!==native.source.prepared.action.id||pool.mapId!==native.source.prepared.map.id||pool.combatId!==native.source.prepared.state.combatId||pool.effectId!==native.requirement.effectId||pool.effectTimestamp!==native.effectTimestamp||pool.rollerTokenId!==native.requirement.actorId||pool.count!==native.requirement.requiredDiceCount||native.source.spellcastingSavingThrows?.length)throw Error('caster-bounty:matching-first-caster-original-required')
 const original=native.source as Source&{hostOriginalD20Replay?:unknown},clock={parentId:pool.parentId,sourceKey:originalD20ReplaySourceKey(pool.parentId,original.prepared.state,original.prepared.action,native.effectTimestamp),effectTimestamp:native.effectTimestamp,facts:[]}
 if(original.hostOriginalD20Replay!==undefined&&!same(original.hostOriginalD20Replay,clock))throw Error('caster-bounty:exact-original-clock-required')
 const source=cloneDnd5eHostTransactionInput({...original,hostOriginalD20Replay:clock,spellcastingSavingThrows:[{effectId:pool.effectId,d20:pool.values[0],...(pool.count===2?{d20Second:pool.values[1]}:{})}]}),before=signature(source)
 let ended=false,currentStage:object|undefined,brandedFirst=false,session:ReturnType<typeof createDnd5eAllyOriginalCollectionSession<Source,ReturnType<typeof resolvePreparedDnd5eSpellCast>>>|undefined
 const guard=()=>{const current=getRoomSession();if(ended||current?.role!=='dm'||current.roomId!==host.roomId||current.memberId!==host.memberId||signature(source)!==before||!sameNative(readDnd5eSpellcastingOriginalOperation(operation),native))throw Error('caster-bounty:current-live-original-required')}
 const brand=(stage:ReturnType<NonNullable<typeof session>['run']>)=>{currentStage=stage;if(!brandedFirst&&stage.status==='pending-ally-natural-one'){brandedFirst=true;live.set(stage,{guard:()=>{guard();if(currentStage!==stage)throw Error('caster-bounty:current-native-stage-required')},source,native,pool})}if(stage.status==='resolved'||stage.status==='rejected')ended=true;return stage}
 const start=()=>{session=createDnd5eAllyOriginalCollectionSession(source,resolvePreparedDnd5eSpellCast);return brand(session.run(source.prepared.state))}
 let first:ReturnType<NonNullable<typeof session>['run']>
 try{guard();if(native.stormOperation){const storm=readDnd5eStormCastOriginalOperation(native.stormOperation);if(storm.records.length!==1)throw Error('caster-bounty:exact-earlier-heart-prefix-required');first=withDnd5eStormCastOriginalReplayScope(native.stormOperation,storm.records[0].choice,start)}else first=start()}catch(error){ended=true;session?.cancel();throw error}
 return{source:cloneDnd5eHostTransactionInput(source),first,run(){guard();if(!session)throw Error('caster-bounty:actual-session-required');return brand(session.run(source.prepared.state))},resumeAllyNaturalOne(...args:Parameters<NonNullable<typeof session>['resumeAllyNaturalOne']>){guard();if(!session)throw Error('caster-bounty:actual-session-required');return brand(session.resumeAllyNaturalOne(...args))},cancel(){if(!ended){ended=true;session?.cancel()}}}
}

/** Only a genuine stage from the fixed canonical worker can qualify the exact
 * completed first caster raw pool. This still grants no room/world execution. */
export function captureDnd5eSpellcastingBountifulOriginalQualification(stage:object):Dnd5eSpellcastingBountifulOriginalQualification{
 const row=live.get(stage);if(!row)throw Error('caster-bounty:actual-issued-stage-required');row.guard();const actual=readDnd5eActualOriginalAllyBoundary(stage),request=actual.request
 if(actual.resolve!==resolvePreparedDnd5eSpellCast||actual.effectTimestamp!==row.native.effectTimestamp||!same(actual.input,row.source)||request.actorId!==row.native.requirement.actorId||request.kind!=='saving-throw'||!same(request.originalRolls,row.pool.values)||request.originalRolls[request.dieIndex]!==1)throw Error('caster-bounty:exact-actual-original-required')
 const result=Object.freeze({})as Dnd5eSpellcastingBountifulOriginalQualification;issued.set(result,{stage,source:cloneDnd5eHostTransactionInput(row.source),signature:signature(row.source),request,native:row.native,pool:row.pool});return result
}
export function readDnd5eSpellcastingBountifulOriginalQualification(value:object,source:Source){
 const row=issued.get(value),stage=row&&live.get(row.stage);if(!row||!stage)throw Error('caster-bounty:actual-private-qualification-required');stage.guard();const actual=readDnd5eActualOriginalAllyBoundary(row.stage)
 if(signature(source)!==row.signature||actual.resolve!==resolvePreparedDnd5eSpellCast||actual.effectTimestamp!==row.native.effectTimestamp||!same(actual.request,row.request))throw Error('caster-bounty:unchanged-actual-source-required')
 return{source:cloneDnd5eHostTransactionInput(row.source),request:structuredClone(row.request),effectTimestamp:row.native.effectTimestamp,rawIssuer:{mode:'dm' as const,rollId:row.pool.requestId,cursor:1},caster:{effectId:row.pool.effectId,rollerTokenId:row.pool.rollerTokenId,rawValues:[...row.pool.rawValues],values:[...row.pool.values]}}
}

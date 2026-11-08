import{withDnd5eSpellWardRetargetChain,withDnd5eSpellWardRetargetOwners,readDnd5eSpellWardRetargetState,readDnd5eSpellWardRetargetOwnerState,readDnd5eSpellWardRetargetInput,readDnd5eSpellWardRetargetOwnerInput}from'./spellWardRetargetChain'
import {resolvePreparedDnd5eSpellCast,readDnd5eActualSpellFacadeResult} from './spellAction'
import {createDnd5eParentEffectClock} from './activeEffects'
import {withDnd5eSpellWardSavingReplay,readDnd5eSpellWardSavingReplayState} from './spellWardSavingReplayPort'

type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type Native=ReturnType<typeof resolvePreparedDnd5eSpellCast>
type Context={source:Source;signature:string;caps:readonly object[];parentId:string;timestamp:number;current:()=>boolean;captured:boolean;nativeCaps?:readonly object[];retargetCaps?:readonly object[];retargetOwnerCaps?:readonly object[];nativeRetargetCaps?:readonly object[];nativeRetargetOwnerCaps?:readonly object[]}
let active:Context|undefined

/** This scope binds a genuine Session synchronously. It does not retain a
 * mechanical replay scope while the Flow awaits a player or a physical die. */
export function createDnd5eSpellWardReplaySessionScope(source:Source,caps:readonly object[],clock:{parentId:string;timestamp:number},current:()=>boolean){
 if(!caps.length||new Set(caps).size!==caps.length||source.transactionId!==clock.parentId||!Number.isFinite(clock.timestamp))throw Error('spell-ward-session:exact-original-required')
 const context:Context={source,signature:JSON.stringify(source),caps:Object.freeze([...caps]),...clock,current,captured:false}
 const check=()=>{if(JSON.stringify(source)!==context.signature||!current())throw Error('spell-ward-session:changed-original')}
 return Object.freeze({
  run<T>(start:()=>T):T{check();if(context.captured||start.constructor.name==='AsyncFunction')throw Error('spell-ward-session:single-synchronous-session-required');const previous=active;active=context;try{const value=start();if(!context.captured)throw Error('spell-ward-session:actual-session-required');return value}finally{active=previous}},
  readCaps(){check();if(!context.captured||!context.nativeCaps)throw Error('spell-ward-session:actual-canonical-worker-required');return context.nativeCaps},
 })
}

/** A true target candidate remains a separate mechanical credential. Only the
 * canonical PreparedSession may consume it with the original Ward prefix. */
export function createDnd5eSpellWardRetargetReplaySessionScope(source:Source,caps:readonly object[],retargetCaps:readonly object[],retargetOwnerCaps:readonly object[],clock:{parentId:string;timestamp:number},current:()=>boolean){
 if(!retargetCaps.length||new Set(caps).size!==caps.length||new Set(retargetCaps).size!==retargetCaps.length||new Set(retargetOwnerCaps).size!==retargetOwnerCaps.length||source.transactionId!==clock.parentId||!Number.isSafeInteger(clock.timestamp)||clock.timestamp<=0)throw Error('spell-ward-retarget-session:exact-original-required')
 const targets=retargetCaps.map(readDnd5eSpellWardRetargetInput),owners=retargetOwnerCaps.map(readDnd5eSpellWardRetargetOwnerInput)
 if(targets.some(fact=>fact.parentId!==clock.parentId||fact.parentId!==source.prepared.action.id||fact.actorId!==source.prepared.actorToken.id||fact.spellId!==source.prepared.spell.id||fact.clock!==clock.timestamp)||owners.some(fact=>fact.parentId!==clock.parentId||fact.actorId!==source.prepared.actorToken.id||fact.clock!==clock.timestamp))throw Error('spell-ward-retarget-session:same-actual-clock-source-required')
 const context:Context={source,signature:JSON.stringify(source),caps:Object.freeze([...caps]),retargetCaps:Object.freeze([...retargetCaps]),retargetOwnerCaps:Object.freeze([...retargetOwnerCaps]),...clock,current,captured:false}
 const check=()=>{if(JSON.stringify(source)!==context.signature||!current())throw Error('spell-ward-session:changed-original')}
 return Object.freeze({
  run<T>(start:()=>T):T{check();if(context.captured||start.constructor.name==='AsyncFunction')throw Error('spell-ward-session:single-synchronous-session-required');const previous=active;active=context;try{const value=start();if(!context.captured)throw Error('spell-ward-session:actual-session-required');return value}finally{active=previous}},
  readCaps(){check();if(!context.captured||!context.nativeCaps)throw Error('spell-ward-session:actual-canonical-worker-required');return context.nativeCaps},
  readRetargetCaps(){check();if(!context.captured||!context.nativeRetargetCaps||!context.nativeRetargetOwnerCaps)throw Error('spell-ward-retarget-session:actual-canonical-worker-required');return Object.freeze({general:context.nativeRetargetCaps,owners:context.nativeRetargetOwnerCaps})},
 })
}

/** Called only at real PreparedSession creation, before its SDK snapshot.
 * JSON-equivalent inputs and a wrapped canonical resolver cannot bind it. */
export function captureDnd5eSpellWardReplaySession(source:object,resolve:unknown){
 const context=active;if(!context)return
 if(context.captured||source!==context.source||resolve!==resolvePreparedDnd5eSpellCast||JSON.stringify(source)!==context.signature||!context.current())throw Error('spell-ward-session:actual-canonical-original-required')
 context.captured=true
 return Object.freeze({
  run<Result>(candidate:unknown,invoke:()=>Result):Result{
   if(JSON.stringify(context.source)!==context.signature||!context.current())throw Error('spell-ward-session:changed-original')
   const ward=()=>context.caps.length?withDnd5eSpellWardSavingReplay(context.caps,invoke):invoke(),result=createDnd5eParentEffectClock({parentId:context.parentId,sourceKey:context.signature,timestamp:context.timestamp}).run(()=>context.retargetCaps?withDnd5eSpellWardRetargetChain(context.retargetCaps,()=>withDnd5eSpellWardRetargetOwners(context.retargetOwnerCaps??[],ward)):withDnd5eSpellWardSavingReplay(context.caps,invoke))
   const native=result as Native
   if(native.result?.ok){const prepared=(candidate as Source).prepared;readDnd5eActualSpellFacadeResult(prepared,native);context.nativeCaps=context.caps.length?readDnd5eSpellWardSavingReplayState(native.result.state):Object.freeze([]);if(context.retargetCaps){context.nativeRetargetCaps=readDnd5eSpellWardRetargetState(native.result.state);context.nativeRetargetOwnerCaps=context.retargetOwnerCaps?.length?readDnd5eSpellWardRetargetOwnerState(native.result.state):Object.freeze([])}}
   return result
  },
 })
}

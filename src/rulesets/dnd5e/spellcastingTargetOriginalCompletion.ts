import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readDnd5eSpellTargetOriginalOperation,type Dnd5eSpellTargetOriginalOperation}from'./spellTargetOriginalOperation'
import{captureSpellcastingTargetPublicationFacts,readSpellcastingTargetPublicationFacts,readSpellcastingTargetOriginalContinuation,type SpellcastingTargetOriginalContinuation}from'./spellcastingTargetOriginalContinuation'
import{resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions}from'./damageReactionFlow'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{withStormCastPreparedOriginalReplay}from'./stormCastPreparedOriginalReplay'

type Source=Awaited<ReturnType<typeof readSpellcastingTargetOriginalContinuation>>['source']
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value)),completed=new WeakMap<object,{sourceSignature:string;resultSignature:string;effectTimestamp:number;roomId:string;memberId:string;publication:object}>()
function currentHost(){const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('caster-target-completion:actual-host-required');return value}
/** A final-facade proof cannot be minted from a result DTO or a caller state.
 * The fixed canonical Spell and Base flow must genuinely finish this original. */
export async function completeSpellcastingTargetOriginal(input:{continuation:SpellcastingTargetOriginalContinuation;operation:Dnd5eSpellTargetOriginalOperation;source:Source;stormReplay?:object;options:Dnd5eDamageReactionFlowOptions}){
 const host=currentHost(),facts=await readSpellcastingTargetOriginalContinuation(input.continuation),native=await readDnd5eSpellTargetOriginalOperation(input.operation)
 const samePlain={...native.source,hostOriginalD20Replay:facts.initial.hostOriginalD20Replay,savingThrowD20:facts.source.savingThrowD20,...(facts.source.savingThrowD20Second===undefined?{}:{savingThrowD20Second:facts.source.savingThrowD20Second})}
 if(signature(samePlain)!==signature(facts.source)||native.effectTimestamp!==facts.effectTimestamp||!input.options.authorityUnchanged())throw Error('caster-target-completion:exact-current-original-required')
 // This bounded consumer permits only the ordinary previously missing effect
 // pool. It does not add target d20s or arbitrary choices to generic late rules.
 const originalSignature=signature(input.source),before={...facts.source,effectRolls:input.source.effectRolls}
 if(signature(before)!==signature(input.source)||!Array.isArray(input.source.effectRolls)||input.source.effectRolls.length>128||input.source.effectRolls.some(value=>!Number.isInteger(value)||value<1||value>10000)||facts.source.effectRolls.length!==0&&signature(facts.source.effectRolls)!==signature(input.source.effectRolls))throw Error('caster-target-completion:only-original-effect-pool-required')
 const source=cloneDnd5eHostTransactionInput({...input.source,hostOriginalD20Replay:(native.source as Source).hostOriginalD20Replay}),run=()=>resolveDnd5ePreparedWithMaterialDamageReactions(input.options,source,resolvePreparedDnd5eSpellCast)
 let pending:ReturnType<typeof run>|undefined
 // Native Session construction consumes the synchronous original prefix. The
 // global scope is closed before awaiting its independently captured replay.
 if(input.stormReplay)withStormCastPreparedOriginalReplay(source,input.stormReplay,()=>{pending=run()});else pending=run()
 if(!pending)throw Error('caster-target-completion:actual-native-worker-required')
 const resolved=await pending
 const after=currentHost();await readSpellcastingTargetOriginalContinuation(input.continuation)
 if(signature(input.source)!==originalSignature||after.roomId!==host.roomId||after.memberId!==host.memberId||!input.options.authorityUnchanged())throw Error('caster-target-completion:changed-authority')
 if(resolved.result.ok&&resolved.application)completed.set(resolved,{sourceSignature:signature(input.source),resultSignature:signature(resolved),effectTimestamp:facts.effectTimestamp,roomId:host.roomId,memberId:host.memberId,publication:await captureSpellcastingTargetPublicationFacts(input.continuation)})
 return resolved
}
export function readSpellcastingTargetCompletedOriginal(result:object,source:Source){
 const host=currentHost(),row=completed.get(result);if(!row||row.roomId!==host.roomId||row.memberId!==host.memberId)throw Error('caster-target-completion:actual-completed-facade-required')
 if(signature(result)!==row.resultSignature||signature(source)!==row.sourceSignature)throw Error('caster-target-completion:changed-native-result-or-source')
 return{effectTimestamp:row.effectTimestamp}
}

export async function assertSpellcastingTargetCompletedOriginalCurrent(result:object,source:Source){
 const actual=readSpellcastingTargetCompletedOriginal(result,source),row=completed.get(result)!,current=await readSpellcastingTargetPublicationFacts(row.publication);if(current.effectTimestamp!==actual.effectTimestamp)throw Error('caster-target-completion:changed-publication-clock');readSpellcastingTargetCompletedOriginal(result,source);return actual
}

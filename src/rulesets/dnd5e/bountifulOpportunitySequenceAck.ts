import{dnd5eEffectiveSpeed}from'./headlessCombatEngine'
import{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import{readBountifulOpportunitySequenceCompletion,readStormFuryOpportunitySequenceCompletion,type BountifulOpportunitySequenceCompletion}from'./bountifulOpportunitySequenceCollector'
import{resolveDnd5ePreparedWithMaterialDamageReactions}from'./damageReactionFlow'
import{resolveBountifulOriginalForNormalAck,publishBountifulOriginalThroughNormalAck}from'./bountifulLuckNormalAck'
import{publishBountifulOrOrdinaryPlayerActionAck}from'./bountifulLuckNormalAck'
import{projectDnd5eCombatApplicationStoreState}from'../../pages/maps/combatApplicationStoreProjection'
import{projectDnd5eHeadlessTurnEconomy}from'./turnEconomy'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{PublishPlayerActionAckInput}from'../../lib/playerActionAckPublish'
type Source=Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0]&{transactionId:string;hostOriginalOpportunityRolls:readonly unknown[]}
type Options=Parameters<typeof resolveBountifulOriginalForNormalAck>[0]['options']
type Gateway=Parameters<typeof publishBountifulOriginalThroughNormalAck>[2]&Parameters<typeof resolveBountifulOriginalForNormalAck>[1]
type Resolved=ReturnType<typeof resolveDnd5eOpportunityMoveSequenceOriginal>
const signature=(v:unknown)=>JSON.stringify(v),issued=new WeakMap<object,{resolved:Resolved;resultSignature:string;projection:ReturnType<typeof projectDnd5eCombatApplicationStoreState>;economies:Source['prepared']['input']['turnEconomyByToken'];unchanged:()=>boolean;ordinary?:true}>()
/** The actual prepared full-move facade alone signs the normal original ACK. */
export async function resolveBountifulOpportunitySequenceForNormalAck(input:{action:SharedPlayerActionState;source:Source;options:Options},gateway:Gateway){
 const resolved=await resolveBountifulOriginalForNormalAck({...input,resolve:resolveDnd5eOpportunityMoveSequenceOriginal},gateway)
 if(!resolved.result.ok||!resolved.application||signature(input.action)!==signature(input.source.prepared.action)||resolved.originalAction.id!==input.action.id)throw Error('opportunity-sequence:actual-whole-result-required')
 const projection=projectDnd5eCombatApplicationStoreState({map:input.source.prepared.map,characters:input.source.prepared.characters,application:resolved.application}),economies=Object.fromEntries(Object.entries(input.source.prepared.input.turnEconomyByToken).map(([id,before])=>{const actor=resolved.result.state.combatants[id];if(!actor)throw Error('opportunity-sequence:original-economy-required');return[id,projectDnd5eHeadlessTurnEconomy(before,actor.turn,Math.max(actor.speed,dnd5eEffectiveSpeed(actor)))]}))
 issued.set(input.action,{resolved,resultSignature:signature(resolved),projection,economies,unchanged:input.options.authorityUnchanged});return resolved
}
/** An ordinary sequence has no Bounty receipt. Its opaque completed native
 * collector still must run the actual material reaction flow before projection. */
export async function resolveBountifulOpportunitySequenceCompletionForNormalAck(input:{action:SharedPlayerActionState;completion:BountifulOpportunitySequenceCompletion;options:Options},gateway:Gateway){
 const complete=input.options.enableStormFuryHit?readStormFuryOpportunitySequenceCompletion(input.action,input.completion):readBountifulOpportunitySequenceCompletion(input.action,input.completion)
 const options={...input.options,...('stormFuryPostfixesComplete'in complete&&complete.stormFuryPostfixesComplete===true?{enableStormFuryHit:false}:{}),authorityUnchanged:()=>input.options.authorityUnchanged()&&complete.authorityUnchanged()}
 if(complete.hadBountiful)return resolveBountifulOpportunitySequenceForNormalAck({action:input.action,source:complete.source,options},gateway)
 const resolved=await resolveDnd5ePreparedWithMaterialDamageReactions(options,complete.source,resolveDnd5eOpportunityMoveSequenceOriginal)
 if(!resolved.result.ok||!resolved.application||!options.authorityUnchanged()||signature(input.action)!==signature(complete.source.prepared.action))throw Error('opportunity-sequence:actual-ordinary-whole-result-required')
 const projection=projectDnd5eCombatApplicationStoreState({map:complete.source.prepared.map,characters:complete.source.prepared.characters,application:resolved.application}),economies=Object.fromEntries(Object.entries(complete.source.prepared.input.turnEconomyByToken).map(([id,before])=>{const actor=resolved.result.state.combatants[id];if(!actor)throw Error('opportunity-sequence:original-economy-required');return[id,projectDnd5eHeadlessTurnEconomy(before,actor.turn,Math.max(actor.speed,dnd5eEffectiveSpeed(actor)))]}))
 issued.set(input.action,{resolved,resultSignature:signature(resolved),projection,economies,unchanged:options.authorityUnchanged,ordinary:true});return resolved
}
export async function publishBountifulOpportunitySequenceAck(action:SharedPlayerActionState,input:PublishPlayerActionAckInput,gateway:Gateway){
 const proof=issued.get(action)
 if(!proof)return publishBountifulOriginalThroughNormalAck(action,input,gateway)
 if(!proof.unchanged()||signature(proof.resolved)!==proof.resultSignature||!input.snapshots||signature(input.snapshots.characters)!==signature(proof.projection.characters)||signature(input.snapshots.maps.find(map=>map.id===action.mapId))!==signature(proof.projection.map))throw Error('opportunity-sequence:changed-original-materials')
 const maps=await gateway.loadResource<{maps:typeof input.snapshots.maps}>('maps')
 if(!maps||signature(input.snapshots.maps)!==signature(maps.maps.map(map=>map.id===action.mapId?proof.projection.map:map)))throw Error('opportunity-sequence:changed-original-materials')
 if(signature(input.snapshots.combat?.dnd5eTurnEconomyByToken)!==signature(proof.economies))throw Error('opportunity-sequence:changed-original-cost')
 if(proof.ordinary)await publishBountifulOrOrdinaryPlayerActionAck(action,input,gateway)
 else await publishBountifulOriginalThroughNormalAck(action,input,gateway)
 issued.delete(action)
}

/** This query never registers a result or accepts a caller projection. */
export function hasBountifulOpportunitySequenceAck(action:SharedPlayerActionState){return issued.has(action)}
/** Page projection must be the exact actual native result registered above,
 * still bound to this exact original action and live room authority. */
export function readBountifulOpportunitySequenceResolvedProjection(action:SharedPlayerActionState,resolved:unknown){
 const proof=issued.get(action)
 if(!proof||proof.resolved!==resolved||!proof.unchanged()||signature(proof.resolved)!==proof.resultSignature)throw Error('opportunity-sequence:exact-live-normal-ack-result-required')
 return{projection:structuredClone(proof.projection),turnEconomyByToken:structuredClone(proof.economies)}
}

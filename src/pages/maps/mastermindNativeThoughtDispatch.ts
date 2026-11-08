import type{SharedCombatState,SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{BattleMap}from'../../store/maps'
import type{Character}from'../../types/character'
import{secondChanceCanonicalControllerMemberId}from'../../../shared/second-chance-controller.mjs'
import{prepareMastermindThoughtNativeOriginal,readMastermindThoughtNativeIssuedOriginal,restoreMastermindThoughtNativeOriginal,type MastermindThoughtGateway,type MastermindThoughtOriginal}from'./mastermindThoughtReadingParent'
type Issued={original:MastermindThoughtOriginal;signature:string}
const dispatches=new WeakMap<SharedPlayerActionState,Issued>()
const signature=(value:unknown)=>JSON.stringify(value)
/** This is a Host-owned intent, not a player command. Its concrete action is
 * rebuilt by the server from the current canonical caster and target. */
export async function issueMastermindNativeThoughtDispatch(input:{id:string;mapId:string;readerTokenId:string;ownerTokenId:string},gateway:MastermindThoughtGateway){
 const session=gateway.session();if(!session||session.role!=='dm')throw Error('native-thought-dispatch:current-Host-required')
 const [maps,characters,combat]=await Promise.all([gateway.loadResource<{maps:BattleMap[]}>('maps'),gateway.loadResource<{characters:Character[]}>('characters'),gateway.loadResource<SharedCombatState>('combat')]),map=maps?.maps.find(map=>map.id===input.mapId),reader=map?.tokens.find(token=>token.id===input.readerTokenId),character=characters?.characters.find(character=>character.id===reader?.characterId),owner=map?.tokens.find(token=>token.id===input.ownerTokenId)
 if(!map||!reader||!character||!owner?.characterId||owner.id===reader.id||secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId})!==session.memberId||!characters?.characters.some(character=>character.id===owner.characterId))throw Error('native-thought-dispatch:canonical-Host-caster-and-target-required')
 if(combat?.active===true&&(combat.mapId!==map.id||combat.initiativeOrder[combat.initiativeIndex]?.tokenId!==reader.id||combat.flowPause))throw Error('native-thought-dispatch:current-Host-turn-required')
 const intent:SharedPlayerActionState={id:input.id,mapId:map.id,type:'dnd5e-spell-cast',status:'pending',sourceMode:'dm',roomMemberId:session.memberId,characterId:character.id,actorTokenId:reader.id,targetTokenId:owner.id,dnd5eSpellCast:{spellId:'detect-thoughts',castingClassId:'wizard',slotLevel:2,targetTokenId:owner.id},round:combat?.round??1,initiativeIndex:combat?.initiativeIndex??0,...(combat?.active===true?{combatId:combat.combatId}:{}),seq:0,updatedAt:Date.now()}
 const original=await prepareMastermindThoughtNativeOriginal(intent,gateway);if(!original)throw Error('native-thought-dispatch:current-reading-boundary-required')
 const issued=await readMastermindThoughtNativeIssuedOriginal(original,gateway),action=issued.action;dispatches.set(action,{original,signature:signature(action)});return action
}
/** A payload, matching ID, or copied JSON never authorizes this local route. */
export async function readMastermindNativeThoughtDispatch(action:SharedPlayerActionState,gateway:MastermindThoughtGateway){
 const issued=dispatches.get(action);if(!issued)return undefined
 if(signature(action)!==issued.signature)throw Error('native-thought-dispatch:issued-action-mutated')
 const current=await readMastermindThoughtNativeIssuedOriginal(issued.original,gateway)
 if(signature(current.action)!==issued.signature)throw Error('native-thought-dispatch:issued-original-changed')
 return issued.original
}
/** Rejection/cleanup must not emit a player ACK for a genuine local intent.
 * This read is not itself an authority or permission to execute anything. */
export function isMastermindNativeThoughtDispatch(action:SharedPlayerActionState){return dispatches.has(action)}

export async function restoreMastermindNativeThoughtDispatch(parentId:string,gateway:MastermindThoughtGateway){const original=await restoreMastermindThoughtNativeOriginal(parentId,gateway),issued=await readMastermindThoughtNativeIssuedOriginal(original,gateway),action=issued.action;dispatches.set(action,{original,signature:signature(action)});return action}
export async function listMastermindNativeThoughtDispatches(mapId:string,gateway:MastermindThoughtGateway){
 const session=gateway.session();if(!session||session.role!=='dm')return[]
 const journal=await gateway.loadResource<{parents:Record<string,{origin?:string;parentTransactionId:string;mapId:string;roomId:string;hostMemberId:string;phase:string;readerTokenId:string;ownerTokenId:string}>}>('mastermind-thought-readings'),out:Array<{parentId:string;readerTokenId:string;ownerTokenId:string;phase:string}>=[]
 for(const row of Object.values(journal?.parents??{})){if(row.origin!=='native'||row.mapId!==mapId||row.roomId!==session.roomId||row.hostMemberId!==session.memberId||!['waiting','answered'].includes(row.phase))continue;try{await restoreMastermindThoughtNativeOriginal(row.parentTransactionId,gateway);out.push({parentId:row.parentTransactionId,readerTokenId:row.readerTokenId,ownerTokenId:row.ownerTokenId,phase:row.phase})}catch{/* A changed original never becomes a resumable entry. */}}
 return out
}

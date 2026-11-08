import{previewMastermindSpellWindowOwnerEligibility}from'./mastermindSpellWindowParent'
import{dnd5eAvailableTempestuousSpellFlight}from'../../rulesets/dnd5e/headlessCombatEngine'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import{beginMastermindSpellWindowCollector,readMastermindSpellWindowCollector,type MastermindSpellWindowCollector}from'./mastermindSpellWindowCollector'
import{readMastermindSpellWindowOriginal,prepareMastermindSpellWindowOwner,type MastermindSpellWindowGateway}from'./mastermindSpellWindowParent'
import{dnd5eCombatantCoverRedirectFeatureIds}from'../../rulesets/dnd5e/headlessCombatEngine'
type Selection={parentTransactionId:string;mapId:string;actorTokenId:string;spellCast:NonNullable<SharedPlayerActionState['dnd5eSpellCast']>}
type Issued={parentId:string;collector:MastermindSpellWindowCollector;signature:string}
const issued=new WeakMap<SharedPlayerActionState,Issued>()
const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>[key,ordered(v)])):value
const signature=(value:unknown)=>JSON.stringify(ordered(value))
/** This is only the native spell-window family's local entry. The canonical
 * private issuer still validates the actual Host caster, source and five reads.
 * It never adds a command to the PC queue or borrows another family's brand. */
export async function issueMastermindSpellWindowNativeDispatch(selection:Selection,gateway:MastermindSpellWindowGateway){
 const collector=await beginMastermindSpellWindowCollector(selection,gateway),original=await readMastermindSpellWindowCollector(collector),action=original.prepared.action
 if(action.sourceMode!=='dm'||action.id!==selection.parentTransactionId||!original.prepared.targetSpellAttacks?.some(target=>{const owner=original.prepared.state.combatants[target.targetToken.id];return !!owner&&dnd5eCombatantCoverRedirectFeatureIds(owner).length>0}))throw Error('spell-window-native-dispatch:actual-Misdirection-target-required')
 // Preserve the real first-owner boundary. A later native full owner is only
 // admission classification: its actual window remains unopened until all
 // preceding physical inputs are locked and the original collector reaches it.
 if(!(dnd5eAvailableTempestuousSpellFlight(original.prepared.state,original.prepared.actorToken.id).length?await previewMastermindSpellWindowOwnerEligibility(original.parentId,0,gateway):await prepareMastermindSpellWindowOwner(original.parentId,0,gateway))&&!original.prepared.targetSpellAttacks?.slice(1).some(target=>{const owner=original.prepared.state.combatants[target.targetToken.id];return !!owner&&dnd5eCombatantCoverRedirectFeatureIds(owner).length>0}))throw Error('spell-window-native-dispatch:actual-first-Misdirection-window-required')
 issued.set(action,{parentId:original.parentId,collector,signature:signature(action)});return action
}
/** Only the exact locally issued action can enter Page's Host route. Every
 * read reconstructs its unchanged canonical native parent again. */
export async function readMastermindSpellWindowNativeDispatch(action:SharedPlayerActionState,gateway:MastermindSpellWindowGateway){
 const entry=issued.get(action);if(!entry)return undefined
 if(signature(action)!==entry.signature)throw Error('spell-window-native-dispatch:issued-action-mutated')
 const current=await readMastermindSpellWindowOriginal(entry.parentId,gateway)
 if(current.prepared.action.sourceMode!=='dm'||signature(current.prepared.action)!==entry.signature)throw Error('spell-window-native-dispatch:same-canonical-original-required')
 return entry.collector
}
/** Classification only; it cannot authorize resolution or publication. */
export function isMastermindSpellWindowNativeDispatch(action:SharedPlayerActionState){return issued.has(action)}
export function mastermindSpellWindowNativeDispatchParentId(action:SharedPlayerActionState){const entry=issued.get(action);if(!entry||signature(action)!==entry.signature)throw Error('spell-window-native-dispatch:actual-issued-action-required');return entry.parentId}
/** A stored ID is merely a lookup. Current controller/source/world guards are
 * rerun before rebuilding a fresh real local dispatch after a reload. */
export async function restoreMastermindSpellWindowNativeDispatch(parentId:string,gateway:MastermindSpellWindowGateway){
 const original=await readMastermindSpellWindowOriginal(parentId,gateway),action=original.prepared.action
 if(action.sourceMode!=='dm'||!action.dnd5eSpellCast)throw Error('spell-window-native-dispatch:actual-native-original-required')
 return issueMastermindSpellWindowNativeDispatch({parentTransactionId:action.id,mapId:action.mapId,actorTokenId:action.actorTokenId,spellCast:action.dnd5eSpellCast},gateway)
}

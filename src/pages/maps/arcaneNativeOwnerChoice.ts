import type {ArcaneNativeOwnerRequest} from '../../../shared/arcane-native-parent.mjs'
import type {Dnd5eHeadlessCombatState} from "../../application/combat/dnd5eCombatRules"
import {dnd5eCombatantCanSee,dnd5eCombatantPairKey} from "../../application/combat/dnd5eCombatRules"

export type ArcaneOwnerChoice=({parentId:string;stage:'arcane';decision:'use'|'decline'}|{parentId:string;stage:'shroud';decision:'use'|'decline';targetIds:string[]})&{checkpointId?:string}
export function arcaneOwnerRequestKey(request:ArcaneNativeOwnerRequest){return request.parentId+':'+(request.checkpointId??'root')+':'+request.phase}
export function sameArcaneOwnerRequest(a:ArcaneNativeOwnerRequest,b:ArcaneNativeOwnerRequest){return arcaneOwnerRequestKey(a)===arcaneOwnerRequestKey(b)&&a.mapId===b.mapId&&a.characterId===b.characterId&&a.actorTokenId===b.actorTokenId&&a.featureId===b.featureId}
export function arcaneOwnerTargetIds(request:ArcaneNativeOwnerRequest,state:Dnd5eHeadlessCombatState):string[]{
 const owner=state.combatants[request.actorTokenId]
 if(request.phase!=='shroud'||request.maximumTargets!==3||request.rangeFeet!==60||request.requiresVisibleTargets!==true||!owner||owner.classState.wardingBondParticipantCharacterId!==request.characterId)return[]
 return Object.values(state.combatants).filter(target=>!target.deathSaves.dead&&(target.currentHp>0||target.usesDeathSaves)&&dnd5eCombatantCanSee(state,owner.id,target.id)&&(target.id===owner.id?0:state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(owner.id,target.id)]??Infinity)<=60).map(target=>target.id)
}
/** An owner sends only a decision and selected IDs. No Host result or private
 * journal becomes an owner credential. Server independently verifies the choice. */
export function arcaneOwnerChoice(request:ArcaneNativeOwnerRequest,decision:'use'|'decline',targetIds:readonly string[],state:Dnd5eHeadlessCombatState):ArcaneOwnerChoice{
 if(request.checkpointId!==undefined&&!/^[a-f0-9]{32}$/.test(request.checkpointId))throw Error('arcane-owner:invalid-checkpoint')
 const checkpoint=request.checkpointId===undefined?{}:{checkpointId:request.checkpointId}
 if(request.phase==='arcane'){if(targetIds.length)throw Error('arcane-owner:unexpected-targets');return{parentId:request.parentId,...checkpoint,stage:'arcane',decision}}
 if(decision==='decline'){if(targetIds.length)throw Error('arcane-owner:decline-targets');return{parentId:request.parentId,...checkpoint,stage:'shroud',decision,targetIds:[]}}
 const eligible=new Set(arcaneOwnerTargetIds(request,state))
 if(targetIds.length>3||new Set(targetIds).size!==targetIds.length||targetIds.some(id=>!eligible.has(id)))throw Error('arcane-owner:invalid-target-selection')
 return{parentId:request.parentId,...checkpoint,stage:'shroud',decision,targetIds:[...targetIds]}
}

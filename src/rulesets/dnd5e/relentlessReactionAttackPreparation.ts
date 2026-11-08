import {dnd5eUnarmedAttackProfiles} from './equipment'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {InitiativeEntry} from '../../components/map/InitiativeTracker'
import {dnd5eCombatantCanSee,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {Dnd5eRelentlessReactionRequest} from './relentlessReactionCheckpoint'
import {planDnd5eMapResultApplication} from './mapBridge'
import {prepareDnd5eEquipmentAttack} from './equipmentAttackAction'
/** Detached preparation using the actual post-damage Host snapshot. No stores or inventory are written. */
export function prepareDnd5eRelentlessReactionAttacks(input:{request:Dnd5eRelentlessReactionRequest;state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];initiativeOrder:readonly InitiativeEntry[];transactionId:string;worldMinute?:number}){
 const actorState=input.state.combatants[input.request.actorId]
 const grant=actorState?.classState.activityWeaponAttackGrants?.[input.request.grantId]
 if(!grant?.immediate||!grant.consumesReaction||!actorState.turn.reactionAvailable)return []
 const characterIdByCombatantId=Object.fromEntries(input.map.tokens.flatMap(token=>token.characterId?[[token.id,token.characterId]]:[]))
 const staged=planDnd5eMapResultApplication({state:input.state,map:input.map,characters:input.characters,characterIdByCombatantId,events:[]})
 const actorToken=staged.map.tokens.find(token=>token.id===input.request.actorId)
 const actor=staged.characters.find(character=>character.id===actorToken?.characterId)
 if(!actor||!actorToken)return []
 const weapons=[{id:'main-hand',slot:'main-hand' as const},{id:'off-hand',slot:'off-hand' as const},...dnd5eUnarmedAttackProfiles(actor,actorState.pluginFeatureIds).map(profile=>({id:profile.weaponId,slot:'main-hand' as const,naturalWeaponId:profile.weaponId}))]
 return weapons.flatMap(weapon=>staged.map.tokens.flatMap(target=>{
  const slot=weapon.slot
  const result=prepareDnd5eEquipmentAttack({geometry:input.state.companionScene?.geometry,map:staged.map,characters:staged.characters,initiativeOrder:input.initiativeOrder,attacksUsed:0,worldMinute:input.worldMinute,
    action:{id:`${input.transactionId}:relentless:${weapon.id}:${target.id}`,mapId:input.map.id,combatId:input.state.combatId,round:input.state.round,initiativeIndex:input.state.initiativeIndex,actorTokenId:actorToken.id,targetTokenId:target.id,characterId:actor.id,type:'dnd5e-weapon-attack',sourceMode:'dm',status:'pending',seq:1,updatedAt:0,dnd5eWeaponAttackOptions:{activityWeaponAttackGrantId:grant.grantId,activityWeaponAttackWeaponSlot:slot,...('naturalWeaponId' in weapon?{naturalWeaponId:weapon.naturalWeaponId}:{})}}})
  if(!result.ok||result.prepared.cover.blocksLineOfEffect||!dnd5eCombatantCanSee(input.state,actorToken.id,target.id))return []
  result.prepared.state=structuredClone(input.state)
  return [{id:`${weapon.id}:${target.id}`,label:`${result.prepared.profile.weaponName} → ${target.label}`,prepared:result.prepared}]
 }))
}

import {dnd5eCharacterCanActAtZeroHitPoints} from '../../rulesets/dnd5e/pluginApi'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import {isDiceCharacterOwnedByCurrentDm} from './diceOwnership'
import {prepareDnd5eEquipmentAttack} from '../../rulesets/dnd5e/equipmentAttackAction'

export interface HostCharacterWeaponConsumedOrigin{roomId:string;memberId:string;parentId:string;mapId:string;combatId:string;round:number;initiativeIndex:number;actorTokenId:string;characterId:string;mapSignature:string;charactersSignature:string}
const consumedHostWeaponActions=new WeakMap<object,{signature:string;origin:HostCharacterWeaponConsumedOrigin;current:()=>boolean}>()
/** Read-only actual consume provenance. DTOs/clones gain no identity, and cancel
 * or a changed controller/action/context invalidates this mechanical witness. */
export function readHostCharacterWeaponConsumedOrigin(action:object):Readonly<HostCharacterWeaponConsumedOrigin>|undefined{const row=consumedHostWeaponActions.get(action),session=getRoomSession();if(!row||!session||session.role!=='dm'||session.roomId!==row.origin.roomId||session.memberId!==row.origin.memberId||row.signature!==JSON.stringify(action)||!row.current())return;return{...row.origin}}

export interface HostCharacterWeaponContext {map:BattleMap;characters:readonly Character[];combat:SharedCombatState}
/** Canonical Host-owned characters have a real player-sheet weapon profile but
 * no player request author. This local capability is never serialized. */
export class HostCharacterWeaponEntry {
 private readonly inFlight=new Map<string,SharedPlayerActionState>()
 private blocked(context:HostCharacterWeaponContext,ownId?:string){
  return [...this.inFlight.values()].some(action=>action.id!==ownId&&action.mapId===context.map.id)||Object.values(context.combat.secondChanceAttacks??{}).some(row=>row.attack.mapId===context.map.id&&row.parentContinuation?.phase!=='consumed')
 }
 hasIssued(id:string){return this.issued.has(id)}
 private readonly issued=new Map<string,{action:SharedPlayerActionState;roomId:string;memberId:string}>()
 eligible(context:HostCharacterWeaponContext,actorTokenId:string,ownId?:string):boolean{
  const session=getRoomSession(),{combat,map,characters}=context,token=map.tokens.find(row=>row.id===actorTokenId),character=characters.find(row=>row.id===token?.characterId)
  return !this.blocked(context,ownId)&&!!session&&session.role==='dm'&&combat.active===true&&!combat.flowPause&&!!combat.combatId&&combat.mapId===map.id&&combat.initiativeOrder[combat.initiativeIndex]?.tokenId===actorTokenId&&!!token?.characterId&&!!character&&(character.currentHp>0||dnd5eCharacterCanActAtZeroHitPoints(character))&&isDiceCharacterOwnedByCurrentDm(character,session)
 }
 issue(context:HostCharacterWeaponContext,input:{id:string;actorTokenId:string;targetTokenId:string;now:number}):SharedPlayerActionState{
  if(!this.eligible(context,input.actorTokenId))throw Error('host-character-weapon:not-current-owned-actor')
  const session=getRoomSession()!,{combat,map}=context,token=map.tokens.find(row=>row.id===input.actorTokenId)!
  if(!input.id.trim()||this.issued.has(input.id))throw Error('host-character-weapon:invalid-command-id')
  const action:SharedPlayerActionState={id:input.id,mapId:map.id,combatId:combat.combatId,sourceMode:'dm',roomMemberId:session.memberId,status:'pending',type:'dnd5e-weapon-attack',actorTokenId:token.id,characterId:token.characterId!,targetTokenId:input.targetTokenId,round:combat.round,initiativeIndex:combat.initiativeIndex,seq:input.now,updatedAt:input.now}
  this.prepare(context,action)
  this.issued.set(action.id,{action:structuredClone(action),roomId:session.roomId,memberId:session.memberId});this.inFlight.set(action.id,action)
  return action
 }
 private prepare(context:HostCharacterWeaponContext,action:SharedPlayerActionState){
  const economy=context.combat.dnd5eTurnEconomyByToken?.[action.actorTokenId]
  const result=prepareDnd5eEquipmentAttack({action,map:context.map,characters:context.characters,initiativeOrder:context.combat.initiativeOrder,attacksUsed:economy?.attacksUsed??0,turnEconomy:economy,turnEconomyByToken:context.combat.dnd5eTurnEconomyByToken})
  if(!result.ok)throw Error('host-character-weapon:'+result.reason)
 }
 consume(context:HostCharacterWeaponContext,action:SharedPlayerActionState):boolean{
  const record=this.issued.get(action.id),session=getRoomSession()
  if(!record||!session||session.role!=='dm'||session.roomId!==record.roomId||session.memberId!==record.memberId||JSON.stringify(record.action)!==JSON.stringify(action)||!this.eligible(context,action.actorTokenId,action.id)||action.combatId!==context.combat.combatId||action.round!==context.combat.round||action.initiativeIndex!==context.combat.initiativeIndex)return false
  try{this.prepare(context,action)}catch{return false}
  this.issued.delete(action.id)
  const signature=JSON.stringify(action),contextSignature=JSON.stringify(context),origin:HostCharacterWeaponConsumedOrigin={roomId:session.roomId,memberId:session.memberId,parentId:action.id,mapId:context.map.id,combatId:context.combat.combatId!,round:context.combat.round,initiativeIndex:context.combat.initiativeIndex,actorTokenId:action.actorTokenId,characterId:action.characterId,mapSignature:JSON.stringify(context.map),charactersSignature:JSON.stringify(context.characters)}
  consumedHostWeaponActions.set(action,{signature,origin,current:()=>this.inFlight.has(action.id)&&!this.issued.has(action.id)&&JSON.stringify(this.inFlight.get(action.id))===signature&&JSON.stringify(context)===contextSignature&&this.eligible(context,action.actorTokenId,action.id)})
  return true
 }
 cancel(id:string){this.issued.delete(id);this.inFlight.delete(id)}
}

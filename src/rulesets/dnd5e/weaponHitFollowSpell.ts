import {planDnd5eMapResultApplication} from './mapBridge'
import {dnd5eWarCasterOpportunitySpellOptions} from './warCasterOpportunitySpell'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import type {Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'

export type Dnd5eHitFollowSpellRolls=Omit<Parameters<typeof resolvePreparedDnd5eSpellCast>[0],'prepared'|'opportunityAttackSpell'>

/** Presentation options only. The session independently re-creates these at
 * the reached movement window before accepting an option identifier. */
export function prepareDnd5eHitFollowSpells(input:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];
 attackerId:string;targetId:string;transactionId:string}){
 const caster=input.state.combatants[input.attackerId]
 if(!caster?.opportunityAttackSpellReplacement||!caster.turn.reactionAvailable)return []
 const state=structuredClone(input.state)
 const characterIdByCombatantId=Object.fromEntries(input.map.tokens.flatMap(token=>
  token.characterId&&!token.dnd5eSimulacrum?[[token.id,token.characterId]]:[]))
 const projected=planDnd5eMapResultApplication({state,map:structuredClone(input.map),characters:structuredClone([...input.characters]),characterIdByCombatantId,events:[]})
 const initiativeOrder=state.initiativeOrder.flatMap((id,index)=>{
  const token=projected.map.tokens.find(token=>token.id===id)
  return token?[{tokenId:id,label:token.label,emoji:token.emoji,color:token.color,roll:-index}]:[]
 })
 const context={map:projected.map,characters:projected.characters,initiativeOrder}
 return dnd5eWarCasterOpportunitySpellOptions({...context,actionIdPrefix:input.transactionId,
  combatId:state.combatId,round:state.round,initiativeIndex:state.initiativeIndex,
  actorTokenId:input.attackerId,targetTokenId:input.targetId,now:0},state).flatMap(option=>{
   const ready=prepareDnd5eSpellCast({...context,action:option.action},state)
   return ready.ok?[{id:option.id,label:option.label,description:option.description,prepared:ready.prepared}]:[]
  })
}

import type {TempleExpirySettlement} from './withStructureExpiry'
import {createDnd5eMapCombatSnapshot} from '../rulesets/dnd5e/mapBridge'
import {resolveDnd5eTempleExpiry} from '../rulesets/dnd5e/templeExpirySettlement'
import {createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy} from '../rulesets/dnd5e/turnEconomy'
import type {Dnd5eSolidExitFeatherFallChoice} from '../rulesets/dnd5e/solidMaterialExitSettlement'
import {getTempleExpiryInteraction,requireTempleExpiryInteraction} from './templeExpiryInteraction'
export {registerTempleExpiryInteraction,type TempleExpiryInteraction} from './templeExpiryInteraction'

export const settleBrowserTempleExpiry:TempleExpirySettlement=async input=>{
 const combat=input.combat?.active&&input.combat.mapId===input.map.id?input.combat:undefined
 const physical=input.map.tokens.filter(token=>['player','enemy','npc'].includes(token.type))
 const snapshot=createDnd5eMapCombatSnapshot({...input,combatId:combat?.combatId??`temple-expiry:${input.map.id}`,
  round:combat?.round,initiativeOrder:physical.map((token,index)=>combat?.initiativeOrder.find(entry=>entry.tokenId===token.id)??
   {tokenId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:1000-index})})
 snapshot.state.active=!!combat
 for(const [id,economy]of Object.entries(combat?.dnd5eTurnEconomyByToken??{})){
  const actor=snapshot.state.combatants[id]
  if(actor)actor.turn={...actor.turn,actionAvailable:economy.action.current>0,bonusActionAvailable:economy.bonusAction.current>0,
   reactionAvailable:economy.reaction.current>0,movementRemaining:economy.movement.current}
 }
 const choices:Dnd5eSolidExitFeatherFallChoice[]=[]
 let rolls:Readonly<Record<string,readonly number[]>>|undefined
 let owner=getTempleExpiryInteraction()
 const transactionId=`temple-expiry:${crypto.randomUUID()}`
 for(let attempt=0;attempt<64;attempt++){
  const result=resolveDnd5eTempleExpiry({...input,state:snapshot.state,characterIdByCombatantId:snapshot.characterIdByCombatantId,
   solidExitFeatherFallChoices:choices,airborneFallDamageRollsByCombatantId:rolls})
  if(result.ok){
   let nextCombat=undefined
   if(combat){
    const economy={...combat.dnd5eTurnEconomyByToken}
    for(const event of result.result.events)if(event.type==='turn-resource-spent'&&event.resource==='reaction'){
     const actor=result.result.state.combatants[event.actorId]
     if(actor)economy[event.actorId]=projectDnd5eHeadlessTurnEconomy(economy[event.actorId]??createDnd5eTurnEconomyCounts(`temple-expiry:${combat.round}`,actor.speed),actor.turn)
    }
    nextCombat={...combat,dnd5eTurnEconomyByToken:economy}
   }
   return {map:result.application.map,geometry:result.geometry,characters:result.application.characters,expiredIds:result.expiredIds,combat:nextCombat}
  }
  if(rolls||!result.airborneFalls?.length||!result.solidExitReactionState)throw Error(result.reason)
  owner??=await requireTempleExpiryInteraction()
  if(getTempleExpiryInteraction()!==owner)throw Error('temple-expiry-host-interaction-unavailable')
  const choice=await owner.chooseFeatherFall(result.solidExitReactionState,result.airborneFalls,input.map,transactionId)
  if(getTempleExpiryInteraction()!==owner)throw Error('temple-expiry-host-interaction-unavailable')
  if(choice){choices.push(choice);continue}
  rolls=await owner.rollFalls(result.airborneFalls,input.map)
  if(getTempleExpiryInteraction()!==owner)throw Error('temple-expiry-host-interaction-unavailable')
 }
 throw Error('temple-expiry-reaction-limit')
}

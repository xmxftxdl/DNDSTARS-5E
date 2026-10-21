import {resolveDnd5eFeatherFallReaction,type Dnd5eCombatEvent,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {settleDnd5eTempleMovementEntries} from './templeMovementSettlement'
import {dnd5eForcedMovementFall} from './spellAction'
import {dnd5eFallingDamageDice} from './traversal'
import {replayDnd5eTempleMovementEntries,dnd5eAcceptedForcedFalls,type Dnd5eForcedFallReactionReplay,type Dnd5eForcedMovementLandingReplay} from './templeMovementReplay'
import type {BattleMap} from '../../store/maps'
type EntryInput=Parameters<typeof settleDnd5eTempleMovementEntries>[0]
/** Host-only staged consequences. No room state is published; return verified dice receipts for replay. */
export async function collectDnd5eForcedMovementConsequences(input:{
 state:Dnd5eHeadlessCombatState;map:BattleMap;events:readonly Dnd5eCombatEvent[];transactionId:string;
 isCurrent:EntryInput['isCurrent'];roll:EntryInput['roll'];rollEffectDice?:EntryInput['rollEffectDice'];
 requestFallReaction?:(state:Dnd5eHeadlessCombatState,falls:ReturnType<typeof dnd5eAcceptedForcedFalls>,transactionId:string)=>Promise<Dnd5eForcedFallReactionReplay|undefined>;
 rollFallingDamage:(count:number,targetId:string)=>Promise<readonly number[]|undefined>;
}){
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 if(input.events.some(event=>event.type==='moved'&&event.movementKind!=='forced'))return {ok:false as const,reason:'forced-movement-event-invalid'}
 const settled=await settleDnd5eTempleMovementEntries({state:input.state,map:input.map,events:input.events,
  transactionId:`${input.transactionId}:direct`,isCurrent:input.isCurrent,roll:input.roll,rollEffectDice:input.rollEffectDice})
 if(!settled.ok)return settled
 let landingState=settled.state
 const reactions:Dnd5eForcedFallReactionReplay[]=[]
 if(input.requestFallReaction){
  let remaining=dnd5eAcceptedForcedFalls(landingState,input.map,settled.events)
  while(remaining.length){
   if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
   const choice=await input.requestFallReaction(landingState,remaining,
    input.transactionId+':direct:fall:'+reactions.length)
   if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
   if(!choice)break
   if(!choice.targetIds.length||choice.targetIds.some(id=>!remaining.some(fall=>fall.combatantId===id))||new Set(choice.targetIds).size!==choice.targetIds.length)
    return {ok:false as const,reason:'forced-fall-reaction-target-invalid'}
   const reacted=resolveDnd5eFeatherFallReaction(landingState,{casterId:choice.casterId,spellcastingSavingThrows:choice.spellcastingSavingThrows,
    falls:choice.targetIds.map(id=>remaining.find(fall=>fall.combatantId===id)!)})
   if(!reacted.ok)return reacted
   landingState=reacted.state;reactions.push(structuredClone(choice))
   remaining=remaining.filter(fall=>!choice.targetIds.includes(fall.combatantId))
  }

 }
 const landings:Dnd5eForcedMovementLandingReplay[]=[]
 for(const [eventIndex,event] of input.events.entries()){
  if(event.type!=='moved'||event.movementKind!=='forced'||!settled.events.includes(event))continue
  if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
  const token=input.map.tokens.find(token=>token.id===event.actorId)
  if(!token)return {ok:false as const,reason:'temple-movement-actor-missing'}
  const fall=dnd5eForcedMovementFall({geometry:input.state.companionScene?.geometry??undefined,
   target:{...token,...event.from,elevationFeet:event.fromElevationFeet},targetCombatant:landingState.combatants[event.actorId],to:event.to})
  const controlled=landingState.combatants[event.actorId]?.classState.activeEffects?.some(effect=>effect.modifiers?.controlledDescent!=null)
  const count=controlled?0:dnd5eFallingDamageDice(fall.fallDistanceFeet)
  const rolls=count>0?await input.rollFallingDamage(count,event.actorId):undefined
  if(count>0&&rolls==null)return {ok:false as const,reason:'forced-landing-dice-cancelled'}
  landings.push({eventIndex,fallingDamageRolls:rolls})
 }
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 const verified=replayDnd5eTempleMovementEntries({state:input.state,map:input.map,events:input.events,
  entryReplays:settled.entryReplays,landings,fallReactions:input.requestFallReaction?reactions:undefined})
 return verified.ok?{...verified,entryReplays:settled.entryReplays,landings,fallReactions:reactions}:verified

}

export async function collectDnd5eHitPushConsequences(input:Parameters<typeof collectDnd5eForcedMovementConsequences>[0]){
 if(input.events.some(event=>event.type!=='moved'||event.movementKind!=='forced'))return {ok:false as const,reason:'hit-push-event-invalid'}
 return collectDnd5eForcedMovementConsequences(input)
}

import {resolveDnd5eFeatherFallReaction,previewDnd5eDirectSpecialMovement,resolveDnd5eHeadlessAction,type Dnd5eAction,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {settleDnd5eTempleMovementEntries} from './templeMovementSettlement'
import {dnd5eForcedMovementFall} from './spellAction'
import {dnd5eFallingDamageDice} from './traversal'
import {dnd5eAcceptedForcedFalls,type Dnd5eForcedFallReactionReplay,type Dnd5eForcedMovementLandingReplay} from './templeMovementReplay'

type CompositeAction=Extract<Dnd5eAction,{type:'monster-special-action'|'monster-legendary-special-action'}>
type EntryInput=Parameters<typeof settleDnd5eTempleMovementEntries>[0]

/** Collect entry, fall reactions and landing receipts for a direct native movement action. */
export async function collectDnd5eDirectSpecialMovement(input:{
 state:Dnd5eHeadlessCombatState;action:CompositeAction;transactionId:string;
 isCurrent:EntryInput['isCurrent'];roll:EntryInput['roll'];rollEffectDice?:EntryInput['rollEffectDice'];
 requestFallReaction?:(state:Dnd5eHeadlessCombatState,falls:ReturnType<typeof dnd5eAcceptedForcedFalls>,transactionId:string)=>Promise<Dnd5eForcedFallReactionReplay|undefined>;
 rollFallingDamage:(count:number,targetId:string)=>Promise<readonly number[]|undefined>;
}){
 const step=structuredClone(input.action)
 step.stageForcedMovement=true
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 if(step.templeEntryReplays!=null&&step.forcedMovementLandings!=null){
  const verified=resolveDnd5eHeadlessAction(input.state,step)
  return verified.ok?{ok:true as const,action:step,result:verified}:verified
 }
 const prefix=previewDnd5eDirectSpecialMovement(input.state,step)
 if(!prefix.ok)return prefix
 const scene=input.state.companionScene
 if(!scene)return {ok:false as const,reason:'temple-entry-scene-missing'}
 const events=prefix.events
 const settled=await settleDnd5eTempleMovementEntries({state:prefix.state,map:scene.map,events,
  transactionId:`${input.transactionId}:direct`,isCurrent:input.isCurrent,roll:input.roll,rollEffectDice:input.rollEffectDice})
 if(!settled.ok)return settled
 let landingState=settled.state
 const reactions:Dnd5eForcedFallReactionReplay[]=[]
 if(input.requestFallReaction){
  let remaining=dnd5eAcceptedForcedFalls(landingState,scene.map,settled.events)
  while(remaining.length){
   if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
   const choice=await input.requestFallReaction(landingState,remaining,
    input.transactionId+':direct:fall:'+reactions.length)
   if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
   if(!choice)break
   if(choice.targetIds.some(id=>!remaining.some(fall=>fall.combatantId===id))||new Set(choice.targetIds).size!==choice.targetIds.length)
    return {ok:false as const,reason:'forced-fall-reaction-target-invalid'}
   const reacted=resolveDnd5eFeatherFallReaction(landingState,{casterId:choice.casterId,spellcastingSavingThrows:choice.spellcastingSavingThrows,
    falls:choice.targetIds.map(id=>remaining.find(fall=>fall.combatantId===id)!)})
   if(!reacted.ok)return reacted
   landingState=reacted.state;reactions.push(structuredClone(choice))
   remaining=remaining.filter(fall=>!choice.targetIds.includes(fall.combatantId))
  }
  step.forcedFallReactions=reactions
 }
 const landings:Dnd5eForcedMovementLandingReplay[]=[]
 for(const [eventIndex,event] of events.entries()){
  if(event.type!=='moved'||event.movementKind!=='forced'||!settled.events.includes(event))continue
  if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
  const token=scene.map.tokens.find(token=>token.id===event.actorId)
  if(!token)return {ok:false as const,reason:'temple-movement-actor-missing'}
  const fall=dnd5eForcedMovementFall({geometry:scene.geometry??undefined,
   target:{...token,...event.from,elevationFeet:event.fromElevationFeet},targetCombatant:landingState.combatants[event.actorId],to:event.to})
  const controlled=landingState.combatants[event.actorId]?.classState.activeEffects?.some(effect=>effect.modifiers?.controlledDescent!=null)
  const count=controlled?0:dnd5eFallingDamageDice(fall.fallDistanceFeet)
  const rolls=count>0?await input.rollFallingDamage(count,event.actorId):undefined
  if(count>0&&rolls==null)return {ok:false as const,reason:'forced-landing-dice-cancelled'}
  landings.push({eventIndex,fallingDamageRolls:rolls})
 }
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 step.templeEntryReplays=settled.entryReplays;step.forcedMovementLandings=landings
 const verified=resolveDnd5eHeadlessAction(input.state,step)
 return verified.ok?{ok:true as const,action:step,result:verified}:verified
}

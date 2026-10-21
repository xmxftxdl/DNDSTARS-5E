import {resolveDnd5eFeatherFallReaction,previewDnd5eMonsterCompositePrefix,type Dnd5eAction,type Dnd5eCombatEvent,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {settleDnd5eTempleMovementEntries} from './templeMovementSettlement'
import {dnd5eForcedMovementFall} from './spellAction'
import {dnd5eFallingDamageDice} from './traversal'
import {dnd5eAcceptedForcedFalls,type Dnd5eForcedFallReactionReplay,type Dnd5eForcedMovementLandingReplay} from './templeMovementReplay'

type CompositeAction=Extract<Dnd5eAction,{type:'monster-multiattack-composite'}>
type EntryInput=Parameters<typeof settleDnd5eTempleMovementEntries>[0]

/** Host collector for the newest staged child only. Earlier children are
 * replayed with their existing evidence, never rolled or published again. */
export async function collectDnd5eCompositeMovementStep(input:{
 state:Dnd5eHeadlessCombatState;action:CompositeAction;transactionId:string;
 isCurrent:EntryInput['isCurrent'];roll:EntryInput['roll'];rollEffectDice?:EntryInput['rollEffectDice'];
 requestFallReaction?:(state:Dnd5eHeadlessCombatState,falls:ReturnType<typeof dnd5eAcceptedForcedFalls>,transactionId:string)=>Promise<Dnd5eForcedFallReactionReplay|undefined>;
 rollFallingDamage:(count:number,targetId:string)=>Promise<readonly number[]|undefined>;
}){
 const steps=structuredClone(input.action.steps),index=steps.length-1,step=steps[index]
 if(!step?.stageForcedMovement)return {ok:false as const,reason:'composite-movement-step-missing'}
 if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
 const action={...input.action,steps}
 const previous=index===0?{ok:true as const,state:input.state,events:[] as Dnd5eCombatEvent[]}:
  previewDnd5eMonsterCompositePrefix(input.state,{...action,steps:steps.slice(0,index)},input.transactionId)
 if(!previous.ok)return previous
 const prefix=previewDnd5eMonsterCompositePrefix(input.state,action,input.transactionId)
 if(!prefix.ok)return prefix
 if(step.templeEntryReplays!=null&&step.forcedMovementLandings!=null)return {ok:true as const,step,prefix}
 const scene=previous.state.companionScene
 if(!scene)return {ok:false as const,reason:'temple-entry-scene-missing'}
 const events=prefix.events.slice(previous.events.length).map(event=>event.type==='moved'?{
  ...event,movementKind:event.movementKind==='teleport'?'teleport' as const:'forced' as const,
  fromElevationFeet:previous.state.combatants[event.actorId]?.elevationFeet??previous.state.combatants[event.actorId]?.groundElevationFeet??0,
  toElevationFeet:event.toElevationFeet??previous.state.combatants[event.actorId]?.elevationFeet,
 }:event)
 const settled=await settleDnd5eTempleMovementEntries({state:prefix.state,map:scene.map,events,
  transactionId:`${input.transactionId}:child:${index}`,isCurrent:input.isCurrent,roll:input.roll,rollEffectDice:input.rollEffectDice})
 if(!settled.ok)return settled
 let landingState=settled.state
 const reactions:Dnd5eForcedFallReactionReplay[]=[]
 if(input.requestFallReaction){
  let remaining=dnd5eAcceptedForcedFalls(landingState,scene.map,settled.events)
  while(remaining.length){
   if(!input.isCurrent())return {ok:false as const,reason:'temple-entry-authority-changed'}
   const choice=await input.requestFallReaction(landingState,remaining,
    input.transactionId+':child:'+index+':fall:'+reactions.length)
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
 const verified=previewDnd5eMonsterCompositePrefix(input.state,action,input.transactionId)
 return verified.ok?{ok:true as const,step,prefix:verified}:verified
}

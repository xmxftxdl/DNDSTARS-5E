import {dnd5eCombatantCanSee,replaceDnd5eCombatantActiveEffects,type Dnd5eCombatEvent,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eCombatantClassLevel,dnd5eCombatantPairKey} from './headlessCombatPrimitives'
import {dnd5eIsIncapacitated} from './passiveDefenses'

function ownedCurse(state:Dnd5eHeadlessCombatState,actorId:string,bearerId:string,packageId:string,activityId:string){
 const actor=state.combatants[actorId],bearer=state.combatants[bearerId]
 if(!actor||!bearer?.deathSaves.dead||actor.currentHp<=0||actor.deathSaves.dead||dnd5eIsIncapacitated(actor)||dnd5eCombatantClassLevel(actor,'warlock')<1)return undefined
 const sourceRulesId=`${packageId}:${activityId}`
 const matches=(bearer.classState.activeEffects??[]).filter(effect=>effect.source.actorId===actor.id&&effect.source.pluginId===packageId&&
  effect.source.rulesId===sourceRulesId&&effect.source.kind==='plugin'&&effect.source.magical===false&&
  effect.modifiers?.notifySourceOnBearerDeath===true&&effect.tags?.includes('hexblade-curse')&&!effect.suspendedBy?.length&&
  effect.duration.type==='rounds'&&effect.duration.remainingRounds>0&&effect.duration.tickOn==='source-turn-end')
 return matches.length===1?{actor,bearer,effect:matches[0],sourceRulesId}:undefined
}
export const dnd5eHasOwnedCurseDeathSource=(state:Dnd5eHeadlessCombatState,actorId:string,bearerId:string,packageId:string,activityId:string)=>
 !!ownedCurse(state,actorId,bearerId,packageId,activityId)

export function consumeDnd5eOwnedCurseDeathHealing(input:{state:Dnd5eHeadlessCombatState;actorId:string;bearerId:string;packageId:string;sourceActivityId:string;events:Dnd5eCombatEvent[]}):number|undefined{
 const found=ownedCurse(input.state,input.actorId,input.bearerId,input.packageId,input.sourceActivityId)
 if(!found)return undefined
 replaceDnd5eCombatantActiveEffects(found.bearer,(found.bearer.classState.activeEffects??[]).filter(effect=>effect.id!==found.effect.id))
 input.events.push({type:'active-effect-removed',targetId:found.bearer.id,effectId:found.effect.id,definitionId:found.effect.definitionId,reason:'death'})
 return Math.max(1,dnd5eCombatantClassLevel(found.actor,'warlock')+Math.floor((found.actor.abilities.cha-10)/2))
}

export function dnd5eOwnedCurseDeathTransferTargets(state:Dnd5eHeadlessCombatState,actorId:string,bearerId:string):readonly {id:string;name:string}[]{
 const actor=state.combatants[actorId]
 if(!actor||actor.currentHp<=0||actor.deathSaves.dead||dnd5eIsIncapacitated(actor)||dnd5eCombatantClassLevel(actor,'warlock')<14)return[]
 return Object.values(state.combatants).filter(target=>target.id!==bearerId&&!target.deathSaves.dead&&
  target.objectDamageThreshold==null&&!target.objectInteractionOnly&&
  (target.id===actor.id?0:state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actor.id,target.id)]??Infinity)<=30&&
  dnd5eCombatantCanSee(state,actor.id,target.id)).map(target=>({id:target.id,name:target.name}))
}
/** Move one exact live source-owned curse instance; no new duration, cost or heal. */
export function transferDnd5eOwnedCurseAfterDeath(input:{state:Dnd5eHeadlessCombatState;actorId:string;bearerId:string;destinationId:string;packageId:string;sourceActivityId:string;events:Dnd5eCombatEvent[]}):boolean{
 const actor=input.state.combatants[input.actorId],bearer=input.state.combatants[input.bearerId],destination=input.state.combatants[input.destinationId]
 if(!actor||!bearer?.deathSaves.dead||!destination||!dnd5eOwnedCurseDeathTransferTargets(input.state,actor.id,bearer.id).some(target=>target.id===destination.id))return false
 const found=ownedCurse(input.state,actor.id,bearer.id,input.packageId,input.sourceActivityId)
 if(!found)return false
 const {effect:original,sourceRulesId}=found
 if(destination.classState.activeEffects?.some(effect=>effect.id===original.id||effect.source.actorId===actor.id&&effect.source.pluginId===input.packageId&&effect.source.rulesId===sourceRulesId))return false
 const moved=structuredClone(original)
 replaceDnd5eCombatantActiveEffects(bearer,(bearer.classState.activeEffects??[]).filter(effect=>effect.id!==original.id))
 replaceDnd5eCombatantActiveEffects(destination,[...destination.classState.activeEffects??[],moved])
 input.events.push({type:'active-effect-removed',targetId:bearer.id,effectId:original.id,definitionId:original.definitionId,reason:'triggered'},
  {type:'active-effect-applied',targetId:destination.id,effectId:moved.id,definitionId:moved.definitionId})
 return true
}

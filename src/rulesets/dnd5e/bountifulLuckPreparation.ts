import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {dnd5eAllyNaturalOneOptions,dnd5eHalflingLuckySuppressed} from './headlessCombatEngine'
import type {AllyNaturalOneKind} from './allyNaturalOneCheckpoint'

export function prepareDnd5eBountifulLuckyDeferral(input:Parameters<typeof createDnd5eMapCombatSnapshot>[0]&{
  actorId:string
  kind:AllyNaturalOneKind
  skill?:string
  initiativeIndex:number
  reactionAvailableByCombatantId:Readonly<Record<string,boolean>>
}){
  const snapshot=createDnd5eMapCombatSnapshot(input),state=snapshot.state,actor=state.combatants[input.actorId]
  if(!actor)return {defer:false,state}
  for(const owner of Object.values(state.combatants))owner.turn.reactionAvailable=input.reactionAvailableByCombatantId[owner.id]===true
  state.initiativeIndex=input.initiativeIndex
  const request={actorId:input.actorId,kind:input.kind,skill:input.skill,originalRolls:[1],dieIndex:0}
  const options=dnd5eAllyNaturalOneOptions(state,request)
  return {defer:dnd5eHalflingLuckySuppressed(actor)||options.length>0,state,options}
}

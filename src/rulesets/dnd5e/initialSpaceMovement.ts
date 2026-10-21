import { effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eInitialSpaceContainsVolume, dnd5eInitialSpaceContainsPoint } from './initialSpaceBoundary'
import { dnd5eCreatureHeightFeetForSizeRank } from './verticalCombatGeometry'
import { dnd5eEffectiveSizeRank, type Dnd5eHeadlessCombatState, type Dnd5eCombatEvent } from './headlessCombatEngine'

/** Host event geometry, never caller-supplied qualification flags. */
export function dnd5eMovementExitedInitialSpaceTags(state:Dnd5eHeadlessCombatState,
  event:Extract<Dnd5eCombatEvent,{type:'moved'}>):string[]{
  const actor=state.combatants[event.actorId]
  const cells=state.gridDistance?.footprintCellsByCombatantId[event.actorId]
  if(!actor||!state.mapId||!cells||!state.gridDistance)return []
  const height=dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(actor))
  const volume=(position:{x:number;y:number},elevation:number,mapId:string)=>({mapId,...position,
    halfWidthUnits:cells*state.gridDistance!.cellUnits/2,bottomFeet:elevation,topFeet:elevation+height})
  const from=volume(event.from,event.fromElevationFeet??actor.elevationFeet??actor.groundElevationFeet??0,event.fromMapId??state.mapId)
  const to=volume(event.to,event.toElevationFeet??actor.elevationFeet??actor.groundElevationFeet??0,event.toMapId??state.mapId)
  return [...new Set(effectiveDnd5eActiveEffects(actor.classState.activeEffects).flatMap(effect=>
    effect.initialSpaceBoundary&&dnd5eInitialSpaceContainsVolume(effect.initialSpaceBoundary,from)&&
    !dnd5eInitialSpaceContainsVolume(effect.initialSpaceBoundary,to)?effect.tags??[]:[]))]
}

export function dnd5eMeleeCrossedInitialSpaceTags(state:Dnd5eHeadlessCombatState,
  event:Extract<Dnd5eCombatEvent,{type:'attack-resolved'}>,
  subsequentEvents:readonly Dnd5eCombatEvent[]=[]):string[]{
  const melee=event.attackDelivery==='melee'||(!event.attackDelivery&&
    (event.attackMode==='melee'||event.attackMode==='unarmed'))
  // Settlement sees the batch's final state. The first later move starts at
  // the attack-time position, even when several push/teleport riders follow.
  const atAttack=(id:string)=>{
    const combatant=state.combatants[id]
    const move=subsequentEvents.find((candidate):candidate is Extract<Dnd5eCombatEvent,{type:'moved'}>=>
      candidate.type==='moved'&&candidate.actorId===id)
    return combatant&&move?{...combatant,position:move.from,
      ...(move.fromElevationFeet!==undefined?{elevationFeet:move.fromElevationFeet}:{}),
    }:combatant
  }
  const actor=atAttack(event.actorId), target=atAttack(event.targetId)
  if(!melee||!actor||!target||!state.mapId)return []
  const cells=state.gridDistance?.footprintCellsByCombatantId[target.id]
  if(!cells||!state.gridDistance)return []
  const half=cells*state.gridDistance.cellUnits/2
  const bottom=target.elevationFeet??target.groundElevationFeet??0
  const height=dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(target))
  const eye=(actor.elevationFeet??actor.groundElevationFeet??0)+dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(actor))/2
  // Use the nearest point inside the target's occupied body, not its center.
  // A tiny inset makes contact across an exactly shared boundary a crossing.
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
  const targetMove=subsequentEvents.find((candidate):candidate is Extract<Dnd5eCombatEvent,{type:'moved'}>=>
    candidate.type==='moved'&&candidate.actorId===event.targetId)
  const point={mapId:targetMove?.fromMapId??state.mapId,
    x:clamp(actor.position.x,target.position.x-half+1e-4,target.position.x+half-1e-4),
    y:clamp(actor.position.y,target.position.y-half+1e-4,target.position.y+half-1e-4),
    elevationFeet:clamp(eye,bottom+1e-4,bottom+height-1e-4)}
  return [...new Set(effectiveDnd5eActiveEffects(actor.classState.activeEffects).flatMap(effect=>
    effect.initialSpaceBoundary&&!dnd5eInitialSpaceContainsPoint(effect.initialSpaceBoundary,point)?effect.tags??[]:[]))]
}

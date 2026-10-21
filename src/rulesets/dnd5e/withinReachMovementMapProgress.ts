import type {BattleMap,Token} from '../../store/maps'
import type {Character} from '../../types/character'
import type {Dnd5eCombatEvent,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {mapGeometryRuntimeForMap,mapGeometryTokenElevation} from '../../lib/mapGeometry'
import {dnd5eMapTokenDistanceFeet} from './verticalCombatGeometry'
import {dnd5eCharacterHasPluginFeature,registeredDnd5ePluginFeatures} from './pluginApi'
import {dnd5eWeaponAttackProfile} from './equipment'
import {advanceDnd5eWithinReachMovement} from './withinReachMovementProgress'

/** Update only from successful, authoritative map applications, never previews. */
export function recordDnd5eWithinReachMapMovement(input:{
  state:Dnd5eHeadlessCombatState
  map:BattleMap
  characters:readonly Character[]
  events:readonly Dnd5eCombatEvent[]
}):void {
  if(!input.events.some(e=>e.type==='moved'||e.type==='turn-ended'))return
  const {state,map}=input
  const geometry=mapGeometryRuntimeForMap(map.id)
  const turnKey=`${state.combatId}:${state.round}:${state.initiativeSlotIds?.[state.initiativeIndex]??state.turnSlotId??state.initiativeOrder[state.initiativeIndex]}`
  const positions=new Map(map.tokens.map(token=>[token.id,{...token,elevationFeet:mapGeometryTokenElevation(geometry,token)}]))
  const guards=map.tokens.flatMap(token=>{
    const character=input.characters.find(c=>c.id===token.characterId)
    if(!character||!registeredDnd5ePluginFeatures().some(feature=>feature.automation!=='manual'&&
      feature.staticModifiers?.opportunityAttacksOnMoveWithinReach===true&&dnd5eCharacterHasPluginFeature(character,feature.id)))return []
    const weapon=dnd5eWeaponAttackProfile(character)
    return weapon?.mode==='melee'?[{tokenId:token.id,reachFeet:weapon.reachFeet??5}]:[]
  })
  for(const event of input.events){
    if(event.type==='turn-ended'){
      for(const actor of Object.values(state.combatants))actor.classState.withinReachMovementByAttacker=undefined
      continue
    }
    if(event.type!=='moved')continue
    // Moving the threatening creature invalidates distances measured around its former position.
    for(const actor of Object.values(state.combatants))if(actor.classState.withinReachMovementByAttacker?.[event.actorId]){
      actor.classState.withinReachMovementByAttacker={...actor.classState.withinReachMovementByAttacker}
      delete actor.classState.withinReachMovementByAttacker[event.actorId]
    }
    const actor=state.combatants[event.actorId],token=positions.get(event.actorId)
    if(!actor||!token)continue
    const from={...event.from,elevationFeet:event.fromElevationFeet??token.elevationFeet}
    const to={...event.to,elevationFeet:event.toElevationFeet??actor.elevationFeet??token.elevationFeet}
    const unitsPerFoot=map.gridSize/Math.max(1,map.feetPerCell??5)
    const directDistance=Math.max(Math.abs(to.x-from.x)/unitsPerFoot,Math.abs(to.y-from.y)/unitsPerFoot,Math.abs(to.elevationFeet-from.elevationFeet))
    const previous=actor.classState.withinReachMovementByAttacker??{}
    const next:NonNullable<typeof actor.classState.withinReachMovementByAttacker>={}
    for(const guard of guards){
      const attacker=positions.get(guard.tokenId)
      if(!attacker||guard.tokenId===actor.id)continue
      const distance=(point:typeof from)=>dnd5eMapTokenDistanceFeet({map,geometry,left:attacker,right:{...token,...point} as Token})
      const progress=advanceDnd5eWithinReachMovement({previous:previous[guard.tokenId],turnKey,
        commitKey:`${turnKey}:${actor.id}:${from.x},${from.y},${from.elevationFeet}:${to.x},${to.y},${to.elevationFeet}:${event.distance}`,
        from,to,attackerPosition:attacker,reachFeet:guard.reachFeet,distanceFeet:event.distance,
        voluntary:state.active&&['voluntary','mounted'].includes(event.movementKind??'')&&
          (event.straightLine===true||Math.abs(directDistance-event.distance)<1e-6),
        withinReach:distance(from)<=guard.reachFeet&&distance(to)<=guard.reachFeet})
      if(progress)next[guard.tokenId]=progress
    }
    actor.classState.withinReachMovementByAttacker=Object.keys(next).length?next:undefined
    positions.set(actor.id,{...token,...to})
  }
}

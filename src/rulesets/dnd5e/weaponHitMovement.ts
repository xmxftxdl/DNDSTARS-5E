import type {BattleMap} from '../../store/maps'
import type {GridCell} from '../../lib/gridCombat'
import {mapCellExtent,tokenAnchorCellFromPixel,tokenFootprintDistanceCells} from '../../lib/gridCombat'
import {mapGeometryRuntimeForMap,mapGeometryTerrainElevationAtPoint} from '../../lib/mapGeometry'
import {validMovementDestination} from './activities/dnd5eActivityMapInteraction'
import {dnd5eEffectiveWalkSpeed,dnd5eHeadlessTurnKey,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eReactionsPrevented} from './passiveDefenses'

export interface Dnd5eHitMovementPlan {
  targetId:string
  position:{x:number;y:number;elevationFeet?:number}
  path:readonly {x:number;y:number}[]
  pathElevationsFeet?:readonly number[]
  movementCostFeet:number
}

/** UI destinations around the displaced target. Host validation is still
 * required after selection, because the transaction may have changed. */
export function dnd5eWeaponHitFollowCells(input:Pick<Parameters<typeof planDnd5eWeaponHitPushAndFollow>[0],
 'state'|'map'|'actorId'|'targetId'>):GridCell[]{
 const actor=input.state.combatants[input.actorId],target=input.state.combatants[input.targetId]
 const actorToken=input.map.tokens.find(token=>token.id===input.actorId),targetToken=input.map.tokens.find(token=>token.id===input.targetId)
 if(!actor||!target||!actorToken||!targetToken||input.state.initiativeOrder[input.state.initiativeIndex]!==actor.id)return []
 const feet=Math.max(1,input.map.feetPerCell??5)
 const radius=Math.ceil(5/feet)+Math.ceil(actorToken.size)+Math.ceil(targetToken.size)
 if(!Number.isFinite(radius)||radius<0)return []
 const origin=tokenAnchorCellFromPixel(target.position.x,target.position.y,targetToken,input.map)
 const {cols,rows}=mapCellExtent(input.map),cells:GridCell[]=[]
 for(let row=Math.max(0,origin.row-radius);row<=Math.min(rows-1,origin.row+radius);row++){
  for(let col=Math.max(0,origin.col-radius);col<=Math.min(cols-1,origin.col+radius);col++){
   const cell={col,row}
   const plan=planDnd5eWeaponHitPushAndFollow({...input,maximumPushFeet:0,followCell:cell})
   if(plan.ok&&plan.follow)cells.push(cell)
  }
 }
 return cells
}

/** Advisory UI cells; the Host must still revalidate the chosen destination at commit. */
export function dnd5eWeaponHitPushCells(input:Parameters<typeof planDnd5eWeaponHitPushAndFollow>[0]):GridCell[] {
  const target=input.state.combatants[input.targetId]
  const token=input.map.tokens.find(candidate=>candidate.id===input.targetId)
  if(!target||!token||!Number.isFinite(input.maximumPushFeet)||input.maximumPushFeet<=0||input.maximumPushFeet>1000)return []
  const origin=tokenAnchorCellFromPixel(target.position.x,target.position.y,token,input.map)
  const radius=Math.ceil(input.maximumPushFeet/Math.max(1,input.map.feetPerCell??5))
  const {cols,rows}=mapCellExtent(input.map),cells:GridCell[]=[]
  for(let row=Math.max(0,origin.row-radius);row<=Math.min(rows-1,origin.row+radius);row++) {
    for(let col=Math.max(0,origin.col-radius);col<=Math.min(cols-1,origin.col+radius);col++) {
      const cell={col,row}
      const plan=planDnd5eWeaponHitPushAndFollow({...input,pushCell:cell,followCell:undefined})
      if(plan.ok&&plan.push&&plan.push.movementCostFeet>0)cells.push(cell)
    }
  }
  return cells
}
/** Host-only preview. Neither a chosen cell nor this plan is a player-authorized movement command. */
export function planDnd5eWeaponHitPushAndFollow(input:{
  state:Dnd5eHeadlessCombatState;map:BattleMap;actorId:string;targetId:string
  maximumPushFeet:number;pushCell?:GridCell;followCell?:GridCell
}):{ok:true;push?:Dnd5eHitMovementPlan;follow?:Dnd5eHitMovementPlan}|{ok:false;reason:string} {
  const actor=input.state.combatants[input.actorId],target=input.state.combatants[input.targetId]
  if(!actor||!target||actor.id===target.id||!Number.isFinite(input.maximumPushFeet)||input.maximumPushFeet<0||input.maximumPushFeet>1000)return {ok:false,reason:'invalid-hit-movement'}
  const projected:BattleMap={...input.map,tokens:input.map.tokens.map(token=>{
    const combatant=input.state.combatants[token.id]
    return combatant?{...token,...combatant.position,elevationFeet:combatant.elevationFeet??token.elevationFeet}:token
  })}
  const actorToken=projected.tokens.find(token=>token.id===actor.id),targetToken=projected.tokens.find(token=>token.id===target.id)
  if(!actorToken||!targetToken)return {ok:false,reason:'missing-map-token'}
  let push:Dnd5eHitMovementPlan|undefined,follow:Dnd5eHitMovementPlan|undefined
  if(input.pushCell){
    const moved=validMovementDestination({map:projected,actorToken,targetToken,destination:input.pushCell,mode:'push',distanceFeet:input.maximumPushFeet})
    if(!moved)return {ok:false,reason:'invalid-push-destination'}
    push={targetId:target.id,...moved}
    projected.tokens=projected.tokens.map(token=>token.id===target.id?{...token,...moved.position}:token)
  }
  if(input.followCell){
    if(actor.classState.movementStoppedTurnKey===dnd5eHeadlessTurnKey(input.state,actor.id))return {ok:false,reason:'follow-movement-stopped'}
    if(!actor.turn.reactionAvailable||dnd5eReactionsPrevented(actor))return {ok:false,reason:'reaction-unavailable'}
    const speed=dnd5eEffectiveWalkSpeed(actor)
    if(speed<=0)return {ok:false,reason:'walking-speed-unavailable'}
    const moved=validMovementDestination({map:projected,actorToken,targetToken:actorToken,destination:input.followCell,
      mode:'voluntary',distanceFeet:speed,maximumMovementCostFeet:speed,requiresDifferentDestination:true})
    if(!moved)return {ok:false,reason:'invalid-follow-destination'}
    const geometry=mapGeometryRuntimeForMap(projected.id)
    const destinationElevation=moved.pathElevationsFeet?.at(-1)??actorToken.elevationFeet??mapGeometryTerrainElevationAtPoint(geometry,moved.position)
    const anchor=projected.tokens.find(token=>token.id===target.id)!
    const targetElevation=anchor.elevationFeet??mapGeometryTerrainElevationAtPoint(geometry,anchor)
    if(Math.max(tokenFootprintDistanceCells({...actorToken,...moved.position},anchor,projected)*Math.max(1,projected.feetPerCell??5),
      Math.abs(destinationElevation-targetElevation))>5)return {ok:false,reason:'invalid-follow-destination'}
    if(moved.position.elevationFeet!=null||destinationElevation!==0)moved.position.elevationFeet=destinationElevation
    follow={targetId:actor.id,...moved}
  }
  return {ok:true,push,follow}
}

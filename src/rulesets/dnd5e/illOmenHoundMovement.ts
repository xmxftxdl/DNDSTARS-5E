import {findDnd5eIllOmenGeometricPath,dnd5eIllOmenGeometricPathLength} from './illOmenHoundPath'
import type {Dnd5eAction,Dnd5eCombatant,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eLiveIllOmenTarget} from './illOmenHoundEffects'

/** Geometric shortest-route constraint. Actual terrain/speed costs remain in the native movement consumer. */
export function dnd5eIllOmenHoundMovementAllowed(state:Dnd5eHeadlessCombatState,hound:Dnd5eCombatant,action:Extract<Dnd5eAction,{type:'move'}>,canSee:(state:Dnd5eHeadlessCombatState,a:string,b:string)=>boolean):boolean{
 if(!hound.illOmenHound)return true
 const target=dnd5eLiveIllOmenTarget(state,hound),scene=state.companionScene
 if(!target||!scene)return false
 const token=scene.map.tokens.find(t=>t.id===hound.id);if(!token)return false
 const known=hound.classState.knownCreatureLocations?.[target.id]
 const destination=canSee(state,hound.id,target.id)||!hound.classState.turnStartResolvedTurnKey ?
  {...target.position,elevationFeet:target.elevationFeet??0}:known?.mapId===state.mapId?known:undefined
 if(!destination)return false
 const map={...scene.map,tokens:scene.map.tokens.filter(t=>t.id!==hound.id)}
 const distance=(from:{x:number;y:number;elevationFeet?:number},to:{x:number;y:number;elevationFeet?:number})=>{
  const path=findDnd5eIllOmenGeometricPath({map,geometry:scene.geometry??undefined,token:{...token,...from},to,
   passThroughObjectsAndCreatures:true,allowOccupiedDestination:true,ignoreDifficultTerrain:true,
   targetElevationFeet:to.elevationFeet??0,maximumTerrainStepFeet:10,allowOpenUnlockedDoors:false})
  return path?dnd5eIllOmenGeometricPathLength(path,state.coordinateUnitsPerFoot??10):Number.POSITIVE_INFINITY
 }
 const start={...hound.position,elevationFeet:hound.elevationFeet??0},end={...action.to,elevationFeet:action.toElevationFeet??start.elevationFeet}
 const route=action.hostMovementPath??[start,end]
 if(route.length<2||route[0].x!==start.x||route[0].y!==start.y||route.at(-1)!.x!==end.x||route.at(-1)!.y!==end.y)return false
 const shortest=distance(start,destination);if(!Number.isFinite(shortest))return false
 let travelled=0
 for(let i=1;i<route.length;i++)travelled+=distance(route[i-1],route[i])
 const remainder=distance(end,destination)
 return Number.isFinite(travelled)&&Number.isFinite(remainder)&&Math.abs(travelled+remainder-shortest)<1e-5
}

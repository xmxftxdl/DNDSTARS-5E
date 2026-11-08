import {findMapGeometryPath} from '../../lib/mapPathfinding'

export function findDnd5eIllOmenGeometricPath(input:Parameters<typeof findMapGeometryPath>[0]):ReturnType<typeof findMapGeometryPath>{
 return findMapGeometryPath({...input,ignoreDifficultTerrain:true,additionalDifficultTerrainMultiplier:undefined,
  additionalSpeedCostMultiplier:undefined,additionalCostMultiplier:undefined,
  additionalMovementCostPerFoot:(_token,from,to)=>{
   const x=Math.abs(to.x-from.x),y=Math.abs(to.y-from.y),gridStep=Math.max(x,y)
   return gridStep>0?Math.hypot(x,y)/gridStep-1:0
  }})
}

export function dnd5eIllOmenGeometricPathLength(path:NonNullable<ReturnType<typeof findMapGeometryPath>>,unitsPerFoot:number):number{
 let total=0;for(let i=1;i<path.points.length;i++)total+=Math.hypot((path.points[i].x-path.points[i-1].x)/unitsPerFoot,
  (path.points[i].y-path.points[i-1].y)/unitsPerFoot,(path.elevationsFeet[i]??0)-(path.elevationsFeet[i-1]??0))
 return total
}

/** Select the shortest geometric route first; charge the unchanged native cost on that exact route. */
export function findDnd5eIllOmenHoundPath(input:Parameters<typeof findMapGeometryPath>[0]):ReturnType<typeof findMapGeometryPath>{
 const path=findDnd5eIllOmenGeometricPath(input)
 if(!path)return
 let cost=0
 for(let i=1;i<path.points.length;i++){
  const from=path.points[i-1],to=path.points[i]
  const segment=findMapGeometryPath({...input,token:{...input.token,...from,elevationFeet:path.elevationsFeet[i-1]},to,
   targetElevationFeet:path.elevationsFeet[i],allowOccupiedDestination:true,
   canTraverseEdge:(a,b)=>a.x===from.x&&a.y===from.y&&b.x===to.x&&b.y===to.y&&(!input.canTraverseEdge||input.canTraverseEdge(a,b))})
  if(!segment)return
  cost+=segment.unroundedMovementCostFeet??segment.movementCostFeet
 }
 return{...path,movementCostFeet:Math.ceil(cost-1e-7),unroundedMovementCostFeet:cost}
}

import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {mapGeometryTokenElevation,mapGeometryLineOfEffectBlocked,mapGeometryMovementBlocked,mapGeometryPlacementBlocked,mapGeometryTerrainElevationAtPoint} from '../../lib/mapGeometry'
import {tokenAnchorCellFromPixel,tokenCenterForAnchorCell,tokenFootprintDistanceCells} from '../../lib/gridCombat'
import {findMapGeometryPath,terrainMultiplierAtPoint} from '../../lib/mapPathfinding'
import {mapTokenSweepBlocked,mapTokenBodyHeight} from '../../lib/mapTokenOccupancy'
import {dnd5eEntitySupportElevation} from './entitySupport'
import {resolveDnd5eFortressServantControl} from './fortressServantControl'
import {dnd5eStructureObjectOutsideBoundary} from './structureObjectBoundary'
import {dnd5eFortressRoomDestinations} from './fortressRoomDestinations'

export interface FortressServantPosition {x:number;y:number;elevationFeet:number}
export function prepareDnd5eFortressServantApproach(input:Omit<Parameters<typeof prepareDnd5eFortressServantMove>[0],'destination'|'expectedPosition'>&{objectTokenId:string}){
 const control=resolveDnd5eFortressServantControl(input),object=input.map.tokens.find(token=>token.id===input.objectTokenId)
 if(!control||!object)return {ok:false as const,reason:'fortress-move-target-unavailable'}
 const feet=input.map.feetPerCell??5
 if(!Number.isFinite(feet)||feet<1)return {ok:false as const,reason:'fortress-move-map-invalid'}
 const actor=control.servant,height=mapGeometryTokenElevation(input.geometry,actor),targetHeight=mapGeometryTokenElevation(input.geometry,object)
 const expectedPosition={x:actor.x,y:actor.y,elevationFeet:height}
 const anchor=tokenAnchorCellFromPixel(actor.x,actor.y,actor,input.map),radius=Math.ceil(15/feet)
 const candidates:FortressServantPosition[]=[]
 for(let row=-radius;row<=radius;row++)for(let col=-radius;col<=radius;col++){
  const point=tokenCenterForAnchorCell({col:anchor.col+col,row:anchor.row+row},actor,input.map)
  for(const elevationFeet of new Set([height,targetHeight])){
   const destination={...point,elevationFeet}
   if(Math.abs(elevationFeet-targetHeight)>5||tokenFootprintDistanceCells({...actor,...destination},object,input.map)*feet>5||
    mapGeometryLineOfEffectBlocked({map:input.map,geometry:input.geometry,from:destination,to:object,fromElevationFeet:elevationFeet,toElevationFeet:targetHeight}))continue
   candidates.push(destination)
  }
 }
 candidates.sort((a,b)=>Math.hypot(a.x-actor.x,a.y-actor.y)-Math.hypot(b.x-actor.x,b.y-actor.y))
 for(const destination of candidates){
  const moved=prepareDnd5eFortressServantMove({...input,expectedPosition,destination})
  if(moved.ok)return moved
 }
 return {ok:false as const,reason:'fortress-move-path-unavailable'}
}
/** Movement is planned without spending: an enclosing command spends once for move plus interaction. */
export function prepareDnd5eFortressServantMove(input:{map:BattleMap;geometry:MapGeometryState;commanderTokenId:string;servantTokenId:string;
 worldMinute:number;destination:FortressServantPosition;expectedPosition:FortressServantPosition}){
 const fail=(reason:string)=>({ok:false as const,reason})
 const control=resolveDnd5eFortressServantControl(input)
 if(!control||(control.servant.hp??0)<=0)return fail('fortress-move-unauthorized')
 if(!input.destination||!input.expectedPosition||![input.destination.x,input.destination.y,input.destination.elevationFeet,
  input.expectedPosition.x,input.expectedPosition.y,input.expectedPosition.elevationFeet].every(Number.isFinite))return fail('fortress-move-position-invalid')
 const height=mapGeometryTokenElevation(input.geometry,control.servant)
 if(Math.abs(control.servant.x-input.expectedPosition.x)>1e-6||Math.abs(control.servant.y-input.expectedPosition.y)>1e-6||
  Math.abs(height-input.expectedPosition.elevationFeet)>1e-6)return fail('fortress-move-position-changed')
 const attempt=(origin:{x:number;y:number},direct=false,destination=input.destination,servant=control.servant)=>{
 const path=direct?{points:[{x:destination.x,y:destination.y}],elevationsFeet:[height],
  cells:[tokenAnchorCellFromPixel(destination.x,destination.y,servant,input.map)],distanceFeet:0,movementCostFeet:0,doorsToOpen:[] as string[]}:
 findMapGeometryPath({map:input.map,geometry:input.geometry,token:{...servant,...origin,elevationFeet:height},to:destination,
  targetElevationFeet:destination.elevationFeet,maximumTerrainStepFeet:0,maximumVisited:2048,allowOpenUnlockedDoors:false})
 if(!path||path.movementCostFeet>15+1e-6||path.distanceFeet>15+1e-6||path.doorsToOpen.length)return fail('fortress-move-path-unavailable')
 const start=path.points[0]
 if(!start)return fail('fortress-move-path-unavailable')
 const offset=Math.hypot(start.x-servant.x,start.y-servant.y)
 if(offset>1e-6){
  const actor=servant
  if(Math.abs(path.elevationsFeet[0]-height)>1e-6||
   mapGeometryMovementBlocked({map:input.map,geometry:input.geometry,token:actor,to:start,fromElevationFeet:height,toElevationFeet:height}).blocked||
   mapGeometryPlacementBlocked({map:input.map,geometry:input.geometry,token:actor,at:start,elevationFeet:height}).blocked||
   mapTokenSweepBlocked({map:input.map,geometry:input.geometry,mover:actor,from:actor,to:start,fromElevationFeet:height,toElevationFeet:height}))return fail('fortress-move-path-unavailable')
  let multiplier=1
  const steps=Math.max(1,Math.ceil(offset))
  for(let i=0;i<=steps;i++){
   const point={x:actor.x+(start.x-actor.x)*i/steps,y:actor.y+(start.y-actor.y)*i/steps}
   const terrain=mapGeometryTerrainElevationAtPoint(input.geometry,point)
   const support=dnd5eEntitySupportElevation({map:input.map,geometry:input.geometry,token:{...actor,...point},terrainElevationFeet:terrain,elevationFeet:height})
   if(Math.abs(support-height)>1e-4)return fail('fortress-move-path-unavailable')
   multiplier=Math.max(multiplier,terrainMultiplierAtPoint(input.geometry,point,{map:input.map,token:actor,elevationFeet:height,tokenHeightFeet:mapTokenBodyHeight(actor)}))
  }
  const distance=offset/input.map.gridSize*(input.map.feetPerCell??5)
  path.distanceFeet+=distance;path.movementCostFeet+=distance*multiplier
  if(path.distanceFeet>15+1e-6||path.movementCostFeet>15+1e-6)return fail('fortress-move-path-unavailable')
  path.points.unshift({x:actor.x,y:actor.y});path.elevationsFeet.unshift(height)
  path.cells.unshift(tokenAnchorCellFromPixel(actor.x,actor.y,actor,input.map))
 }
 try{
  for(let i=0;i<path.points.length;i++)if(dnd5eStructureObjectOutsideBoundary({binding:servant.dnd5eObjectState!.structureBinding!,
   geometry:{maps:[input.geometry]},mapId:input.map.id,position:{...path.points[i],elevationFeet:path.elevationsFeet[i]}}))return fail('fortress-move-outside')
 }catch{return fail('fortress-move-boundary-unavailable')}
 const end=path.points.at(-1),elevationFeet=path.elevationsFeet.at(-1)
 if(!end||Math.hypot(end.x-destination.x,end.y-destination.y)>1e-6||elevationFeet==null||Math.abs(elevationFeet-destination.elevationFeet)>1e-6)return fail('fortress-move-path-unavailable')
 return {ok:true as const,map:{...input.map,tokens:input.map.tokens.map(token=>token.id===servant.id?{...token,...end,elevationFeet,movementAnimation:undefined}:token)},path}
 }
 // An exact same-story destination can be reachable even when no grid center fits inside a small room.
 if(Math.abs(input.destination.elevationFeet-height)<=1e-6){
  const half=control.servant.size*input.map.gridSize/2
  if(input.destination.x>=half&&input.destination.y>=half&&input.destination.x<=input.map.width-half&&input.destination.y<=input.map.height-half&&
   Math.hypot(input.destination.x-control.servant.x,input.destination.y-control.servant.y)/input.map.gridSize*(input.map.feetPerCell??5)<=15+1e-6){
   const direct=attempt(input.destination,true)
   if(direct.ok)return direct
  }
 }
 // A five-foot opening can fall between grid centers. Route through its
 // actual center and perpendicular approaches, checking every swept segment.
 if(Math.abs(input.destination.elevationFeet-height)<=1e-6){
  const nodes=[{x:control.servant.x,y:control.servant.y},{x:input.destination.x,y:input.destination.y}]
  const radius=15/(input.map.feetPerCell??5)*input.map.gridSize
  for(const door of input.geometry.doors){
   if(door.openState!=='open'||height<door.baseHeightFeet||height+mapTokenBodyHeight(control.servant)>door.baseHeightFeet+door.heightFeet)continue
   const [a,b]=door.points,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
   if(!length)continue
   const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2}
   if(Math.hypot(center.x-control.servant.x,center.y-control.servant.y)>radius)continue
   nodes.push(center)
   for(const offset of [control.servant.size*input.map.gridSize/2+1,control.servant.size*input.map.gridSize])
    nodes.push({x:center.x-dy/length*offset,y:center.y+dx/length*offset},{x:center.x+dy/length*offset,y:center.y-dx/length*offset})
  }
  // Open arches have no door entity. Derive their center from owned room fronts;
  // the existing swept-edge checks still reject closed doors or blocked openings.
  for(const room of dnd5eFortressRoomDestinations(input.geometry,control.servant.dnd5eObjectState!.structureBinding!.structureId)){
   const center=room.threshold
   if(Math.abs(center.elevationFeet-height)>1e-6||Math.hypot(center.x-control.servant.x,center.y-control.servant.y)>radius)continue
   if(input.geometry.doors.some(door=>Math.abs(door.baseHeightFeet-height)<1e-6&&
    Math.hypot((door.points[0].x+door.points[1].x)/2-center.x,(door.points[0].y+door.points[1].y)/2-center.y)<1e-4))continue
   const dx=room.outside.x-center.x,dy=room.outside.y-center.y,length=Math.hypot(dx,dy)
   if(length<1e-6)continue
   nodes.push(center)
   for(const offset of [control.servant.size*input.map.gridSize/2+1,control.servant.size*input.map.gridSize])
    nodes.push({x:center.x+dx/length*offset,y:center.y+dy/length*offset},{x:center.x-dx/length*offset,y:center.y-dy/length*offset})
  }
  if(nodes.length>2){
   type Success=Extract<ReturnType<typeof attempt>,{ok:true}>
   const costs=new Map<number,number>([[0,0]]),routes=new Map<number,Success['path']>(),visited=new Set<number>()
   while(visited.size<nodes.length){
    const next=[...costs].filter(([index])=>!visited.has(index)).sort((a,b)=>a[1]-b[1])[0]
    if(!next)break
    const [index,cost]=next
    if(index===1){
     const path=routes.get(index)!
     return {ok:true as const,path,map:{...input.map,tokens:input.map.tokens.map(token=>token.id===control.servant.id?
      {...token,...input.destination,movementAnimation:undefined}:token)}}
    }
    visited.add(index)
    for(let target=1;target<nodes.length;target++){
     if(visited.has(target)||target===index)continue
     const lowerBound=Math.hypot(nodes[target].x-nodes[index].x,nodes[target].y-nodes[index].y)/input.map.gridSize*(input.map.feetPerCell??5)
     if(cost+lowerBound>15+1e-6||cost+lowerBound>=(costs.get(target)??Infinity))continue
     const edge=attempt(nodes[target],true,{...nodes[target],elevationFeet:height},{...control.servant,...nodes[index]})
     if(!edge.ok||cost+edge.path.movementCostFeet>15+1e-6)continue
     const total=cost+edge.path.movementCostFeet
     if(total>=(costs.get(target)??Infinity))continue
     const prior=routes.get(index)
     costs.set(target,total)
     routes.set(target,prior?{...edge.path,points:[...prior.points,...edge.path.points.slice(1)],
      cells:[...prior.cells,...edge.path.cells.slice(1)],elevationsFeet:[...prior.elevationsFeet,...edge.path.elevationsFeet.slice(1)],
      distanceFeet:prior.distanceFeet+edge.path.distanceFeet,movementCostFeet:total}:edge.path)
    }
   }
  }
 }
 const destinationAnchor=tokenAnchorCellFromPixel(input.destination.x,input.destination.y,control.servant,input.map)
 const destinationCenter=tokenCenterForAnchorCell(destinationAnchor,control.servant,input.map)
 // Grid routes cannot satisfy an exact off-grid endpoint after the direct route failed.
 if(Math.hypot(destinationCenter.x-input.destination.x,destinationCenter.y-input.destination.y)>1e-6)return fail('fortress-move-path-unavailable')
 const anchor=tokenAnchorCellFromPixel(control.servant.x,control.servant.y,control.servant,input.map)
 const nearest=tokenCenterForAnchorCell(anchor,control.servant,input.map)
 if(Math.hypot(nearest.x-control.servant.x,nearest.y-control.servant.y)<=1e-6)return attempt(nearest)
 // Connect the actual origin to neighboring grid nodes; each connector is checked and charged above.
 const candidates=[]
 for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++){
  const origin=tokenCenterForAnchorCell({col:anchor.col+col,row:anchor.row+row},control.servant,input.map)
  const half=control.servant.size*input.map.gridSize/2
  if(origin.x<half||origin.y<half||origin.x>input.map.width-half||origin.y>input.map.height-half)continue
  const result=attempt(origin)
  if(result.ok)candidates.push(result)
 }
 candidates.sort((a,b)=>a.path.movementCostFeet-b.path.movementCostFeet||a.path.distanceFeet-b.path.distanceFeet)
 return candidates[0]??fail('fortress-move-path-unavailable')
}

import type {BattleMap} from '../../store/maps'
import {mapGeometryPlacementBlocked,mapGeometryTokenElevation,type MapGeometryState} from '../../lib/mapGeometry'
import {mapTokenSweepBlocked} from '../../lib/mapTokenOccupancy'
import {structureSolidBodyBlocked} from '../../../shared/structure-solid-collision.mjs'
import {structureSupportingElevation} from '../../../shared/structure-support.mjs'
import {cellToPixel,pixelToCell} from '../../lib/gridCombat'

export type Dnd5eStructureEmergencePlacements=Record<string,{x:number;y:number;elevationFeet:number}>
type EmergenceInput={map:BattleMap;before:MapGeometryState;after:MapGeometryState;placements?:Dnd5eStructureEmergencePlacements}
type EmergenceResult={ok:true;map:BattleMap;changedTokenIds:string[]}|{ok:false;reason:string;tokenIds:string[];previewMap:BattleMap;minimumElevations:Record<string,number>}

/** Raise intersecting creatures without HP changes; ambiguous landings require explicit placement. */
export function prepareDnd5eStructureEmergence(input:EmergenceInput):EmergenceResult{
 const {map,before,after}=input
 if(map.id!==before.mapId||map.id!==after.mapId)throw Error('structure-emergence-map-invalid')
 if(input.placements&&Object.keys(input.placements).length){
  const baseline=prepareDnd5eStructureEmergence({...input,placements:undefined})
  if(baseline.ok||Object.keys(input.placements).some(id=>!baseline.tokenIds.includes(id)))return {ok:false,reason:'structure-emergence-placement-invalid',tokenIds:[],previewMap:map,minimumElevations:{}}
 }
 const oldIds=new Set([...before.obstacles,...before.doors].map(entity=>entity.id))
 const added=[...after.obstacles,...after.doors].filter(entity=>!oldIds.has(entity.id))
 const newSupport={...after,obstacles:after.obstacles.filter(entity=>!oldIds.has(entity.id))}
 const changedTokenIds:string[]=[],requiresPlacement:string[]=[]
 const minimumElevations:Record<string,number>={}
 const tokens=map.tokens.map(token=>{
  if(token.type==='obstacle'||token.dnd5eSpellEffect)return token
  const feet=mapGeometryTokenElevation(before,token),half=token.size*map.gridSize/2
  let height=feet
  for(const entity of added){
   const points=entity.points.length===2?[...entity.points,entity.points[1]]:entity.points
   if(!structureSolidBodyBlocked({points,baseHeightFeet:0,heightFeet:1},
    {...token,elevationFeet:0},{...token,elevationFeet:0},half,1))continue
   const top=entity.kind==='obstacle'&&entity.stairPath?Math.max(...entity.stairPath.points.map(point=>point.elevationFeet)):entity.baseHeightFeet+entity.heightFeet
   height=Math.max(height,top)
  }
  if(height<=feet+1e-7)return token
  minimumElevations[token.id]=height
  const placement=input.placements?.[token.id]
  if(placement&&(![placement.x,placement.y,placement.elevationFeet].every(Number.isFinite)||placement.elevationFeet<height-1e-7)){
   requiresPlacement.push(token.id);return token
  }
  const lifted={...token,...placement,elevationFeet:placement?.elevationFeet??height,movementAnimation:undefined}
  height=lifted.elevationFeet
  const support=structureSupportingElevation({map,geometry:newSupport,position:lifted,elevationFeet:height,creatureWidthFeet:token.size*(map.feetPerCell??5),
   terrainElevationFeet:-1000})
  if(lifted.x-half<0||lifted.y-half<0||lifted.x+half>map.width||lifted.y+half>map.height||
   Math.abs(support-height)>1e-4||mapGeometryPlacementBlocked({map,geometry:after,token,at:lifted,elevationFeet:height}).blocked)requiresPlacement.push(token.id)
  changedTokenIds.push(token.id)
  return lifted
 })
 const next={...map,tokens}
 for(const token of tokens){
  if(!changedTokenIds.includes(token.id))continue
  const height=token.elevationFeet!
  if(mapTokenSweepBlocked({map:next,geometry:after,mover:token,from:token,to:token,fromElevationFeet:height,toElevationFeet:height}))requiresPlacement.push(token.id)
 }
 if(requiresPlacement.length)return {ok:false,reason:'structure-emergence-placement-required',tokenIds:[...new Set(requiresPlacement)],previewMap:next,minimumElevations}
 return {ok:true as const,map:next,changedTokenIds}
}

/** Legal grid destinations on the new structure only; final commit revalidates them. */
export function dnd5eStructureEmergenceDestinations(input:EmergenceInput&{tokenId:string}){
 const plan=prepareDnd5eStructureEmergence(input)
 if(plan.ok||!plan.tokenIds.includes(input.tokenId))return []
 const token=input.map.tokens.find(token=>token.id===input.tokenId)!
 const prior=new Set(input.before.obstacles.map(entity=>entity.id)),added=input.after.obstacles.filter(entity=>!prior.has(entity.id))
 const supportGeometry={...input.after,obstacles:added}
 const points=added.flatMap(entity=>entity.points)
 if(!points.length)return []
 const low=pixelToCell(Math.min(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),input.map)
 const high=pixelToCell(Math.max(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y)),input.map)
 const levels=[...new Set(added.map(entity=>entity.baseHeightFeet+entity.heightFeet))].filter(height=>height>=plan.minimumElevations[token.id]-1e-7).sort((a,b)=>b-a)
 const result:{cell:{col:number;row:number};x:number;y:number;elevationFeet:number}[]=[]
 for(let row=low.row;row<=high.row;row++)for(let col=low.col;col<=high.col;col++){
  const cell={col,row},point=cellToPixel(cell,input.map),half=token.size*input.map.gridSize/2
  if(point.x-half<0||point.y-half<0||point.x+half>input.map.width||point.y+half>input.map.height)continue
  for(const height of levels){
   if(Math.abs(structureSupportingElevation({map:input.map,geometry:supportGeometry,position:point,elevationFeet:height,
    creatureWidthFeet:token.size*(input.map.feetPerCell??5),terrainElevationFeet:-1000})-height)>1e-4)continue
   if(mapGeometryPlacementBlocked({map:input.map,geometry:input.after,token,at:point,elevationFeet:height}).blocked||
    mapTokenSweepBlocked({map:plan.previewMap,geometry:input.after,mover:token,from:point,to:point,fromElevationFeet:height,toElevationFeet:height}))continue
   result.push({cell,...point,elevationFeet:height});break
  }
 }
 return result.sort((a,b)=>Math.hypot(a.x-token.x,a.y-token.y)-Math.hypot(b.x-token.x,b.y-token.y))
}

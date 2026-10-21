import {mapGeometryTerrainPathBands,mapGeometryTerrainElevationAtPoint,type MapGeometryPoint,type MapGeometryState} from '../../lib/mapGeometry'

/** Plan mandatory downward steps separately from the commanded horizontal movement. */
export function planDnd5eAreaGroundDescent(input:{geometry?:MapGeometryState;from:MapGeometryPoint;to:MapGeometryPoint;bottomFeet:number;maximumClearanceFeet:number}):
 {ok:true;path:Array<MapGeometryPoint&{elevationFeet:number}>;bottomFeet:number}|{ok:false;reason:'invalid-height'|'terrain-rise'}{
 if(!Number.isFinite(input.bottomFeet)||!Number.isFinite(input.maximumClearanceFeet)||input.maximumClearanceFeet<0||input.maximumClearanceFeet>1000)return {ok:false,reason:'invalid-height'}
 let bottom=input.bottomFeet
 const pointAt=(t:number)=>({x:input.from.x+(input.to.x-input.from.x)*t,y:input.from.y+(input.to.y-input.from.y)*t})
 const path=[{...input.from,elevationFeet:bottom}]
 const bands=mapGeometryTerrainPathBands(input)
 // Include the final authored surface, including a destination exactly on its boundary.
 for(const band of [...bands,{fromT:1,toT:1,elevationFeet:mapGeometryTerrainElevationAtPoint(input.geometry,input.to)}]){
  if(bottom<band.elevationFeet-1e-7)return {ok:false,reason:'terrain-rise'}
  const next=Math.min(bottom,band.elevationFeet+input.maximumClearanceFeet)
  if(next<bottom-1e-7){
   const point=pointAt(band.fromT)
   path.push({...point,elevationFeet:bottom},{...point,elevationFeet:next})
   bottom=next
  }
 }
 path.push({...input.to,elevationFeet:bottom})
 return {ok:true,path,bottomFeet:bottom}
}

import type { BattleMap } from '../../store/maps'
import { mapGeometryLightPolygon, mapGeometryTokenElevation, mapGeometryTerrainElevationAtPoint, type MapGeometryPoint, type MapGeometryState, type MapGeometrySpellLightingSource } from '../../lib/mapGeometry'

/** Shadow volumes use the same live source as illumination, and stop at opaque walls. */
export function persistentAreaLightReductionPolygons(map: BattleMap, geometry?: MapGeometryState): MapGeometryPoint[][] {
 return (map.dnd5ePluginAreas ?? []).flatMap(area => {
  if(area.lighting?.kind !== 'reduce-light') return []
  const id=area.anchorTokenId ?? (area.anchorMode==='source-token'?area.sourceTokenId:undefined)
  const token=id?map.tokens.find(token=>token.id===id):undefined
  if(id&&!token)return []
  const cell=area.anchorCell??area.cells[0]
  const origin=area.lightingOnly?area.lightingOrigin:undefined
  if(!token&&!cell&&!origin)return []
  const source=origin??token??{x:map.gridOffsetX+(cell.col+.5)*map.gridSize,y:map.gridOffsetY+(cell.row+.5)*map.gridSize}
  const elevation=origin?origin.elevationFeet:token?mapGeometryTokenElevation(geometry,token):mapGeometryTerrainElevationAtPoint(geometry,source)
  const height=elevation-mapGeometryTerrainElevationAtPoint(geometry,source)
  const radius=Math.sqrt(Math.max(0,area.lighting.radiusFeet**2-height**2))
  if(radius===0)return []
  const polygon=mapGeometryLightPolygon({map,geometry,source,elevationFeet:elevation,radiusFeet:radius})
  return polygon.length>=3?[polygon]:[]
 })
}

/** Clip a wall-limited polygon to a cell; boundary bridges have zero filled area. */
function clipCell(polygon: readonly MapGeometryPoint[], left:number, top:number, size:number): MapGeometryPoint[] {
 let result=[...polygon]
 for(const [axis,bound,above] of [['x',left,true],['x',left+size,false],['y',top,true],['y',top+size,false]] as const){
  const next:MapGeometryPoint[]=[]
  for(let i=0;i<result.length;i++){
   const a=result[i],b=result[(i+1)%result.length]
   const aInside=above?a[axis]>=bound:a[axis]<=bound
   const bInside=above?b[axis]>=bound:b[axis]<=bound
   if(aInside)next.push(a)
   if(aInside!==bInside){
    const t=(bound-a[axis])/(b[axis]-a[axis])
    next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})
   }
  }
  result=next
 }
 return result
}

/** Ground illumination only; the elevated beam itself is drawn by the area effect. */
export function persistentAreaGroundLightPolygons(input:{map:BattleMap;geometry?:MapGeometryState;source:MapGeometrySpellLightingSource}):MapGeometryPoint[][] {
 const {map,geometry,source}=input
 if(source.kind!=='light'||!source.areaOnly)return []
 if(source.structureVolume){
  const volume=source.structureVolume
  // The temple illuminates its whole interior, including behind interior objects.
  const ground=mapGeometryTerrainElevationAtPoint(geometry,source.point)
  return ground>=volume.bottomFeet&&ground<volume.topFeet?[volume.points.map(point=>({...point}))]:[]
 }
 const area=map.dnd5ePluginAreas?.find(area=>area.id===source.areaId)
 if(!area)return []
 const size=Math.max(1,map.gridSize)
 const cells=area.cells.filter(cell=>{
  const elevation=mapGeometryTerrainElevationAtPoint(geometry,{x:map.gridOffsetX+(cell.col+.5)*size,y:map.gridOffsetY+(cell.row+.5)*size})
  return area.vertical?.mode!=='volume'||elevation>=area.vertical.baseElevationFeet&&elevation<area.vertical.baseElevationFeet+area.vertical.heightFeet
 })
 if(!cells.length)return []
 const radiusPixels=Math.max(...cells.map(cell=>Math.hypot(map.gridOffsetX+(cell.col+.5)*size-source.point.x,map.gridOffsetY+(cell.row+.5)*size-source.point.y)))+size
 const polygon=mapGeometryLightPolygon({map,geometry,source:source.point,elevationFeet:source.elevationFeet,radiusFeet:radiusPixels/size*Math.max(1,map.feetPerCell??5)})
 return cells.map(cell=>clipCell(polygon,map.gridOffsetX+cell.col*size,map.gridOffsetY+cell.row*size,size)).filter(polygon=>polygon.length>=3)
}

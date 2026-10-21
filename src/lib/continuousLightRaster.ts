import {mapGeometrySpellLightContributionAtPoint, mapGeometrySegments, mapGeometryTerrainElevationAtPoint, type MapGeometrySpellLightingSource, type MapGeometryState} from './mapGeometry'
import {rectangularPrism} from '../../shared/rectangular-prism.mjs'
import type {BattleMap} from '../store/maps'

export interface ContinuousLightRasterInput {
  map: BattleMap
  geometry?: MapGeometryState
  sources: MapGeometrySpellLightingSource[]
  bounds: {x:number;y:number;width:number;height:number}
  pixelSize: number
}

/** Rasterize source contributions, not ambient light or the global darkness mask.
 * Multiple dim lights form a union rather than accumulating into bright light. */
export function rasterizeContinuousLight(input:ContinuousLightRasterInput) {
  const step=Math.max(0.01,input.pixelSize)
  const width=Math.max(1,Math.ceil(input.bounds.width/step))
  const height=Math.max(1,Math.ceil(input.bounds.height/step))
  if(width*height>16_777_216)throw new Error('continuous-light-raster-too-large')
  const rgba=new Uint8ClampedArray(width*height*4)
  // The shadow of one finite rectangular wall is convex. If all eight
  // emitter corners lie strictly inside it, the entire prism is hidden.
  // Never combine different walls: their union may contain an opening.
  // Magical passages invalidate this certificate and use normal sampling.
  const walls=input.map.dnd5ePluginAreas?.some(area=>area.blocking?.suppressesMappedBarriers)
    ? [] : mapGeometrySegments(input.geometry).filter(s=>s.entityKind==='wall'&&s.blocksVision)
  const prepared=input.sources.map(source=>{
    const prism=source.kind==='light'&&source.emissionArea&&rectangularPrism(input.map,source.emissionArea)
    const corners=prism?[-1,1].flatMap(a=>[-1,1].flatMap(b=>[-1,1].map(c=>
      prism.world([a*prism.half[0],b*prism.half[1],c*prism.half[2]])))):[]
    const reach=source.kind==='light'&&corners.length?{
      left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
      top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y)),
      low:Math.min(...corners.map(p=>p.elevationFeet)),high:Math.max(...corners.map(p=>p.elevationFeet)),
      radius:source.brightRadiusFeet+source.dimRadiusFeet,
    }:undefined
    return {source,corners,reach}
  })
  for(let row=0;row<height;row++)for(let col=0;col<width;col++){
    const point={x:input.bounds.x+(col+.5)*input.bounds.width/width,
      y:input.bounds.y+(row+.5)*input.bounds.height/height}
    let alpha=0
    const elevationFeet=mapGeometryTerrainElevationAtPoint(input.geometry,point)
    for(const {source,corners,reach} of prepared){
      if(reach){
        // A retained emitter is a subset of the full prism's bounding box.
        // Distance to that box is a lower bound, so this cannot discard light.
        const scale=(input.map.feetPerCell??5)/Math.max(1,input.map.gridSize)
        const dx=Math.max(reach.left-point.x,point.x-reach.right,0)*scale
        const dy=Math.max(reach.top-point.y,point.y-reach.bottom,0)*scale
        const dz=Math.max(reach.low-elevationFeet,elevationFeet-reach.high,0)
        if(dx*dx+dy*dy+dz*dz>reach.radius*reach.radius)continue
      }
      const fullyHidden=corners.length>0&&walls.some(wall=>corners.every(corner=>{
        const dx=corner.x-point.x,dy=corner.y-point.y
        const sx=wall.b.x-wall.a.x,sy=wall.b.y-wall.a.y
        const den=dx*sy-dy*sx
        if(Math.abs(den)<1e-8)return false
        const ax=wall.a.x-point.x,ay=wall.a.y-point.y
        const t=(ax*sy-ay*sx)/den,u=(ax*dy-ay*dx)/den
        if(t<=1e-5||t>=1-1e-5||u<=1e-5||u>=1-1e-5)return false
        const height=elevationFeet+(corner.elevationFeet-elevationFeet)*t
        return height>wall.baseHeightFeet+1e-5&&height<wall.baseHeightFeet+wall.heightFeet-1e-5
      }))
      if(fullyHidden)continue
      const light=mapGeometrySpellLightContributionAtPoint({...input,source,point,elevationFeet})
      alpha=Math.max(alpha,light==='bright'?255:light==='dim'?133:0)
      if(alpha===255)break
    }
    rgba[(row*width+col)*4+3]=alpha
  }
  return {width,height,rgba}
}

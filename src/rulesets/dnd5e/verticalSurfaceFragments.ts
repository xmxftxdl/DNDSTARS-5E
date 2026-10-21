import { polygonSignedArea } from '../../lib/convexPolygonPartition'
import { geometryEntityDestroyed } from '../../../shared/map-geometry-durability.mjs'
import { selectSingleVerticalMaterialSurface, type VerticalMaterialSurface } from './verticalMaterialSurface'

export interface VerticalSurfaceFragment {
  surface: VerticalMaterialSurface
  /** Rectangle in the shared drawing, measured from its lower left corner in feet. */
  leftFeet: number
  bottomFeet: number
  widthFeet: number
  heightFeet: number
  reversed: boolean
}

/** Cover a coplanar patch using physical faces; gaps and overlapping owners are rejected. */
export function partitionVerticalMaterialSurfaces(input: Parameters<typeof selectSingleVerticalMaterialSurface>[0]): VerticalSurfaceFragment[] | undefined {
  const { geometry, pixelsPerFoot: scale, widthFeet: width, heightFeet: height } = input
  if (![scale,width,height,input.baseElevationFeet,input.maximumSideFeet,input.centerFraction].every(Number.isFinite) ||
    scale<=0 || width<=0 || height<=0 || width>input.maximumSideFeet || height>input.maximumSideFeet ||
    input.centerFraction<0 || input.centerFraction>1 || !Number.isInteger(input.edgeIndex)) return undefined
  const anchors=geometry.obstacles.filter(s=>s.id===input.entityId)
  if(anchors.length!==1)return undefined
  const anchor=anchors[0],a=anchor.points[input.edgeIndex],b=anchor.points[(input.edgeIndex+1)%anchor.points.length]
  if(!a||!b||geometryEntityDestroyed(anchor)||anchor.terrainRegion||!anchor.surfaceMaterial||!input.materials.includes(anchor.surfaceMaterial))return undefined
  const length=Math.hypot(b.x-a.x,b.y-a.y)
  if(length<=1e-7)return undefined
  const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,winding=Math.sign(polygonSignedArea(anchor.points))
  const origin={x:a.x+ux*(input.centerFraction*length-width*scale/2),y:a.y+uy*(input.centerFraction*length-width*scale/2)}
  const candidates: Array<{entityId:string;edgeIndex:number;left:number;right:number;bottom:number;top:number;start:number;end:number}> = []
  for(const solid of geometry.obstacles){
    if(geometryEntityDestroyed(solid)||solid.terrainRegion||solid.heightFeet<=0||!solid.surfaceMaterial||!input.materials.includes(solid.surfaceMaterial))continue
    if(geometry.obstacles.filter(other=>other.id===solid.id).length!==1)return undefined
    for(let edgeIndex=0;edgeIndex<solid.points.length;edgeIndex++){
      const p=solid.points[edgeIndex],q=solid.points[(edgeIndex+1)%solid.points.length]
      if(Math.abs((p.x-origin.x)*uy-(p.y-origin.y)*ux)>1e-6 || Math.abs((q.x-origin.x)*uy-(q.y-origin.y)*ux)>1e-6)continue
      const edgeLength=Math.hypot(q.x-p.x,q.y-p.y)
      if(edgeLength<=1e-7)continue
      const orientation=Math.sign(((q.x-p.x)*ux+(q.y-p.y)*uy)*polygonSignedArea(solid.points))
      if(orientation!==winding)continue
      const start=((p.x-origin.x)*ux+(p.y-origin.y)*uy)/scale,end=((q.x-origin.x)*ux+(q.y-origin.y)*uy)/scale
      const left=Math.max(0,Math.min(start,end)),right=Math.min(width,Math.max(start,end))
      const bottom=Math.max(0,solid.baseHeightFeet-input.baseElevationFeet),top=Math.min(height,solid.baseHeightFeet+solid.heightFeet-input.baseElevationFeet)
      if(right-left>1e-7&&top-bottom>1e-7)candidates.push({entityId:solid.id,edgeIndex,left,right,bottom,top,start,end})
    }
  }
  const cuts=(values:number[])=>[...new Set(values)].sort((a,b)=>a-b)
  const xs=cuts([0,width,...candidates.flatMap(c=>[c.left,c.right])]),ys=cuts([0,height,...candidates.flatMap(c=>[c.bottom,c.top])])
  if((xs.length-1)*(ys.length-1)>256)return undefined
  const result:VerticalSurfaceFragment[]=[]
  for(let x=1;x<xs.length;x++)for(let y=1;y<ys.length;y++){
    const left=xs[x-1],right=xs[x],bottom=ys[y-1],top=ys[y]
    if(right-left<=1e-7||top-bottom<=1e-7)continue
    const owners=candidates.filter(c=>c.left<=(left+right)/2&&c.right>=(left+right)/2&&c.bottom<=(bottom+top)/2&&c.top>=(bottom+top)/2)
    if(owners.length!==1)return undefined
    const owner=owners[0]
    const surface=selectSingleVerticalMaterialSurface({...input,entityId:owner.entityId,edgeIndex:owner.edgeIndex,
      centerFraction:((left+right)/2-owner.start)/(owner.end-owner.start),widthFeet:right-left,heightFeet:top-bottom,
      baseElevationFeet:input.baseElevationFeet+bottom})
    if(!surface)return undefined
    result.push({surface,leftFeet:left,bottomFeet:bottom,widthFeet:right-left,heightFeet:top-bottom,reversed:owner.end<owner.start})
  }
  return result.length?result:undefined
}

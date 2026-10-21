import {geometryEntityDestroyed} from '../../../shared/map-geometry-durability.mjs'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import {triangulateSimplePolygon} from '../../lib/triangulateSimplePolygon'
import {MAP_SURFACE_MATERIALS} from '../../lib/mapSurfaceMaterials'
import type {MapGeometryPoint,MapGeometryState,MapGeometrySurfaceMaterial} from '../../lib/mapGeometry'
import {mapGeometryFootprintTerrainSamples} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {mapCellExtent,type GridCell} from '../../lib/gridCombat'

export interface HorizontalMaterialSurface {
  entityId:string
  material:MapGeometrySurfaceMaterial
  localCornersFeet:MapGeometryPoint[]
  corners:MapGeometryPoint[]
  elevationFeet:number
  fragments?: HorizontalMaterialSurfaceFragment[]
}
/** One convex portion of a shared drawing, bound to its own physical surface. */
export interface HorizontalMaterialSurfaceFragment extends Omit<HorizontalMaterialSurface,'fragments'> {
  /** Coordinates in feet relative to the original drawing frame, for clipping without stretching. */
  drawingCornersFeet: MapGeometryPoint[]
}

/** Partitions a single rectangular selection without filling gaps or accepting ambiguous overlaps. */
export function partitionHorizontalMaterialSurfaces(input:{geometry:MapGeometryState;corners:MapGeometryPoint[];elevationFeet:number;pixelsPerFoot:number;materials:readonly MapGeometrySurfaceMaterial[]}):HorizontalMaterialSurfaceFragment[]|undefined{
  const corners=rectangle(input.corners),scale=input.pixelsPerFoot
  if(!corners||!Number.isFinite(scale)||scale<=0||!Number.isFinite(input.elevationFeet))return undefined
  const drawing=frame(corners)!,pieces:HorizontalMaterialSurfaceFragment[]=[]
  const local=(points:MapGeometryPoint[],basis:NonNullable<ReturnType<typeof frame>>)=>points.map(p=>({
    x:((p.x-basis.a.x)*basis.ux+(p.y-basis.a.y)*basis.uy)/scale,
    y:(-(p.x-basis.a.x)*basis.uy+(p.y-basis.a.y)*basis.ux)/scale,
  }))
  for(const solid of input.geometry.obstacles){
    if(geometryEntityDestroyed(solid)||solid.terrainRegion||solid.heightFeet<=0||!solid.surfaceMaterial||
      !input.materials.includes(solid.surfaceMaterial)||Math.abs(solid.baseHeightFeet+solid.heightFeet-input.elevationFeet)>1e-4)continue
    const triangles=triangulateSimplePolygon(solid.points),basis=frame(solid.points)
    if(!triangles||!basis)continue
    for(const triangle of triangles){
      const intersection=partitionByConvexPolygon(corners,triangle)?.inside??[]
      if(Math.abs(polygonSignedArea(intersection))<=1e-7)continue
      if(input.geometry.obstacles.filter(entity=>entity.id===solid.id).length!==1||
        pieces.some(piece=>Math.abs(polygonSignedArea(partitionByConvexPolygon(intersection,piece.corners)?.inside??[]))>1e-7)||
        !exposed(input.geometry,intersection,input.elevationFeet,solid.surfaceMaterial))return undefined
      pieces.push({entityId:solid.id,material:solid.surfaceMaterial,corners:intersection,
        localCornersFeet:local(intersection,basis),drawingCornersFeet:local(intersection,drawing),elevationFeet:input.elevationFeet})
    }
  }
  const covered=pieces.reduce((sum,piece)=>sum+Math.abs(polygonSignedArea(piece.corners)),0)
  return pieces.length&&Math.abs(covered-Math.abs(polygonSignedArea(corners)))<1e-5?pieces:undefined
}
const rectangle=(value:unknown):MapGeometryPoint[]|undefined=>{
  if(!Array.isArray(value)||value.length!==4)return undefined
  if(value.some(p=>!p||typeof p!=='object'||Object.keys(p).some(k=>k!=='x'&&k!=='y')||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return undefined
  const points=value.map(p=>({x:p.x as number,y:p.y as number}))
  const [a,b,c,d]=points,ux=b.x-a.x,uy=b.y-a.y,vx=d.x-a.x,vy=d.y-a.y
  if(Math.hypot(ux,uy)<1e-7||Math.hypot(vx,vy)<1e-7||ux*vy-uy*vx<=0||
    Math.abs(ux*vx+uy*vy)>1e-6*Math.hypot(ux,uy)*Math.hypot(vx,vy)||Math.hypot(c.x-b.x-d.x+a.x,c.y-b.y-d.y+a.y)>1e-6)return undefined
  return points
}
export function normalizeHorizontalMaterialSurface(value:unknown):HorizontalMaterialSurface|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined
  const v=value as Record<string,unknown>
  if(Object.keys(v).some(k=>!['entityId','material','localCornersFeet','corners','elevationFeet','fragments'].includes(k))||
    typeof v.entityId!=='string'||!v.entityId.trim()||v.entityId.length>256||
    !(MAP_SURFACE_MATERIALS as readonly unknown[]).includes(v.material)||typeof v.elevationFeet!=='number'||!Number.isFinite(v.elevationFeet))return undefined
  const localCornersFeet=rectangle(v.localCornersFeet),corners=rectangle(v.corners)
  const fragments=v.fragments==null?undefined:normalizeHorizontalSurfaceFragments(v.fragments)
  if(v.fragments!=null&&!fragments)return undefined
  return localCornersFeet&&corners?{entityId:v.entityId,material:v.material as MapGeometrySurfaceMaterial,localCornersFeet,corners,elevationFeet:v.elevationFeet,...(fragments?{fragments}:{})}:undefined
}

function normalizeHorizontalSurfaceFragments(value:unknown):HorizontalMaterialSurfaceFragment[]|undefined{
  if(!Array.isArray(value)||!value.length||value.length>256)return undefined
  const polygon=(v:unknown):MapGeometryPoint[]|undefined=>{
    if(!Array.isArray(v)||v.length<3||v.length>16||v.some(p=>!p||typeof p!=='object'||Object.keys(p).some(k=>k!=='x'&&k!=='y')||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return undefined
      const points=v.map(p=>({x:p.x,y:p.y}))
      if(points.some((p,i)=>points.some((q,j)=>j<i&&Math.hypot(p.x-q.x,p.y-q.y)<1e-7)))return undefined
    return partitionByConvexPolygon(points,points)?.inside.length?points:undefined
  }
  const result:HorizontalMaterialSurfaceFragment[]=[]
  for(const raw of value){
    if(!raw||typeof raw!=='object'||Object.keys(raw).some(k=>!['entityId','material','corners','localCornersFeet','drawingCornersFeet','elevationFeet'].includes(k))||
      typeof raw.entityId!=='string'||!raw.entityId.trim()||raw.entityId.length>256||!MAP_SURFACE_MATERIALS.includes(raw.material)||!Number.isFinite(raw.elevationFeet))return undefined
    const corners=polygon(raw.corners),localCornersFeet=polygon(raw.localCornersFeet),drawingCornersFeet=polygon(raw.drawingCornersFeet)
      if(!corners||!localCornersFeet||!drawingCornersFeet||corners.length!==localCornersFeet.length||corners.length!==drawingCornersFeet.length)return undefined
      if(!sameFragmentShape(localCornersFeet,drawingCornersFeet,true)||!sameFragmentShape(localCornersFeet,corners,false))return undefined
    result.push({entityId:raw.entityId,material:raw.material,corners,localCornersFeet,drawingCornersFeet,elevationFeet:raw.elevationFeet})
  }
  return result
}
/** Stored coordinate frames may rotate/translate, but must not stretch or mirror the art. */
function sameFragmentShape(a:MapGeometryPoint[],b:MapGeometryPoint[],sameUnits:boolean):boolean{
  const fa=frame(a),fb=frame(b)
  if(!fa||!fb)return false
  const scale=Math.hypot(b[1].x-b[0].x,b[1].y-b[0].y)/Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)
  if(!Number.isFinite(scale)||scale<=0||(sameUnits&&Math.abs(scale-1)>1e-6))return false
  return a.every((p,i)=>{
    const ax=(p.x-fa.a.x)*fa.ux+(p.y-fa.a.y)*fa.uy
    const ay=-(p.x-fa.a.x)*fa.uy+(p.y-fa.a.y)*fa.ux
    const q=b[i],bx=((q.x-fb.a.x)*fb.ux+(q.y-fb.a.y)*fb.uy)/scale
    const by=(-(q.x-fb.a.x)*fb.uy+(q.y-fb.a.y)*fb.ux)/scale
    return Math.hypot(ax-bx,ay-by)<=1e-6*Math.max(1,Math.hypot(ax,ay))
  })
}
function frame(points:readonly MapGeometryPoint[]){
  const a=points[0],b=points[1]
  if(!a||!b)return undefined
  const length=Math.hypot(b.x-a.x,b.y-a.y)
  return Number.isFinite(length)&&length>1e-7?{a,ux:(b.x-a.x)/length,uy:(b.y-a.y)/length}:undefined
}
function contains(points:readonly MapGeometryPoint[],corners:readonly MapGeometryPoint[]){
  const triangles=triangulateSimplePolygon(points)
  if(!triangles)return false
  const covered=triangles.reduce((sum,t)=>sum+Math.abs(polygonSignedArea(partitionByConvexPolygon(t,corners)?.inside??[])),0)
  return Math.abs(covered-Math.abs(polygonSignedArea(corners)))<1e-5
}
function exposed(geometry:MapGeometryState,corners:MapGeometryPoint[],height:number,material:MapGeometrySurfaceMaterial){
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y))
  const samples=mapGeometryFootprintTerrainSamples({geometry,at:{x:(left+right)/2,y:(top+bottom)/2},halfSizePixels:Math.max(right-left,bottom-top)/2,footprint:corners,surfaceElevationFeet:height})
  return samples.length>0&&samples.every(sample=>sample.material===material&&sample.elevationFeet<=height+1e-4)
}
export function selectHorizontalMaterialSurface(input:{geometry:MapGeometryState;corners:MapGeometryPoint[];elevationFeet:number;pixelsPerFoot:number;materials:readonly MapGeometrySurfaceMaterial[]}):HorizontalMaterialSurface|undefined{
  const corners=rectangle(input.corners)
  if(!corners||!Number.isFinite(input.pixelsPerFoot)||input.pixelsPerFoot<=0)return undefined
  const solids=input.geometry.obstacles.filter(entity=>!geometryEntityDestroyed(entity)&&!entity.terrainRegion&&entity.heightFeet>0&&
    entity.surfaceMaterial&&input.materials.includes(entity.surfaceMaterial)&&Math.abs(entity.baseHeightFeet+entity.heightFeet-input.elevationFeet)<1e-4&&contains(entity.points,corners))
  if(solids.length!==1){
    const fragments=partitionHorizontalMaterialSurfaces(input)
    if(!fragments)return undefined
    const first=fragments[0],solid=input.geometry.obstacles.find(entity=>entity.id===first.entityId)!,basis=frame(solid.points)!
    return {entityId:first.entityId,material:first.material,corners,elevationFeet:input.elevationFeet,fragments,
      localCornersFeet:corners.map(p=>({x:((p.x-basis.a.x)*basis.ux+(p.y-basis.a.y)*basis.uy)/input.pixelsPerFoot,
        y:(-(p.x-basis.a.x)*basis.uy+(p.y-basis.a.y)*basis.ux)/input.pixelsPerFoot}))}
  }
  const solid=solids[0],basis=frame(solid.points)
  if(!basis||input.geometry.obstacles.filter(entity=>entity.id===solid.id).length!==1)return undefined
  if(!exposed(input.geometry,corners,input.elevationFeet,solid.surfaceMaterial!))return undefined
  const localCornersFeet=corners.map(p=>({x:((p.x-basis.a.x)*basis.ux+(p.y-basis.a.y)*basis.uy)/input.pixelsPerFoot,
    y:(-(p.x-basis.a.x)*basis.uy+(p.y-basis.a.y)*basis.ux)/input.pixelsPerFoot}))
  return {entityId:solid.id,material:solid.surfaceMaterial!,localCornersFeet,corners,elevationFeet:input.elevationFeet}
}
export function resolveAttachedHorizontalSurface(saved:HorizontalMaterialSurface,geometry:MapGeometryState,pixelsPerFoot:number):HorizontalMaterialSurface|undefined{
  if(!Number.isFinite(pixelsPerFoot)||pixelsPerFoot<=0)return undefined
  if(saved.fragments){
    const fragments=saved.fragments.flatMap(fragment=>{
      const projected=resolveAttachedHorizontalSurface(fragment,geometry,pixelsPerFoot)
      return projected?[{...fragment,...projected}]:[]
    })
    return fragments.length?{...saved,fragments}:undefined
  }
  const solids=geometry.obstacles.filter(entity=>entity.id===saved.entityId)
  if(solids.length!==1)return undefined
  const solid=solids[0],basis=frame(solid.points)
  if(!basis||geometryEntityDestroyed(solid)||solid.terrainRegion||solid.heightFeet<=0||solid.surfaceMaterial!==saved.material)return undefined
  const corners=saved.localCornersFeet.map(p=>({x:basis.a.x+(p.x*basis.ux-p.y*basis.uy)*pixelsPerFoot,
    y:basis.a.y+(p.x*basis.uy+p.y*basis.ux)*pixelsPerFoot}))
  if(!contains(solid.points,corners))return undefined
  if(!exposed(geometry,corners,solid.baseHeightFeet+solid.heightFeet,saved.material))return undefined
  return {...saved,corners,elevationFeet:solid.baseHeightFeet+solid.heightFeet}
}

export function horizontalSurfaceCells(surface:HorizontalMaterialSurface,map:BattleMap):GridCell[]{
  if(surface.fragments){
    const cells=new Map<string,GridCell>()
    for(const fragment of surface.fragments)for(const cell of horizontalSurfaceCells(fragment,map))cells.set(`${cell.col},${cell.row}`,cell)
    return [...cells.values()]
  }
  const {corners}=surface,g=map.gridSize,ox=map.gridOffsetX,oy=map.gridOffsetY
  const {cols,rows}=mapCellExtent(map)
  if(g<=0||corners.some(p=>p.x<ox-1e-7||p.y<oy-1e-7||p.x>ox+cols*g+1e-7||p.y>oy+rows*g+1e-7))return []
  const cells:GridCell[]=[]
  const minCol=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.x))-ox)/g)),maxCol=Math.min(cols-1,Math.floor((Math.max(...corners.map(p=>p.x))-ox)/g))
  const minRow=Math.max(0,Math.floor((Math.min(...corners.map(p=>p.y))-oy)/g)),maxRow=Math.min(rows-1,Math.floor((Math.max(...corners.map(p=>p.y))-oy)/g))
  for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){
    const x=ox+col*g,y=oy+row*g
    const clipped=partitionByConvexPolygon(corners,[{x,y},{x:x+g,y},{x:x+g,y:y+g},{x,y:y+g}])?.inside??[]
    if(Math.abs(polygonSignedArea(clipped))>1e-7)cells.push({col,row})
  }
  return cells
}

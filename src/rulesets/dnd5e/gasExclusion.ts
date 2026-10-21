import {groveCellVisionSegments,groveVolumeOverlaps} from '../../../shared/grove-volume.mjs'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {boxCoveredBySpheres,type CoverageSphere} from './sphereUnionCoverage'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import {triangulateSimplePolygon} from '../../lib/triangulateSimplePolygon'

export function isWindDispersibleGas(area:Dnd5ePluginArea):boolean {
 return area.dispersedByStrongWind===true || (area.sourceKind==='core-spell' &&
  ['fog-cloud','stinking-cloud','cloudkill'].includes(area.coreSpellId??''))
}
/** A local live geometry query: never edits the gas, its concentration, or its lifetime. */
export function gasExcludedAt(map:BattleMap,gas:Dnd5ePluginArea,point:{x:number;y:number},bottomFeet:number,topFeet=bottomFeet,halfSizePixels=0):boolean {
 if(!isWindDispersibleGas(gas))return false
 const singleWard=(map.dnd5ePluginAreas??[]).some(ward=>{
  if(ward.id===gas.id || ward.excludesWindDispersibleGas!==true || ward.modeState?.paused)return false
  const anchor=ward.anchorMode==='source-token'||ward.anchorMode==='target-token'||ward.anchorMode==='effect-token'
   ? map.tokens.find(token=>token.id===(ward.anchorTokenId??ward.sourceTokenId)):undefined
  const vertical=ward.vertical
  if(vertical?.mode!=='volume')return false
  const base=anchor&&Number.isFinite(anchor.elevationFeet)&&Number.isFinite(vertical.anchorOffsetFeet)?anchor.elevationFeet!+vertical.anchorOffsetFeet!:vertical.baseElevationFeet
  if(bottomFeet<base || topFeet>base+vertical.heightFeet)return false
  if(vertical.shape==='sphere' && ward.anchorCell){
   const center=anchor??{x:map.gridOffsetX+(ward.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(ward.anchorCell.row+.5)*map.gridSize}
   const scale=(map.feetPerCell??5)/map.gridSize,radius=vertical.heightFeet/2
   const dx=(Math.abs(point.x-center.x)+halfSizePixels)*scale,dy=(Math.abs(point.y-center.y)+halfSizePixels)*scale
   const dz=Math.max(Math.abs(bottomFeet-(base+radius)),Math.abs(topFeet-(base+radius)))
   if(dx*dx+dy*dy+dz*dz>radius*radius+1e-8)return false
  }
  // Respect Host-clipped footprint cells as well as the volume.
  const epsilon=halfSizePixels?1e-6:0
  const minCol=Math.floor((point.x-halfSizePixels+epsilon-map.gridOffsetX)/map.gridSize)
  const maxCol=Math.floor((point.x+halfSizePixels-epsilon-map.gridOffsetX)/map.gridSize)
  const minRow=Math.floor((point.y-halfSizePixels+epsilon-map.gridOffsetY)/map.gridSize)
  const maxRow=Math.floor((point.y+halfSizePixels-epsilon-map.gridOffsetY)/map.gridSize)
  const cells=new Set(ward.cells.map(c=>`${c.col}:${c.row}`))
  for(let col=minCol;col<=maxCol;col++)for(let row=minRow;row<=maxRow;row++)if(!cells.has(`${col}:${row}`))return false
  return true
 })
 if(singleWard)return true
 if(halfSizePixels===0&&bottomFeet===topFeet)return false
 // Only the part of the body that intersects gas needs protection. Partition
 // at grid/height boundaries so Host-clipped cells and separate wards combine.
 const scale=(map.feetPerCell??5)/map.gridSize
 const wards=(map.dnd5ePluginAreas??[]).filter(w=>w.id!==gas.id&&w.excludesWindDispersibleGas===true&&!w.modeState?.paused&&w.vertical?.mode==='volume')
 if(!wards.length)return false
 for(const cell of gas.cells){
  const x=map.gridOffsetX+cell.col*map.gridSize,y=map.gridOffsetY+cell.row*map.gridSize
  const left=Math.max(x,point.x-halfSizePixels),right=Math.min(x+map.gridSize,point.x+halfSizePixels)
  const front=Math.max(y,point.y-halfSizePixels),back=Math.min(y+map.gridSize,point.y+halfSizePixels)
  if(right<=left||back<=front)continue
  const gasVertical=gas.vertical?.mode==='volume'?gas.vertical:undefined
  const gasAnchor=['source-token','target-token','effect-token'].includes(gas.anchorMode??'')?map.tokens.find(t=>t.id===(gas.anchorTokenId??gas.sourceTokenId)):undefined
  const gasBase=gasAnchor&&Number.isFinite(gasAnchor.elevationFeet)&&Number.isFinite(gasVertical?.anchorOffsetFeet)?gasAnchor.elevationFeet!+gasVertical!.anchorOffsetFeet!:gasVertical?.baseElevationFeet??bottomFeet
  const gasCenter=gasAnchor??(gas.anchorCell?{x:map.gridOffsetX+(gas.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(gas.anchorCell.row+.5)*map.gridSize}:undefined)
  const domain:CoverageSphere|undefined=gasVertical?.shape==='sphere'&&gasCenter?{center:[gasCenter.x*scale,gasCenter.y*scale,gasBase+gasVertical.heightFeet/2],radius:gasVertical.heightFeet/2}:undefined
  const gasBands=gasVertical?.columns?.filter(c=>c.col===cell.col&&c.row===cell.row)??[{baseElevationFeet:gasBase,heightFeet:gasVertical?.heightFeet??topFeet-bottomFeet}]
  const volumes=wards.flatMap(ward=>{
   if(!ward.cells.some(c=>c.col===cell.col&&c.row===cell.row))return []
   const v=ward.vertical!
   if(v.mode!=='volume')return []
   const anchor=['source-token','target-token','effect-token'].includes(ward.anchorMode??'')?map.tokens.find(t=>t.id===(ward.anchorTokenId??ward.sourceTokenId)):undefined
   const base=anchor&&Number.isFinite(anchor.elevationFeet)&&Number.isFinite(v.anchorOffsetFeet)?anchor.elevationFeet!+v.anchorOffsetFeet!:v.baseElevationFeet
   const center=anchor??(ward.anchorCell?{x:map.gridOffsetX+(ward.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(ward.anchorCell.row+.5)*map.gridSize}:undefined)
   if(v.shape==='sphere'&&!center)return []
   const sphere:CoverageSphere|undefined=v.shape==='sphere'?{center:[center!.x*scale,center!.y*scale,base+v.heightFeet/2],radius:v.heightFeet/2}:undefined
   return (v.columns?.filter(c=>c.col===cell.col&&c.row===cell.row)??[{baseElevationFeet:base,heightFeet:v.heightFeet}]).map(band=>({bottom:band.baseElevationFeet,top:band.baseElevationFeet+band.heightFeet,sphere}))
  })
  for(const band of gasBands){
   const bottom=Math.max(bottomFeet,band.baseElevationFeet),top=Math.min(topFeet,band.baseElevationFeet+band.heightFeet)
   if(top<=bottom)continue
   const grove=gas.groveVolume
   const groveLevels=grove?[grove.baseElevationFeet,grove.baseElevationFeet+grove.heightFeet,...grove.excludedStructures.flatMap(s=>[s.baseElevationFeet,s.baseElevationFeet+s.heightFeet])]:[]
   const levels=[...new Set([bottom,top,...[...volumes.flatMap(v=>[v.bottom,v.top]),...groveLevels].filter(z=>z>bottom&&z<top)])].sort((a,b)=>a-b)
   for(let i=1;i<levels.length;i++){
    const low=levels[i-1],high=levels[i],active=volumes.filter(v=>v.bottom<=low&&v.top>=high)
    if(active.some(v=>!v.sphere))continue
    let polygons=[[{x:left,y:front},{x:right,y:front},{x:right,y:back},{x:left,y:back}]]
    if(grove){
     if(low<grove.baseElevationFeet||high>grove.baseElevationFeet+grove.heightFeet)continue
     const x=grove.minX,y=grove.minY,w=grove.widthPixels
     const bounds=[{x,y},{x:x+w,y},{x:x+w,y:y+w},{x,y:y+w}]
     polygons=polygons.flatMap(p=>{const cut=partitionByConvexPolygon(p,bounds);return cut&&cut.inside.length>=3?[cut.inside]:[]})
     for(const structure of grove.excludedStructures){
      if(structure.baseElevationFeet>low||structure.baseElevationFeet+structure.heightFeet<high)continue
      const triangles=triangulateSimplePolygon(structure.points)
      if(!triangles)continue
      for(const triangle of triangles)polygons=polygons.flatMap(p=>partitionByConvexPolygon(p,triangle)?.outside??[p])
     }
    }
    for(const p of polygons){
     const points=polygonSignedArea(p)<0?[...p].reverse():p
     const planes=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y;return{n:[dy,-dx,0] as [number,number,number],d:(dy*a.x-dx*a.y)*scale}})
     if(!boxCoveredBySpheres([left*scale,front*scale,low],[right*scale,back*scale,high],active.map(v=>v.sphere!),domain,planes))return false
    }
   }
  }
 }
 return true
}

/** Horizontal display/vision slice; circles use 96 segments (under one pixel at normal map scales). */
export function gasExclusionSlice(map:BattleMap,gas:Dnd5ePluginArea,elevationFeet:number):import('./druidGroveVolume').Dnd5eGroveVolume|undefined {
 if(!isWindDispersibleGas(gas))return undefined
 type Point={x:number;y:number}
 const exclusions:import('./druidGroveVolume').Dnd5eGroveVolume['excludedStructures']=[]
 const clip=(points:Point[],axis:'x'|'y',bound:number,greater:boolean):Point[]=>{
  const result:Point[]=[]
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length]
   const inside=(p:Point)=>greater?p[axis]>=bound:p[axis]<=bound
   if(inside(a))result.push(a)
   if(inside(a)!==inside(b)){const t=(bound-a[axis])/(b[axis]-a[axis]);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}
  }
  return result
 }
 for(const ward of map.dnd5ePluginAreas??[]){
  if(ward.id===gas.id||ward.excludesWindDispersibleGas!==true||ward.modeState?.paused||ward.vertical?.mode!=='volume')continue
  const v=ward.vertical,anchor=['source-token','target-token','effect-token'].includes(ward.anchorMode??'')?map.tokens.find(t=>t.id===(ward.anchorTokenId??ward.sourceTokenId)):undefined
  const base=anchor&&Number.isFinite(anchor.elevationFeet)&&Number.isFinite(v.anchorOffsetFeet)?anchor.elevationFeet!+v.anchorOffsetFeet!:v.baseElevationFeet
  if(elevationFeet<base||elevationFeet>=base+v.heightFeet)continue
  const center=anchor??(ward.anchorCell?{x:map.gridOffsetX+(ward.anchorCell.col+.5)*map.gridSize,y:map.gridOffsetY+(ward.anchorCell.row+.5)*map.gridSize}:undefined)
  const radius=v.shape==='sphere'?Math.sqrt(Math.max(0,(v.heightFeet/2)**2-(elevationFeet-base-v.heightFeet/2)**2))/(map.feetPerCell??5)*map.gridSize:undefined
  if(v.shape==='sphere'&&(!center||!radius))continue
  const circle=radius&&center?Array.from({length:96},(_,i)=>({x:center.x+radius*Math.cos(i*Math.PI/48),y:center.y+radius*Math.sin(i*Math.PI/48)})):undefined
  for(const cell of ward.cells){
   const x=map.gridOffsetX+cell.col*map.gridSize,y=map.gridOffsetY+cell.row*map.gridSize
   let points=circle??[{x,y},{x:x+map.gridSize,y},{x:x+map.gridSize,y:y+map.gridSize},{x,y:y+map.gridSize}]
   for(const[axis,bound,greater]of [['x',x,true],['x',x+map.gridSize,false],['y',y,true],['y',y+map.gridSize,false]] as const)points=clip(points,axis,bound,greater)
   if(points.length>=3)exclusions.push({points,baseElevationFeet:elevationFeet-1,heightFeet:2})
  }
 }
 if(!exclusions.length)return undefined
 return {minX:0,minY:0,widthPixels:Math.max(map.width,map.height),baseElevationFeet:elevationFeet-1,heightFeet:2,excludedStructures:exclusions}
}

/** Remove internal cell seams; only the boundary of remaining gas blocks the view. */
export function gasExclusionVisionSegments(map:BattleMap,gas:Dnd5ePluginArea,elevationFeet:number){
 const windSlice=gasExclusionSlice(map,gas,elevationFeet)
 if(!windSlice)return undefined
 // Preserve the cloud's original bounds and empty structures when adding wind holes.
 if(gas.groveVolume){
  const original=gas.groveVolume
  if(elevationFeet<original.baseElevationFeet||elevationFeet>=original.baseElevationFeet+original.heightFeet)return []
 }
 const slice=gas.groveVolume?{...gas.groveVolume,excludedStructures:[...gas.groveVolume.excludedStructures,...windSlice.excludedStructures]}:windSlice
 const cells=new Set(gas.cells.map(c=>`${c.col}:${c.row}`)),seen=new Set<string>()
 const contains=(p:{x:number;y:number})=>cells.has(`${Math.floor((p.x-map.gridOffsetX)/map.gridSize)}:${Math.floor((p.y-map.gridOffsetY)/map.gridSize)}`)&&groveVolumeOverlaps(slice,p,elevationFeet)
 return gas.cells.flatMap(cell=>groveCellVisionSegments(slice,{x:map.gridOffsetX+cell.col*map.gridSize,y:map.gridOffsetY+cell.row*map.gridSize,size:map.gridSize},elevationFeet,1e-6)).filter(edge=>{
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,length=Math.hypot(dx,dy)
  if(length<1e-8)return false
  const mid={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2},epsilon=1e-5
  if(contains({x:mid.x-dy/length*epsilon,y:mid.y+dx/length*epsilon})===contains({x:mid.x+dy/length*epsilon,y:mid.y-dx/length*epsilon}))return false
  const key=[edge.a,edge.b].map(p=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort().join(':')
  if(seen.has(key))return false
  seen.add(key);return true
 })
}

export function wallSurfaceLength(area){
 return area.circularGeometry?.innerRadiusFeet!=null?Math.PI*(area.circularGeometry.radiusFeet+area.circularGeometry.innerRadiusFeet):area.rectGeometry?.lengthFeet
}
export function wallSurfaceCoordinate(area,map,point){
 if(!area.anchorCell)return undefined
 const length=wallSurfaceLength(area);if(!(length>0))return undefined
 const scale=(map.feetPerCell??5)/map.gridSize
 const x=(point.x-(map.gridOffsetX??0)-(area.anchorCell.col+.5)*map.gridSize)*scale
 const y=(point.y-(map.gridOffsetY??0)-(area.anchorCell.row+.5)*map.gridSize)*scale
 if(area.circularGeometry?.innerRadiusFeet!=null)return ((Math.atan2(y,x)+2*Math.PI)%(2*Math.PI))/(2*Math.PI)*length
 const d=area.rectGeometry?.direction
 return d?x*d.dc+y*d.dr+length/2:undefined
}
export function validWallSurfaceSections(area,sections){
 const length=wallSurfaceLength(area),v=area.vertical
 if(!(length>0)||!area.anchorCell||v?.mode!=='volume'||v.shape||!Array.isArray(sections)||sections.length>1024)return false
 for(let i=0;i<sections.length;i++){
  const p=sections[i]
  if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['startFeet','endFeet','bottomFeet','topFeet'].includes(k))||
   ![p.startFeet,p.endFeet,p.bottomFeet,p.topFeet].every(Number.isFinite)||
   p.startFeet<0||p.endFeet>length+1e-8||p.startFeet>=p.endFeet||p.bottomFeet<v.baseElevationFeet||p.topFeet>v.baseElevationFeet+v.heightFeet||p.bottomFeet>=p.topFeet)return false
  if(sections.slice(0,i).some(q=>Math.min(q.endFeet,p.endFeet)>Math.max(q.startFeet,p.startFeet)&&Math.min(q.topFeet,p.topFeet)>Math.max(q.bottomFeet,p.bottomFeet)))return false
 }
 return true
}
/** Partition at exact section edges; midpoint classification does not sample across an edge. */
export function wallSurfaceRayIntervals(area,map,from,to,z,dz,interval){
 if(area.wallSurfaceSections==null)return [interval]
 const cuts=[...interval],length=wallSurfaceLength(area)
 const x=from.x-(map.gridOffsetX??0)-(area.anchorCell.col+.5)*map.gridSize
 const y=from.y-(map.gridOffsetY??0)-(area.anchorCell.row+.5)*map.gridSize
 const dx=to.x-from.x,dy=to.y-from.y
 const add=t=>{if(Number.isFinite(t)&&t>interval[0]&&t<interval[1])cuts.push(t)}
 for(const p of area.wallSurfaceSections){
  for(const h of [p.bottomFeet,p.topFeet])if(Math.abs(dz)>1e-12)add((h-z)/dz)
  for(const s of [p.startFeet,p.endFeet]){
   if(area.circularGeometry?.innerRadiusFeet!=null){
    const a=s/length*2*Math.PI,ux=Math.cos(a),uy=Math.sin(a),den=dx*uy-dy*ux
    if(Math.abs(den)>1e-12)add(-(x*uy-y*ux)/den)
   }else{
    const start=wallSurfaceCoordinate(area,map,from),end=wallSurfaceCoordinate(area,map,to)
    if(Math.abs(end-start)>1e-12)add((s-start)/(end-start))
   }
  }
 }
 cuts.sort((a,b)=>a-b)
 const result=[]
 for(let i=1;i<cuts.length;i++){
  if(cuts[i]-cuts[i-1]<=1e-10)continue
  const t=(cuts[i]+cuts[i-1])/2,s=wallSurfaceCoordinate(area,map,{x:from.x+dx*t,y:from.y+dy*t}),h=z+dz*t
  if(area.wallSurfaceSections.some(p=>s>=p.startFeet-1e-9&&s<=p.endFeet+1e-9&&h>=p.bottomFeet&&h<p.topFeet))result.push([cuts[i-1],cuts[i]])
 }
 return result
}

export function wallSurfaceWorldPoint(area,map,alongFeet){
 if(!area.anchorCell)return undefined
 const length=wallSurfaceLength(area);if(!(length>0))return undefined
 const scale=map.gridSize/(map.feetPerCell??5),x=(map.gridOffsetX??0)+(area.anchorCell.col+.5)*map.gridSize,y=(map.gridOffsetY??0)+(area.anchorCell.row+.5)*map.gridSize
 if(area.circularGeometry?.innerRadiusFeet!=null){
  const angle=alongFeet/length*2*Math.PI,r=(area.circularGeometry.radiusFeet+area.circularGeometry.innerRadiusFeet)/2*scale
  return {x:x+Math.cos(angle)*r,y:y+Math.sin(angle)*r}
 }
 const d=area.rectGeometry?.direction
 return d?{x:x+(alongFeet-length/2)*d.dc*scale,y:y+(alongFeet-length/2)*d.dr*scale}:undefined
}

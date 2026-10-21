import { rectangularPrism, rectangularPrismNearestPoint, rectangularPrismCells } from './rectangular-prism.mjs'

const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0)
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const add=(a,b,k=1)=>a.map((n,i)=>n+k*b[i])
const cache=new WeakMap()
const clippingCache=new WeakMap()

/** Missing projected cells require the sampled mask, not a full-solid outline. */
export function rectangularLightHasClippedCells(map,area){
 const key=JSON.stringify([map.width,map.height,map.gridSize,map.feetPerCell,map.gridOffsetX,map.gridOffsetY,area.rectGeometry,area.anchorCell,area.vertical,area.cells])
 const old=clippingCache.get(area)
 if(old?.key===key)return old.value
 const retained=new Set(area.cells.map(c=>`${c.col},${c.row}`))
 const full=rectangularPrismCells(map,area)
 const value=!!full?.some(c=>!retained.has(`${c.col},${c.row}`))
 clippingCache.set(area,{key,value});return value
}

// Each retained grid column intersects the real, rotated solid. Cache its
// planes, edges and vertices; these do not depend on the illuminated point.
function pieces(map,area){
 const key=JSON.stringify([map.gridSize,map.feetPerCell,map.gridOffsetX,map.gridOffsetY,area.rectGeometry,area.anchorCell,area.vertical,area.cells])
 const previous=cache.get(area)
 if(previous?.key===key)return previous.value
 const prism=rectangularPrism(map,area)
 if(!prism)return undefined
 const scale=(map.feetPerCell??5)/Math.max(1,map.gridSize)
 const value={prism,scale,parts:area.cells.map(cell=>{
  const planes=prism.half.flatMap((h,i)=>[-1,1].map(sign=>({n:[0,1,2].map(j=>i===j?sign:0),b:h})))
  for(const [axis,index] of [['x',0],['y',1]]){
   const offset=axis==='x'?(map.gridOffsetX??0):(map.gridOffsetY??0)
   const coordinate=axis==='x'?cell.col:cell.row
   const low=(offset+coordinate*map.gridSize-prism.center[axis])*scale
   const high=low+map.gridSize*scale
   const n=prism.axes.map(a=>a[index])
   planes.push({n,b:high},{n:n.map(v=>-v),b:-low})
  }
  const inside=p=>planes.every(({n,b})=>dot(n,p)<=b+1e-8)
  const edges=[],vertices=[]
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
   const a=planes[i],b=planes[j],v=cross(a.n,b.n),den=dot(v,v)
   if(den<1e-16)continue
   const origin=add(cross(b.n,v).map(n=>n*a.b/den),cross(v,a.n).map(n=>n*b.b/den))
   let lo=-Infinity,hi=Infinity
   for(const p of planes){
    const slope=dot(p.n,v),gap=p.b-dot(p.n,origin)
    if(Math.abs(slope)<1e-12){if(gap< -1e-8){lo=1;hi=0;break}}
    else if(slope>0)hi=Math.min(hi,gap/slope)
    else lo=Math.max(lo,gap/slope)
   }
   if(lo<=hi+1e-8&&Number.isFinite(lo)&&Number.isFinite(hi)){
    const start=add(origin,v,lo),end=add(origin,v,hi)
    edges.push([start,end]);vertices.push(start,end)
   }
  }
  return {planes,inside,edges,vertices}
 })}
 cache.set(area,{key,value});return value
}

/** Closest point on the union of retained columns intersected with the prism.
 * A convex polyhedron minimum lies in its interior, a face, edge or vertex.
 * Enumerating those cases avoids projection iterations or sampling tolerances.
 */
export function clippedPrismLightOrigin(map,area,target){
 const nearest=rectangularPrismNearestPoint(map,area,target)
 if(!nearest)return undefined
 const x=(nearest.x-(map.gridOffsetX??0))/map.gridSize,y=(nearest.y-(map.gridOffsetY??0))/map.gridSize
 if(area.cells.some(c=>x>=c.col-1e-9&&x<=c.col+1+1e-9&&y>=c.row-1e-9&&y<=c.row+1+1e-9))return nearest
 // Axis-aligned solids intersect each retained column in an axis-aligned box.
 // Avoid constructing polyhedron faces for the common upright-wall case.
 const prism=rectangularPrism(map,area)
 if(prism.axes.every(axis=>axis.every(n=>Math.abs(n)<1e-12||Math.abs(Math.abs(n)-1)<1e-12))){
  const scale=(map.feetPerCell??5)/Math.max(1,map.gridSize)
  const half=[0,1,2].map(i=>prism.axes.reduce((sum,axis,j)=>sum+Math.abs(axis[i])*prism.half[j],0))
  let best,bestDistance=Infinity
  for(const cell of area.cells){
   const left=Math.max((map.gridOffsetX??0)+cell.col*map.gridSize,prism.center.x-half[0]/scale)
   const right=Math.min((map.gridOffsetX??0)+(cell.col+1)*map.gridSize,prism.center.x+half[0]/scale)
   const top=Math.max((map.gridOffsetY??0)+cell.row*map.gridSize,prism.center.y-half[1]/scale)
   const bottom=Math.min((map.gridOffsetY??0)+(cell.row+1)*map.gridSize,prism.center.y+half[1]/scale)
   if(left>right||top>bottom)continue
   const p={x:Math.max(left,Math.min(right,target.x)),y:Math.max(top,Math.min(bottom,target.y)),elevationFeet:Math.max(prism.center.elevationFeet-half[2],Math.min(prism.center.elevationFeet+half[2],target.elevationFeet))}
   const distance=((p.x-target.x)*scale)**2+((p.y-target.y)*scale)**2+(p.elevationFeet-target.elevationFeet)**2
   if(distance<bestDistance){best=p;bestDistance=distance}
  }
  return best
 }
 const data=pieces(map,area)
 if(!data)return undefined
 const q=data.prism.local(target)
 let best,bestDistance=Infinity
 const consider=p=>{const d=dot(add(p,q,-1),add(p,q,-1));if(d<bestDistance){best=p;bestDistance=d}}
 for(const part of data.parts){
  if(!part.vertices.length)continue
  if(part.inside(q))return target
  for(const {n,b} of part.planes){const p=add(q,n,(b-dot(n,q))/dot(n,n));if(part.inside(p))consider(p)}
  for(const [a,b] of part.edges){const v=add(b,a,-1),den=dot(v,v);consider(add(a,v,den?Math.max(0,Math.min(1,dot(add(q,a,-1),v)/den)):0))}
 }
 return best?data.prism.world(best):undefined
}

/** Grid-distance to the actual clipped solid, including a target's body.
 * SAT against an axis-aligned box expanded by d in each world axis gives
 * the exact Chebyshev separation. Minimize over retained convex pieces.
 */
export function clippedPrismDistanceToBox(map,area,minimum,maximum){
 const data=pieces(map,area)
 if(!data)return Infinity
 const {prism,scale}=data
 const toWorld=v=>[0,1,2].map(i=>prism.axes.reduce((sum,a,j)=>sum+a[i]*v[j],0))
 const center=[((minimum.x+maximum.x)/2-prism.center.x)*scale,((minimum.y+maximum.y)/2-prism.center.y)*scale,(minimum.elevationFeet+maximum.elevationFeet)/2-prism.center.elevationFeet]
 const half=[(maximum.x-minimum.x)*scale/2,(maximum.y-minimum.y)*scale/2,(maximum.elevationFeet-minimum.elevationFeet)/2]
 const world=[[1,0,0],[0,1,0],[0,0,1]]
 let nearest=Infinity
 for(const part of data.parts){
  if(!part.vertices.length)continue
  const vertices=part.vertices.map(toWorld)
  const axes=[...world,...part.planes.map(p=>toWorld(p.n)),...part.edges.flatMap(([a,b])=>world.map(w=>cross(toWorld(add(b,a,-1)),w)))]
  let distance=0
  for(const axis of axes){
   const denominator=axis.reduce((sum,n)=>sum+Math.abs(n),0)
   if(denominator<1e-12)continue
   const values=vertices.map(v=>dot(axis,v)),mid=dot(axis,center)
   const radius=half.reduce((sum,n,i)=>sum+n*Math.abs(axis[i]),0)
   distance=Math.max(distance,(Math.min(...values)-mid-radius)/denominator,(mid-radius-Math.max(...values))/denominator)
  }
  nearest=Math.min(nearest,distance)
 }
 return nearest
}

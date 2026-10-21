type Vec3=readonly [number,number,number]

/** Earliest contact with a vertical cylinder, independently clipping altitude and planar radius. */
export function firstCylinderPathContact(path:readonly {x:number;y:number;elevationFeet:number}[],pixelsPerFoot:number,radiusFeet:number,heightFeet:number,low:Vec3,high:Vec3):ReturnType<typeof firstSpherePathContact> {
 if(!Number.isFinite(pixelsPerFoot)||pixelsPerFoot<=0||!Number.isFinite(heightFeet)||heightFeet<=0)return undefined
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dz=b.elevationFeet-a.elevationFeet
  let begin=0,end=1
  if(Math.abs(dz)<1e-12){if(a.elevationFeet>high[2]||a.elevationFeet+heightFeet<low[2])continue}
  else{
   const first=(low[2]-heightFeet-a.elevationFeet)/dz,last=(high[2]-a.elevationFeet)/dz
   begin=Math.max(0,Math.min(first,last));end=Math.min(1,Math.max(first,last))
   if(begin>end)continue
  }
  const point=(t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,elevationFeet:a.elevationFeet+dz*t})
  const start=point(begin),finish=point(end)
  const local=sweptSphereBoxContact([start.x/pixelsPerFoot,start.y/pixelsPerFoot,0],
   [finish.x/pixelsPerFoot,finish.y/pixelsPerFoot,0],radiusFeet,[low[0],low[1],0],[high[0],high[1],0])
  if(local!==undefined){const fraction=begin+(end-begin)*local;return {segment:i-1,fraction,point:point(fraction)}}
 }
 return undefined
}

/** Earliest contact of a moving sphere with an axis-aligned occupied body. */
export function sweptSphereBoxContact(from:Vec3,to:Vec3,radius:number,low:Vec3,high:Vec3):number|undefined {
 if(![...from,...to,...low,...high,radius].every(Number.isFinite)||radius<0||low.some((v,i)=>v>high[i]))return undefined
 const delta=from.map((v,i)=>to[i]-v)
 const cuts=new Set([0,1])
 for(let axis=0;axis<3;axis++)if(Math.abs(delta[axis])>1e-12){
  for(const edge of [low[axis],high[axis]]){
   const t=(edge-from[axis])/delta[axis]
   if(t>0&&t<1)cuts.add(t)
  }
 }
 const ordered=[...cuts].sort((a,b)=>a-b)
 for(let part=1;part<ordered.length;part++){
  const start=ordered[part-1],end=ordered[part],mid=(start+end)/2
  let a=0,b=0,c=-radius*radius
  for(let axis=0;axis<3;axis++){
   const point=from[axis]+delta[axis]*mid
   const edge=point<low[axis]?low[axis]:point>high[axis]?high[axis]:undefined
   if(edge===undefined)continue
   const offset=from[axis]-edge,speed=delta[axis]
   a+=speed*speed;b+=2*offset*speed;c+=offset*offset
  }
  const value=(t:number)=>(a*t+b)*t+c
  if(value(start)<=1e-9)return start
  if(a<=1e-12)continue
  const discriminant=b*b-4*a*c
  if(discriminant<0)continue
  const enter=(-b-Math.sqrt(discriminant))/(2*a)
  if(enter>=start-1e-9&&enter<=end+1e-9)return Math.max(start,Math.min(end,enter))
 }
 return undefined
}

/** Path elevations represent sphere bottoms, while this sweep uses its center. */
export function firstSpherePathContact(path:readonly {x:number;y:number;elevationFeet:number}[],pixelsPerFoot:number,radiusFeet:number,low:Vec3,high:Vec3):
 {segment:number;fraction:number;point:{x:number;y:number;elevationFeet:number}}|undefined {
 if(!Number.isFinite(pixelsPerFoot)||pixelsPerFoot<=0)return undefined
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i]
  const t=sweptSphereBoxContact([a.x/pixelsPerFoot,a.y/pixelsPerFoot,a.elevationFeet+radiusFeet],
    [b.x/pixelsPerFoot,b.y/pixelsPerFoot,b.elevationFeet+radiusFeet],radiusFeet,low,high)
  if(t!==undefined)return {segment:i-1,fraction:t,point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,elevationFeet:a.elevationFeet+(b.elevationFeet-a.elevationFeet)*t}}
 }
 return undefined
}

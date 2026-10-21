/** Host path distances use one grid-step per orthogonal or diagonal cell. */
export function dnd5eJumpLaunchPoint(input: {
 path: readonly {x:number;y:number}[]
 elevationsFeet?: readonly number[]
 approachFeet: number
 coordinateUnitsPerFoot: number
}): {x:number;y:number;elevationFeet?:number} | undefined {
 if(!Number.isFinite(input.approachFeet)||input.approachFeet<0||!Number.isFinite(input.coordinateUnitsPerFoot)||input.coordinateUnitsPerFoot<=0||!input.path.length||input.path.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return undefined
 if(input.elevationsFeet&&(input.elevationsFeet.length!==input.path.length||input.elevationsFeet.some(n=>!Number.isFinite(n))))return undefined
 let remaining=input.approachFeet
 if(remaining===0)return {...input.path[0],elevationFeet:input.elevationsFeet?.[0]}
 for(let i=1;i<input.path.length;i++){
  const from=input.path[i-1],to=input.path[i],feet=Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y))/input.coordinateUnitsPerFoot
  if(feet<=0)continue
  if(remaining<=feet+1e-6){const t=Math.min(1,remaining/feet);return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,elevationFeet:input.elevationsFeet?input.elevationsFeet[i-1]+(input.elevationsFeet[i]-input.elevationsFeet[i-1])*t:undefined}}
  remaining-=feet
 }
 return undefined
}

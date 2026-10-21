import type {Dnd5eWaterChange,Dnd5eWaterIntent} from './controlledWater'
import {parseSurfaceDrawing} from './surfaceDrawing'

/** Shared prompt values are untrusted; never accept a different mode or physical qualification. */
export function resolveControlledWaterInput(intent:Dnd5eWaterIntent,values:Record<string,string>):Dnd5eWaterChange|undefined{
 if(intent.kind==='shape'){
  const description=values.description?.trim()
  const drawing=values.drawing?parseSurfaceDrawing(values.drawing):undefined
  if(values.drawing&&!drawing)return undefined
  return description&&description.length<=500?{kind:'shape',description,...(drawing?{drawing}:{})}:undefined
 }
 if(intent.kind==='appearance'){
  if(!/^#[\da-f]{6}$/i.test(values.color??'')||!values.opacity?.trim())return undefined
  const opacity=Number(values.opacity)
  return Number.isFinite(opacity)&&opacity>=0&&opacity<=1?{kind:'appearance',color:values.color,opacity}:undefined
 }
 if(intent.kind==='move'){
  if(!['x','y','z'].every(key=>typeof values[key]==='string'&&values[key].trim()))return undefined
  const displacementFeet={x:Number(values.x),y:Number(values.y),z:Number(values.z)}
  const length=Math.hypot(displacementFeet.x,displacementFeet.y,displacementFeet.z)
  return Number.isFinite(length)&&length>0&&length<=5+1e-7?{kind:'move',displacementFeet}:undefined
 }
 return undefined
}

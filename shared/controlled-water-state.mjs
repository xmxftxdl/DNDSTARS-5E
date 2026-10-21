import {normalizeSurfaceDrawing} from './surface-drawing-state.mjs'
const object=v=>v!=null&&typeof v==='object'&&!Array.isArray(v)
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max
const color=v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)
/** Browser and server share the same persisted water/effect contract. */
export function normalizeControlledWaterState(value){
  if(object(value)&&value.sourceWaterId!=null&&!id(value.sourceWaterId))return undefined
  if(!object(value)||!id(value.id)||!object(value.positionFeet)||!object(value.dimensionsFeet)||
    !['x','y','z'].every(k=>finite(value.positionFeet[k],-1000000,1000000)&&finite(value.dimensionsFeet[k],0.001,10000))||
    !color(value.color)||!finite(value.opacity,0,1)||!Array.isArray(value.alterations)||value.alterations.length>256||
    !Array.isArray(value.appliedActionIds)||value.appliedActionIds.length>100000||!value.appliedActionIds.every(id)||
    new Set(value.appliedActionIds).size!==value.appliedActionIds.length)return undefined
  const seen=new Set(),alterations=[]
  for(const effect of value.alterations){
    const duration=effect?.durationMinutes??60
    if(!Number.isInteger(duration)||duration<1||duration>1440||(effect?.limitGroup!=null&&!id(effect.limitGroup)))return undefined
    if(!object(effect)||!id(effect.id)||seen.has(effect.id)||!id(effect.casterId)||
      !finite(effect.appliedAtWorldMinute,0,Number.MAX_SAFE_INTEGER-duration)||effect.expiresAtWorldMinute!==effect.appliedAtWorldMinute+duration||
      !value.appliedActionIds.includes(effect.id))return undefined
    seen.add(effect.id)
    const common={...(effect.durationMinutes!=null?{durationMinutes:duration}:{}),...(effect.limitGroup!=null?{limitGroup:effect.limitGroup}:{}),id:effect.id,casterId:effect.casterId,appliedAtWorldMinute:effect.appliedAtWorldMinute,expiresAtWorldMinute:effect.expiresAtWorldMinute}
    if(effect.kind==='freeze')alterations.push({...common,kind:'freeze'})
    else if(effect.kind==='shape'){
      if(typeof effect.description!=='string'||!effect.description.trim()||effect.description.length>500)return undefined
      const drawing=effect.drawing==null?undefined:normalizeSurfaceDrawing(effect.drawing)
      if(effect.drawing!=null&&!drawing)return undefined
      const frame=effect.drawingFrameFeet
      if(frame!=null&&(!drawing||!object(frame)||!finite(frame.x,-1000000,1000000)||!finite(frame.y,-1000000,1000000)||!finite(frame.width,0.001,5)||!finite(frame.height,0.001,5)))return undefined
      alterations.push({...common,kind:'shape',description:effect.description,...(drawing?{drawing}:{}),...(frame?{drawingFrameFeet:{x:frame.x,y:frame.y,width:frame.width,height:frame.height}}:{})})
    }else if(effect.kind==='appearance'){
      if(!color(effect.color)||!finite(effect.opacity,0,1))return undefined
      alterations.push({...common,kind:'appearance',color:effect.color,opacity:effect.opacity})
    }else return undefined
  }
  const vector=v=>({x:v.x,y:v.y,z:v.z})
  return {id:value.id,...(value.sourceWaterId!=null?{sourceWaterId:value.sourceWaterId}:{}),positionFeet:vector(value.positionFeet),dimensionsFeet:vector(value.dimensionsFeet),color:value.color,opacity:value.opacity,
    alterations,appliedActionIds:[...value.appliedActionIds]}
}

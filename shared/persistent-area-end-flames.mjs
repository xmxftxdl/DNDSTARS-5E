import {isFlameLight} from './flame-light-concealment.mjs'

/** Pure authority transition. It never treats missing maps as an area dismissal. */
export function settleAreaEndFlames({before,after,geometry,groundAt,tokenElevation,worldMinute}) {
  if(!before||!after||before.id!==after.id||geometry?.mapId!==after.id)return {map:after,geometry,changedTokenIds:[],changedLightIds:[]}
  const live=new Set((after.dnd5ePluginAreas??[]).map(area=>area.id))
  const scale=(after.feetPerCell??5)/after.gridSize
  const origins=(before.dnd5ePluginAreas??[]).flatMap(area=>{
    const radius=area.endFlameExtinguishRadiusFeet,anchor=area.anchorCell
    if(live.has(area.id)||!anchor||!Number.isInteger(radius)||radius<=0||radius>1000||!Number.isFinite(scale)||scale<=0)return []
    const point={x:before.gridOffsetX+(anchor.col+.5)*before.gridSize,y:before.gridOffsetY+(anchor.row+.5)*before.gridSize}
    return [{...point,z:groundAt(geometry,point),radius}]
  })
  const reaches=(point,z)=>point&&origins.some(origin=>Math.hypot((point.x-origin.x)*scale,(point.y-origin.y)*scale,z-origin.z)<=origin.radius+1e-7)
  const ordinary=kind=>['torch','candle','lamp','hooded-lantern'].includes(kind)
  const active=light=>light?.enabled&&!(Number.isFinite(worldMinute)&&Number.isFinite(light.expiresAtWorldMinute)&&worldMinute>=light.expiresAtWorldMinute)
  const changedTokenIds=[],changedLightIds=[]
  const tokens=after.tokens.map(token=>{
    const light=token.lightSource
    if(!active(light)||!isFlameLight(light)||!ordinary(light.sourceKind)||!reaches(token,tokenElevation(geometry,token)))return token
    changedTokenIds.push(token.id)
    return {...token,lightSource:undefined}
  })
  const lights=(geometry.lights??[]).map(light=>{
    if(!active(light)||!(isFlameLight(light)||(light.flame!==false&&light.controlledFlame?.burning))||
      light.sourceKind==='spell'||light.controlledFlame?.magical===true||
      !(ordinary(light.sourceKind)||light.controlledFlame?.magical===false)||!reaches(light.points?.[0],light.elevationFeet??0))return light
    changedLightIds.push(light.id)
    return {...light,enabled:false,controlledFlame:light.controlledFlame?{...light.controlledFlame,burning:false,alterations:[]}:undefined}
  })
  return {map:changedTokenIds.length?{...after,tokens}:after,geometry:changedLightIds.length?{...geometry,lights}:geometry,changedTokenIds,changedLightIds}
}

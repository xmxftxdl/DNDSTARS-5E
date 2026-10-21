import type {Dnd5eWaterIntent} from './controlledWater'
import {prepareDnd5eWaterAppearanceMapChange} from './controlledWaterMap'

type Scene=Omit<Parameters<typeof prepareDnd5eWaterAppearanceMapChange>[0],'selection'>
type WaterSelection=Parameters<typeof prepareDnd5eWaterAppearanceMapChange>[0]['selection']
export type ControlledWaterRegion=Extract<WaterSelection,{waterId:string}>['region']
export type ControlledWaterSelection={waterId:string;region:ControlledWaterRegion}|{dismissEffectId:string}

export function controlledWaterSelectionOptions(scene:Scene,intent:Dnd5eWaterIntent,region?:ControlledWaterRegion){
 const options:{id:string;label:string;selection:ControlledWaterSelection}[]=[]
 const seen=new Set<string>()
 const add=(selection:ControlledWaterSelection,label:string)=>{
  const request='dismissEffectId'in selection?selection:intent.kind!=='dismiss'?{...selection,change:intent}:undefined
  if(!request||!prepareDnd5eWaterAppearanceMapChange({...scene,selection:request}).ok)return
  options.push({id:JSON.stringify(selection),label,selection})
 }
 for(const geometry of scene.geometries)for(const body of geometry.obstacles){
  const water=body.controlledWater;if(!water)continue
  if(intent.kind==='dismiss'){
   for(const effect of water.alterations){
    if(seen.has(effect.id)||effect.casterId!==scene.casterId||effect.expiresAtWorldMinute<=scene.worldMinute)continue
    seen.add(effect.id)
    const mode=effect.kind==='freeze'?'冻结':effect.kind==='shape'?'形状':'颜色与透明度'
    add({dismissEffectId:effect.id},`${body.label||'水体'} · ${mode} · 剩余 ${Math.ceil(effect.expiresAtWorldMinute-scene.worldMinute)} 分钟`)
   }
  }else if(geometry.mapId===scene.map.id&&region){
   const source=water.sourceWaterId??water.id
   if(seen.has(source))continue
   seen.add(source)
   add({waterId:body.id,region},body.label||'选区内水体')
  }
 }
 return options
}

/** Only Host-generated options are accepted; refresh eligibility after the choice. */
export async function requestControlledWaterSelection(input:{readScene:()=>Scene;intent:Dnd5eWaterIntent;region?:ControlledWaterRegion;
 choose:(options:{id:string;label:string}[])=>Promise<unknown>}):Promise<ControlledWaterSelection|undefined>{
 const options=controlledWaterSelectionOptions(input.readScene(),input.intent,input.region)
 if(!options.length)return undefined
 const id=options.length===1&&input.intent.kind!=='dismiss'?options[0].id:await input.choose(options.map(({id,label})=>({id,label})))
 if(typeof id!=='string'||!options.some(option=>option.id===id))return undefined
 return controlledWaterSelectionOptions(input.readScene(),input.intent,input.region).find(option=>option.id===id)?.selection
}

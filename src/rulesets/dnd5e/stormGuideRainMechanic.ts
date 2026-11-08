import{cloneDnd5eSceneWeatherFacts}from'../../../shared/dnd5e-scene-weather-facts.mjs'
import type{Dnd5eMechanicOperationHandlerRegistrationV1}from'./plugins/pluginMechanicsRegistry'

export const STORM_GUIDE_RAIN_HANDLER='core.storm-guide-rain'
export const STORM_GUIDE_RAIN_EFFECT='storm-guide-rain-shelter'
export const STORM_GUIDE_RAIN_TAG='storm-guide:rain-shelter:20'

/** The generic Activity executor calls this only with its Host-built encounter
 * snapshot. The weather is a scene fact, not a package parameter or choice. */
export const stormGuideRainHandler:Dnd5eMechanicOperationHandlerRegistrationV1={
 id:STORM_GUIDE_RAIN_HANDLER,label:'引导风雨·止雨',
 description:'仅在实际下雨时，动作令自身周围20尺球形区域内停止降雨；由原生天气投影读取。',
 phases:['effects','persistence'],parameters:[],
 resolve({operation,execution,target}){
  const facts=cloneDnd5eSceneWeatherFacts(execution.sceneWeatherFacts)
  if(target.id!==execution.actor.id||(execution.actor.classLevels?.sorcerer??0)<6||facts?.raining!==true)throw Error('storm-guide:actual-rain-and-sorcerer-six-required')
  return[{kind:'apply-effect',operationId:operation.id,targetId:target.id,
   effectId:STORM_GUIDE_RAIN_EFFECT,name:'引导风雨·止雨',
   tags:[STORM_GUIDE_RAIN_TAG],duration:{kind:'permanent'},conditions:[],modifierGroups:[],
   magical:false,concentration:false,stacking:'replace',disposition:'buff'}]
 },
}

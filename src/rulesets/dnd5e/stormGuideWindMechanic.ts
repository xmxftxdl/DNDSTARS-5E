import{cloneDnd5eSceneWeatherFacts}from'../../../shared/dnd5e-scene-weather-facts.mjs'
import type{Dnd5eMechanicOperationHandlerRegistrationV1}from'./plugins/pluginMechanicsRegistry'
import{STORM_GUIDE_WIND_EXPIRY_TAG}from'./stormGuideWindExpiry'

export const STORM_GUIDE_WIND_HANDLER='core.storm-guide-wind'
export const STORM_GUIDE_WIND_EFFECT='storm-guide-wind-direction'
export const STORM_GUIDE_WIND_TAG='storm-guide:wind-control:100'
export const STORM_GUIDE_WIND_DIRECTION_TAG='storm-guide:wind-direction:'
export const stormGuideWindHandler:Dnd5eMechanicOperationHandlerRegistrationV1={
 id:STORM_GUIDE_WIND_HANDLER,label:'引导风雨·风向',description:'实际有风时，每轮附赠动作改变周围100尺球形区域内风向，直到自己下回合结束；风速不变。',phases:['effects','persistence'],parameters:[],
 resolve({operation,execution,target}){
  const facts=cloneDnd5eSceneWeatherFacts(execution.sceneWeatherFacts),text=execution.choices?.['wind-direction']?.trim(),direction=text?Number(text):NaN
  if(target.id!==execution.actor.id||(execution.actor.classLevels?.sorcerer??0)<6||!facts?.wind||execution.activityRoundScopeKnown!==true||execution.activityUsedThisRound===true||!Number.isFinite(direction)||direction<0||direction>=360)throw Error('storm-guide:actual-wind-round-and-direction-required')
  if(execution.sceneWeatherExploration===true&&!Number.isSafeInteger(execution.sceneWeatherWorldSecond))throw Error('storm-guide:actual-world-second-required')
  return[{kind:'apply-effect',operationId:operation.id,targetId:target.id,effectId:STORM_GUIDE_WIND_EFFECT,name:'引导风雨·风向',tags:[STORM_GUIDE_WIND_TAG,STORM_GUIDE_WIND_DIRECTION_TAG+String(direction),...(execution.sceneWeatherExploration===true?[STORM_GUIDE_WIND_EXPIRY_TAG+String(execution.sceneWeatherWorldSecond!+6)]:[])],duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-end',includeCreationTurn:false},conditions:[],modifierGroups:[],magical:false,concentration:false,stacking:'replace',disposition:'buff'},
   {kind:'record-activity-round-use',operationId:operation.id,targetId:target.id}]
 },
}

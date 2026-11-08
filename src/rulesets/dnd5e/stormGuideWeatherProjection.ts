import{dnd5eCombatantHasSubclass}from'./headlessCombatPrimitives'
import{registeredDnd5ePluginFeatures}from'./plugins/pluginContentCatalog'
import{dnd5eFeatureActivityControls}from'./activities/dnd5eFeatureActivityControls'
import{STORM_GUIDE_WIND_HANDLER,STORM_GUIDE_WIND_EFFECT,STORM_GUIDE_WIND_TAG,STORM_GUIDE_WIND_DIRECTION_TAG}from'./stormGuideWindMechanic'
import{readDnd5eStormGuideWindExpiry}from'./stormGuideWindExpiry'
import{dnd5eActivitySceneWorldSecond}from'./stormGuideRoundClock'
import{cloneDnd5eSceneWeatherFacts,type Dnd5eSceneWeatherFactsV1}from'../../../shared/dnd5e-scene-weather-facts.mjs'
import{effectiveDnd5eActiveEffects}from'./activeEffects'
import{dnd5ePluginFeatureCurrentEnvelopeFullV1,registeredDnd5eRulesPlugins}from'./pluginApi'
import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import{STORM_GUIDE_RAIN_TAG,STORM_GUIDE_RAIN_EFFECT}from'./stormGuideRainMechanic'
import{STORM_GUIDE_RAIN_HANDLER}from'./stormGuideRainMechanic'
import{getRegisteredDnd5eActivity}from'./activities/dnd5eActivityRegistry'

/** Read-only physical weather projection. Neither an effect tag nor this result
 * grants an Activity, source entitlement, raw die, or world-write capability. */
export function dnd5eStormGuideSceneWeatherAt(state:Dnd5eHeadlessCombatState,point:{x:number;y:number;elevationFeet?:number}):Dnd5eSceneWeatherFactsV1|undefined{
 const facts=cloneDnd5eSceneWeatherFacts(state.companionScene?.geometry?.weatherFacts)
 if(!facts)return undefined
 const units=state.coordinateUnitsPerFoot
 if(!Number.isFinite(units)||!units||units<=0||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.elevationFeet??0))return facts
 let raining=facts.raining,wind:{at:number;id:string;direction:number}|undefined
 const packages=new Set(registeredDnd5eRulesPlugins().map(plugin=>plugin.id)),features=registeredDnd5ePluginFeatures()
 for(const actor of Object.values(state.combatants)){
  if((actor.classLevels?.sorcerer??0)<6)continue
  const inside=Math.hypot((actor.position.x-point.x)/units,(actor.position.y-point.y)/units,(actor.elevationFeet??actor.groundElevationFeet??0)-(point.elevationFeet??0))<=20
  if(!inside&&Math.hypot((actor.position.x-point.x)/units,(actor.position.y-point.y)/units,(actor.elevationFeet??actor.groundElevationFeet??0)-(point.elevationFeet??0))>100)continue
  for(const effect of effectiveDnd5eActiveEffects(actor.classState.activeEffects)){
   const source=effect.source
   if(source.actorId!==actor.id||!source.pluginId||!packages.has(source.pluginId)||!source.rulesId||!source.rulesId.startsWith(source.pluginId+':'))continue
   const activityId=source.rulesId.slice(source.pluginId.length+1),activity=getRegisteredDnd5eActivity(source.pluginId,activityId)
   if(!activity||!features.some(feature=>feature.ownerPluginId===source.pluginId&&feature.sourceClassId==='sorcerer'&&(actor.classLevels?.sorcerer??0)>=Math.max(6,feature.minimumLevel??0)&&!!feature.sourceSubclassId&&dnd5eCombatantHasSubclass(actor,'sorcerer',feature.sourceSubclassId)&&actor.pluginFeatureIds.includes(feature.id)&&dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)&&dnd5eFeatureActivityControls(feature).some(control=>control.activity.id===activity.id)))continue
   const hasHandler=(id:string)=>activity?.outcomes.some(outcome=>outcome.operations.some(operation=>operation.kind==='mechanic'&&operation.handlerId===id&&operation.target==='actor'))
   if(inside&&effect.tags?.includes(STORM_GUIDE_RAIN_TAG)&&effect.definitionId==='activity:'+source.rulesId+':'+STORM_GUIDE_RAIN_EFFECT+':marker'&&hasHandler(STORM_GUIDE_RAIN_HANDLER))raining=false
   if(facts.wind&&effect.tags?.includes(STORM_GUIDE_WIND_TAG)&&effect.definitionId==='activity:'+source.rulesId+':'+STORM_GUIDE_WIND_EFFECT+':marker'&&hasHandler(STORM_GUIDE_WIND_HANDLER)){
     const expiry=readDnd5eStormGuideWindExpiry(effect),now=dnd5eActivitySceneWorldSecond(state);if(expiry===null||expiry!==undefined&&(now===undefined||now>=expiry))continue
    const directions=effect.tags.filter(tag=>tag.startsWith(STORM_GUIDE_WIND_DIRECTION_TAG));if(directions.length!==1)continue;const raw=directions[0].slice(STORM_GUIDE_WIND_DIRECTION_TAG.length),direction=Number(raw);if(!Number.isFinite(direction)||direction<0||direction>=360||String(direction)!==raw)continue
    if(!wind||effect.appliedAt>wind.at||effect.appliedAt===wind.at&&effect.id>wind.id)wind={at:effect.appliedAt,id:effect.id,direction}
   }
  }
 }
 return{...facts,raining,wind:facts.wind&&wind?{...facts.wind,directionDegrees:wind.direction}:facts.wind}
}

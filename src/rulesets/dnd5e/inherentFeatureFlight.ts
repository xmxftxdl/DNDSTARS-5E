import type{Character}from'../../types/character'
import{createDnd5eMechanicalEffect,normalizeDnd5eActiveEffects,type Dnd5eActiveEffectInstance}from'./activeEffects'
import{runtimeDnd5ePluginFeatures,dnd5eCharacterHasPluginFeature,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'./plugins/pluginContentCatalog'
const prefix='feature-flight:'
/** Rebuild only from the current owned definition, never a persisted speed claim. */
export function dnd5eInherentFeatureFlightEffects(character:Character|undefined,effects:readonly Dnd5eActiveEffectInstance[]|undefined){
 const all=normalizeDnd5eActiveEffects(effects),persisted=all.filter(effect=>!effect.tags?.some(tag=>tag.startsWith(prefix)))
 if(!character)return persisted
 const projected=runtimeDnd5ePluginFeatures().flatMap(feature=>{
  const flight=feature.staticModifiers?.inherentFlight
  if(!flight||feature.automation!=='full'||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)||!dnd5eCharacterHasPluginFeature(character,feature.id))return []
  const tag=prefix+feature.id,prior=all.find(effect=>effect.id===tag)
  return[createDnd5eMechanicalEffect({id:tag,definitionId:tag,label:feature.name,targetId:character.id,appliedAt:0,
   source:{kind:'feature',rulesId:feature.id,actorId:character.id,characterId:character.id,magical:true},
   duration:{type:'permanent'},tags:[tag],suspendedBy:prior?.suspendedBy,
   modifiers:{flySpeedFeet:flight.speedFeet,magicallyHeldAloft:true}})]
 })
 return[...persisted,...projected]
}

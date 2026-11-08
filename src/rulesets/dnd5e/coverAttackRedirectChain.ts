import type{Dnd5eCoverAttackRedirectUse}from'./headlessCombatEngine'

type Redirect=Readonly<Pick<Dnd5eCoverAttackRedirectUse,'featureId'|'originalTargetId'|'replacementTargetId'>>
/** Plain mechanical choices only. This neither issues an owner answer nor
 * authorizes a source, result, reaction or Room publication. */
export function dnd5eCoverAttackRedirectChainUses(value:unknown):readonly Redirect[]|undefined{
 const result:Redirect[]=[],seen=new Set<object>();let current:unknown=value,previous:string|undefined
 for(let depth=0;depth<64;depth++){
  if(!current||typeof current!=='object'||Array.isArray(current)||seen.has(current))return undefined
  seen.add(current);const descriptors=Object.getOwnPropertyDescriptors(current),keys=Reflect.ownKeys(descriptors)
  if(keys.some(k=>typeof k!=='string'||!['featureId','originalTargetId','replacementTargetId','next'].includes(k))||Object.values(descriptors).some(d=>!('value'in d)))return undefined
  const featureId=descriptors.featureId?.value,originalTargetId=descriptors.originalTargetId?.value,replacementTargetId=descriptors.replacementTargetId?.value
  if([featureId,originalTargetId,replacementTargetId].some(v=>typeof v!=='string'||!v)||previous!==undefined&&originalTargetId!==previous)return undefined
  result.push(Object.freeze({featureId,originalTargetId,replacementTargetId}));previous=replacementTargetId;current=descriptors.next?.value
  if(current===undefined)return Object.freeze(result)
 }
 return undefined
}
export function dnd5eCoverAttackRedirectChainTargetId(value:unknown):string|undefined{
 return dnd5eCoverAttackRedirectChainUses(value)?.at(-1)?.replacementTargetId
}

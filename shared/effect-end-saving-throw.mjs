export function validDnd5eEffectEndSavingThrow(value) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false
 const v=value
 return Object.keys(v).every(k=>['ability','dc','exhaustionOnFailure'].includes(k)) &&
  ['str','dex','con','int','wis','cha'].includes(String(v.ability)) && Number.isInteger(v.dc) && Number(v.dc)>=1 && Number(v.dc)<=40 &&
  Number.isInteger(v.exhaustionOnFailure) && Number(v.exhaustionOnFailure)>=1 && Number(v.exhaustionOnFailure)<=6
}
/** Persist the obligation after the original bonuses are removed; no dice at cast time. */
export function retainDnd5eEndedEffectSavingThrows(before, after) {
 const result=[...after], retained=new Set(after.map(e=>e.id))
 for(const effect of before){
  if(retained.has(effect.id)||!validDnd5eEffectEndSavingThrow(effect.endSavingThrow))continue
  const id=`end-save:${effect.id}`
  if(retained.has(id))continue
  result.push({schemaVersion:1,id,definitionId:'pending:effect-end-save',kind:'mark',label:`${effect.label}（结束豁免）`,
   source:{...effect.source,magical:false},appliedAt:effect.appliedAt,duration:{type:'permanent'},stackingKey:id,stackingPolicy:'replace',
   pendingEndSavingThrow:{...effect.endSavingThrow},visibility:effect.visibility})
  retained.add(id)
 }
 return result
}

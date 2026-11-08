const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,allowed)=>record(value)&&Object.keys(value).every(key=>allowed.includes(key))
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=2000
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max
export function validateBountifulDeferredD20Choices(value,parentId){
 return Array.isArray(value)&&value.length<=128&&new Set(value.map(row=>row?.interruptId)).size===value.length&&value.every(row=>
  keys(row,['schemaVersion','kind','parentId','sourceOccurrence','readyOrdinal','actorId','characterId','dieIndex','rawRollId','interruptId','contributionId','originalValue','selectedValue','rerollValues','selectedIndex','selectionPolicy','featureId','resourceCosts'])&&
  row.schemaVersion===1&&row.kind==='choice-reroll'&&row.parentId===parentId&&integer(row.sourceOccurrence,0,511)&&integer(row.readyOrdinal,0,100000)&&integer(row.dieIndex,0,1)&&
  [row.actorId,row.characterId,row.rawRollId,row.interruptId,row.contributionId,row.featureId].every(text)&&integer(row.originalValue,1,20)&&integer(row.selectedValue,1,20)&&
  Array.isArray(row.rerollValues)&&row.rerollValues.length>=1&&row.rerollValues.length<=2&&row.rerollValues.every(die=>integer(die,1,20))&&
  integer(row.selectedIndex,0,row.rerollValues.length)&&['owner-chooses','highest','lowest','must-use-latest'].includes(row.selectionPolicy)&&
  [row.originalValue,...row.rerollValues][row.selectedIndex]===row.selectedValue&&Array.isArray(row.resourceCosts)&&row.resourceCosts.length<=16&&
  new Set(row.resourceCosts.map(cost=>cost?.resourceKey)).size===row.resourceCosts.length&&row.resourceCosts.every(cost=>keys(cost,['resourceKey','amount'])&&text(cost.resourceKey)&&integer(cost.amount,1,1000)))
}

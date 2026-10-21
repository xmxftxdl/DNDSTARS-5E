export interface Dnd5eFortressFurnishingRecipe {templateId:string;size:number}
export interface Dnd5eFortressFurnishingPlacement {id:string;templateId:string;level:1|2|3;x:number;y:number}
export function validDnd5eFortressFurnishingCatalog(value:unknown):value is Dnd5eFortressFurnishingRecipe[]{
 if(!Array.isArray(value)||value.length>128)return false
 const ids=new Set<string>()
 return value.every(entry=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>key!=='templateId'&&key!=='size')||
   typeof entry.templateId!=='string'||!/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(entry.templateId)||ids.has(entry.templateId)||
   typeof entry.size!=='number'||!Number.isFinite(entry.size)||entry.size<0.1||entry.size>10)return false
  ids.add(entry.templateId);return true
 })
}

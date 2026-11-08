// Finite Core-only mirror of Native classLevels.ts. This data reader grants
// no character feature, spell, result, actor permission or World authority.
export const coreClassIdentities=Object.freeze([["barbarian","野蛮人"],["bard","吟游诗人"],["cleric","牧师"],["druid","德鲁伊"],["fighter","战士"],["monk","武僧"],["paladin","圣武士"],["ranger","游侠"],["rogue","游荡者"],["sorcerer","术士"],["warlock","邪术师"],["wizard","法师"]].map(pair=>Object.freeze(pair)))
const byIdentity=new Map(coreClassIdentities.flatMap(([id,name])=>[[id,id],[name,id]])),coreIds=new Set(coreClassIdentities.map(([id])=>id))
/** Same normalization as Native with the fixed Core registry only. Unknown
 * keys are dropped here, exactly as an unregistered Native identity is. */
export function normalizeCoreCharacterClassLevels(character){
 const normalized={}
 for(const[classId,rawLevel]of Object.entries(character?.dnd5eClassLevels??{})){
  if(!byIdentity.has(classId)||!Number.isFinite(rawLevel))continue
  const level=Math.max(0,Math.min(20,Math.floor(rawLevel)))
  if(level>0)normalized[classId]=level
 }
 const primary=byIdentity.get(character?.charClass),classIds=Object.keys(normalized)
 if(classIds.length>0){
  if(primary&&classIds.length===1&&normalized[primary]==null)return{[primary]:Math.max(1,Math.min(20,Math.floor(character.level||normalized[classIds[0]]||1)))}
  return normalized
 }
 return primary?{[primary]:Math.max(1,Math.min(20,Math.floor(character.level||1)))}:{}
}
/** Policy-safe boundary: an unknown/custom primary or level-map identity
 * might resolve through Native's live custom-class registry. Without that
 * verified source it is unsupported, never inferred as a Core class grant.
 * undefined is unsupported; zero is a supported record without this class. */
export function readSupportedCoreCharacterClassLevel(character,classId){
 if(!character||!coreIds.has(classId)||!byIdentity.has(character.charClass))return undefined
 const levels=character.dnd5eClassLevels
 if(levels!=null&&(typeof levels!=='object'||Array.isArray(levels)||Object.keys(levels).some(id=>!byIdentity.has(id))))return undefined
 return normalizeCoreCharacterClassLevels(character)[classId]??0
}

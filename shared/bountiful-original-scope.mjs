const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const stable=v=>Array.isArray(v)?v.map(stable):obj(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v
export const bountifulSceneClockSignature=v=>JSON.stringify(stable(v==null?null:Object.fromEntries(Object.entries(v).filter(([k])=>k!=='_sync'))))
export const bountifulSceneCombatBoundary=combat=>JSON.stringify(stable(Object.fromEntries(['active','mapId','combatId','round','initiativeIndex','initiativeOrder','dnd5eTurnEconomyByToken'].filter(k=>combat?.[k]!==undefined).map(k=>[k,combat[k]]))))
export function bountifulOriginalScopeMatches(combat,identity){
 if(!combat||!identity)return false
 if(identity.sceneScope)return combat.active===false&&identity.sceneScope.kind==='ordinary-scene'&&bountifulSceneCombatBoundary(combat)===identity.sceneScope.combatBoundary
 return combat.active===true&&combat.mapId===identity.mapId&&combat.combatId===identity.combatId&&combat.round===identity.round&&combat.initiativeIndex===identity.initiativeIndex
}
export function validBountifulOriginalSceneScope(value){return obj(value)&&Object.keys(value).length===4&&value.kind==='ordinary-scene'&&typeof value.combatBoundary==='string'&&value.combatBoundary.length>0&&value.combatBoundary.length<2000000&&typeof value.campaignTimeSignature==='string'&&value.campaignTimeSignature.length<2000000&&Number.isSafeInteger(value.campaignTimeRevision)&&value.campaignTimeRevision>=0}

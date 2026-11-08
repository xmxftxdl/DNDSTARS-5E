import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'

/** A Native availability record, not a submitted choice, die or authority cap. */
export function dnd5eActivityRoundScope(state:Dnd5eHeadlessCombatState):string|undefined{
 if(state.companionScene?.weatherControlCombatActive??state.active)return typeof state.combatId==='string'&&state.combatId.length>0&&Number.isSafeInteger(state.round)&&state.round>=1?JSON.stringify(['combat-round',state.combatId,state.round]):undefined
 const second=dnd5eActivitySceneWorldSecond(state)
 return second===undefined?undefined:JSON.stringify(['scene-round',state.companionScene!.map.id,Math.floor(second/6)])
}
export function dnd5eActivitySceneWorldSecond(state:Dnd5eHeadlessCombatState):number|undefined{
 const scene=state.companionScene,minute=scene?.worldMinute,remainder=scene?.worldSecondRemainder
 if(typeof minute!=='number'||!Number.isFinite(minute)||minute<0||!scene?.map.id)return undefined
 if(remainder!==undefined&&(!Number.isInteger(remainder)||remainder<0||remainder>=60||!Number.isInteger(minute)))return undefined
 const second=minute*60+(remainder??0)
 return Number.isSafeInteger(Math.round(second))&&Math.abs(second-Math.round(second))<=1e-6?Math.round(second):undefined
}
export function dnd5eActivityRoundUseKey(packageId:string,activityId:string){return'activity-round:'+JSON.stringify([packageId,activityId])}

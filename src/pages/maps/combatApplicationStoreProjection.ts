import type {Dnd5eMapResultPlan} from '../../rulesets/dnd5e/mapBridge'
import type {Character} from '../../types/character'
import {applyTokenPatchToSharedMaps,type BattleMap} from '../../store/maps'
import {projectDnd5eAuthorityCharacterPatch} from '../../store/characters'
import {applyDnd5eCombatResultApplication,mergeDnd5eCombatCharacterResult} from './commitDnd5eCombatResult'

/** Shared with the real Page application: map-level fields are only replaced
 * for a structural transaction; ordinary movement commits actual entity patches. */
export function dnd5eCombatApplicationUsesStructuralMap(currentMap:BattleMap|undefined,application:Dnd5eMapResultPlan):boolean{
 return !!currentMap&&(
  currentMap.tokens.length!==application.map.tokens.length||
  currentMap.tokens.some((token,index)=>token.id!==application.map.tokens[index]?.id)||
  JSON.stringify(currentMap.dnd5ePluginAreas??[])!==JSON.stringify(application.map.dnd5ePluginAreas??[])||
  JSON.stringify(currentMap.dnd5ePendingMovementCompletions??[])!==JSON.stringify(application.map.dnd5ePendingMovementCompletions??[])||
  JSON.stringify(currentMap.dnd5eDelayedSummons??[])!==JSON.stringify(application.map.dnd5eDelayedSummons??[])||
  JSON.stringify(currentMap.dnd5eSkillCheckMovement)!==JSON.stringify(application.map.dnd5eSkillCheckMovement)||
  JSON.stringify(currentMap.dnd5eActivityTurnClock)!==JSON.stringify(application.map.dnd5eActivityTurnClock)
 )
}

/** Pure execution of the actual coordinator and authority patch algorithms.
 * It neither mutates a Store nor brands a parent or arbitrary result. */
export function projectDnd5eCombatApplicationStoreState(input:{map:BattleMap;characters:readonly Character[];application:Dnd5eMapResultPlan}){
 const original=structuredClone({map:input.map,characters:[...input.characters]});let map=original.map,characters=original.characters
 if(input.application.map.id!==map.id)throw Error('combat-projection:original-map-required')
 applyDnd5eCombatResultApplication({application:input.application,mapId:map.id,applicationMode:dnd5eCombatApplicationUsesStructuralMap(map,input.application)?'map':'entities',
  applyMap:(_id,resolved)=>{map={...map,...resolved}},
  applyCharacter:(id,resolved,patch)=>{characters=characters.map(current=>current.id===id?projectDnd5eAuthorityCharacterPatch(current,mergeDnd5eCombatCharacterResult(current,resolved,patch)):current)},
  applyToken:(mapId,id,resolved,patch)=>{const next=applyTokenPatchToSharedMaps([map],mapId,id,patch??resolved);if(!next)throw Error('combat-projection:actual-token-required');map=next[0]},
 })
 return {map,characters}
}

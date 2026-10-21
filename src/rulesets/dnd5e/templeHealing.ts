import {dnd5eTempleWardAt} from './templeWardGeometry'
import type {Dnd5eCombatant,Dnd5eHeadlessCombatState} from './headlessCombatEngine'

/** Re-evaluate the live recipient position; do not persist an indoor bonus on the actor. */
export function dnd5eTempleSpellHealingBonus(state:Dnd5eHeadlessCombatState,recipient:Dnd5eCombatant,spellLevel:number):number {
 if(!Number.isSafeInteger(spellLevel)||spellLevel<1||spellLevel>9)return 0
 const scene=state.companionScene
 if(!scene||scene.map.id!==state.mapId||!scene.geometry)return 0
 const elevation=recipient.elevationFeet??recipient.groundElevationFeet??0
 let bonus=0
 for(const structure of scene.geometry?.structureLifetimes??[]){
  const ward=structure.templeWard,volume=structure.objectBoundary
  if(!ward||!volume||structure.replacementGroup!=='temple-of-the-gods')continue
  if(!dnd5eTempleWardAt({...scene.geometry,structureLifetimes:[structure]},recipient.position,elevation,scene.worldMinute))continue
  // Multiple instances of the same spell do not add their bonuses together.
  bonus=Math.max(bonus,ward.healingBonus)
 }
 return bonus
}

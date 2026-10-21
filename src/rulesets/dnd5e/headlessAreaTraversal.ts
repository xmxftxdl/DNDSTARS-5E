import type {Dnd5eCombatant,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5ePersistentAreaOccupantModifiersAt} from './persistentAreaGeometry'

/** Read transaction-local position, not the token's pre-action position, for environmental movement rules. */
export function dnd5eHeadlessAreaTraversalModifiers(state:Dnd5eHeadlessCombatState,actor:Dnd5eCombatant, at?:{x:number;y:number;elevationFeet?:number}) {
 const none={halvesFallingDamage:false,verticalJumpBonusFeet:0}
 const scene=state.companionScene
 if(!scene||scene.map.id!==state.mapId)return none
 const tokens=scene.map.tokens.map(token=>{
  const body=state.combatants[token.id]
  return body?{...token,x:body.position.x,y:body.position.y,elevationFeet:body.elevationFeet,hp:body.currentHp}:token
 })
 const token=tokens.find(token=>token.id===actor.id)
 if(!token)return none
 const areas=scene.map.dnd5ePluginAreas?.filter(area=>{
  if(area.modeState?.paused)return false
  if(area.permanent!==true&&(state.round>area.expiresAfterRound||
   (scene.worldMinute!=null&&area.expiresAtWorldMinute!=null&&scene.worldMinute>=area.expiresAtWorldMinute)))return false
  const source=state.combatants[area.sourceTokenId]
  if(area.concentrationId&&source&&(!source.concentrating||source.classState.concentrationSpellId!==area.concentrationId))return false
  return true
 })
 const modifiers=dnd5ePersistentAreaOccupantModifiersAt({map:{...scene.map,tokens,dnd5ePluginAreas:areas},token,position:at ?? actor.position,elevationFeet:at?.elevationFeet ?? actor.elevationFeet})
 return {halvesFallingDamage:modifiers.halvesFallingDamage,verticalJumpBonusFeet:modifiers.verticalJumpBonusFeet}
}

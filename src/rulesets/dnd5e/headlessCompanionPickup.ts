import { dnd5eCarriedLoadCapacityPounds } from './carryingCapacity'
import { prepareDnd5eMapInventoryPickup, type MapInventoryPickupResult } from './mapInventoryPickup'
import type { Dnd5eHeadlessCombatState, Dnd5eCombatant } from './headlessCombatEngine'
import type { Dnd5eCompanionObjectInteraction } from './companionObjectInteraction'

export function prepareDnd5eHeadlessCompanionPickup(state:Dnd5eHeadlessCombatState,actor:Dnd5eCombatant,
  selection:Extract<Dnd5eCompanionObjectInteraction,{operation:'pickup-item'}>):MapInventoryPickupResult {
  const scene=state.companionScene
  if(!scene || scene.map.id!==selection.mapId)return {ok:false,reason:'pickup-map-unavailable'}
  return prepareDnd5eMapInventoryPickup({companionCapacityPounds:dnd5eCarriedLoadCapacityPounds(actor),geometry:scene.geometry,map:{...scene.map,tokens:scene.map.tokens.map(token=>token.id===actor.id?{...token,...actor.position,hp:actor.currentHp,
          elevationFeet:actor.elevationFeet,dnd5eCombatState:{...token.dnd5eCombatState,activeEffects:actor.classState.activeEffects},
          dnd5eSummon:token.dnd5eSummon?{...token.dnd5eSummon,controlEnded:(!!actor.summonedUncontrolledSubtype||actor.summonedSourceCombatantId!==token.dnd5eSummon.sourceTokenId)?true:undefined}:undefined}:token)},
          characters:[],actorTokenId:actor.id,objectTokenId:selection.objectTokenId,expectedReceiptId:selection.expectedReceiptId,expectedQuantity:selection.expectedQuantity,combatActive:false})
}

import type { BattleMap } from '../../store/maps'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import { dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { mapGeometryLineOfEffectBlocked, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import type { Dnd5eMapObjectStateV1 } from './mapObjectState'

export function clearEndedDnd5eGroundItemEffects(state: Dnd5eHeadlessCombatState, object: Dnd5eMapObjectStateV1 | undefined): Dnd5eMapObjectStateV1 | undefined {
  const inventory = object?.inventoryItem
  if (!inventory?.boundEffects?.length) return object
  const retained = inventory.boundEffects.filter(effect => effect.duration.type !== 'concentration' ||
    !state.combatants[effect.duration.sourceActorId] || dnd5eGroundItemEffectIsLive(state, effect))
  return retained.length === inventory.boundEffects.length ? object : {
    ...object!, inventoryItem: { ...inventory, boundEffects: retained.length ? retained : undefined },
  }
}

export function dnd5eGroundItemEffectIsLive(state: Dnd5eHeadlessCombatState, effect: Dnd5eActiveEffectInstance): boolean {
  const duration = effect.duration
  if (duration.type !== 'concentration') return duration.type !== 'rounds' || duration.remainingRounds > 0
  const caster = state.combatants[duration.sourceActorId]
  return !!caster?.concentrating && caster.classState.concentrationSpellId === (duration.concentrationId ?? effect.source.rulesId) &&
    (duration.remainingRounds == null || duration.remainingRounds > 0) &&
    (!effect.source.executionId || !!caster.classState.activeEffects?.some(anchor => anchor.source.executionId === effect.source.executionId &&
      anchor.source.rulesId === effect.source.rulesId && anchor.duration.type === 'concentration'))
}

/** Add spatial facts without making an unattended weapon a targetable creature or initiative actor. */
export function projectDnd5eGroundItemEffectOrigins(state: Dnd5eHeadlessCombatState, map: BattleMap, geometry?: MapGeometryState): void {
  state.groundItemEffectOrigins = {}
  state.distanceFeetByCombatantPair ??= {}
  state.lineOfEffectBlockedByCombatantPair ??= {}
  for (const holder of map.tokens) {
    const holderActor = state.combatants[holder.id]
    const item = holderActor ? { ...holder, x: holderActor.position.x, y: holderActor.position.y, elevationFeet: holderActor.elevationFeet } : holder
    const inventories = [
      ...(item.type === 'obstacle' ? [item.dnd5eObjectState?.inventoryItem] : []),
      ...(item.dnd5eCarriedObjects ?? []).map(carried => carried.objectState.inventoryItem),
    ]
    const effects = inventories.flatMap(inventory => {
      if (!inventory?.instance) return []
      const intactIds = new Set([inventory.instance, ...(inventory.contents ?? [])]
        .filter(entry => !entry.condition?.destroyed).map(entry => entry.instanceId))
      return (inventory.boundEffects ?? []).filter(effect =>
      intactIds.has(effect.modifiers?.weaponEnchantment?.inventoryInstanceId ?? effect.modifiers?.armorEnchantment?.inventoryInstanceId ?? '') &&
      dnd5eGroundItemEffectIsLive(state, effect))
    })
    if (!effects.length) continue
    state.groundItemEffectOrigins[item.id] = effects
    for (const token of map.tokens) {
      const actor = state.combatants[token.id]
      if (!actor) continue
      const target = { ...token, x: actor.position.x, y: actor.position.y, elevationFeet: actor.elevationFeet }
      state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(item.id, token.id)] = dnd5eMapTokenDistanceFeet({ map, geometry, left: item, right: target })
      const key = dnd5eDirectedCombatantPairKey(item.id, token.id)
      const blocked = mapGeometryLineOfEffectBlocked({ geometry, map, from: item, to: target,
        fromElevationFeet: mapGeometryTokenElevation(geometry, item), toElevationFeet: mapGeometryTokenElevation(geometry, target) })
      if (blocked) state.lineOfEffectBlockedByCombatantPair[key] = true
      else delete state.lineOfEffectBlockedByCombatantPair[key]
    }
  }
}

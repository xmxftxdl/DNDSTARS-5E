import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eGroundItemEffectIsLive } from '../mapGroundItemEffectOrigins'

/** Resolve the current holder from Host effects; never accept an origin token from a client. */
export function dnd5eActivityEffectOriginId(state:Dnd5eHeadlessCombatState,actorId:string,activity:Dnd5eActivityDefinitionV1):string|undefined {
  const binding=activity.target.kind==='creature'?activity.target.effectOrigin:undefined
  if(!binding)return actorId
  const holders=Object.values(state.combatants).filter(target=>target.classState.activeEffects?.some(effect=> {
    const definitionId = effect.definitionId.replace(/:(?:modifiers:\d+|extension|marker)$/, '')
    return effect.source.actorId===actorId && (definitionId===binding.effectId || definitionId.endsWith(`:${binding.effectId}`)) && (effect.modifiers?.weaponEnchantment?.inventoryInstanceId ?? effect.modifiers?.armorEnchantment?.inventoryInstanceId)!=null
  }))
  const ground = Object.entries(state.groundItemEffectOrigins ?? {}).filter(([, effects]) => effects.some(effect => {
    const definitionId = effect.definitionId.replace(/:(?:modifiers:\d+|extension|marker)$/, '')
    return effect.source.actorId === actorId && (definitionId === binding.effectId || definitionId.endsWith(`:${binding.effectId}`)) &&
      dnd5eGroundItemEffectIsLive(state, effect)
  })).map(([id]) => id)
  const origins = [...holders.map(holder => holder.id), ...ground]
  return origins.length === 1 ? origins[0] : undefined
}

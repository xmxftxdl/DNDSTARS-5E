import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import { dnd5ePersistentAreaEffectMatchesOrigin } from './persistentAreaConditionEffects'

/** A newly armed trap survives; a triggered trap ends only after its last captive is released. */
export function reconcileDnd5eTriggeredAreaLifetimes(map: BattleMap, characters: readonly Character[], roomMaps: readonly BattleMap[] = [map]): BattleMap {
  const maps = [map, ...roomMaps.filter(other => other.id !== map.id)]
  const knownTokens = new Set(maps.flatMap(other => other.tokens.map(token => token.id)))
  const characterIds = new Set(characters.map(character => character.id))
  const effects = [
    ...characters.flatMap(character => normalizeDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)),
    ...maps.flatMap(other => other.tokens.flatMap(token => token.characterId && characterIds.has(token.characterId) && !token.dnd5eSimulacrum
      ? [] : normalizeDnd5eActiveEffects(token.dnd5eCombatState?.activeEffects))),
  ]
  const next = map.dnd5ePluginAreas?.filter(area => {
    const terminating = area.triggers?.filter(trigger => trigger.endAreaWhenNoBoundConditions) ?? []
    if (!terminating.length) return true
    const ids = new Set(terminating.map(trigger => trigger.frequencyGroupId ?? trigger.id))
    const receipts = area.triggerReceipts?.filter(receipt => ids.has(receipt.triggerId) && receipt.declined !== true) ?? []
    if (!receipts.length) return true
    if (effects.some(effect => effect.standardCondition === 'restrained' && effect.source.actorId === area.sourceTokenId &&
      effect.areaLifetime?.mapId === map.id && effect.areaLifetime.areaId === area.id &&
      dnd5ePersistentAreaEffectMatchesOrigin(effect, area.id))) return true
    // Missing remote roster is not evidence that a captive ceased to exist.
    if (receipts.some(receipt => !knownTokens.has(receipt.targetTokenId))) return true
    return false
  })
  return next?.length === map.dnd5ePluginAreas?.length ? map : { ...map, dnd5ePluginAreas: next }
}

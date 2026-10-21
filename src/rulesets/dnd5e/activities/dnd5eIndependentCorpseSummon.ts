import type { Token } from '../../../store/maps'
import type { Dnd5eActivityAuthorityHandoffs } from '../headlessCombatEngine'

/** Attribution only: never reinsert a departed actor into the map. */
export type Dnd5eDelayedSourceIdentity = Pick<Token, 'id' | 'characterId' | 'type' | 'label' | 'emoji' | 'color'>

export function isIndependentCorpseSummon(handoffs: Dnd5eActivityAuthorityHandoffs): boolean {
  return handoffs.summons.length > 0 && handoffs.summons.every(summon =>
    summon.independentPersistent === true && summon.persistent === true && !summon.concentration && !summon.bondKey &&
    summon.sourceDeathBehavior !== 'die' && !!summon.afterDamageKillOperationId && !!summon.corpseTokenId && summon.count === 1) &&
    Object.entries(handoffs).every(([key,value]) => key === 'summons' || !Array.isArray(value) || value.length === 0)
}

export function validDelayedSourceIdentity(value: Dnd5eDelayedSourceIdentity | undefined, actorId: string): value is Dnd5eDelayedSourceIdentity {
  return !!value && value.id === actorId && ['player','enemy'].includes(value.type) &&
    ['id','label','emoji','color'].every(key => typeof value[key as keyof Dnd5eDelayedSourceIdentity] === 'string') &&
    (value.characterId == null || typeof value.characterId === 'string')
}

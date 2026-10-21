import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eActivePlanarPhase, effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eMapPlaneRelation } from './mapPlane'

/** Host-owned scene data only. Knowing a position does not grant sight or line of effect. */
export function dnd5eSourceKnowsTargetLocation(input: {
  observerMap: BattleMap; observer: Token; targetMap: BattleMap; target: Token
  characters: readonly Character[]
}): boolean {
  const { observerMap, observer, targetMap, target, characters } = input
  if (observer.type === 'obstacle' || target.type === 'obstacle' ||
    dnd5eMapPlaneRelation(observerMap, targetMap) !== 'same') return false
  const effectsFor = (token: Token) => {
    const character = token.characterId ? characters.find(entry => entry.id === token.characterId) : undefined
    return effectiveDnd5eActiveEffects(character?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects)
  }
  if ([observer, target].some(token => token.characterId && !characters.some(character => character.id === token.characterId))) return false
  const observerEffects = effectsFor(observer), targetEffects = effectsFor(target)
  if ([...observerEffects, ...targetEffects].some(effect => effect.legacyCondition === 'banished')) return false
  if ((dnd5eActivePlanarPhase(observerEffects).plane === 'ethereal') !==
    (dnd5eActivePlanarPhase(targetEffects).plane === 'ethereal')) return false
  return targetEffects.some(effect => effect.modifiers?.locationKnownToSource === true &&
    (effect.source.characterId != null
      ? effect.source.characterId === observer.characterId
      : effect.source.actorId === observer.id || (observer.characterId != null && effect.source.actorId === observer.characterId)))
}


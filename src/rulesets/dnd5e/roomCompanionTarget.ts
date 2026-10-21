import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eActivePlanarPhase, effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eMapPlaneRelation } from './mapPlane'

/** Host room lookup, independent of which scene the player currently sees.
 * These arguments must come from the Host store, never client map payloads. */
export function resolveDnd5eRoomCompanionTarget(input: {
  maps: readonly BattleMap[]; characters: readonly Character[]
  actorMapId: string; actorTokenId: string; targetMapId: string; targetTokenId: string
  packageId: string; sourceActivityId: string; bondKey: string
}): { ok: true; actorMap: BattleMap; targetMap: BattleMap; actor: Token; target: Token } |
  { ok: false; reason: 'invalid-target' | 'plane-unknown' | 'different-plane' } {
  const actorMaps = input.maps.filter(map => map.id === input.actorMapId)
  const targetMaps = input.maps.filter(map => map.id === input.targetMapId)
  if (actorMaps.length !== 1 || targetMaps.length !== 1) return { ok: false, reason: 'invalid-target' }
  const actorMap = actorMaps[0], targetMap = targetMaps[0]
  const actors = actorMap.tokens.filter(token => token.id === input.actorTokenId)
  const targets = targetMap.tokens.filter(token => token.id === input.targetTokenId)
  if (actors.length !== 1 || targets.length !== 1) return { ok: false, reason: 'invalid-target' }
  const actor = actors[0], target = targets[0], summon = target.dnd5eSummon
  if (actor.type === 'obstacle' || target.type === 'obstacle' || !summon ||
    summon.pluginId !== input.packageId || summon.featureId !== input.sourceActivityId || summon.bondKey !== input.bondKey ||
    (actor.characterId ? summon.sourceCharacterId !== actor.characterId :
      actorMap.id !== targetMap.id || summon.sourceTokenId !== actor.id)) return { ok: false, reason: 'invalid-target' }
  const character = (token: Token) => token.characterId ? input.characters.find(entry => entry.id === token.characterId) : undefined
  if ([actor, target].some(token => token.characterId && !character(token))) return { ok: false, reason: 'invalid-target' }
  const targetCharacter = character(target)
  const hp = targetCharacter?.currentHp ?? target.hp ?? target.maxHp
  if (hp == null || !Number.isFinite(hp) || (hp <= 0 && (targetCharacter
    ? (targetCharacter.deathSaveFailures ?? 0) >= 3 : target.dnd5eCombatState?.deathRound != null))) return { ok: false, reason: 'invalid-target' }
  const effects = (token: Token) => character(token)?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects
  // Banishment does not identify a destination plane, so never guess.
  if ([actor, target].some(token => effectiveDnd5eActiveEffects(effects(token)).some(effect => effect.legacyCondition === 'banished'))) {
    return { ok: false, reason: 'plane-unknown' }
  }
  const relation = dnd5eMapPlaneRelation(actorMap, targetMap)
  if (relation !== 'same') return { ok: false, reason: relation === 'unknown' ? 'plane-unknown' : 'different-plane' }
  const ethereal = (token: Token) => dnd5eActivePlanarPhase(effects(token)).plane === 'ethereal'
  if (ethereal(actor) !== ethereal(target)) return { ok: false, reason: 'different-plane' }
  return { ok: true, actorMap, targetMap, actor, target }
}

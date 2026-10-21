import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'

/** Unknown attachment/carrying facts do not certify a loose scene rock. */
export function dnd5ePersistentAreaLooseRocks(map: BattleMap, area: Dnd5ePluginArea): Token[] {
  return map.tokens.filter(token => token.type === 'obstacle' && !token.dnd5eSpellEffect &&
    token.dnd5eObjectState?.naturalFeature === 'rock' && token.dnd5eObjectState.attached === false &&
    token.dnd5eObjectState.wornOrCarried === false && (token.hp == null || token.hp > 0) &&
    dnd5eTokenIntersectsPersistentAreaAt(token, map, area, token))
}

/** Read the selected object from the authoritative scene, never client coordinates. */
export function dnd5eActivityMappedRockOrigin(input: {
  state: import('./headlessCombatEngine').Dnd5eHeadlessCombatState
  actorId: string; activityId: string; areaId?: string; payload?: unknown
}): Token | undefined {
  const scene = input.state.companionScene
  const raw = input.payload
  const id = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>).mappedObjectOriginTokenId : undefined
  if (!scene || typeof id !== 'string') return undefined
  const area = scene.map.dnd5ePluginAreas?.find(candidate => candidate.id === input.areaId &&
    candidate.sourceTokenId === input.actorId && !candidate.modeState?.paused &&
    (candidate.permanent || input.state.round <= candidate.expiresAfterRound) &&
    (scene.worldMinute == null || candidate.expiresAtWorldMinute == null || scene.worldMinute < candidate.expiresAtWorldMinute) &&
    candidate.grantedActivities?.some(grant => grant.activityId === input.activityId))
  return area ? dnd5ePersistentAreaLooseRocks(scene.map, area).find(rock => rock.id === id) : undefined
}

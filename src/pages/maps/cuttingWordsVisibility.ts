import { mapGeometryCanSeeToken, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'

/**
 * Cutting Words requires its bard to see the creature making the roll. Keep
 * this separate from target visibility: the bard may use it while they are
 * themselves the target, but never through a wall or in darkness they cannot
 * see through.
 */
export function dnd5eCuttingWordsCanSeeAttacker(input: {
  map: BattleMap
  bardToken: Token
  attackerToken: Token
}): boolean {
  return mapGeometryCanSeeToken({
    geometry: mapGeometryRuntimeForMap(input.map.id),
    map: input.map,
    viewer: input.bardToken,
    target: input.attackerToken,
    forceEnabled: true,
    fallbackRangeFeet: 60,
  })
}

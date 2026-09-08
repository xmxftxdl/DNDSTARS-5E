import { cellKey, tokenOccupiedCellsAt } from '../../lib/gridCombat'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'

/**
 * Effect-token areas such as Arcane Hand can deliberately occupy the same
 * squares as the creature they are controlling.  Konva then reports the
 * later-rendered effect token for a click on that stack.  During a granted
 * creature-targeting action, tunnel that click through the area's own effect
 * token to the closest creature sharing its footprint.
 */
export function resolvePersistentAreaCreatureTarget(
  map: BattleMap,
  area: Pick<Dnd5ePluginArea, 'anchorTokenId'> | undefined,
  clickedTokenId: string,
): Token | undefined {
  const clicked = map.tokens.find((token) => token.id === clickedTokenId)
  if (!clicked || clicked.type !== 'obstacle' || area?.anchorTokenId !== clicked.id) return clicked

  const occupied = new Set(tokenOccupiedCellsAt(clicked, map, clicked).map(cellKey))
  return map.tokens
    .filter((candidate) =>
      candidate.type !== 'obstacle' &&
      tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => occupied.has(cellKey(cell))))
    .sort((left, right) =>
      Math.hypot(left.x - clicked.x, left.y - clicked.y) -
      Math.hypot(right.x - clicked.x, right.y - clicked.y))[0] ?? clicked
}

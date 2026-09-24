import type { Token } from '../../store/maps'
import { getDnd5eSrdMonster } from './monsters'

/** Web Walker ignores web movement restrictions, not the fire burning in them. */
export function dnd5eTokenHasWebWalker(token: Token): boolean {
  const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  return monster?.traits.some((trait) =>
    ['web walker', '蛛网行者'].includes(trait.name.trim().toLowerCase())) ?? false
}

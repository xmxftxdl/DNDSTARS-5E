import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { Token } from '../../store/maps'
import { dnd5eActivePerceivesVisibleCreaturesAsHostile } from './activeEffects'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot } from './mapBridge'

/** Lazily resolves perceived hostility from Host sight, preserving actual sides and ownership. */
export function createDnd5eMapHostilityView(input: Parameters<typeof createDnd5eMapCombatSnapshot>[0] & { actorToken: Token }) {
  let snapshot: ReturnType<typeof createDnd5eMapCombatSnapshot> | undefined
  const actor = input.characters.find(character => character.id === input.actorToken.characterId)
  const altered = dnd5eActivePerceivesVisibleCreaturesAsHostile(actor?.dnd5eCombatState?.activeEffects ?? input.actorToken.dnd5eCombatState?.activeEffects)
  return (target: Token): boolean => {
    if (target.id === input.actorToken.id) return false
    if (areOpposedCombatTokens(input.actorToken, target)) return true
    if (!altered || target.type === 'obstacle') return false
    snapshot ??= createDnd5eMapCombatSnapshot({ ...input,
      additionalCreatureTokenIds: input.map.tokens.filter(token => token.type !== 'obstacle').map(token => token.id) })
    return dnd5eCombatantCanSee(snapshot.state, input.actorToken.id, target.id)
  }
}

import type { BattleMap, Token } from '../../store/maps'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { dnd5eMapTokenDistanceFeet } from '../../rulesets/dnd5e/verticalCombatGeometry'
import type { Dnd5eSustainedSpellAttackDefinition } from '../../rulesets/dnd5e/spells'

export type Dnd5eMapSpellTargetContract =
  | { kind: 'self' }
  | {
      kind: 'creature'
      relation: 'ally' | 'enemy' | 'any'
      includeSelf?: boolean
      rangeFeet?: number
    }

/**
 * Sustained controls target by the follow-up action, not by the original
 * spell's target. Flame Blade is cast on self, then attacks an enemy within
 * 5 feet; reusing the spell-level `ally` contract would offer targets that
 * the Host must reject.
 */
export function dnd5eSustainedSpellTargetContract(
  sustainedAttack: Dnd5eSustainedSpellAttackDefinition | undefined,
): Dnd5eMapSpellTargetContract | undefined {
  if (!sustainedAttack) return undefined
  return {
    kind: 'creature',
    relation: sustainedAttack.relation === 'any' ? 'any' : 'enemy',
    includeSelf: sustainedAttack.relation === 'any',
    rangeFeet: sustainedAttack.rangeFeet,
  }
}

/**
 * Mirrors the Host's relation check in the visible target picker. The Host
 * still revalidates every submitted id, but the player should never be offered
 * a friendly creature for an enemy-only spell (or vice versa).
 */
export function dnd5eMapSpellTargetOptions(input: {
  tokens: readonly Token[]
  actorToken: Token | undefined
  contract: Dnd5eMapSpellTargetContract | undefined
  map?: BattleMap
  unavailableTokenIds?: ReadonlySet<string>
  /** Optional spell-specific eligibility already derived from Host-owned token state. */
  eligibleTokenIds?: ReadonlySet<string>
  /** Map geometry projection used to hide targets the caster cannot affect. */
  hasLineOfEffect?: (actorToken: Token, targetToken: Token) => boolean
}): Token[] {
  const creatures = input.tokens.filter((token) =>
    token.type !== 'obstacle' &&
    !input.unavailableTokenIds?.has(token.id) &&
    (input.eligibleTokenIds == null || input.eligibleTokenIds.has(token.id)))
  if (!input.actorToken || !input.contract) return creatures
  const actorToken = input.actorToken
  const contract = input.contract
  if (contract.kind === 'self') {
    return creatures.filter((token) => token.id === actorToken.id)
  }
  return creatures.filter((token) => {
    if (token.id === actorToken.id && contract.includeSelf !== true) {
      return false
    }
    const opposed = areOpposedCombatTokens(actorToken, token)
    if (contract.relation === 'enemy' && !opposed) return false
    if (contract.relation === 'ally' && opposed) return false
    if (input.hasLineOfEffect && !input.hasLineOfEffect(actorToken, token)) return false
    if (contract.rangeFeet != null && input.map &&
      dnd5eMapTokenDistanceFeet({
        map: input.map, left: actorToken, right: token,
      }) > contract.rangeFeet) return false
    return true
  })
}

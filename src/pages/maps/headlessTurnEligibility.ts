import { dnd5eClassDefinitionForCharacter, getDnd5eSrdMonster } from '../../rulesets/dnd5e'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'

/**
 * A linked map token is not automatically a Headless 5e combatant. Generic
 * test/legacy characters must use ordinary initiative advancement instead of
 * being sent through a 5e end-turn transaction that will reject them.
 */
export function dnd5eCombatantHasHeadlessTurnRules(input: {
  token?: Pick<Token, 'poolId'>
  character?: Pick<Character, 'charClass'>
}): boolean {
  return (
    (!!input.character && dnd5eClassDefinitionForCharacter(input.character) != null) ||
    (!!input.token?.poolId && getDnd5eSrdMonster(input.token.poolId) != null)
  )
}

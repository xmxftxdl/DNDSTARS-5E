import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { getDnd5eSrdMonster } from './monsters'

/** Resolves every authoritative creature-type identity a manual condition source can expose. */
export function dnd5eConditionSourceCreatureTypes(
  token: Token,
  character?: Character,
): string[] {
  const formId = character?.dnd5eCombatState?.wildShapeFormId ??
    token.dnd5eCombatState?.wildShapeFormId
  const formType = formId ? getDnd5eSrdMonster(formId)?.creatureType : undefined
  const monsterType = token.poolId ? getDnd5eSrdMonster(token.poolId)?.creatureType : undefined
  return [...new Set([
    ...(formType ? [formType] : []),
    ...(token.creatureTypes ?? []),
    ...(monsterType ? [monsterType] : []),
    ...(character && !formType ? ['humanoid', '类人生物'] : []),
  ].map((value) => value.trim()).filter(Boolean))]
}

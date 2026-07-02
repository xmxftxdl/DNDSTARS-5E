import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import { canUseDoubleArrow } from './classFeatures'
import { isTokenAlive } from './combatTokens'
import { getSkillAoeTargeting } from './skillTargeting'
import type { SharedPlayerActionState } from './sharedCombatTypes'

export type PlayerAttackPrepareResult =
  | {
      ok: true
      actor: Character
      skill: CombatSkill
      targets: Token[]
      targetIds: string[]
      waiveAp: boolean
      doubleArrow: boolean
      isArrowSequence: boolean
    }
  | {
      ok: false
      reason: 'invalid-attack' | 'insufficient-ap'
    }

export function preparePlayerAttackAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: Character[]
}): PlayerAttackPrepareResult {
  const { action, map, characters } = input
  const actor = characters.find((character) => character.id === action.characterId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  const targetIds = action.targetTokenIds?.length
    ? action.targetTokenIds
    : action.targetTokenId
      ? [action.targetTokenId]
      : []
  const initialTargets = targetIds
    .map((targetId) => map.tokens.find((token) => token.id === targetId))
    .filter((target): target is Token => !!target)

  if (
    action.type !== 'attack-token' ||
    !actor ||
    !skill ||
    getSkillAoeTargeting(skill) ||
    initialTargets.length === 0 ||
    initialTargets.some((target) => !isTokenAlive(target, characters))
  ) {
    return { ok: false, reason: 'invalid-attack' }
  }

  const waiveAp = !!actor.combatBuffs?.galeComboReady
  if (!waiveAp && actor.currentAP < skill.apCost) return { ok: false, reason: 'insufficient-ap' }

  const doubleArrow = canUseDoubleArrow(actor, skill) && !!actor.combatBuffs?.doubleArrowReady
  const targets = expandRepeatedAttackTargets(skill, initialTargets)
  const isArrowSequence =
    skill.skillTreeId === 'multiShot' ||
    skill.skillTreeId === 'encircle' ||
    (!!action.targetTokenIds?.length && skill.skillTreeId === 'rageShot')

  return {
    ok: true,
    actor,
    skill,
    targets,
    targetIds,
    waiveAp,
    doubleArrow,
    isArrowSequence,
  }
}

function expandRepeatedAttackTargets(skill: CombatSkill, targets: Token[]): Token[] {
  if ((skill.skillTreeId === 'multiShot' || skill.skillTreeId === 'encircle') && targets.length === 1) {
    const shots = Math.max(1, skill.arrowShots ?? 1)
    return Array.from({ length: shots }, () => targets[0])
  }
  return targets
}

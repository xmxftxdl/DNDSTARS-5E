import { dnd5eAbilityCheckRollMode, dnd5eSkillProficiencyRank, type Dnd5eCombatant } from '../headlessCombatEngine'
import { dnd5eClassDefinition } from '../classes'
import { getDnd5eSrdMonster } from '../monsters'
import { dnd5eOpposedCheckSourceAbility, dnd5eOpposedSourceSkill } from './dnd5eFormula'
import type { Dnd5eActivityCheckV1 } from './dnd5eActivityContracts'
import { SKILLS } from '../../../lib/dnd'

type OpposedCheck = Extract<Dnd5eActivityCheckV1, { kind: 'opposed-ability-check' }>

/** Use the same best-modifier defense for dice presentation and final settlement. Ties keep declaration order. */
export function dnd5eOpposedHostCheckOptions(check: OpposedCheck, actor: Dnd5eCombatant, target: Dnd5eCombatant) {
  const modifier = (option: OpposedCheck['targetOptions'][number]) => {
    // The executor reads the Host's standard skill modifier when a skill is
    // present; match that snapshot rather than silently substituting an ability.
    const ability = option.skill ? SKILLS.find(skill => skill.key === option.skill)?.ability ?? option.ability : option.ability
    return Math.floor((target.abilities[ability] - 10) / 2) +
      target.proficiencyBonus * dnd5eSkillProficiencyRank(target, option.skill)
  }
  return {
    source: { ability: dnd5eOpposedCheckSourceAbility(check.sourceAbility, {
      spellcastingAbility: (actor.classId ? dnd5eClassDefinition(actor.classId)?.spellcasting?.ability : undefined) ??
        (actor.statBlockId ? getDnd5eSrdMonster(actor.statBlockId)?.spellcasting?.ability : undefined),
    }), skill: dnd5eOpposedSourceSkill(check) },
    target: check.targetOptions.reduce((best, candidate) => modifier(candidate) > modifier(best) ? candidate : best, check.targetOptions[0]!),
  }
}

export function dnd5eOpposedHostRollModes(check: OpposedCheck, actor: Dnd5eCombatant, target: Dnd5eCombatant) {
  const options = dnd5eOpposedHostCheckOptions(check, actor, target)
  const sizeMode = check.sourceRollModeByTargetSizeRank &&
    (check.sourceRollModeByTargetSizeRank.minimum == null || target.sizeRank >= check.sourceRollModeByTargetSizeRank.minimum) &&
    (check.sourceRollModeByTargetSizeRank.maximum == null || target.sizeRank <= check.sourceRollModeByTargetSizeRank.maximum)
    ? check.sourceRollModeByTargetSizeRank.mode : undefined
  const sourceFlags = [check.sourceRollMode, sizeMode]
  const opposedFlags = sourceFlags.includes('advantage') && sourceFlags.includes('disadvantage')
  const requestedSourceMode = sourceFlags.includes('advantage') ? 'advantage' : sourceFlags.includes('disadvantage') ? 'disadvantage' : 'normal'
  return {
    // Any advantage and any disadvantage cancel, regardless of how many
    // sources there are. Pass requested flags before Host flags collapse.
    source: opposedFlags ? 'normal' as const : dnd5eAbilityCheckRollMode(actor, { ...options.source, requestedMode: requestedSourceMode }),
    target: dnd5eAbilityCheckRollMode(target, { ...options.target,
      requestedMode: check.targetRollMode === 'host-derived' ? undefined : check.targetRollMode }),
  }
}

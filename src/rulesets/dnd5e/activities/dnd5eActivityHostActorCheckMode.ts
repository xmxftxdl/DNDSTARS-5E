import { dnd5eAbilityCheckRollMode, dnd5eCombatantHasConcentrationCheckAdvantage, type Dnd5eCombatant } from '../headlessCombatEngine'
import { dnd5eSavingThrowMode } from '../passiveDefenses'
import { resolveDnd5eRollMode } from '../rollMode'
import type { Dnd5eActivityCheckV1 } from './dnd5eActivityContracts'

export function dnd5eActivityHostActorCheckModeV1(
  actor: Dnd5eCombatant,
  check: Extract<Dnd5eActivityCheckV1, { kind: 'ability-check' | 'skill-check' | 'concentration-check' }>,
) {
  if (check.kind !== 'concentration-check') return dnd5eAbilityCheckRollMode(actor, {
    ability: check.ability, skill: check.kind === 'skill-check' ? check.skill : undefined,
  })
  const base = dnd5eSavingThrowMode(actor, check.ability, { effectVisible: true })
  return resolveDnd5eRollMode({
    advantage: [{ active: base === 'advantage' || dnd5eCombatantHasConcentrationCheckAdvantage(actor), reason: 'concentration' }],
    disadvantage: [{ active: base === 'disadvantage' || actor.classState.concentrationCheckDisadvantagePendingSourceId != null, reason: 'concentration' }],
  }).mode
}

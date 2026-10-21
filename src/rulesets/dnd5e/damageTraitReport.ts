import { dnd5eActiveSpellTargetingImmunitySchools, dnd5eActiveSubmerged, dnd5eHasActiveSpellRuleState, effectiveDnd5eActiveEffects, normalizeDnd5eActiveEffects } from './activeEffects'
import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { Dnd5eConditionalDamageDefense } from './damageDefenses'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import { dnd5eSourceAuraRequirementSatisfied } from './sourceAuraRequirement'
import { dnd5eClassStateDamageResistance } from './classStateDamageResistance'
import { dnd5eCreaturePeaceProtectionFeatures } from './creaturePeaceProtectionFeatures'

/** Public facts only: internal feature identifiers are never part of the report. */
export interface Dnd5eDamageTraitReport {
  immunities: Dnd5eDamageType[]
  resistances: Dnd5eDamageType[]
  vulnerabilities: Dnd5eDamageType[]
  conditional: (Omit<Dnd5eConditionalDamageDefense, 'reason'> & { attackOnly?: true; sourceCreatureProtection?: true })[]
}

export interface Dnd5eDamageTraitReceipt {
  targetId: string
  targetName?: string
  mapId?: string
  sourceActivityId: string
  round: number
  report: Dnd5eDamageTraitReport
}

/** Called only inside an authorized Activity transaction, never from client facts. */
export function recordDnd5eDeclaredDamageTraitReport(
  state: Dnd5eHeadlessCombatState, actorId: string, targetId: string, sourceActivityId: string,
): boolean {
  const actor = state.combatants[actorId], target = state.combatants[targetId]
  if (!actor || !target) return false
  actor.classState.damageTraitReports = {
    ...actor.classState.damageTraitReports,
    [sourceActivityId]: { targetId, targetName: target.name, mapId: state.mapId, sourceActivityId, round: state.round,
      report: readDnd5eDeclaredDamageTraitReport(target, { state, targetId }) },
  }
  return true
}

/**
 * Reads the Host's declared damage defenses. Callers must authorize visibility,
 * range and resource spending before publishing this private result.
 * Dynamic situational defenses must be projected by the Host before this read.
 */
export function readDnd5eDeclaredDamageTraitReport(
  target: Pick<Dnd5eCombatant, 'classState' | 'damageImmunities' | 'damageResistances' | 'damageVulnerabilities' | 'damageDefenseRules'>,
  context?: { state: Dnd5eHeadlessCombatState; targetId: string },
): Dnd5eDamageTraitReport {
  const empty = (): Dnd5eDamageTraitReport => ({
    immunities: [], resistances: [], vulnerabilities: [], conditional: [],
  })
  const effects = effectiveDnd5eActiveEffects(normalizeDnd5eActiveEffects(target.classState.activeEffects))
  if (dnd5eActiveSpellTargetingImmunitySchools(effects).includes('divination')) return empty()
  const report: Dnd5eDamageTraitReport = {
    immunities: [...new Set(target.damageImmunities)],
    resistances: [...new Set(target.damageResistances)],
    vulnerabilities: [...new Set(target.damageVulnerabilities)],
    conditional: target.damageDefenseRules.map(rule => ({
      outcome: rule.outcome,
      ...(rule.damageTypes ? { damageTypes: [...rule.damageTypes] } : {}),
      ...(rule.delivery != null ? { delivery: rule.delivery } : {}),
      ...(rule.magical != null ? { magical: rule.magical } : {}),
      ...(rule.weaponMaterialNot != null ? { weaponMaterialNot: rule.weaponMaterialNot } : {}),
      ...(rule.sourceMoralAlignment != null ? { sourceMoralAlignment: rule.sourceMoralAlignment } : {}),
    })),
  }
  const suppressed = new Set(effects.flatMap(effect =>
    effect.modifiers?.suppressDamageResistance ? [effect.modifiers.suppressDamageResistance] : []))
  const combatant = context?.state.combatants[context.targetId]
  if (combatant) {
    if (dnd5eCreaturePeaceProtectionFeatures(combatant).length)
      report.conditional.push({ outcome: 'resistant', sourceCreatureProtection: true })
    report.resistances.push(...DND5E_DAMAGE_TYPES.filter(type => dnd5eClassStateDamageResistance(combatant, type)))
    if (combatant.classState.monsterLegendaryMovement?.temporaryDamageImmunity === 'all')
      report.immunities.push(...DND5E_DAMAGE_TYPES)
    if (combatant.spellDamageResistance)
      report.conditional.push({ outcome: 'resistant', delivery: 'spell' })
  }
  if (dnd5eActiveSubmerged(effects)) report.resistances.push('fire')
  if (dnd5eHasActiveSpellRuleState(effects, 'mind-blank', 'damage-immunity')) report.immunities.push('psychic')
  if (dnd5eHasActiveSpellRuleState(effects, 'stoneskin', 'damage-resistance'))
    report.conditional.push({ outcome: 'resistant', damageTypes: ['bludgeoning', 'piercing', 'slashing'], magical: false })
  for (const effect of effects) {
    const modifier = effect.modifiers
    if (modifier?.damageImmunity) report.immunities.push(modifier.damageImmunity)
    if (modifier?.damageResistance) report.resistances.push(modifier.damageResistance)
    if (modifier?.damageVulnerability) report.vulnerabilities.push(modifier.damageVulnerability)
    if (modifier?.resistanceToAllDamage) report.resistances.push(...DND5E_DAMAGE_TYPES)
    if (modifier?.vulnerabilityToAllDamage) report.vulnerabilities.push(...DND5E_DAMAGE_TYPES)
    for (const rule of modifier?.conditionalDamageResistances ?? []) {
      if (rule.sourceAura && (!context || !dnd5eSourceAuraRequirementSatisfied(
        context.state, effect.source.actorId, context.targetId, rule.sourceAura,
      ))) continue
      for (const delivery of rule.deliveries ?? [undefined]) {
        report.conditional.push({
          outcome: 'resistant', damageTypes: [...rule.damageTypes],
          ...(delivery ? { delivery } : {}),
          ...(rule.sourceMagical != null ? { magical: rule.sourceMagical } : {}),
          ...(rule.attackOnly ? { attackOnly: true } : {}),
        })
      }
    }
  }
  report.immunities = [...new Set(report.immunities)]
  report.vulnerabilities = [...new Set(report.vulnerabilities)]
  report.resistances = [...new Set(report.resistances)].filter(type => !suppressed.has(type))
  report.conditional = report.conditional.flatMap(rule => {
    if (rule.outcome !== 'resistant' || !suppressed.size) return [rule]
    const damageTypes = (rule.damageTypes ?? DND5E_DAMAGE_TYPES).filter(type => !suppressed.has(type))
    return damageTypes.length ? [{ ...rule, damageTypes }] : []
  })
  return report
}

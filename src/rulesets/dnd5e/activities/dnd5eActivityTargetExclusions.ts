import { dnd5eActivityCreatureTypeMatches } from '../creatureTypeMatching'
export { dnd5eActivityCreatureTypeMatches } from '../creatureTypeMatching'
import { dnd5eStandardConditionId, type Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eActivityTargetV1 } from './dnd5eActivityContracts'
import type { AbilityKey } from '../../../lib/dnd'
import { dnd5eConditionImmuneFromSource } from '../passiveDefenses'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

/** Derive only requested exclusions from live Host defenses, including temporary/source-relative immunity. */
export function dnd5eActivityTargetImmunities(activity: Dnd5eActivityDefinitionV1,
  target: Parameters<typeof dnd5eConditionImmuneFromSource>[0],
  source: Parameters<typeof dnd5eConditionImmuneFromSource>[2],
): readonly Dnd5eStandardConditionId[] {
  const exclusions = activity.target.kind === 'self' ? [] : activity.target.excludedConditionImmunities ?? []
  const automaticSuccessConditions = (activity.checks ?? []).flatMap(check =>
    check.kind === 'saving-throw' && check.automaticSuccessIfConditionImmune
      ? [check.automaticSuccessIfConditionImmune] : [])
  return [...new Set([...((target.conditionImmunities ?? []).flatMap(value => { const condition = dnd5eStandardConditionId(value); return condition ? [condition] : [] })), ...[...exclusions, ...automaticSuccessConditions].filter(condition =>
    dnd5eConditionImmuneFromSource(target, condition, source,
      { sourceMagical: activity.legacySource?.kind === 'spell' ? true : undefined }))])]
}

/** Called with Host snapshots both before requesting dice and during execution. */
export function dnd5eActivityExcludesTarget(target: Dnd5eActivityTargetV1, creature: {
  creatureType?: string
  elevationFeet?: number
  groundElevationFeet?: number
  abilities?: Partial<Record<AbilityKey, number>>
  conditionImmunities?: readonly string[]
}): boolean {
  if (dnd5eActivityExcludesCreatureType(target, creature.creatureType)) return true
  if (target.kind === 'self') return false
  if (target.kind === 'area' && target.requiresGroundContact) {
    if (!Number.isFinite(creature.elevationFeet) || !Number.isFinite(creature.groundElevationFeet)) throw new Error('activity-target-ground-contact-missing')
    if (Math.abs(creature.elevationFeet! - creature.groundElevationFeet!) > 1e-4) return true
  }

  if (target.excludedConditionImmunities?.length) {
    if (!Array.isArray(creature.conditionImmunities)) throw new Error('activity-target-condition-immunities-missing')
    if (target.excludedConditionImmunities.some(condition => creature.conditionImmunities!.includes(condition))) return true
  }
  let excluded = false
  for (const [bounds, minimum] of [[target.minimumAbilityScores, true], [target.maximumAbilityScores, false]] as const) {
    for (const [key, threshold] of Object.entries(bounds ?? {})) {
      const score = creature.abilities?.[key as AbilityKey]
      // Missing authoritative facts are an error, not evidence of immunity.
      if (!Number.isInteger(score) || score! < 0 || score! > 30) throw new Error(`activity-target-ability-missing:${key}`)
      if (minimum ? score! < threshold : score! > threshold) excluded = true
    }
  }
  return excluded
}

/** Compare authoritative creature types, never names supplied by a client. */
export function dnd5eActivityExcludesCreatureType(target: Dnd5eActivityTargetV1, creatureType?: string): boolean {
  if (target.kind === 'self' || !creatureType) return false
  return target.excludedCreatureTypes?.some(type => dnd5eActivityCreatureTypeMatches(type, creatureType)) === true
}

/** Imported types and the localized SRD catalog describe the same Host fact. */



/** Radial ground effects measure the ground itself, rather than a creature's head or an infinite column. */
export function dnd5eActivityGroundWithinVerticalRange(target: Dnd5eActivityTargetV1, originElevationFeet: number, groundElevationFeet: number): boolean {
  if (target.kind !== 'area' || !target.requiresGroundContact || (target.shape !== 'circle' && target.shape !== 'sphere')) return true
  if (!Number.isFinite(originElevationFeet) || !Number.isFinite(groundElevationFeet)) throw new Error('activity-ground-range-height-missing')
  return Math.abs(originElevationFeet-groundElevationFeet) <= (target.radiusFeet ?? 0)+1e-4
}

/** A missing Host type cannot safely choose between distinct save branches. */
export function dnd5eActivitySaveExcludesCreatureType(check: { excludedCreatureTypes?: readonly string[] }, creatureType?: string): boolean {
  if (!check.excludedCreatureTypes?.length) return false
  if (!creatureType?.trim()) throw new Error('activity-save-creature-type-missing')
  return check.excludedCreatureTypes.some(type => dnd5eActivityCreatureTypeMatches(type, creatureType))
}

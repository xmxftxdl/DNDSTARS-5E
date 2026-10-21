import { dnd5eActivityCommunicationSaveSucceeds } from './dnd5eActivityCommunicationSave'
import { dnd5eCombatantCanHearSource } from '../audibility'
import type { D20RollMode } from '../../contracts'
import { dnd5eCombatantEnvironmentalImmunities, type Dnd5eEnvironmentalHazard } from '../environmentalProtection'
import { dnd5eActivityAttackAbility } from './dnd5eAttackAbility'
import { dnd5eOpposedHostRollModes } from './dnd5eActivityOpposedChecks'
import { dnd5eActivitySaveExcludesCreatureType, dnd5eActivityExcludesTarget, dnd5eActivityTargetImmunities, dnd5eActivityCreatureTypeMatches } from './dnd5eActivityTargetExclusions'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { dnd5eFleshToStoneTargetHasFlesh } from '../fleshToStone'
import { dnd5eSavingThrowMode } from '../passiveDefenses'
import type {
  Dnd5ePluginDiceRollDeclaration,
  Dnd5ePluginPerTargetDiceRollDeclaration,
} from '../plugins/pluginHeadlessContracts'
import type { Dnd5eActivityCheckV1, Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

export interface Dnd5eActivityRollTargetV1 {
  id: string
  statBlockId?: string
  name?: string
  controller?: 'player' | 'players' | 'dm'
  creatureType?: string
  conditionImmunities?: readonly string[]
  environmentalImmunities?: readonly Dnd5eEnvironmentalHazard[]
  abilities?: Partial<Record<AbilityKey, number>>
  sizeRank?: number
  /** Host-derived source-relative audibility for effects that only affect hearers. */
  canHearActivitySource?: boolean
  languages?: readonly string[]
  elevationFeet?: number
  groundElevationFeet?: number
}

function activityTargetNeedsPerTargetRoll(
  activity: Dnd5eActivityDefinitionV1,
  target: Dnd5eActivityRollTargetV1,
): boolean {
  if (dnd5eActivityExcludesTarget(activity.target, target)) return false
  // Divine Word lets the caster select any visible creature, but only a
  // creature that can hear the word makes the Charisma save. Keep the target
  // in the submitted selection while omitting its inapplicable dice request.
  if (
    activity.legacySource?.kind === 'spell' &&
    activity.legacySource.id === 'divine-word' &&
    target.canHearActivitySource === false
  ) return false
  // Flesh to Stone can be cast on any creature, but a non-flesh body does
  // not make the initial save and receives none of the spell's effects.
  if (
    activity.legacySource?.kind === 'spell' &&
    activity.legacySource.id === 'flesh-to-stone' &&
    !dnd5eFleshToStoneTargetHasFlesh(target)
  ) return false
  return true
}

function combineRollModes(modes: readonly (D20RollMode | undefined)[]): D20RollMode {
  const active = modes.filter((mode): mode is Exclude<D20RollMode, 'normal'> =>
    mode === 'advantage' || mode === 'disadvantage')
  if (active.includes('advantage') && active.includes('disadvantage')) return 'normal'
  return active[0] ?? 'normal'
}

export function savingThrowModeForTarget(input: {
  check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>
  actor: Dnd5eActivityRollTargetV1
  target: Dnd5eActivityRollTargetV1
  hostSavingThrowMode: (targetId: string, check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>) => D20RollMode
  saveFactsByTargetId?: import('./dnd5eActivitySaveFacts').Dnd5eActivitySaveFactsV1
}): D20RollMode {
  const { check, actor, target } = input
  const declared = check.rollMode ?? 'normal'
  const baseMode = declared === 'host-derived'
    ? input.hostSavingThrowMode(target.id, check)
    : declared
  const creatureTypeMode = check.rollModeByCreatureType && target.creatureType &&
    check.rollModeByCreatureType.creatureTypes.some((type) =>
      dnd5eActivityCreatureTypeMatches(type, target.creatureType!))
    ? check.rollModeByCreatureType.mode
    : undefined
  const statBlockMode = target.statBlockId && check.rollModeByStatBlock?.statBlockIds.includes(target.statBlockId)
    ? check.rollModeByStatBlock.mode
    : undefined
  const sizeMode = check.rollModeBySizeRank && target.sizeRank != null &&
    (check.rollModeBySizeRank.minimum == null || target.sizeRank >= check.rollModeBySizeRank.minimum) &&
    (check.rollModeBySizeRank.maximum == null || target.sizeRank <= check.rollModeBySizeRank.maximum)
    ? check.rollModeBySizeRank.mode
    : undefined
  const opposedMode = check.rollModeIfOpposed && actor.controller != null && target.controller != null &&
    actor.controller !== target.controller
    ? check.rollModeIfOpposed
    : undefined

  // Keep the dice recipe aligned with the executor's final check mode. This is
  // especially important for host-derived saves: reserving 2d20 unconditionally
  // made ordinary saves look like advantage even though the second die was ignored.
  const factMode=check.rollModeByHostFact&&input.saveFactsByTargetId?.[target.id]?.[check.rollModeByHostFact.id]===true?
    check.rollModeByHostFact.mode:undefined
  return combineRollModes([baseMode, creatureTypeMode, statBlockMode, sizeMode, opposedMode,factMode])
}

function selectedSavingThrowAbility(
  target: Dnd5eCombatant,
  check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>,
) {
  const modifier = (ability: typeof check.ability) => target.savingThrowBonuses[ability] ??
    Math.floor((target.abilities[ability] - 10) / 2)
  return (check.abilityOptions?.length ? check.abilityOptions : [check.ability]).reduce((best, candidate) =>
    modifier(candidate) > modifier(best) ? candidate : best, check.ability)
}

/** Derives the base save mode from authoritative combat state for an Activity. */
export function dnd5eActivityHostSavingThrowModeV1(input: {
  activity: Dnd5eActivityDefinitionV1
  actor: Dnd5eCombatant
  target: Dnd5eCombatant
  check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>
  sourceDistanceFeet?: number
  state?: Dnd5eHeadlessCombatState
  grantingAreaId?: string
}): D20RollMode {
  const sourceIsSpell = input.activity.legacySource?.kind === 'spell' || input.activity.spellInvocation != null
  const grantingArea = input.grantingAreaId ? input.state?.companionScene?.map.dnd5ePluginAreas?.find(area =>
    area.id === input.grantingAreaId && area.sourceTokenId === input.actor.id &&
    area.grantedActivities?.some(grant => grant.activityId === input.activity.id)) : undefined
  const recognizedIllusion = input.check.advantageIfIllusionRecognized === true &&
    grantingArea?.illusionRecognition?.knownTokenIds.includes(input.target.id) === true
  return dnd5eSavingThrowMode(
    input.target,
    selectedSavingThrowAbility(input.target, input.check),
    {
      effectVisible: true,
      recognizedIllusion,
      sourceCreatureType: input.actor.creatureType,
      sourceActorId: input.actor.id,
      sourceIsSpell,
      sourceIsMagical: sourceIsSpell || input.activity.legacySource?.magical === true,
      sourceDistanceFeet: input.sourceDistanceFeet,
      // A condition immunity declared on the save is also the authoritative
      // condition the spell is attempting to impose. Passing it through lets
      // racial rules such as Fey Ancestry derive advantage for charm saves.
      condition: input.check.automaticSuccessIfConditionImmune,
    },
  )
}

/**
 * Expands Activity-owned per-target dice after Host target validation. Unlike
 * the generic plugin expander, this function knows the live check mode and can
 * request exactly one d20 for a normal check or two for advantage/disadvantage.
 */
export function dnd5eActivityPerTargetRollDeclarationsV1(input: {
  activity: Dnd5eActivityDefinitionV1
  declarations: readonly Dnd5ePluginPerTargetDiceRollDeclaration[] | undefined
  actor: Dnd5eActivityRollTargetV1
  targets: readonly Dnd5eActivityRollTargetV1[]
  projectileTargetIds?: readonly string[]
  choices?: Readonly<Record<string, string>>
  /** Host-only, already settled pre-save weapon counter outcomes. */
  weaponCounterattackSuccessCheckKeys?: ReadonlySet<string>
  saveFactsByTargetId?: import('./dnd5eActivitySaveFacts').Dnd5eActivitySaveFactsV1
  combatants?: Readonly<Record<string, Dnd5eCombatant>>
  hostSavingThrowMode: (targetId: string, check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>) => D20RollMode
  hostAttackRollMode: (targetId: string, delivery?: 'melee' | 'ranged') => D20RollMode
  spellcastingAbility?: AbilityKey
  hostAbilityCheckMode?: (
    check: Extract<Dnd5eActivityCheckV1, { kind: 'ability-check' | 'skill-check' | 'concentration-check' }>,
  ) => D20RollMode
}): Dnd5ePluginDiceRollDeclaration[] {
  const allChecks = input.activity.checks ?? []
  const checks = allChecks.filter((check) =>
    !(
      'appliesWhenChoice' in check &&
      check.appliesWhenChoice &&
      !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')
    ))
  const inactiveRollIds = new Set(allChecks.flatMap((check) =>
    checks.includes(check)
      ? []
      : check.kind === 'opposed-ability-check'
        ? [check.rollId, check.opposedRollId]
        : [check.rollId]))
  const rollTargets = input.targets.filter((target) => {
    const host = input.combatants?.[target.id]
    return activityTargetNeedsPerTargetRoll(input.activity, host ? {
      ...target, elevationFeet: host.elevationFeet, groundElevationFeet: host.groundElevationFeet,
      conditionImmunities: dnd5eActivityTargetImmunities(input.activity, host, input.combatants?.[input.actor.id]),
    } : target)
  })
  return (input.declarations ?? []).filter((declaration) => !inactiveRollIds.has(declaration.id))
    .flatMap((declaration) => {
    const check = checks.find((candidate) =>
      candidate.scope === 'per-target' && (
        candidate.rollId === declaration.id ||
        (candidate.kind === 'opposed-ability-check' && candidate.opposedRollId === declaration.id)
      ))
    const perProjectile = check && 'perProjectile' in check && check.perProjectile === true
    if (perProjectile && !input.projectileTargetIds?.length) throw new Error('activity-projectile-order-missing')
    const occurrences = perProjectile
      ? input.projectileTargetIds!.flatMap((id, projectileOccurrenceIndex) => {
          if (!input.targets.some(target => target.id === id)) throw new Error('activity-projectile-target-missing')
          const target = rollTargets.find(target => target.id === id)
          return target ? [{ target, projectileOccurrenceIndex }] : []
        })
      : rollTargets.map(target => ({ target, projectileOccurrenceIndex: undefined }))
    return occurrences.filter(({ target, projectileOccurrenceIndex }) => {
      if (check?.kind === 'saving-throw') {
        const key = `${check.id}${projectileOccurrenceIndex == null ? '' : `:projectile:${projectileOccurrenceIndex}`}:${target.id}`
        if (input.weaponCounterattackSuccessCheckKeys?.has(key)) return false
        const source = input.combatants?.[input.actor.id]
        const host = input.combatants?.[target.id]
        const communicationTarget = host && source ? { languages: host.languages, canHearActivitySource: target.canHearActivitySource ?? dnd5eCombatantCanHearSource(host, source) } : target
        if (dnd5eActivityCommunicationSaveSucceeds(check, source ?? input.actor, communicationTarget)) return false
      }
      if (check?.kind === 'saving-throw' && dnd5eActivitySaveExcludesCreatureType(check, input.combatants?.[target.id]?.creatureType ?? target.creatureType)) return false
      if (check?.kind === 'saving-throw' && check.environmentalHazard) {
        const host = input.combatants?.[target.id]
        const protections = host ? dnd5eCombatantEnvironmentalImmunities(host) : target.environmentalImmunities
        if (protections?.includes(check.environmentalHazard)) return false
      }
      if (check?.kind !== 'saving-throw' || !check.automaticSuccessIfConditionImmune) return true
      const host = input.combatants?.[target.id]
      const immunities = host
        ? dnd5eActivityTargetImmunities(input.activity, host, input.combatants?.[input.actor.id])
        : target.conditionImmunities
      return !immunities?.includes(check.automaticSuccessIfConditionImmune)
    }).map(({ target, projectileOccurrenceIndex }) => {
    let count = declaration.count
    let acceptedCounts: readonly number[] | undefined
    let d20RollKind: Dnd5ePluginDiceRollDeclaration['d20RollKind']
    let d20RollMode: D20RollMode | undefined
    if (check?.kind === 'opposed-ability-check') {
      const sourceSide = declaration.id === check.rollId
      const declared = (sourceSide ? check.sourceRollMode : check.targetRollMode) ?? 'normal'
      const combatant = input.combatants?.[sourceSide ? input.actor.id : target.id]
      let baseMode: D20RollMode = declared === 'host-derived' ? 'normal' : declared
      let hostFinalMode: D20RollMode | undefined
      if (combatant) {
        const source = input.combatants?.[input.actor.id]
        const defender = input.combatants?.[target.id]
        if (source && defender) {
          const modes = dnd5eOpposedHostRollModes(check, source, defender)
          hostFinalMode = sourceSide ? modes.source : modes.target
        }
      }
      const sizeRule = sourceSide ? check.sourceRollModeByTargetSizeRank : undefined
      const sizeMode = sizeRule && target.sizeRank != null &&
        (sizeRule.minimum == null || target.sizeRank >= sizeRule.minimum) &&
        (sizeRule.maximum == null || target.sizeRank <= sizeRule.maximum) ? sizeRule.mode : undefined
      d20RollMode = hostFinalMode ?? combineRollModes([baseMode, sizeMode])
      d20RollKind = 'ability-check'
      count = d20RollMode === 'normal' ? 1 : 2
      // Accept already-open requests created before opposed recipes were mode-aware.
      acceptedCounts = declaration.count === 2 && count === 1 ? [1, 2] : undefined
    } else if (check?.kind === 'saving-throw') {
      const mode = savingThrowModeForTarget({
        check,
        actor: input.actor,
        target,
        hostSavingThrowMode: input.hostSavingThrowMode,
        saveFactsByTargetId: input.saveFactsByTargetId,
      })
      d20RollKind = 'saving-throw'
      d20RollMode = mode
      count = mode === 'normal' ? 1 : 2
      // Before live roll recipes became mode-aware, host-derived checks always
      // stored two d20 values. Continue accepting those saved/in-flight actions
      // while new rolls display and animate only the one die actually used.
      acceptedCounts = check.rollMode === 'host-derived' && mode === 'normal' ? [1, 2] : undefined
    } else if (check?.kind === 'attack-roll') {
      const declared = check.rollMode ?? 'normal'
      const mode = declared === 'host-derived'
        ? input.hostAttackRollMode(target.id, check.delivery)
        : declared
      d20RollKind = 'attack'
      d20RollMode = mode
      count = mode === 'normal' ? 1 : 2
    } else if (
      check?.kind === 'ability-check' || check?.kind === 'skill-check' ||
      check?.kind === 'concentration-check'
    ) {
      const declared = check.rollMode ?? 'normal'
      const mode = declared === 'host-derived'
        ? input.hostAbilityCheckMode?.(check) ?? 'normal'
        : declared
      d20RollKind = check.kind === 'concentration-check' ? 'saving-throw' : 'ability-check'
      d20RollMode = mode
      count = mode === 'normal' ? 1 : 2
      acceptedCounts = check.rollMode === 'host-derived' && mode === 'normal' ? [1, 2] : undefined
    }
    return {
      ...declaration,
      id: `${declaration.id}${projectileOccurrenceIndex == null ? '' : `:projectile:${projectileOccurrenceIndex}`}:${target.id}`,
      label: `${target.name?.trim() || target.id} · ${declaration.label}${projectileOccurrenceIndex == null ? '' : ` · ${projectileOccurrenceIndex + 1}`}`,
      count,
      ...(check?.kind === 'opposed-ability-check' ? { ownerOnlyPresentation: true } : {}),
      rollerTokenId: check?.kind === 'saving-throw' ||
        (check?.kind === 'opposed-ability-check' && check.opposedRollId === declaration.id) ? target.id : input.actor.id,
      ...(d20RollKind ? { d20RollKind } : {}),
      ...(d20RollMode ? { d20RollMode } : {}),
      attackAbility: check?.kind === 'attack-roll' ? dnd5eActivityAttackAbility(check.attackBonus, input.spellcastingAbility) : undefined,
      ...(acceptedCounts ? { acceptedCounts } : {}),
    }
    })
  })
}

/**
 * Removes later per-target rolls whose declared prerequisite check did not
 * succeed. The browser and Headless validator both use this after the attack
 * dice are known, so a missed melee spell attack never asks for or accepts the
 * target's dependent saving throw.
 */
export function filterDnd5eConditionalActivityRollDeclarationsV1(input: {
  activity: Dnd5eActivityDefinitionV1
  declarations: readonly Dnd5ePluginDiceRollDeclaration[]
  successfulCheckKeys: ReadonlySet<string>
  /** Full Host order, including targets whose dice have already been collected. */
  orderedTargetIds?: readonly string[]
  orderedProjectileTargetIds?: readonly string[]
  savingThrowResult?: (checkId: string, targetId: string, projectileOccurrenceIndex?: number) => boolean | undefined
  targetSpeedFeet?: (targetId: string) => number | undefined
  rolls?: Readonly<Record<string, { total: number }>>
}): Dnd5ePluginDiceRollDeclaration[] {
  return input.declarations.filter((declaration) => {
    const check = (input.activity.checks ?? []).find((candidate) =>
      candidate.scope === 'per-target' ? declaration.id.startsWith(`${candidate.rollId}:`) : declaration.id === candidate.rollId)
    if (!check) return true
    const targetSuffix = check.scope === 'per-target' ? declaration.id.slice(check.rollId.length + 1) : undefined
    const projectile = 'perProjectile' in check && check.perProjectile ? /^projectile:(\d+):(.+)$/.exec(targetSuffix ?? '') : null
    if ('perProjectile' in check && check.perProjectile && !projectile) return false
    const targetId = projectile?.[2] ?? targetSuffix
    if (check.kind === 'saving-throw' && check.stopAfterFirstFailure) {
      const ordered = projectile ? input.orderedProjectileTargetIds : input.orderedTargetIds
      const index = projectile ? Number(projectile[1]) : targetId == null ? -1 : ordered?.indexOf(targetId) ?? -1
      if (!ordered || index < 0 || ordered[index] !== targetId || !ordered.slice(0, index).every((id, previousIndex) =>
        input.savingThrowResult?.(check.id, id, projectile ? previousIndex : undefined) === true)) return false
    }
    if (check.kind === 'random-roll' && check.minimumTargetSpeedFeet != null) {
      const speed = targetId == null ? undefined : input.targetSpeedFeet?.(targetId)
      if (speed == null || !Number.isFinite(speed) || speed < check.minimumTargetSpeedFeet) return false
    }
    if (check.kind === 'random-roll' && check.appliesWhenSave) {
      const result = targetId == null ? undefined : input.savingThrowResult?.(check.appliesWhenSave.checkId, targetId)
      if (result == null || result !== (check.appliesWhenSave.result === 'success')) return false
    }
    if (check.kind === 'saving-throw' && check.appliesWhenCheck) {
      const prerequisite = input.activity.checks?.find(candidate => candidate.id === check.appliesWhenCheck!.checkId)
      const occurrence = prerequisite && 'perProjectile' in prerequisite && prerequisite.perProjectile ? projectile?.[1] : undefined
      if (prerequisite && 'perProjectile' in prerequisite && prerequisite.perProjectile && occurrence == null) return false
      return input.successfulCheckKeys.has(targetId == null ? check.appliesWhenCheck.checkId :
        `${check.appliesWhenCheck.checkId}${occurrence == null ? '' : `:projectile:${occurrence}`}:${targetId}`)
    }
    if (check.kind === 'random-roll' && check.appliesWhenCheckTotal) {
      const prerequisite = (input.activity.checks ?? []).find((candidate) =>
        candidate.id === check.appliesWhenCheckTotal!.checkId)
      if (!prerequisite) return false
      const prerequisiteRollId = prerequisite.scope === 'per-target'
        ? `${prerequisite.rollId}:${targetId}`
        : prerequisite.rollId
      const total = input.rolls?.[prerequisiteRollId]?.total
      return total != null && Number.isFinite(total) &&
        (check.appliesWhenCheckTotal.minimum == null || total >= check.appliesWhenCheckTotal.minimum) &&
        (check.appliesWhenCheckTotal.maximum == null || total <= check.appliesWhenCheckTotal.maximum)
    }
    return true
  })
}

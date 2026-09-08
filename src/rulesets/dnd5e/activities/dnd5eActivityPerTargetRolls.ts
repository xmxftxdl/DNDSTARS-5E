import type { D20RollMode } from '../../contracts'
import type { Dnd5eCombatant } from '../headlessCombatEngine'
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
  sizeRank?: number
  /** Host-derived source-relative audibility for effects that only affect hearers. */
  canHearActivitySource?: boolean
}

function activityTargetNeedsPerTargetRoll(
  activity: Dnd5eActivityDefinitionV1,
  target: Dnd5eActivityRollTargetV1,
): boolean {
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

function savingThrowModeForTarget(input: {
  check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>
  actor: Dnd5eActivityRollTargetV1
  target: Dnd5eActivityRollTargetV1
  hostSavingThrowMode: (targetId: string, check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>) => D20RollMode
}): D20RollMode {
  const { check, actor, target } = input
  const declared = check.rollMode ?? 'normal'
  const baseMode = declared === 'host-derived'
    ? input.hostSavingThrowMode(target.id, check)
    : declared
  const creatureTypeMode = check.rollModeByCreatureType && target.creatureType &&
    check.rollModeByCreatureType.creatureTypes.some((type) =>
      type.trim().toLocaleLowerCase() === target.creatureType!.trim().toLocaleLowerCase())
    ? check.rollModeByCreatureType.mode
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
  return combineRollModes([baseMode, creatureTypeMode, sizeMode, opposedMode])
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
}): D20RollMode {
  const sourceIsSpell = input.activity.legacySource?.kind === 'spell'
  return dnd5eSavingThrowMode(
    input.target,
    selectedSavingThrowAbility(input.target, input.check),
    {
      effectVisible: true,
      sourceCreatureType: input.actor.creatureType,
      sourceIsSpell,
      sourceIsMagical: sourceIsSpell,
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
  choices?: Readonly<Record<string, string>>
  hostSavingThrowMode: (targetId: string, check: Extract<Dnd5eActivityCheckV1, { kind: 'saving-throw' }>) => D20RollMode
  hostAttackRollMode: (targetId: string, delivery?: 'melee' | 'ranged') => D20RollMode
  hostAbilityCheckMode?: (
    check: Extract<Dnd5eActivityCheckV1, { kind: 'ability-check' | 'skill-check' | 'concentration-check' }>,
  ) => D20RollMode
}): Dnd5ePluginDiceRollDeclaration[] {
  const allChecks = input.activity.checks ?? []
  const checks = allChecks.filter((check) =>
    !(
      (check.kind === 'saving-throw' || check.kind === 'attack-roll') &&
      check.appliesWhenChoice &&
      !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')
    ))
  const inactiveRollIds = new Set(allChecks.flatMap((check) =>
    checks.includes(check)
      ? []
      : check.kind === 'opposed-ability-check'
        ? [check.rollId, check.opposedRollId]
        : [check.rollId]))
  const rollTargets = input.targets.filter((target) => activityTargetNeedsPerTargetRoll(input.activity, target))
  return (input.declarations ?? []).filter((declaration) => !inactiveRollIds.has(declaration.id))
    .flatMap((declaration) => rollTargets.map((target) => {
    const check = checks.find((candidate) =>
      candidate.scope === 'per-target' && (
        candidate.rollId === declaration.id ||
        (candidate.kind === 'opposed-ability-check' && candidate.opposedRollId === declaration.id)
      ))
    let count = declaration.count
    let acceptedCounts: readonly number[] | undefined
    let d20RollKind: Dnd5ePluginDiceRollDeclaration['d20RollKind']
    let d20RollMode: D20RollMode | undefined
    if (check?.kind === 'saving-throw') {
      const mode = savingThrowModeForTarget({
        check,
        actor: input.actor,
        target,
        hostSavingThrowMode: input.hostSavingThrowMode,
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
      id: `${declaration.id}:${target.id}`,
      label: `${target.name?.trim() || target.id} · ${declaration.label}`,
      count,
      ...(check?.kind === 'saving-throw' ? { rollerTokenId: target.id } : {}),
      ...(check?.kind === 'attack-roll' ? { rollerTokenId: input.actor.id } : {}),
      ...(check?.kind === 'ability-check' || check?.kind === 'skill-check' ||
        check?.kind === 'concentration-check' ? { rollerTokenId: input.actor.id } : {}),
      ...(d20RollKind ? { d20RollKind } : {}),
      ...(d20RollMode ? { d20RollMode } : {}),
      ...(acceptedCounts ? { acceptedCounts } : {}),
    }
  }))
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
  rolls?: Readonly<Record<string, { total: number }>>
}): Dnd5ePluginDiceRollDeclaration[] {
  return input.declarations.filter((declaration) => {
    const check = (input.activity.checks ?? []).find((candidate) =>
      candidate.scope === 'per-target' && declaration.id.startsWith(`${candidate.rollId}:`))
    if (!check) return true
    const targetId = declaration.id.slice(check.rollId.length + 1)
    if (check.kind === 'saving-throw' && check.appliesWhenCheck) {
      return input.successfulCheckKeys.has(`${check.appliesWhenCheck.checkId}:${targetId}`)
    }
    if (check.kind === 'random-roll' && check.appliesWhenCheckTotal) {
      const prerequisite = (input.activity.checks ?? []).find((candidate) =>
        candidate.id === check.appliesWhenCheckTotal!.checkId)
      if (!prerequisite) return false
      const prerequisiteRollId = prerequisite.scope === 'per-target'
        ? `${prerequisite.rollId}:${targetId}`
        : prerequisite.rollId
      const total = input.rolls?.[prerequisiteRollId]?.total
      return total != null &&
        (check.appliesWhenCheckTotal.minimum == null || total >= check.appliesWhenCheckTotal.minimum) &&
        (check.appliesWhenCheckTotal.maximum == null || total <= check.appliesWhenCheckTotal.maximum)
    }
    return true
  })
}

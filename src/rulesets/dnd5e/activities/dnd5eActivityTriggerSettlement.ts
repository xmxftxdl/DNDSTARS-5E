import type { Character } from '../../../types/character'
import {
  type Dnd5eActionResult,
  type Dnd5eActivityAuthorityCommitResult,
  type Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import { dnd5eSavingThrowMode } from '../passiveDefenses'
import type {
  Dnd5eActivityAreaPlacementV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityTriggerContextV1,
} from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { collectDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityHeadlessCompiler'
import type { Dnd5eActivityConfirmedByV1 } from './dnd5eActivityInvocation'
import { dnd5eContextPredicateSatisfiedV1 } from './dnd5eActivityInvocation'
import type { AvailableRegisteredDnd5eActivityV1 } from './dnd5eActivityRegistry'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import type { AbilityKey } from '../../../lib/dnd'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'

export interface Dnd5eActivityTriggerChoiceRequestV1 {
  eventId: string
  packageId: string
  activity: Dnd5eActivityDefinitionV1
  actorId: string
  targetIds: readonly string[]
  confirmation: AvailableRegisteredDnd5eActivityV1['confirmation']
  triggerContext: Dnd5eActivityTriggerContextV1
}

export interface Dnd5eActivityTriggerConfirmationV1 {
  accepted: boolean
  choices?: Readonly<Record<string, string>>
}

export interface Dnd5eActivityTriggerRollRequestV1 {
  id: string
  label: string
  count: number
  sides: number
  actorId: string
  targetId?: string
  targetName: string
  kind: 'formula' | 'attack-roll' | 'saving-throw' | 'ability-check'
}

export interface Dnd5eActivityTriggerDiagnosticV1 {
  eventId: string
  packageId: string
  activityId: string
  status: 'declined' | 'resolved' | 'rejected' | 'unsupported'
  reason?: string
}

export interface Dnd5eActivityTriggerAreaSelectionRequestV1 {
  receiptId: string
  eventId: string
  packageId: string
  activity: Dnd5eActivityDefinitionV1
  actorId: string
  /** Current Host snapshot used to revalidate sight and effect requirements. */
  state: Dnd5eHeadlessCombatState
  triggerContext: Dnd5eActivityTriggerContextV1
}

export interface Dnd5eActivityTriggerAreaSelectionV1 {
  targetIds: readonly string[]
  areaPlacement: Dnd5eActivityAreaPlacementV1
  areaPlacementDistanceFeet: number
}

export interface Dnd5eActivityTriggerMapHandoffRequestV1 {
  receiptId: string
  eventId: string
  packageId: string
  activity: Dnd5eActivityDefinitionV1
  actorId: string
  triggerContext: Dnd5eActivityTriggerContextV1
  committed: Extract<Dnd5eActivityAuthorityCommitResult, { ok: true }>
}

export interface Dnd5eActivityTriggerSettlementResultV1 {
  state: Dnd5eHeadlessCombatState
  /** Only events appended by Activity commits; the caller retains its source batch. */
  events: Extract<Dnd5eActionResult, { ok: true }>['events']
  diagnostics: readonly Dnd5eActivityTriggerDiagnosticV1[]
  combatRevision: number
}

function activityTargetIds(
  activity: Dnd5eActivityDefinitionV1,
  context: Dnd5eActivityTriggerContextV1,
): readonly string[] | undefined {
  const actorId = context.eligibleActorIds[0]
  if (!actorId) return undefined
  const target = activity.target
  if (target.kind === 'self') return [actorId]
  if (target.kind === 'area') return undefined
  const candidates = [...new Set(context.eligibleTargetIds)]
    .filter((targetId) => target.includeSelf || targetId !== actorId)
  if (candidates.length === 0 && target.includeSelf) return [actorId]
  return candidates.slice(0, target.count)
}

function eventTargetAreaSelection(
  activity: Dnd5eActivityDefinitionV1,
  state: Dnd5eHeadlessCombatState,
  context: Dnd5eActivityTriggerContextV1,
): Dnd5eActivityTriggerAreaSelectionV1 | undefined {
  const target = activity.target
  if (target.kind !== 'area' || target.origin !== 'event-target' || target.radiusFeet == null) return undefined
  const actorId = context.eligibleActorIds[0]
  const anchorId = context.eligibleTargetIds[0]
  const actor = actorId ? state.combatants[actorId] : undefined
  const anchor = anchorId ? state.combatants[anchorId] : undefined
  if (!actor || !anchor) return undefined
  const targetIds = Object.values(state.combatants).filter((candidate) => {
    if (candidate.currentHp <= 0 || candidate.deathSaves.dead) return false
    if (target.excludeEventTarget && candidate.id === anchor.id) return false
    if (!target.includeSelf && candidate.id === actor.id) return false
    if (target.relation === 'ally' && candidate.controller !== actor.controller) return false
    if (target.relation === 'enemy' && candidate.controller === actor.controller) return false
    const distance = candidate.id === anchor.id
      ? 0
      : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(anchor.id, candidate.id)]
    return Number.isFinite(distance) && distance! <= target.radiusFeet! + 1e-6
  }).slice(0, target.maximumTargets).map((candidate) => candidate.id)
  return {
    targetIds,
    areaPlacement: {
      x: anchor.position.x,
      y: anchor.position.y,
      elevationFeet: anchor.elevationFeet,
      radiusFeet: target.radiusFeet,
      angleDegrees: 0,
    },
    areaPlacementDistanceFeet: 0,
  }
}

function confirmedBy(confirmation: AvailableRegisteredDnd5eActivityV1['confirmation']): Dnd5eActivityConfirmedByV1 {
  if (confirmation === 'automatic') return 'system'
  if (confirmation === 'target-choice') return 'target'
  if (confirmation === 'dm-approval') return 'dm'
  return 'actor'
}

function criticalTrigger(context: Dnd5eActivityTriggerContextV1): boolean {
  return context.source.kind === 'attack' && context.source.result === 'critical-hit'
}

function inheritedActivityCastLevel(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  activity: Dnd5eActivityDefinitionV1,
  context: Dnd5eActivityTriggerContextV1,
): number | undefined {
  if (context.source.kind === 'spell') return context.source.level
  const actor = state.combatants[actorId]
  if (!actor) return undefined
  const requiredEffectIds = (activity.requirements ?? []).flatMap((requirement) =>
    requirement.kind === 'active-effect' && requirement.subject === 'actor' &&
      requirement.present && requirement.source === 'self'
      ? [requirement.effectId]
      : [])
  if (requiredEffectIds.length === 0) return undefined
  const matchingLevels = (actor.classState.activeEffects ?? []).flatMap((effect) =>
    requiredEffectIds.some((effectId) => effect.definitionId.includes(`:${effectId}`)) &&
      effect.source.actorId === actorId && effect.source.spellLevel != null
      ? [effect.source.spellLevel]
      : [])
  return matchingLevels.length > 0 ? Math.max(...matchingLevels) : undefined
}

function selectedSavingThrowAbility(
  target: Dnd5eHeadlessCombatState['combatants'][string],
  primary: AbilityKey,
  options?: readonly AbilityKey[],
): AbilityKey {
  const modifier = (ability: AbilityKey) => target.savingThrowBonuses[ability] ??
    Math.floor((target.abilities[ability] - 10) / 2)
  return (options?.length ? options : [primary]).reduce((best, candidate) =>
    modifier(candidate) > modifier(best) ? candidate : best, primary)
}

async function authoritativeRolls(input: {
  state: Dnd5eHeadlessCombatState
  available: AvailableRegisteredDnd5eActivityV1
  triggerContext: Dnd5eActivityTriggerContextV1
  actorId: string
  targetIds: readonly string[]
  roll: (request: Dnd5eActivityTriggerRollRequestV1) => Promise<readonly number[]>
}): Promise<{
  rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  checkRollModes: Readonly<Record<string, 'normal' | 'advantage' | 'disadvantage'>>
} | { unsupported: string }> {
  const rolls: Record<string, Dnd5eFormulaRollResult> = {}
  const checkRollModes: Record<string, 'normal' | 'advantage' | 'disadvantage'> = {}
  const actorName = input.state.combatants[input.actorId]?.name ?? input.actorId
  for (const declaration of collectDnd5eActivityFormulaRollDeclarationsV1(
    input.available.activity,
    criticalTrigger(input.triggerContext),
  )) {
    rolls[declaration.id] = {
      values: [...await input.roll({
        ...declaration,
        label: `${input.available.activity.name} · ${declaration.id}`,
        actorId: input.actorId,
        targetName: actorName,
        kind: 'formula',
      })],
    }
  }
  for (const check of input.available.activity.checks ?? []) {
    const targets = check.scope === 'per-target' ? input.targetIds : [input.targetIds[0]]
    for (const targetId of targets) {
      if (!targetId) return { unsupported: `check-target-missing:${check.id}` }
      const target = input.state.combatants[targetId]
      if (!target) return { unsupported: `check-target-missing:${check.id}` }
      const checkKey = check.scope === 'per-target' ? `${check.id}:${targetId}` : check.id
      const rollKey = check.scope === 'per-target' ? `${check.rollId}:${targetId}` : check.rollId
      const creatureTypeOverride = check.kind === 'saving-throw' && target.creatureType &&
        check.rollModeByCreatureType?.creatureTypes.some((type) =>
          type.trim().toLocaleLowerCase() === target.creatureType!.trim().toLocaleLowerCase())
        ? check.rollModeByCreatureType.mode
        : undefined
      const sizeRankOverride = check.kind === 'saving-throw' && check.rollModeBySizeRank &&
        (check.rollModeBySizeRank.minimum == null || target.sizeRank >= check.rollModeBySizeRank.minimum) &&
        (check.rollModeBySizeRank.maximum == null || target.sizeRank <= check.rollModeBySizeRank.maximum)
        ? check.rollModeBySizeRank.mode
        : undefined
      const declaredMode = check.rollMode ?? 'normal'
      const saveAbility = check.kind === 'saving-throw'
        ? selectedSavingThrowAbility(target, check.ability, check.abilityOptions)
        : undefined
      let mode: 'normal' | 'advantage' | 'disadvantage'
      if (declaredMode === 'host-derived') {
        if (check.kind !== 'saving-throw') return { unsupported: `host-derived-${check.kind}:${check.id}` }
        mode = dnd5eSavingThrowMode(target, saveAbility!, {
          effectVisible: true,
          sourceCreatureType: input.state.combatants[input.actorId]?.creatureType,
          sourceIsSpell: input.triggerContext.source.kind === 'spell',
        })
      } else mode = declaredMode
      const overrideModes = [creatureTypeOverride, sizeRankOverride].filter(
        (candidate): candidate is 'advantage' | 'disadvantage' => candidate != null,
      )
      const allModes = [mode, ...overrideModes].filter((candidate) => candidate !== 'normal')
      mode = allModes.includes('advantage') && allModes.includes('disadvantage')
        ? 'normal'
        : allModes[0] ?? 'normal'
      checkRollModes[checkKey] = mode
      rolls[rollKey] = {
        values: [...await input.roll({
          id: rollKey,
          label: `${input.available.activity.name} · ${check.kind === 'saving-throw' ? `${saveAbility!.toUpperCase()} 豁免` : check.kind}`,
          count: mode === 'normal' ? 1 : 2,
          sides: 20,
          actorId: input.actorId,
          targetId,
          targetName: target.name,
          kind: check.kind === 'saving-throw'
            ? 'saving-throw'
            : check.kind === 'attack-roll'
              ? 'attack-roll'
              : 'ability-check',
        })],
      }
    }
  }
  return { rolls, checkRollModes }
}

/**
 * Serial Host-side consumer for Activity windows produced by committed combat
 * events. It never trusts client totals: confirmations contain only a choice,
 * and every die is requested from the Host callback.
 */
export async function settleDnd5eActivityTriggerWindowsV1(input: {
  state: Dnd5eHeadlessCombatState
  events: Extract<Dnd5eActionResult, { ok: true }>['events']
  eventBatchId: string
  combatRevision: number
  charactersByCombatantId?: Readonly<Record<string, Character>>
  confirm: (request: Dnd5eActivityTriggerChoiceRequestV1) => Promise<boolean | Dnd5eActivityTriggerConfirmationV1>
  roll: (request: Dnd5eActivityTriggerRollRequestV1) => Promise<readonly number[]>
  /** Host-owned production map selector. Omit in simulations without a map. */
  selectArea?: (
    request: Dnd5eActivityTriggerAreaSelectionRequestV1,
  ) => Promise<Dnd5eActivityTriggerAreaSelectionV1 | undefined>
  /** Atomically applies map-owned proposals before combat state is accepted. */
  settleMapHandoffs?: (
    request: Dnd5eActivityTriggerMapHandoffRequestV1,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>
  maximumResolutions?: number
}): Promise<Dnd5eActivityTriggerSettlementResultV1> {
  let state = input.state
  let combatRevision = input.combatRevision
  const appendedEvents: Extract<Dnd5eActionResult, { ok: true }>['events'][number][] = []
  const diagnostics: Dnd5eActivityTriggerDiagnosticV1[] = []
  const consumed = new Set<string>()
  const batches: Array<{ id: string; events: typeof input.events; ancestry: ReadonlySet<string> }> = [
    { id: input.eventBatchId, events: input.events, ancestry: new Set() },
  ]
  const maximumResolutions = input.maximumResolutions ?? 32
  let resolutions = 0

  while (batches.length > 0 && resolutions < maximumResolutions) {
    const batch = batches.shift()!
    const windows = listDnd5eActivityTriggerWindowsV1({
      state,
      events: batch.events,
      eventBatchId: batch.id,
      charactersByCombatantId: input.charactersByCombatantId,
    })
    for (const window of windows) {
      for (const available of window.available) {
        const activityKey = `${available.packageId}:${available.activity.id}`
        if (batch.ancestry.has(activityKey)) continue
        const receiptId = `${window.triggerContext.eventId}:${available.packageId}:${available.activity.id}`
        if (consumed.has(receiptId)) continue
        consumed.add(receiptId)
        const actorId = window.triggerContext.eligibleActorIds[0]
        let targetIds = activityTargetIds(available.activity, window.triggerContext)
        let areaSelection: Dnd5eActivityTriggerAreaSelectionV1 | undefined
        if (!actorId || (available.activity.target.kind !== 'area' && targetIds == null)) {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'unsupported',
            reason: available.activity.target.kind === 'area'
              ? input.selectArea ? 'area-placement-cancelled' : 'triggered-area-placement-requires-map-targeting'
              : 'eligible-target-missing',
          })
          continue
        }
        let triggerContext = available.activity.target.kind === 'self' &&
          !window.triggerContext.eligibleTargetIds.includes(actorId)
          ? {
              ...window.triggerContext,
              eligibleTargetIds: [...window.triggerContext.eligibleTargetIds, actorId],
            }
          : window.triggerContext
        const displayActivity = available.activity.choices?.length
          ? {
              ...available.activity,
              choices: available.activity.choices.map((choice) => ({
                ...choice,
                options: choice.options.filter((option) => option.requirements?.every((requirement) => {
                  if (requirement.kind === 'resource-capacity') {
                    const resource = state.combatants[actorId]?.classResources[requirement.resourceId]
                    return !!resource && requirement.minimumMissing.kind === 'constant' &&
                      resource.max - resource.current >= requirement.minimumMissing.value
                  }
                  return dnd5eContextPredicateSatisfiedV1(requirement, triggerContext) !== false
                }) ?? true),
              })),
            }
          : available.activity
        if (displayActivity.choices?.some((choice) => choice.options.length === 0)) {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'unsupported',
            reason: 'no-eligible-activity-choice',
          })
          continue
        }
        const choiceRequest: Dnd5eActivityTriggerChoiceRequestV1 = {
          eventId: window.triggerContext.eventId,
          packageId: available.packageId,
          activity: displayActivity,
          actorId,
          targetIds: targetIds ?? [],
          confirmation: available.confirmation,
          triggerContext,
        }
        const confirmation = available.confirmation === 'automatic'
          ? { accepted: true, choices: Object.fromEntries((available.activity.choices ?? []).flatMap((choice) =>
              choice.defaultOptionId ? [[choice.id, choice.defaultOptionId] as const] : [])) }
          : await input.confirm(choiceRequest)
        const accepted = typeof confirmation === 'boolean' ? confirmation : confirmation.accepted
        const activityChoices = typeof confirmation === 'boolean' ? undefined : confirmation.choices
        if (!accepted) {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'declined',
          })
          continue
        }
        if (available.activity.target.kind === 'area') {
          areaSelection = eventTargetAreaSelection(available.activity, state, triggerContext) ?? (
            input.selectArea ? await input.selectArea({
                receiptId,
                eventId: window.triggerContext.eventId,
                packageId: available.packageId,
                activity: available.activity,
                actorId,
                state,
                triggerContext: window.triggerContext,
              }) : undefined
          )
          targetIds = areaSelection?.targetIds
          if (!areaSelection || targetIds == null) {
            diagnostics.push({
              eventId: window.triggerContext.eventId,
              packageId: available.packageId,
              activityId: available.activity.id,
              status: 'unsupported',
              reason: input.selectArea ? 'area-placement-cancelled' : 'triggered-area-placement-requires-map-targeting',
            })
            continue
          }
          if (available.activity.target.origin === 'event-target') {
            triggerContext = {
              ...triggerContext,
              eligibleTargetIds: [...new Set([...triggerContext.eligibleTargetIds, ...targetIds])],
            }
          }
        }
        if (!targetIds) {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'unsupported',
            reason: 'eligible-target-missing',
          })
          continue
        }
        const rolled = await authoritativeRolls({
          state, available, triggerContext, actorId, targetIds, roll: input.roll,
        })
        if ('unsupported' in rolled) {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'unsupported',
            reason: rolled.unsupported,
          })
          continue
        }
        const committed = resolveRegisteredDnd5eActivityInCombatV1({
          state,
          combatRevision,
          command: {
            schemaVersion: 1,
            commandId: `activity-trigger:${receiptId}`.slice(0, 160),
            actorId,
            packageId: available.packageId,
            packageVersion: available.packageVersion,
            activityId: available.activity.id,
            targetIds,
            areaPlacement: areaSelection?.areaPlacement,
            choices: activityChoices,
            castLevel: inheritedActivityCastLevel(state, actorId, available.activity, triggerContext),
            expectedRevision: combatRevision,
            triggerEventId: triggerContext.eventId,
          },
          authoritativeRolls: rolled.rolls,
          checkRollModes: rolled.checkRollModes,
          areaPlacementDistanceFeet: areaSelection?.areaPlacementDistanceFeet,
          areaTargetIds: areaSelection?.targetIds,
          parentDamageType: triggerContext.source.kind === 'attack'
            ? triggerContext.source.damageType
            : undefined,
          triggerContext,
          confirmedBy: confirmedBy(available.confirmation),
          dmApproved: available.confirmation === 'dm-approval',
          actorCharacter: input.charactersByCombatantId?.[actorId],
        })
        if (committed.phase !== 'commit') {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'rejected',
            reason: committed.result.reason,
          })
          continue
        }
        if (!committed.result.ok) {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'rejected',
            reason: committed.result.reason,
          })
          continue
        }
        const hasMapHandoffs = committed.result.activityHandoffs &&
          Object.values(committed.result.activityHandoffs).some((entries) => entries.length > 0)
        if (hasMapHandoffs && input.settleMapHandoffs) {
          const handoff = await input.settleMapHandoffs({
            receiptId,
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activity: available.activity,
            actorId,
            triggerContext,
            committed: committed.result,
          })
          if (!handoff.ok) {
            diagnostics.push({
              eventId: window.triggerContext.eventId,
              packageId: available.packageId,
              activityId: available.activity.id,
              status: 'unsupported',
              reason: handoff.reason,
            })
            continue
          }
        } else if (hasMapHandoffs) {
          diagnostics.push({
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activityId: available.activity.id,
            status: 'unsupported',
            reason: 'map-handoff-requires-placement',
          })
          continue
        }
        state = committed.result.state
        combatRevision += 1
        resolutions += 1
        appendedEvents.push(...committed.result.events)
        diagnostics.push({
          eventId: window.triggerContext.eventId,
          packageId: available.packageId,
          activityId: available.activity.id,
          status: 'resolved',
        })
        if (committed.result.events.length > 0) {
          batches.push({
            id: `${input.eventBatchId}:nested-${resolutions}`,
            events: committed.result.events,
            ancestry: new Set([...batch.ancestry, activityKey]),
          })
        }
        if (resolutions >= maximumResolutions) break
      }
      if (resolutions >= maximumResolutions) break
    }
  }
  return { state, events: appendedEvents, diagnostics, combatRevision }
}

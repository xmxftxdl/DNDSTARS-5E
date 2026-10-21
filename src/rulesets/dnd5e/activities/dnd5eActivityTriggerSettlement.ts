import { collectDnd5eActivityNegationDice } from './dnd5eActivityNegationDice'
import { dnd5eBoundHpRetaliationGrant } from './dnd5eAutonomousRetaliationContract'
import { dnd5eInterruptedFeatureSpellActivity } from './dnd5eInterruptedFeatureSpell'
import { previewDnd5eFeatureSpellInvocation } from '../headlessCombatEngine'
import type { Dnd5eActivityNegationChoice } from './dnd5eActivityDisadvantageNegation'
import type { Dnd5ePluginDiceRollDeclaration } from '../plugins/pluginHeadlessContracts'
import { dnd5eActivityAttackGateResultV1, dnd5eActivitySaveGateResultV1 } from './dnd5eActivitySaveGate'
import { withDnd5eIncapacitatedActivityAuthority } from '../incapacitatedActivityAuthority'
import { prepareDnd5eDamageReactionSpell } from '../damageReactionSpellPreparation'
import { bindDnd5eSpellMaterialEffects } from '../spellMaterialEffectBindings'
import { dnd5eAreaTargetSelectionValid } from './dnd5eAreaTargetSelection'
import { dnd5eActivityLanguageChoicesV1 } from './dnd5eActivityChoices'
import { dnd5eActivityEffectMatches } from './dnd5eActivityEffectSelector'
import { dnd5eOpposedHostRollModes } from './dnd5eActivityOpposedChecks'
import type { Character } from '../../../types/character'
import { dnd5eActivityExecutionGrant, dnd5eActivityUsesExecutionGrant } from './dnd5eActivityEntitlements'
import {
  dnd5eHeadlessTurnKey,
  consumeDnd5eSingleUseActivityGrant,
  expireDnd5eActivityWindowGrants,
  type Dnd5eActionResult,
  type Dnd5eActivityAuthorityCommitResult,
  type Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import { dnd5eSavingThrowMode, dnd5eIsIncapacitated } from '../passiveDefenses'
import { dnd5eActivityExcludesTarget, dnd5eActivityTargetImmunities, dnd5eActivityCreatureTypeMatches } from './dnd5eActivityTargetExclusions'
import type {
  Dnd5eActivityAreaPlacementV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityTriggerContextV1,
} from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1, dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { dnd5eActivityRootRequirementsSatisfiedV1 } from './dnd5eActivityExecutor'
import { filterDnd5eConditionalActivityRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { collectDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityHeadlessCompiler'
import { materializeDnd5eEventWeaponDice } from './dnd5eEventWeaponDice'
import type { Dnd5eActivityConfirmedByV1 } from './dnd5eActivityInvocation'
import { dnd5eContextPredicateSatisfiedV1 } from './dnd5eActivityInvocation'
import type { AvailableRegisteredDnd5eActivityV1 } from './dnd5eActivityRegistry'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import type { Dnd5eFormulaRollResult, Dnd5eFormulaV1 } from './dnd5eFormula'
import type { AbilityKey } from '../../../lib/dnd'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { dnd5eActivityEffectOriginId } from './dnd5eActivityEffectOrigin'
import { dnd5eCombatantCanSee, dnd5eDirectedCombatantPairKey } from '../headlessCombatEngine'

function actorFormulaReadyBeforeSelection(formula: Dnd5eFormulaV1): boolean {
  if (formula.kind === 'constant') return true
  if (formula.kind === 'dice') return false
  if (formula.kind === 'reference') return ['actor-current-hp', 'actor-max-hp', 'actor-level', 'actor-class-level', 'actor-proficiency-bonus', 'actor-ability-modifier'].includes(formula.reference.kind)
  if ('values' in formula) return formula.values.every(actorFormulaReadyBeforeSelection)
  return actorFormulaReadyBeforeSelection(formula.value)
}

export interface Dnd5eActivityTriggerChoiceRequestV1 {
  /** Host-derived eligible slot levels; absent for ordinary feature triggers. */
  availableCastLevels?: readonly number[]
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
  /** Untrusted controller choice; the damage checkpoint must revalidate it. */
  castLevel?: number
  choices?: Readonly<Record<string, string>>
  inventorySelection?: {ownerId:string; instanceId:string; revision:number}
}

export interface Dnd5eActivityTriggerNegationRequestV1 {
  state: Dnd5eHeadlessCombatState
  activityId: string
  actionId: string
  declaration: Dnd5ePluginDiceRollDeclaration
}

export interface Dnd5eActivityTriggerRollRequestV1 {
  d20RollMode?: 'normal' | 'advantage' | 'disadvantage'
  rollerTokenId: string
  id: string
  label: string
  count: number
  sides: number
  actorId: string
  targetId?: string
  targetName: string
  kind: 'formula' | 'attack-roll' | 'saving-throw' | 'ability-check' | 'random-roll'
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
  castLevel?: number
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
    // Zero HP does not make an unconscious creature a corpse. Keep targets
    // still using death saves; the damage authority handles failed saves.
    if (candidate.deathSaves.dead || (candidate.currentHp <= 0 && !candidate.usesDeathSaves)) return false
    if (target.excludeEventTarget && candidate.id === anchor.id) return false
    if (!target.includeSelf && candidate.id === actor.id) return false
    if ((target.requiresLineOfSight || target.requiresVisibleTargets) && !dnd5eCombatantCanSee(state, actor.id, candidate.id)) return false
    if (target.requiresLineOfEffect && state.lineOfEffectBlockedByCombatantPair?.[
      dnd5eDirectedCombatantPairKey(anchor.id, candidate.id)] === true) return false
    if (target.relation === 'ally' && candidate.controller !== actor.controller) return false
    if (target.relation === 'enemy' && candidate.controller === actor.controller) return false
    const distance = candidate.id === anchor.id
      ? 0
      : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(anchor.id, candidate.id)]
    return Number.isFinite(distance) && distance! <= target.radiusFeet! + 1e-6
  }).slice(0, target.selection ? undefined : target.maximumTargets).map((candidate) => candidate.id)
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
  packageId: string,
): number | undefined {
  const actor = state.combatants[actorId]
  if (!actor) return undefined
  const poolGrant = dnd5eBoundHpRetaliationGrant(actor, packageId, activity)
  if (poolGrant) return poolGrant.source.spellLevel
  if (dnd5eActivityUsesExecutionGrant(activity)) return dnd5eActivityExecutionGrant({
    packageId, activity, combatant: actor, triggerContext: context,
  })?.source.spellLevel
  if (context.source.kind === 'spell') return context.source.level
  const requiredEffects = (activity.requirements ?? []).flatMap((requirement) =>
    requirement.kind === 'active-effect' && requirement.subject === 'actor' &&
      requirement.present && requirement.source === 'self'
      ? [requirement]
      : [])
  if (requiredEffects.length === 0) return undefined
  const matchingLevels = (actor.classState.activeEffects ?? []).flatMap((effect) =>
    requiredEffects.some(requirement => dnd5eActivityEffectMatches(requirement, {
      definitionId: effect.definitionId, sourceActorId: effect.source.actorId, sourceCharacterId:effect.source.characterId, tags: effect.tags,
      suspended: !!effect.suspendedBy?.length,
    }, actorId,undefined,actor.classState.wardingBondParticipantCharacterId)) && effect.source.spellLevel != null
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

export async function rollDnd5eActivityTriggerDiceV1(input: {
  actionId?: string
  state: Dnd5eHeadlessCombatState
  available: AvailableRegisteredDnd5eActivityV1
  triggerContext: Dnd5eActivityTriggerContextV1
  actorId: string
  targetIds: readonly string[]
  choices?: Readonly<Record<string, string>>
  chooseDisadvantageNegation?: (request: Dnd5eActivityTriggerNegationRequestV1) => Promise<Dnd5eActivityNegationChoice | undefined>
  roll: (request: Dnd5eActivityTriggerRollRequestV1) => Promise<readonly number[]>
}): Promise<{
  disadvantageNegationChoices: Readonly<Record<string, Dnd5eActivityNegationChoice>>
  rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  checkRollModes: Readonly<Record<string, 'normal' | 'advantage' | 'disadvantage'>>
} | { unsupported: string }> {
  let previous: Parameters<typeof collectDnd5eActivityNegationDice>[0]['previous']
  const previewNegation = (roll: { rollId: string; mode: string }) =>
    roll.mode === 'disadvantage' && !!previous?.choices[roll.rollId]
  const roll = async (request: Dnd5eActivityTriggerRollRequestV1) => {
    if (!input.chooseDisadvantageNegation || !input.actionId || input.available.activity.authorityBinding) return input.roll(request)
    const result = await collectDnd5eActivityNegationDice({ state: input.state, activityId: input.available.activity.id,
      parent: { activity: input.available.activity, actorId: input.actorId,
        castLevel: inheritedActivityCastLevel(input.state, input.actorId, input.available.activity, input.triggerContext, input.available.packageId) },
      actionId: input.actionId, previous, declarations: [{ ...request,
        d20RollKind: request.kind === 'attack-roll' ? 'attack' : request.kind === 'saving-throw' ? 'saving-throw' : request.kind === 'ability-check' ? 'ability-check' : undefined }],
      choose: (declaration, state) => input.chooseDisadvantageNegation!({ declaration, state,
        activityId: input.available.activity.id, actionId: input.actionId! }),
      roll: declaration => input.roll({ ...request, count: declaration.count, d20RollMode: declaration.d20RollMode }),
      isCurrent: () => true,
    })
    previous = { declarations: result.declarations, choices: result.disadvantageNegationChoices }
    return result.authoritativeRolls[request.id].values
  }
  const rolls: Record<string, Dnd5eFormulaRollResult> = {}
  const checkRollModes: Record<string, 'normal' | 'advantage' | 'disadvantage'> = {}
  const hostActor = input.state.combatants[input.actorId]
  if (!hostActor) return { unsupported: 'activity-actor-missing' }
  if (input.targetIds.some(id => !input.state.combatants[id])) return { unsupported: 'activity-target-missing' }
  // These predicates depend only on Host snapshots, never on choices or dice.
  // Root requirements reject the entire selection; they are not area exclusions.
  const targetRequirements = (input.available.activity.requirements ?? []).filter(requirement =>
    requirement.kind === 'size-rank' || requirement.kind === 'creature-type' ||
    requirement.kind === 'can-hear-source' || requirement.kind === 'shared-language' ||
    requirement.kind === 'can-understand-source-language' || requirement.kind === 'can-speak' ||
    requirement.kind === 'target-identity' || requirement.kind === 'owned-companion' ||
    requirement.kind === 'condition' || requirement.kind === 'ability-score' || requirement.kind === 'speed')
  if (targetRequirements.length && !dnd5eActivityRootRequirementsSatisfiedV1({
    activity: { ...input.available.activity, requirements: targetRequirements },
    actor: dnd5eActivityActorSnapshotFromCombatantV1(hostActor),
    targets: input.targetIds.map(id => dnd5eActivityActorSnapshotFromCombatantV1(input.state.combatants[id], hostActor)),
    rolls: {}, triggerContext: input.triggerContext,
  })) return { unsupported: 'activity-target-requirements-not-met' }
  let applicableTargetIds: readonly string[]
  try {
    applicableTargetIds = input.targetIds.filter(id =>
      !dnd5eActivityExcludesTarget(input.available.activity.target, input.state.combatants[id] ? {
        ...input.state.combatants[id], conditionImmunities: dnd5eActivityTargetImmunities(input.available.activity,
          input.state.combatants[id], input.state.combatants[input.actorId]),
      } : {}))
  } catch (error) {
    return { unsupported: error instanceof Error ? error.message : 'activity-target-facts-invalid' }
  }
  const actorName = input.state.combatants[input.actorId]?.name ?? input.actorId
  let diceActivity: Dnd5eActivityDefinitionV1
  try { diceActivity = materializeDnd5eEventWeaponDice(input.available.activity, input.triggerContext) }
  catch (error) { return { unsupported: error instanceof Error ? error.message : 'activity-trigger-weapon-dice-unavailable' } }
  for (const declaration of collectDnd5eActivityFormulaRollDeclarationsV1(
    diceActivity,
    criticalTrigger(input.triggerContext),
    {
      actor: dnd5eActivityActorSnapshotFromCombatantV1(hostActor),
      castLevel: inheritedActivityCastLevel(
        input.state, input.actorId, input.available.activity,
        input.triggerContext, input.available.packageId,
      ),
    },
    input.choices,
  )) {
    rolls[declaration.id] = {
      values: [...await roll({
        ...declaration,
        label: `${input.available.activity.name} · ${declaration.id}`,
        actorId: input.actorId,
        rollerTokenId: input.actorId,
        targetName: actorName,
        kind: 'formula',
      })],
    }
  }
  for (const check of input.available.activity.checks ?? []) {
    if ('appliesWhenChoice' in check && check.appliesWhenChoice &&
      !check.appliesWhenChoice.optionIds.includes(input.choices?.[check.appliesWhenChoice.choiceId] ?? '')) continue
    const targets = check.scope === 'per-target' ? applicableTargetIds : applicableTargetIds.slice(0, 1)
    for (const targetId of targets) {
      if (!targetId) return { unsupported: `check-target-missing:${check.id}` }
      const target = input.state.combatants[targetId]
      if (!target) return { unsupported: `check-target-missing:${check.id}` }
      const checkKey = check.scope === 'per-target' ? `${check.id}:${targetId}` : check.id
      const rollKey = check.scope === 'per-target' ? `${check.rollId}:${targetId}` : check.rollId
      if (check.kind === 'saving-throw' && check.stopAfterFirstFailure && !targets.slice(0, targets.indexOf(targetId)).every(id =>
        dnd5eActivitySaveGateResultV1({ negateDisadvantage: previewNegation, activity: input.available.activity,
          actor: dnd5eActivityActorSnapshotFromCombatantV1(hostActor),
          targets: applicableTargetIds.map(id => dnd5eActivityActorSnapshotFromCombatantV1(input.state.combatants[id], hostActor)),
          rolls, choices: input.choices, checkRollModes, triggerContext: input.triggerContext,
        }, [], check.id, id) === true)) break
      if (check.kind === 'saving-throw' && check.appliesWhenCheck && dnd5eActivityAttackGateResultV1({ negateDisadvantage: previewNegation,
        activity: input.available.activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(hostActor),
        targets: applicableTargetIds.map(id => dnd5eActivityActorSnapshotFromCombatantV1(input.state.combatants[id], hostActor)),
        rolls, choices: input.choices, checkRollModes, triggerContext: input.triggerContext,
      }, [], check.appliesWhenCheck.checkId, targetId) !== true) continue
      if (check.kind === 'random-roll') {
        const declaration = { id: rollKey, label: check.label ?? check.id, count: check.count, sides: check.sides }
        const totals = Object.fromEntries(Object.entries(rolls).map(([id, roll]) => {
          const prior = input.available.activity.checks?.find(candidate =>
            candidate.scope === 'per-target' ? id.startsWith(`${candidate.rollId}:`) : id === candidate.rollId)
          return [id, { total: roll.values.reduce((sum, value) => sum + value,
            prior?.kind === 'random-roll' ? prior.modifier ?? 0 : 0) }]
        }))
        if (!filterDnd5eConditionalActivityRollDeclarationsV1({
          activity: input.available.activity, declarations: [declaration], successfulCheckKeys: new Set(), rolls: totals,
          targetSpeedFeet: id => input.state.combatants[id] ? dnd5eActivityActorSnapshotFromCombatantV1(input.state.combatants[id]).speed : undefined,
          savingThrowResult: (checkId, id) => dnd5eActivitySaveGateResultV1({ negateDisadvantage: previewNegation,
            activity: input.available.activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(hostActor),
            targets: applicableTargetIds.map(id => dnd5eActivityActorSnapshotFromCombatantV1(input.state.combatants[id], hostActor)),
            rolls, choices: input.choices, checkRollModes, triggerContext: input.triggerContext,
          }, [], checkId, id),
        }).length) continue
        rolls[rollKey] = {
          values: [...await roll({
            id: rollKey,
            label: `${input.available.activity.name} · 随机表`,
            count: check.count,
            sides: check.sides,
            actorId: input.actorId,
            rollerTokenId: input.actorId,
            targetId,
            targetName: target.name,
            kind: 'random-roll',
          })],
        }
        continue
      }
      if (check.kind === 'opposed-ability-check') {
        const actor = input.state.combatants[input.actorId]
        if (!actor) return { unsupported: `check-actor-missing:${check.id}` }
        const { source: sourceMode, target: targetMode } = dnd5eOpposedHostRollModes(check, actor, target)
        checkRollModes[`${checkKey}:source`] = sourceMode
        checkRollModes[`${checkKey}:target`] = targetMode
        checkRollModes[`${checkKey}:source-final`] = sourceMode
        checkRollModes[`${checkKey}:target-final`] = targetMode
        rolls[rollKey] = {
          values: [...await roll({
            id: rollKey,
            label: `${input.available.activity.name} · ${check.sourceAbility === 'spellcasting' ? '施法属性' : check.sourceAbility.toUpperCase()} 对抗检定`,
            d20RollMode: sourceMode, count: sourceMode === 'normal' ? 1 : 2,
            sides: 20,
            actorId: input.actorId,
            rollerTokenId: input.actorId,
            targetId,
            targetName: target.name,
            kind: 'ability-check',
          })],
        }
        const opposedRollKey = `${check.opposedRollId}:${targetId}`
        rolls[opposedRollKey] = {
          values: [...await roll({
            id: opposedRollKey,
            label: `${input.available.activity.name} · 目标对抗检定`,
            d20RollMode: targetMode, count: targetMode === 'normal' ? 1 : 2,
            sides: 20,
            actorId: input.actorId,
            rollerTokenId: targetId,
            targetId,
            targetName: target.name,
            kind: 'ability-check',
          })],
        }
        continue
      }
      const creatureTypeOverride = check.kind === 'saving-throw' && target.creatureType &&
        check.rollModeByCreatureType?.creatureTypes.some((type) =>
          dnd5eActivityCreatureTypeMatches(type, target.creatureType!))
        ? check.rollModeByCreatureType.mode
        : undefined
      const statBlockOverride = check.kind === 'saving-throw' && target.statBlockId &&
        check.rollModeByStatBlock?.statBlockIds.includes(target.statBlockId)
        ? check.rollModeByStatBlock.mode
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
      const overrideModes = [creatureTypeOverride, statBlockOverride, sizeRankOverride].filter(
        (candidate): candidate is 'advantage' | 'disadvantage' => candidate != null,
      )
      const allModes = [mode, ...overrideModes].filter((candidate) => candidate !== 'normal')
      mode = allModes.includes('advantage') && allModes.includes('disadvantage')
        ? 'normal'
        : allModes[0] ?? 'normal'
      checkRollModes[checkKey] = mode
      rolls[rollKey] = {
        values: [...await roll({
          id: rollKey,
          label: `${input.available.activity.name} · ${check.kind === 'saving-throw' ? `${saveAbility!.toUpperCase()} 豁免` : check.kind}`,
          d20RollMode: mode, count: mode === 'normal' ? 1 : 2,
          sides: 20,
          actorId: input.actorId,
          rollerTokenId: check.kind === 'saving-throw' ? targetId : input.actorId,
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
  return { rolls, checkRollModes, disadvantageNegationChoices: { ...previous?.choices } }
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
  /** Collect only Host-owned casting saves and reaction choices before spell effect dice. */
  prepareFeatureSpell?: (request: {
    state: Dnd5eHeadlessCombatState; actorId: string; activity: Dnd5eActivityDefinitionV1; eventId: string
  }) => Promise<Pick<Parameters<typeof resolveRegisteredDnd5eActivityInCombatV1>[0],
    'spellcastingSavingThrows' | 'counterspellReaction'> | undefined>
  confirm: (request: Dnd5eActivityTriggerChoiceRequestV1) => Promise<boolean | Dnd5eActivityTriggerConfirmationV1>
  /** Separate Host choice owned by the recipient, never inferred from activation. */
  confirmTargetWillingness?: (request: {
    actorId: string; targetId: string; activity: Dnd5eActivityDefinitionV1; eventId: string; packageId: string
  }) => Promise<boolean>
  chooseDisadvantageNegation?: (request: Dnd5eActivityTriggerNegationRequestV1) => Promise<Dnd5eActivityNegationChoice | undefined>
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
  selectTarget?: (request: {
    actorId: string; activity: Dnd5eActivityDefinitionV1; eventId: string; packageId: string
    candidates: readonly { id: string; name: string }[]
  }) => Promise<string | undefined>
  selectTargets?: (request: {
    actorId: string; activity: Dnd5eActivityDefinitionV1; eventId: string; packageId: string
    candidates: readonly { id: string; name: string }[]
  }) => Promise<readonly string[] | undefined>
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
        // Earlier hits in this same batch may already have spent this use.
        // Recheck before prompting; the initial window list is only a snapshot.
        if ((available.activity.requirements ?? []).some(requirement =>
          requirement.kind === 'once-per-turn' &&
          state.combatants[actorId]?.classState.declarativeUsedTurnKeys?.[requirement.key] ===
            dnd5eHeadlessTurnKey(state, actorId))) continue
        const receipts = state.combatants[actorId]?.classState.activityTriggerReceipts
        if (receipts?.combatId === state.combatId && receipts.ids.includes(receiptId)) continue
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
        // Only actor-local gates independent of target/choice/roll selection can
        // safely run before prompts. Final authority still checks all requirements.
        const preRollRequirements = (available.activity.requirements ?? []).filter(requirement => {
          if (['combat-active', 'turn-owner', 'minimum-level', 'class-level'].includes(requirement.kind)) return true
          if (requirement.kind === 'resource') return actorFormulaReadyBeforeSelection(requirement.minimum)
          if (requirement.kind === 'resource-capacity') return actorFormulaReadyBeforeSelection(requirement.minimumMissing)
          if (requirement.kind === 'condition' || requirement.kind === 'hp-percentage') return requirement.subject === 'actor'
          if (requirement.kind === 'hp-value' && requirement.subject === 'actor') {
            return typeof requirement.value === 'number' || actorFormulaReadyBeforeSelection(requirement.value)
          }
          return false
        })
        const hostActor = state.combatants[actorId]
        const preRollActor = hostActor ? dnd5eActivityActorSnapshotFromCombatantV1(hostActor) : undefined
        if (preRollActor && dnd5eIsIncapacitated(hostActor)) {
          preRollActor.conditions = [...new Set([...preRollActor.conditions, 'incapacitated' as const])]
        }
        if (!hostActor || !dnd5eActivityRootRequirementsSatisfiedV1({
          activity: { ...available.activity, requirements: preRollRequirements },
          actor: preRollActor!, targets: [], rolls: {},
          combatActive: state.active, currentTurnActorId: state.active ? state.initiativeOrder[state.initiativeIndex] : undefined,
          triggerContext,
        })) {
          diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
            activityId: available.activity.id, status: 'rejected', reason: 'requirements-not-met' })
          continue
        }
        const actorChoices = dnd5eActivityLanguageChoicesV1(
          available.activity, preRollActor!.languages, hostActor.hitPointDice, Object.values(state.combatants),
        )
        const displayActivity = actorChoices.choices?.length
          ? {
              ...actorChoices,
              choices: actorChoices.choices.map((choice) => ({
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
          : actorChoices
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
        const isDeathSpell = triggerContext.event === 'creature-died' && available.activity.legacySource?.kind === 'spell' && !available.activity.requiresEffectGrant
        const prepareDeathSpell = (choices?: Readonly<Record<string, string>>) => prepareDnd5eDamageReactionSpell({
          packageId: available.packageId, activity: available.activity, actor: state.combatants[actorId],
          character: input.charactersByCombatantId?.[actorId], event: 'creature-died', choices,
        })
        const deathSpell = isDeathSpell ? prepareDeathSpell() : undefined
        if (deathSpell && (!deathSpell.ok || deathSpell.requiresInventoryWrite)) {
          diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
            activityId: available.activity.id, status: 'rejected', reason: deathSpell.ok ? 'trigger-material-write-unsupported' : deathSpell.reason })
          continue
        }
        const choiceRequest: Dnd5eActivityTriggerChoiceRequestV1 = {
          ...(deathSpell?.ok ? { availableCastLevels: deathSpell.availableCastLevels } : {}),
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
        const inventorySelection = typeof confirmation === 'boolean' ? undefined : confirmation.inventorySelection
        if (!accepted) {
          // Declining is a completed decision for this concrete event. Keep its
          // receipt without charging resources or mutating the caller's state.
          const decliningActor = state.combatants[actorId]
          const prior = decliningActor.classState.activityTriggerReceipts
          state = { ...state, combatants: { ...state.combatants, [actorId]: {
            ...decliningActor, classState: { ...decliningActor.classState, activityTriggerReceipts: {
              combatId: state.combatId,
              ids: [...(prior?.combatId === state.combatId ? prior.ids : []), receiptId],
            } },
          } } }
          combatRevision += 1
          if (available.activity.invocation?.kind === 'triggered' &&
            available.activity.invocation.releaseSingleUseGrantOnDecline) {
            const beforeDecline = state
            state = structuredClone(state)
            const requiresExecution = dnd5eActivityUsesExecutionGrant(available.activity)
            const grant = requiresExecution ? dnd5eActivityExecutionGrant({
              packageId: available.packageId, activity: available.activity,
              combatant: beforeDecline.combatants[actorId], targetIds: targetIds ?? [], triggerContext,
            }) : undefined
            if (!requiresExecution || grant) consumeDnd5eSingleUseActivityGrant({ before: beforeDecline, after: state, actorId,
              packageId: available.packageId, activityId: available.activity.id,
              targetIds: targetIds ?? [], grantEffectId: grant?.id, events: appendedEvents })
          }
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
          if (areaSelection && available.activity.target.selection === 'choose-any') {
            const candidates = areaSelection.targetIds.map(id => ({ id, name: state.combatants[id]?.name ?? id }))
            const selected = await input.selectTargets?.({ actorId, activity: available.activity,
              packageId: available.packageId, eventId: receiptId, candidates })
            if (!dnd5eAreaTargetSelectionValid(available.activity.target, areaSelection.targetIds, selected)) {
              diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
                activityId: available.activity.id, status: selected == null ? 'declined' : 'rejected',
                reason: selected == null ? 'target-selection-declined' : 'invalid-selected-target' })
              continue
            }
            // Command authority receives the full Host candidate set; only intent is reduced.
            targetIds = [...selected]
          }
          if (areaSelection && available.activity.target.selection === 'choose-one') {
            const candidates = areaSelection.targetIds.map((id) => ({ id, name: state.combatants[id].name }))
            const selected = candidates.length && input.selectTarget
              ? await input.selectTarget({ actorId, activity: available.activity, packageId: available.packageId, eventId: receiptId, candidates })
              : undefined
            if (!selected || !candidates.some((candidate) => candidate.id === selected)) {
              diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
                activityId: available.activity.id, status: selected ? 'rejected' : 'declined',
                reason: selected ? 'invalid-selected-target' : 'target-selection-declined' })
              continue
            }
            areaSelection = { ...areaSelection, targetIds: [selected] }
            targetIds = [selected]
          }
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
          // These occupants come from the Host map selector (or Host event-area
          // calculation), not the player's command. A newly placed point area
          // may affect creatures absent from the parent spell's target list.
          {
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
        // A fixed creature range is already authoritative after target selection;
        // do not request damage dice for a target the Host must reject.
        if (available.activity.target.kind === 'creature' && available.activity.target.rangeFeet != null) {
          const origin = dnd5eActivityEffectOriginId(state, actorId, available.activity)
          const maximum = available.activity.target.rangeFeet
          if (!origin || targetIds.some(targetId => targetId !== origin &&
            (state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(origin, targetId)] ?? Number.POSITIVE_INFINITY) > maximum)) {
            diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
              activityId: available.activity.id, status: 'rejected', reason: 'target-out-of-range' })
            continue
          }
        }
        if (available.activity.target.kind === 'creature' && available.activity.target.requiresLineOfEffect) {
          const origin = dnd5eActivityEffectOriginId(state, actorId, available.activity)
          if (!origin || targetIds.some(targetId => state.lineOfEffectBlockedByCombatantPair?.[
            dnd5eDirectedCombatantPairKey(origin, targetId)] === true)) {
            diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
              activityId: available.activity.id, status: 'rejected', reason: 'target-snapshot-mismatch' })
            continue
          }
        }
        let willingTargetIds: string[] | undefined
        if (available.activity.target.kind === 'creature' && available.activity.target.requiresWilling) {
          willingTargetIds = []
          for (const targetId of targetIds) {
            if (!await input.confirmTargetWillingness?.({actorId,targetId,activity:available.activity,eventId:receiptId,packageId:available.packageId})) break
            willingTargetIds.push(targetId)
          }
          if (willingTargetIds.length !== targetIds.length) {
            diagnostics.push({eventId:window.triggerContext.eventId,packageId:available.packageId,activityId:available.activity.id,
              status:input.confirmTargetWillingness?'declined':'unsupported',reason:'target-not-willing'})
            continue
          }
        }
        const deathCastLevel = typeof confirmation === 'boolean' ? undefined : confirmation.castLevel
        const finalDeathSpell = isDeathSpell ? prepareDeathSpell(activityChoices) : undefined
        if (finalDeathSpell && (!finalDeathSpell.ok || finalDeathSpell.requiresInventoryWrite ||
          deathCastLevel == null || !finalDeathSpell.availableCastLevels.includes(deathCastLevel))) {
          diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
            activityId: available.activity.id, status: 'rejected', reason: 'reaction-spell-invalid-selection' })
          continue
        }
        const spellCheckpoint = available.activity.spellInvocation && input.prepareFeatureSpell
          ? await input.prepareFeatureSpell({state, actorId, activity: available.activity, eventId: triggerContext.eventId}) : {}
        if (!spellCheckpoint) {
          diagnostics.push({eventId:triggerContext.eventId,packageId:available.packageId,
            activityId:available.activity.id,status:'declined',reason:'feature-spell-checkpoint-cancelled'})
          continue
        }
        const spellAllowed = available.activity.spellInvocation
          ? previewDnd5eFeatureSpellInvocation(state, {actorId,...spellCheckpoint}, available.activity.spellInvocation) : true
        if (spellAllowed == null) {
          diagnostics.push({eventId:triggerContext.eventId,packageId:available.packageId,
            activityId:available.activity.id,status:'rejected',reason:'feature-spell-checkpoint-invalid'})
          continue
        }
        const rolled = await rollDnd5eActivityTriggerDiceV1({
          state, available: spellAllowed ? available : {...available,activity:dnd5eInterruptedFeatureSpellActivity(available.activity)},
          triggerContext, actorId, targetIds, choices: activityChoices, roll: input.roll,
          actionId: `activity-trigger:${receiptId}`.slice(0, 160), chooseDisadvantageNegation: input.chooseDisadvantageNegation,
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
        const inheritedCastLevel = inheritedActivityCastLevel(
          state,
          actorId,
          available.activity,
          triggerContext,
          available.packageId,
        )
        const committed = withDnd5eIncapacitatedActivityAuthority(state, available.packageId,
          available.activity, triggerContext, actorId, () => resolveRegisteredDnd5eActivityInCombatV1({
          allowInactiveDeathReactionCommit: isDeathSpell && deathSpell?.ok === true ||
            triggerContext.event === 'creature-died' && available.activity.activation.kind === 'free' &&
            available.activity.legacySource?.kind !== 'spell',
          ...spellCheckpoint,
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
            willingTargetIds,
            choices: activityChoices,
            inventoryOwnerId: inventorySelection?.ownerId,
            inventoryInstanceId: inventorySelection?.instanceId,
            expectedInventoryRevision: inventorySelection?.revision,
            castLevel: isDeathSpell ? deathCastLevel : inheritedCastLevel,
            expectedRevision: combatRevision,
            triggerEventId: triggerContext.eventId,
          },
          authoritativeRolls: rolled.rolls,
          disadvantageNegationChoices: rolled.disadvantageNegationChoices,
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
          inventoryOwner: input.charactersByCombatantId?.[actorId],
          inventoryRoster: [...new Map(Object.values(input.charactersByCombatantId ?? {}).map(character => [character.id,character])).values()],
        }))
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
        // Include the receipt in the candidate passed to atomic map persistence.
        // A failed handoff discards this candidate together with its resource changes.
        const settledActor = committed.result.state.combatants[actorId]
        const materialPlan = finalDeathSpell?.ok ? finalDeathSpell.componentCheck.materialPlan : undefined
        if (materialPlan?.allocations.some(allocation => allocation.bindEffectId)) {
          const bound = bindDnd5eSpellMaterialEffects(materialPlan,
            state.combatants[actorId].classState.activeEffects ?? [], settledActor.classState.activeEffects ?? [],
            [...Object.values(state.combatants).flatMap(actor => actor.classState.activeEffects ?? []),
              ...Object.values(input.charactersByCombatantId ?? {}).flatMap(character => character.dnd5eCombatState?.activeEffects ?? [])],
            finalDeathSpell!.ok ? finalDeathSpell!.spellId : undefined, available.packageId)
          if (!bound) {
            diagnostics.push({ eventId: window.triggerContext.eventId, packageId: available.packageId,
              activityId: available.activity.id, status: 'rejected', reason: 'reaction-spell-material-binding-failed' })
            continue
          }
          settledActor.classState.activeEffects = bound
        }
        const priorReceipts = settledActor.classState.activityTriggerReceipts
        settledActor.classState.activityTriggerReceipts = {
          combatId: state.combatId,
          ids: [...(priorReceipts?.combatId === state.combatId ? priorReceipts.ids : []), receiptId],
        }
        const hasMapHandoffs = committed.result.activityHandoffs &&
          Object.entries(committed.result.activityHandoffs).some(([kind, entries]) =>
            kind === 'areaSpellDamageTypes' ? (entries as readonly string[] | undefined)?.includes('cold') : (entries?.length ?? 0) > 0)
        if (hasMapHandoffs && input.settleMapHandoffs) {
          const handoff = await input.settleMapHandoffs({
            receiptId,
            eventId: window.triggerContext.eventId,
            packageId: available.packageId,
            activity: available.activity,
            actorId,
            castLevel: inheritedCastLevel,
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
    // Reaching the safety budget does not mean every offered choice was handled.
    // Keep unfinished grants in that case. A normally finished immediate window
    // closes even when no reaction was available or placement was unsuccessful.
    if (resolutions < maximumResolutions) {
      const closed = expireDnd5eActivityWindowGrants(state, batch.events)
      if (closed.state !== state) {
        state = closed.state
        combatRevision += 1
        appendedEvents.push(...closed.events)
        if (closed.events.length) batches.push({ id: `${batch.id}:closed`, events: closed.events, ancestry: batch.ancestry })
      }
    }
  }
  return { state, events: appendedEvents, diagnostics, combatRevision }
}

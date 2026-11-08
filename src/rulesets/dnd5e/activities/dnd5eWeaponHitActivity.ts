import{dnd5eOrdinaryWeaponScene,dnd5eWeaponActivityTurnKey}from'../ordinaryWeaponScene'
import { dnd5ePluginFeatureCurrentEnvelopeFullV1, dnd5ePluginFeatureDefinition } from '../plugins/pluginContentCatalog'
import {dnd5eExecutionEventKey} from './dnd5eActivityIdentity'
import type {BattleMap} from '../../../store/maps'
import type {GridCell} from '../../../lib/gridCombat'
import {planDnd5eWeaponHitPushAndFollow} from '../weaponHitMovement'
import { dnd5eCombatantCanSee, dnd5eHeadlessTurnKey, type Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5eWeaponHitDecision, Dnd5eWeaponHitEvent } from '../weaponHitCheckpoint'
import { collectDnd5eFormulaRollDeclarations, type Dnd5eFormulaRollResult } from './dnd5eFormula'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { dnd5eCombatantEntitledToActivityV1 } from './dnd5eActivityEntitlements'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './dnd5eActivityTriggerWindows'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivityCommand } from './dnd5eActivityCommand'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { dnd5eGrantedActivityTargetsAllowed, normalizeDnd5eActiveEffects } from '../activeEffects'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eSavingThrowMode } from '../passiveDefenses'

/** Match the same live Host receipt for inherited scaling and consumption. */
export function dnd5eWeaponHitActivityGrant(state: Dnd5eHeadlessCombatState, event: Dnd5eWeaponHitEvent, packageId: string, activity: Dnd5eActivityDefinitionV1) {
  if (!activity.requiresEffectGrant) return undefined
  return normalizeDnd5eActiveEffects(state.combatants[event.actorId]?.classState.activeEffects).find(effect =>
    (effect.source.pluginId ?? (effect.source.kind === 'spell' ? 'srd-5.1' : undefined)) === packageId &&
    effect.grantedActivities?.includes(activity.id) && dnd5eGrantedActivityTargetsAllowed(effect, [event.targetId]))
}

export function dnd5eWeaponHitSecondaryCandidates(state: Dnd5eHeadlessCombatState, event: Dnd5eWeaponHitEvent,
  rule: {rangeFeet:number;requiresLineOfSight:boolean}): readonly {id:string;name:string}[] {
  if (!Number.isFinite(rule.rangeFeet) || rule.rangeFeet < 0 || rule.rangeFeet > 1000 || !state.combatants[event.actorId]) return []
  return Object.values(state.combatants).filter(target => target.id !== event.actorId && target.id !== event.targetId &&
    target.objectDamageThreshold == null && !target.objectInteractionOnly && !target.deathSaves.dead &&
    (state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(event.actorId,target.id)] ?? Infinity) <= rule.rangeFeet &&
    (!rule.requiresLineOfSight || dnd5eCombatantCanSee(state,event.actorId,target.id)))
    .map(target => ({id:target.id,name:target.name}))
}

export function dnd5eWeaponHitConditionChoices(state: Dnd5eHeadlessCombatState, event: Dnd5eWeaponHitEvent, activity: Dnd5eActivityDefinitionV1) {
  return activity.choices?.map(choice => {
    const operation = activity.outcomes.flatMap(outcome => outcome.operations).find(op => op.kind === 'apply-effect' && op.charmedSourceChoiceId === choice.id)
    if (choice.optionsFrom !== 'combat-creatures' || operation?.kind !== 'apply-effect') return choice
    return { ...choice, options: Object.values(state.combatants).filter(creature => creature.id !== event.targetId &&
      creature.objectDamageThreshold == null && !creature.objectInteractionOnly &&
      (operation.conditionSourceMaximumDistanceFeet == null ||
        (state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(event.targetId, creature.id)] ?? Infinity) <= operation.conditionSourceMaximumDistanceFeet))
      .map(creature => ({ id: creature.id, label: creature.name })) }
  })
}

/** Pre-commit adapter: accepts Activity identity plus Host dice, never client
 * amounts, resource costs or an independently supplied trigger context. */
export function resolveDnd5eWeaponHitActivity(input: {
  state: Dnd5eHeadlessCombatState; event: Dnd5eWeaponHitEvent; eventBatchId: string
  combatRevision: number; packageId: string; packageVersion: string; activityId: string
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  map?: BattleMap
  choices?: Readonly<Record<string, string>>
  selectedPushCell?: GridCell | null
  selectedSecondaryTargetIds?: readonly string[]
  expectedDefinitionSignature?: string
}): { ok: true; decision: Dnd5eWeaponHitDecision; definitionSignature: string; pushSelectionRequired?: {maximumFeet:number} }
  | { ok: false; reason: string } {
  if (!input.event.hit || (!['weapon', 'spell'].includes(input.event.attackCategory ?? '') && !input.event.attackDelivery)) return { ok: false, reason: 'weapon-hit-evidence-missing' }
  const activity = getRegisteredDnd5eActivity(input.packageId, input.activityId)
  if(activity?.requirements?.some(row=>row.kind==='once-per-turn'&&row.key==='eldritch-smite')&&dnd5eOrdinaryWeaponScene(input.state)===false)return{ok:false,reason:'ordinary-scene-authority-required'}
  const actor = input.state.combatants[input.event.actorId], target = input.state.combatants[input.event.targetId]
  if (!activity || !actor || !target) return { ok: false, reason: 'weapon-hit-activity-missing' }
  // Pact-weapon recipes bind their execution to the currently registered
  // feature source as well as the Activity's own automation capability. A
  // retained prepared actor cannot keep executing a downgraded invocation.
  if (activity.requirements?.some(requirement => requirement.kind === 'attack-pact-weapon')) {
    const source = activity.legacySource
    const featureId = source?.id.startsWith(`${input.packageId}:`) ? source.id : `${input.packageId}:${source?.id}`
    const feature = source?.kind === 'feature' ? dnd5ePluginFeatureDefinition(featureId) : undefined
    if (!dnd5ePluginFeatureCurrentEnvelopeFullV1(featureId)) return { ok: false, reason: 'weapon-hit-pact-source-envelope-not-automatic' }
    if (!feature || feature.ownerPluginId !== input.packageId || feature.automation !== 'full' ||
      feature.declarativeAbility && feature.declarativeAbility.automation !== 'full')
      return { ok: false, reason: 'weapon-hit-pact-source-not-automatic' }
  }
  const signature = JSON.stringify(activity)
  if (input.expectedDefinitionSignature != null && signature !== input.expectedDefinitionSignature) return { ok: false, reason: 'weapon-hit-activity-changed' }
  if (!dnd5eCombatantEntitledToActivityV1({ packageId: input.packageId, activity, combatant: actor })) return { ok: false, reason: 'weapon-hit-activity-not-owned' }
  // Other stateful operations need their own atomic adapter. Never silently
  // drop their effects or action-economy costs when converting this decision.
  const operations = activity.outcomes.flatMap(outcome => outcome.operations)
  const operation = operations[0]
  const defenseOperation = operations[1]
  const defense = defenseOperation?.kind === 'apply-effect' ? activity.effects?.find(effect => effect.id === defenseOperation.effectId) : undefined
  const save = activity.checks?.[0]
  const failure = activity.outcomes[1]?.when
  const hasSelectedCharm = defenseOperation?.kind === 'apply-effect' && !!defenseOperation.charmedSourceChoiceId &&
    activity.choices?.length === 1 && activity.choices[0].id === defenseOperation.charmedSourceChoiceId && activity.choices[0].optionsFrom === 'combat-creatures' &&
    defense?.conditions?.length === 1 && defense.conditions[0] === 'charmed' && !defense.modifiers?.length &&
    defense.breakOn?.every(trigger => ['attacked-by-condition-entity','damaged-by-condition-entity','forced-save-by-condition-entity'].includes(trigger)) === true
  // Closed concentration fear continuation: its Wisdom check is a bearer action,
  // never a repeat save or an arbitrary effects escape hatch.
  const fearRemoval = defense?.removalAction
  const hasConcentrationFear = activity.legacySource?.kind === 'spell' && activity.legacySource.magical === true &&
    activity.requiresEffectGrant === true && save?.kind === 'saving-throw' && save.ability === 'wis' &&
    defense?.conditions?.length === 1 && defense.conditions[0] === 'frightened' && !defense.modifiers?.length &&
    defense.magical === true && defense.concentration === true && defense.stacking === 'unique-by-source' &&
    defense.duration.kind === 'concentration' && defense.duration.maximumRounds === 10 &&
    Object.keys(defense.duration).every(key => ['kind','maximumRounds'].includes(key)) &&
    Object.keys(defense).every(key => ['schemaVersion','id','name','stacking','duration','magical','concentration','conditions','removalAction'].includes(key)) &&
    fearRemoval?.economy === 'action' && fearRemoval.maxDistanceFeet === 0 && fearRemoval.selfOnly === true &&
    Object.keys(fearRemoval).every(key => ['label','economy','maxDistanceFeet','selfOnly','abilityCheck'].includes(key)) &&
    fearRemoval.abilityCheck?.ability === 'wis' && !fearRemoval.abilityCheck.skill &&
    Object.keys(fearRemoval.abilityCheck).every(key => ['ability','dc'].includes(key)) &&
    fearRemoval.abilityCheck.dc.kind === 'reference' && fearRemoval.abilityCheck.dc.reference.kind === 'actor-spell-save-dc'
  const debilitationModifiers = defense?.modifiers
  const hasBoundTimedDebilitation = activity.legacySource?.kind === 'spell' && activity.legacySource.magical === true &&
    activity.requiresEffectGrant === true && save?.kind === 'saving-throw' && save.ability === 'wis' &&
    defense?.magical === true && defense.stacking === 'unique-by-source' &&
    Object.keys(defense).every(key => ['schemaVersion','id','name','stacking','duration','magical','sourceLink','modifiers'].includes(key)) &&
    defense.duration.kind === 'rounds' && defense.duration.rounds === 1 && defense.duration.expiresAt === 'target-turn-end' &&
    defense.duration.includeCreationTurn === false && Object.keys(defense.duration).every(key => ['kind','rounds','expiresAt','includeCreationTurn'].includes(key)) &&
    !!defense.sourceLink?.sourceRequiresEffect && Object.keys(defense.sourceLink).every(key => key === 'sourceRequiresEffect') &&
    actor.classState.activeEffects?.some(effect => effect.source.actorId === actor.id && effect.source.pluginId === input.packageId &&
      effect.duration.type === 'concentration' && !effect.suspendedBy?.length &&
      (effect.definitionId.endsWith(`:${defense.sourceLink!.sourceRequiresEffect}`) || effect.definitionId.includes(`:${defense.sourceLink!.sourceRequiresEffect}:`))) === true &&
    debilitationModifiers?.length === 3 &&
    debilitationModifiers.some(modifier => modifier.kind === 'attack-roll' && modifier.mode === 'disadvantage' && Object.keys(modifier).every(key => ['kind','mode'].includes(key))) &&
    debilitationModifiers.some(modifier => modifier.kind === 'ability-check' && modifier.mode === 'disadvantage' && Object.keys(modifier).every(key => ['kind','mode'].includes(key))) &&
    debilitationModifiers.some(modifier => modifier.kind === 'prohibit-reaction' && Object.keys(modifier).every(key => key === 'kind'))
  const hasTargetSaveEffect = activity.checks?.length === 1 && save?.kind === 'saving-throw' && save.scope === 'per-target' &&
    Object.keys(save).every(key => ['id','rollId','kind','ability','dc','scope','rollMode'].includes(key)) &&
    activity.outcomes.length === 2 && activity.outcomes[0].operations.length === 1 && activity.outcomes[1].operations.length === 1 &&
    failure?.kind === 'check' && failure.checkId === save.id && failure.result === 'failure' &&
    operations.length === 2 && defenseOperation?.kind === 'apply-effect' && defenseOperation.target === 'target' &&
    Object.keys(defenseOperation).every(key => ['id','kind','target','effectId', ...(hasSelectedCharm ? ['charmedSourceChoiceId','conditionSourceMaximumDistanceFeet'] : [])].includes(key)) && activity.effects?.length === 1 && !!defense &&
    (hasConcentrationFear || hasBoundTimedDebilitation || Object.keys(defense).every(key => ['schemaVersion','id','name','stacking','duration','modifiers','magical', ...(hasSelectedCharm ? ['conditions','breakOn'] : [])].includes(key)) && defense.stacking === 'replace' &&
    defense.duration.kind === 'rounds' && defense.duration.rounds === 1 && defense.duration.expiresAt === 'source-turn-start' &&
    Object.keys(defense.duration).every(key => ['kind','rounds','expiresAt'].includes(key)) &&
    (hasSelectedCharm || defense.modifiers?.length === 1 && (
      defense.modifiers[0].kind === 'weapon-damage-multiplier' && Object.keys(defense.modifiers[0]).every(key => ['kind','multiplier'].includes(key)) &&
      defense.modifiers[0].multiplier >= 0 && defense.modifiers[0].multiplier <= 1 ||
      defense.modifiers[0].kind === 'sight-range-limit' && Object.keys(defense.modifiers[0]).every(key => ['kind','rangeFeet'].includes(key)) &&
      Number.isInteger(defense.modifiers[0].rangeFeet) && defense.modifiers[0].rangeFeet >= 1 && defense.modifiers[0].rangeFeet <= 10000))) && input.event.attackCategory === 'weapon'
  if (hasSelectedCharm) {
    const choices = dnd5eWeaponHitConditionChoices(input.state, input.event, activity) ?? []
    if (choices.some(choice => !choice.options.some(option => option.id === input.choices?.[choice.id])))
      return { ok: false, reason: 'invalid-condition-source-choice' }
  }
  const controllerOperation = operations[2]
  const linkedOperation = operations[3]
  const controller = controllerOperation?.kind === 'apply-effect' ? activity.effects?.find(effect => effect.id === controllerOperation.effectId) : undefined
  const linked = linkedOperation?.kind === 'apply-effect' ? activity.effects?.find(effect => effect.id === linkedOperation.effectId) : undefined
  const hasLinkedEffects = input.event.attackCategory === 'weapon' && !activity.checks?.length && activity.outcomes.length === 1 &&
    operations.length === 4 && activity.effects?.length === 2 && defenseOperation?.kind === 'remove-effect' &&
    defenseOperation.target === 'actor' && defenseOperation.source === 'self' &&
    controllerOperation?.kind === 'apply-effect' && controllerOperation.target === 'actor' &&
    linkedOperation?.kind === 'apply-effect' && linkedOperation.target === 'target' && !!controller && !!linked &&
    defenseOperation.effectId === controller.id && controller.stacking === 'replace' && linked.stacking === 'replace' &&
    linked.sourceLink?.sourceRequiresEffect === controller.id && linked.sourceLink.sourceRequiresEffectSameApplication === true &&
    [controller, linked].every(effect => effect.duration.kind === 'rounds' && effect.duration.rounds >= 1 && effect.duration.rounds <= 100 &&
      effect.duration.expiresAt === 'source-turn-start' && Object.keys(effect).every(key =>
        ['schemaVersion','id','name','magical','stacking','duration','sourceLink','grants','modifiers','removalAction'].includes(key))) &&
    !controller.modifiers?.length && !controller.sourceLink && !controller.grants?.length && !controller.removalAction &&
    linked.modifiers?.length === 1 && linked.modifiers[0].kind === 'speed' && linked.modifiers[0].mode === 'add' &&
    linked.modifiers[0].value.kind === 'constant' && linked.modifiers[0].value.value <= 0
  const hasPostHitBanishment = input.event.attackCategory === 'weapon' && activity.legacySource?.kind === 'spell' &&
    activity.legacySource.magical === true && activity.requiresEffectGrant === true && !activity.effects?.length &&
    !activity.checks?.length && !activity.choices?.length && activity.outcomes.length === 1 && operations.length === 2 &&
    defenseOperation?.kind === 'weapon-hit-banishment' && defenseOperation.target === 'target' && defenseOperation.maximumHitPoints === 50 &&
    Object.keys(defenseOperation).every(key => ['id','kind','target','maximumHitPoints'].includes(key)) &&
    operation.kind === 'damage' && operation.amount.kind === 'dice' && operation.amount.count === 5 && operation.amount.sides === 10 &&
    operation.damageType === 'force' && operation.magical === true && operation.critical === 'double-dice'
  const hasDefense = operations.length === 2 && defenseOperation?.kind === 'apply-effect' && defenseOperation.target === 'actor' &&
    Object.keys(defenseOperation).every(key => ['id','kind','target','effectId'].includes(key)) && activity.effects?.length === 1 && !!defense &&
    Object.keys(defense).every(key => ['schemaVersion','id','name','stacking','duration','modifiers'].includes(key)) && defense.stacking === 'replace' &&
    defense.duration.kind === 'rounds' && defense.duration.rounds === 1 && defense.duration.expiresAt === 'source-turn-start' &&
    defense.modifiers?.length === 1 && defense.modifiers[0].kind === 'armor-class' && defense.modifiers[0].mode === 'add' &&
    Object.keys(defense.modifiers[0]).every(key => ['kind','mode','value'].includes(key)) && input.event.attackCategory === 'weapon'
  const hasProne = input.event.attackCategory === 'weapon' && operations.length === 2 && activity.outcomes.length === 1 &&
    !activity.checks?.length && !activity.choices?.length && activity.effects?.length === 1 &&
    defenseOperation?.kind === 'apply-effect' && defenseOperation.target === 'target' &&
    Object.keys(defenseOperation).every(key=>['id','kind','target','effectId'].includes(key)) && !!defense &&
    defense.stacking === 'replace' && defense.duration.kind === 'permanent' &&
    Object.keys(defense).every(key=>['schemaVersion','id','name','stacking','duration','conditions','magical'].includes(key)) &&
    defense.conditions?.length === 1 && defense.conditions[0] === 'prone' &&
    target.objectDamageThreshold == null && !target.objectInteractionOnly
  const secondaryOperation = operations[1]?.kind === 'secondary-weapon-damage' ? operations[1] : undefined
  const hasSecondary = operations.length === 2 && !!secondaryOperation && operation.kind === 'damage' &&
    secondaryOperation.damageOperationId === operation.id && operation.amount.kind === 'dice' && operation.amount.count === 1 &&
    operation.damageType === 'inherit-primary' && operation.magical == null && !activity.scaling?.length && input.event.attackCategory === 'weapon'
  const pushOperation = operations[1]?.kind === 'move' ? operations[1] : undefined
  const followOperation=operations[2]?.kind==='reaction-follow'?operations[2]:undefined
  const hasFollow=operations.length===3&&!!followOperation&&followOperation.target==='actor'&&followOperation.pushOperationId===pushOperation?.id&&
    followOperation.movementBudget==='walking-speed'&&followOperation.targetRadiusFeet===5&&
    Object.keys(followOperation).every(key=>['id','kind','target','pushOperationId','movementBudget','targetRadiusFeet'].includes(key))
  const hasPush = (operations.length === 2||hasFollow) && pushOperation?.mode === 'push' && pushOperation.target === 'target' &&
    Object.keys(pushOperation).every(key=>['id','kind','target','mode','distanceFeet'].includes(key)) && input.event.attackCategory === 'weapon' &&
    !activity.scaling?.length
  if (input.selectedPushCell !== undefined && !hasPush) return {ok:false,reason:'unexpected-push-selection'}
  if(hasFollow&&(!hasPush||input.state.initiativeOrder[input.state.initiativeIndex]!==actor.id||input.event.attackOrigin!=='attack-action'))return {ok:false,reason:'follow-hit-context-invalid'}
  const selectedSecondaryTargetIds = input.selectedSecondaryTargetIds ?? []
  if (selectedSecondaryTargetIds.length > 128 || new Set(selectedSecondaryTargetIds).size !== selectedSecondaryTargetIds.length ||
    (selectedSecondaryTargetIds.length > 0 && !hasSecondary)) return {ok:false,reason:'invalid-secondary-targets'}
  const secondaryCandidates = hasSecondary ? dnd5eWeaponHitSecondaryCandidates(input.state,input.event,secondaryOperation!) : []
  if (selectedSecondaryTargetIds.some(id => !secondaryCandidates.some(candidate => candidate.id === id))) return {ok:false,reason:'invalid-secondary-targets'}
  const grant = dnd5eWeaponHitActivityGrant(input.state, input.event, input.packageId, activity)
  const castLevel = grant?.source.spellLevel
  if (activity.requiresEffectGrant && !grant) return { ok: false, reason: 'weapon-hit-activity-not-owned' }
  if (activity.invocation?.kind !== 'triggered' || activity.invocation.event !== 'attack-hit' ||
    !['actor-choice', 'automatic'].includes(activity.invocation.confirmation) || activity.activation.kind !== 'free' ||
    activity.authorityBinding || activity.scaling?.some(rule => (rule.basis === 'slot-level' && castLevel == null) || rule.areaRadiusFeetPerStep ||
      rule.adjustments?.some(adjustment => adjustment.operationId !== operation?.id || adjustment.additionalTargetsPerStep ||
        adjustment.additionalProjectilesPerStep || adjustment.additionalUsesPerStep || adjustment.durationRoundsPerStep)) || (activity.choices?.length && !hasSelectedCharm) || (activity.checks?.length && !hasTargetSaveEffect) ||
    (activity.effects?.length && !hasDefense && !hasTargetSaveEffect && !hasLinkedEffects && !hasProne && !hasPostHitBanishment) ||
    (activity.outcomes.length !== 1 && !hasTargetSaveEffect) || activity.outcomes[0].when.kind !== 'always' || (operations.length !== 1 && !hasDefense && !hasTargetSaveEffect && !hasSecondary && !hasPush && !hasLinkedEffects && !hasProne && !hasPostHitBanishment) ||
    operation.kind !== 'damage' || operation.target !== 'target' || operation.damageSource || operation.cannotBeReduced || operation.destroysBodyOnDeath ||
    activity.consumption?.some(cost => cost.kind !== 'resource' || cost.consumeOn !== 'resolve' || collectDnd5eFormulaRollDeclarations([cost.amount]).length > 0)) {
    return { ok: false, reason: 'weapon-hit-activity-shape-unsupported' }
  }
  const triggerContext = dnd5eActivityTriggerContextsFromCombatEventV1(input.state, input.event, 0, input.eventBatchId)
    .find(context => context.event === 'attack-hit')
  if (!triggerContext) return { ok: false, reason: 'weapon-hit-evidence-missing' }
  const resolution = resolveDnd5eActivityCommand({
    command: { schemaVersion: 1, commandId: `weapon-hit:${dnd5eExecutionEventKey(input.eventBatchId)}`,
      actorId: actor.id, targetIds: [target.id], packageId: input.packageId, packageVersion: input.packageVersion,
      activityId: input.activityId, expectedRevision: input.combatRevision, triggerEventId: triggerContext.eventId, castLevel, choices: input.choices },
    currentRevision: input.combatRevision, combatActive: dnd5eOrdinaryWeaponScene(input.state)?false:input.state.active,
    currentTurnActorId: !dnd5eOrdinaryWeaponScene(input.state)&&input.state.active ? input.state.initiativeOrder[input.state.initiativeIndex] : undefined,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, input.state),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(target, actor, input.state)],
    combatants: Object.values(input.state.combatants).map(creature => dnd5eActivityActorSnapshotFromCombatantV1(creature, actor, input.state)),
    distanceFeetBetweenTargets: { [target.id]: Object.fromEntries(Object.values(input.state.combatants).flatMap(creature => {
      const distance = input.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(target.id, creature.id)]
      return distance == null ? [] : [[creature.id, distance]]
    })) },
    usedTurnKeys: new Set(Object.entries(actor.classState.declarativeUsedTurnKeys ?? {})
      .filter(([, turn]) => turn === dnd5eWeaponActivityTurnKey(input.state,dnd5eHeadlessTurnKey(input.state, actor.id))).map(([key]) => key)),
    authoritativeRolls: input.authoritativeRolls,
    ...(hasTargetSaveEffect && save?.kind === 'saving-throw' ? { checkRollModes: { [`${save.id}:${target.id}`]: save.rollMode === 'host-derived'
      ? dnd5eSavingThrowMode(target, save.ability, { effectVisible: true, sourceCreatureType: actor.creatureType, sourceIsSpell: activity.legacySource?.kind === 'spell' })
      : save.rollMode ?? 'normal' } } : {}),
    triggerContext, confirmedBy: activity.invocation.confirmation === 'automatic' ? 'system' : 'actor', parentDamageType: input.event.damageType,
    distanceFeetByTargetId: { [target.id]: input.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actor.id, target.id)] ?? Number.POSITIVE_INFINITY },
  })
  if (!resolution.ok) return { ok: false, reason: resolution.reason }
  if (resolution.status !== 'resolved' || (hasTargetSaveEffect ? ![1,2].includes(resolution.proposals.length) : resolution.proposals.length !== (hasLinkedEffects?4:hasFollow?3:hasDefense || hasSecondary || hasPush || hasProne || hasPostHitBanishment ? 2 : 1)) || resolution.proposals[0].kind !== 'deal-damage' ||
    resolution.proposals[0].targetId !== target.id) return { ok: false, reason: 'weapon-hit-resolution-unsupported' }
  if (hasPostHitBanishment && (resolution.proposals[1]?.kind !== 'weapon-hit-banishment' ||
    resolution.proposals[1].targetId !== target.id || resolution.proposals[1].maximumHitPoints !== 50 ||
    !grant?.grantedActivitiesSingleUse || !grant.source.executionId || !actor.concentrating || !actor.classState.concentrationSpellId ||
    actor.classState.concentrationSpellId !== `${input.packageId}:${activity.legacySource!.id}`))
    return {ok:false,reason:'weapon-hit-banishment-source-invalid'}
  const defenseProposal = resolution.proposals[1]
  const defenseAmount = defenseProposal?.kind === 'apply-effect' ? defenseProposal.modifierGroups[0]?.armorClassBonus : undefined
  const weaknessRules = defenseProposal?.kind === 'apply-effect' ? defenseProposal.modifierGroups[0]?.weaponDamageMultipliers : undefined
  const sightCap = defenseProposal?.kind === 'apply-effect' ? defenseProposal.modifierGroups[0]?.sightRangeLimitFeet : undefined
  const targetModifier = defense?.modifiers?.[0]
  if (hasTargetSaveEffect && !hasSelectedCharm && !hasConcentrationFear && !hasBoundTimedDebilitation && defenseProposal && (defenseProposal.kind !== 'apply-effect' || defenseProposal.targetId !== target.id ||
    (targetModifier?.kind === 'sight-range-limit' ? sightCap !== targetModifier.rangeFeet :
    targetModifier?.kind !== 'weapon-damage-multiplier' || weaknessRules?.length !== 1 || weaknessRules[0].multiplier !== targetModifier.multiplier))) return {ok:false,reason:'weapon-hit-resolution-unsupported'}
  if (hasDefense && (defenseProposal?.kind !== 'apply-effect' || defenseProposal.targetId !== actor.id || defenseAmount == null ||
    !Number.isSafeInteger(defenseAmount) || defenseAmount < 0 || defenseAmount > 1000)) return {ok:false,reason:'weapon-hit-resolution-unsupported'}
  if (hasSecondary && (resolution.proposals[1]?.kind !== 'select-secondary-weapon-damage' ||
    resolution.proposals[1].damageOperationId !== operation.id)) return {ok:false,reason:'weapon-hit-resolution-unsupported'}
  const secondaryAmount = hasSecondary && operation.amount.kind === 'dice' ? input.authoritativeRolls[operation.amount.rollId]?.values[0] : undefined
  if (hasSecondary && (!Number.isSafeInteger(secondaryAmount) || secondaryAmount! < 1)) return {ok:false,reason:'invalid-rolls'}
  const pushProposal = resolution.proposals[1]?.kind === 'move' ? resolution.proposals[1] : undefined
  if(hasFollow&&resolution.proposals[2]?.kind!=='select-reaction-follow')return {ok:false,reason:'weapon-hit-resolution-unsupported'}
  if (hasPush && (!pushProposal || pushProposal.targetId !== target.id || pushProposal.mode !== 'push' ||
    !Number.isFinite(pushProposal.distanceFeet) || pushProposal.distanceFeet < 0 || pushProposal.distanceFeet > 1000)) return {ok:false,reason:'invalid-push-distance'}
  let pushMovements:Dnd5eWeaponHitDecision['pushMovements']
  if (hasPush && input.selectedPushCell != null) {
    if (!input.map) return {ok:false,reason:'push-map-required'}
    const planned = planDnd5eWeaponHitPushAndFollow({state:input.state,map:input.map,actorId:actor.id,targetId:target.id,
      maximumPushFeet:pushProposal!.distanceFeet,pushCell:input.selectedPushCell})
    if (!planned.ok) return {ok:false,reason:planned.reason}
    if (planned.push) pushMovements=[{...planned.push,activityId:activity.id,maximumFeet:pushProposal!.distanceFeet}]
  }
  const resourceCosts: { resourceId: string; amount: number }[] = []
  for (const cost of resolution.consumptions) {
    if (cost.kind !== 'resource' || cost.amount < 1 || !Number.isInteger(cost.amount)) return { ok: false, reason: 'weapon-hit-cost-unsupported' }
    resourceCosts.push({ resourceId: cost.resourceId, amount: cost.amount })
  }
  const totals = new Map<string, number>()
  for (const cost of resourceCosts) totals.set(cost.resourceId, (totals.get(cost.resourceId) ?? 0) + cost.amount)
  for (const [id, amount] of totals) if ((actor.classResources[id]?.current ?? 0) < amount)
    return { ok: false, reason: 'weapon-hit-resource-unavailable' }
  const dice = operation.weaponDiceFromTrigger
  const declaredIds = dice ? [dice.rollId] : collectDnd5eFormulaRollDeclarations([operation.amount]).map(roll => roll.id)
  if (hasTargetSaveEffect && save) declaredIds.push(`${save.rollId}:${target.id}`)
  if (Object.keys(input.authoritativeRolls).some(key => !declaredIds.includes(key))) return { ok: false, reason: 'invalid-rolls' }
  const rolled = resolution.proposals[0].diceAudit?.some(die => die.count > 0) === true
  const amount = resolution.proposals[0].amount
  if (!Number.isSafeInteger(amount) || amount < 0) return { ok: false, reason: 'invalid-rolls' }
  return { ok: true, definitionSignature: signature,
    ...(hasPush && input.selectedPushCell === undefined ? {pushSelectionRequired:{maximumFeet:pushProposal!.distanceFeet}} : {}), decision: {
    ...((hasProne || hasLinkedEffects || (hasSelectedCharm || hasConcentrationFear || hasBoundTimedDebilitation) && defenseProposal) ? { linkedEffectApplications: [{ packageId: input.packageId, activityId: activity.id,
      targetId: target.id, sourceId: activity.legacySource?.id ?? activity.id,
      sourceKind: activity.legacySource?.kind === 'spell' ? 'spell' : 'feature',
      resolution: { ...resolution, consumptions: [], checks: [], proposals: resolution.proposals.slice(1) } }] } : {}),
    ...(hasPostHitBanishment ? {planarBanishments:[{packageId:input.packageId,activityId:activity.id,
      targetId:target.id,sourceId:activity.legacySource!.id,sourceConcentrationId:actor.classState.concentrationSpellId!,
      sourceExecutionId:grant!.source.executionId!,sourceGrantEffectId:grant!.id,maximumHitPoints:50 as const}]} : {}),
    ...(pushMovements ? {pushMovements} : {}),
    ...(hasFollow?{followRequests:[{packageId:input.packageId,activityId:activity.id,actorId:actor.id,targetId:target.id,targetRadiusFeet:followOperation!.targetRadiusFeet}]}:{}),
    ...(hasSecondary ? {secondaryDamageTargets:selectedSecondaryTargetIds.map(targetId=>({targetId,amount:secondaryAmount!}))} : {}),
    ...(hasTargetSaveEffect && sightCap != null ? {targetSightLimits:[{packageId:input.packageId,activityId:activity.id,effectId:defense!.id,label:defense!.name,targetId:target.id,rangeFeet:sightCap,magical:defense?.magical === true || activity.legacySource?.magical === true}]} : {}),
    ...(hasDefense ? {actorArmorBonuses:[{packageId:input.packageId,activityId:activity.id,effectId:defense!.id,label:defense!.name,amount:defenseAmount!}]} : {}),
    ...(hasTargetSaveEffect && weaknessRules ? {targetWeaponMultipliers:[{packageId:input.packageId,activityId:activity.id,effectId:defense!.id,label:defense!.name,targetId:target.id,multiplier:weaknessRules[0].multiplier,magical:defense?.magical === true || activity.legacySource?.magical === true}]} : {}),
    ...(grant?.grantedActivitiesSingleUse ? { consumedGrants: [{ packageId: input.packageId, activityId: activity.id, effectId: grant.id }] } : {}),
    usageKeys: [...new Set(activity.requirements?.flatMap(requirement => requirement.kind === 'once-per-turn' ? [requirement.key] : []) ?? [])],
    ...((input.event.attackCategory !== 'weapon' || operation.damageType !== 'inherit-primary' || operation.magical != null)
      ? { damageComponents: [{ amount, type: resolution.proposals[0].damageType, magical: operation.magical ?? grant?.source.magical, rolled }] }
      : dice && !activity.scaling?.length ? { extraDice: { count: dice.count, rolls: [...input.authoritativeRolls[dice.rollId].values], doubleOnCritical: operation.critical === 'double-dice' } }
      : { resolvedBonusDamage: amount, resolvedBonusDamageRolled: rolled }), resourceCosts,
  } }
}

import { stageDnd5eActivityCounterattacks } from './dnd5eActivityCounterattackCheckpoint'
import { createDnd5eActivityNegationSession } from './dnd5eActivityDisadvantageNegation'
import { dnd5eInterruptedFeatureSpellActivity } from './dnd5eInterruptedFeatureSpell'
import { dnd5eInventoryExchangeRitualReady } from '../inventoryExchangeRitual'
import { dnd5eAttackActionSlot } from '../attackActionSlot'
import { advanceDnd5eAttackActionHistory } from '../attackActionHistory'
import { dnd5eHeadlessTurnKey, grantDnd5eFirstOwnTurnWeaponAttack, dnd5eDistinctTargetBonusAttackFeatures } from '../headlessCombatEngine'
import { dnd5eInventoryExchangeOwnerMatchesActor } from '../inventoryExchangeAuthority'
import { settleDnd5eInventoryExchangeOnMap } from '../inventoryExchangeMap'
import type { BattleMap } from '../../../store/maps'
import { applyDnd5eInventoryExchange } from '../inventoryExchange'
import { expireDnd5eSourceBoundInventory } from '../items'
import { consumeDnd5eWeaponAmmunition } from '../items'
import { stampDnd5eActivityGrantProvenance } from './dnd5eActivityGrantProvenance'
import { alterDnd5eInventoryItem } from '../inventoryItemAlteration'
import { dnd5eInventoryItemTemplate } from '../items'
import type { Dnd5eRollDiceAudit } from '../rollDiceTransaction'
import {
  commitDnd5eActivityExecution,
  dnd5eFeatureSpellInvocationTurnAllowed,
  recordDnd5eFeatureSpellInvocation,
  previewDnd5eFeatureSpellInvocation,
  dnd5eCanReceiveCreatedWeaponsInHand,
  resolveDnd5eHeadlessAction,
  settleDnd5eCriticalCancellationCheckpoint,
  type Dnd5eCombatEvent,
  type Dnd5eActivityAuthorityCommitResult,
  type Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import {
  resolveDnd5eActivityCommand,
  type Dnd5eActivityAuthorityInput,
  type Dnd5eActivityAuthorityResult,
} from './dnd5eActivityCommand'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import type {
  Dnd5eActivityCapabilityProposal,
  Dnd5eActivityExecutionResult,
  Dnd5eResolvedActivityConsumption,
} from './dnd5eActivityExecutor'
import {
  applyDnd5eInventoryActivityCosts,
  applyDnd5eInventoryGrantBundle,
  applyDnd5eInventoryMutation,
  normalizeDnd5eInventory,
  type Dnd5eInventoryActivityCost,
  type Dnd5eInventoryActivityCostFailure,
} from '../items'
import type { Character } from '../../../types/character'
import type { Dnd5eInventoryMutationFailure } from '../../../types/inventory'
import { dnd5eLinkedPlanarObjectAuthorityRecordId } from '../spellAuthorityState'
import { prepareDnd5eActivityContinuationV1, finishDnd5eActivityContinuationV1 } from './dnd5eActivityContinuation'

export interface Dnd5eItemActivityCommitMetadata {
  /** Successful replacement receipt; map caller commits this to its existing turn ledger. */
  equipmentAttackSlot?: ReturnType<typeof dnd5eAttackActionSlot>
  rollDiceAudit?: readonly Dnd5eRollDiceAudit[]
  inventoryOwner?: Character
  inventoryDeduplicated?: boolean
  map?: BattleMap
}

export type Dnd5eActivityHeadlessAuthorityBridgeResult =
  | { phase: 'resolve'; result: Extract<Dnd5eActivityAuthorityResult, { ok: false }> }
  | {
      phase: 'inventory'
      result: {
        ok: false
        reason: Dnd5eInventoryActivityCostFailure | Dnd5eInventoryMutationFailure |
          'inventory-context-required' | 'inventory-item-mismatch' | 'inventory-alteration-failed' | 'ammunition-unavailable'
      }
    }
  | { phase: 'commit'; result: Dnd5eActivityAuthorityCommitResult & Dnd5eItemActivityCommitMetadata }

type Dnd5eResolvedItemChargeConsumption = Dnd5eResolvedActivityConsumption & {
  kind: 'item-charge'
  resourceId: string
  amount: number
  itemTemplateIds?: readonly string[]
}

type Dnd5eResolvedInventoryGrantProposal = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'grant-inventory-item' }
>

type Dnd5eResolvedInventoryIdentifyProposal = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'identify-inventory-item' }
>

type Dnd5eResolvedInventoryPurifyProposal = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'purify-inventory-item' }
>

type Dnd5eResolvedInventoryAttunementBreakProposal = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'break-inventory-item-attunement' }
>

type Dnd5eResolvedSpellAuthorityProposal = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'establish-spell-authority' }
>

type Dnd5eResolvedSpellAuthorityTransitionProposal = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'transition-spell-authority' }
>

function isResolvedItemChargeConsumption(
  consumption: Dnd5eResolvedActivityConsumption,
): consumption is Dnd5eResolvedItemChargeConsumption {
  return consumption.kind === 'item-charge'
}

function consumptionApplies(
  consumption: Dnd5eResolvedActivityConsumption,
  resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }>,
  dmApproved: boolean,
): boolean {
  if (consumption.consumeOn === 'hit') return resolution.checks.some((check) => check.success)
  if (consumption.consumeOn === 'dm-approval') return dmApproved
  return true
}

function itemActivityCost(
  resourceId: string,
  amount: number,
  templateId: string,
): Dnd5eInventoryActivityCost | undefined {
  if (resourceId === 'selected-item:quantity') return { kind: 'quantity', amount }
  if (resourceId === 'selected-item:charges') return { kind: 'resource', resourceId: 'uses', amount }
  const prefix = `item:${templateId}:`
  if (!resourceId.startsWith(prefix)) return undefined
  const resource = resourceId.slice(prefix.length)
  if (resource === 'quantity') return { kind: 'quantity', amount }
  if (resource === 'charges') return { kind: 'resource', resourceId: 'uses', amount }
  if (resource.startsWith('resource:') && resource.length > 'resource:'.length) {
    return { kind: 'resource', resourceId: resource.slice('resource:'.length), amount }
  }
  return undefined
}

/** Resolve registered Activity content and atomically commit its state effects. */
export function resolveAndCommitDnd5eActivityCommand(
  source: Dnd5eHeadlessCombatState,
  authority: Dnd5eActivityAuthorityInput,
  options: { distinctTargetBonusAttackFeatureId?: string; featureAttackBudget?: Parameters<typeof dnd5eAttackActionSlot>[0]; equipmentAttackBudget?: Parameters<typeof dnd5eAttackActionSlot>[0]; allowInactiveAwakeningCommit?: boolean; allowInactiveRestCommit?: boolean; allowInactiveDamageReactionCommit?: boolean; allowInactiveDeathReactionCommit?: boolean; exchangeScene?: { map: BattleMap; actorTokenId: string }; worldMinute?: number } = {},
): Dnd5eActivityHeadlessAuthorityBridgeResult {
  const activity = getRegisteredDnd5eActivity(authority.command.packageId, authority.command.activityId)
  if (authority.sourceActionInterruptionReaction && !activity?.spellInvocation) return {phase:'resolve',result:{ok:false,reason:'invalid-command',details:['source-interruption-requires-spell-invocation']}}
  if (activity?.spellInvocation) {
    const allowed = previewDnd5eFeatureSpellInvocation(source, {
      actorId: authority.command.actorId, spellcastingSavingThrows: authority.spellcastingSavingThrows,
      sourceActionInterruptionReaction: authority.sourceActionInterruptionReaction,
      counterspellReaction: authority.counterspellReaction,
    }, activity.spellInvocation)
    if (allowed == null) return {phase:'resolve',result:{ok:false,reason:'invalid-command',details:['feature-spell-checkpoint-invalid']}}
    authority = { ...authority, featureSpellInvocationInterrupted: !allowed }
  } else authority = { ...authority, featureSpellInvocationInterrupted: false }
  if (activity?.spellInvocation && !dnd5eFeatureSpellInvocationTurnAllowed(source, authority.command.actorId,
    activity.spellInvocation, activity.activation.kind)) {
    return {phase:'resolve',result:{ok:false,reason:'invalid-command',details:['feature-spell-turn-restriction']}}
  }
  const conditionalBonusId = options.distinctTargetBonusAttackFeatureId
  if (conditionalBonusId && (!options.featureAttackBudget || !activity?.usesAttackActionAttack ||
    !Number.isSafeInteger(options.featureAttackBudget.attacksUsed) || options.featureAttackBudget.attacksUsed < 0 ||
    !dnd5eAttackActionSlot({ ...options.featureAttackBudget, attacksUsed: 0 }) ||
    activity.target.kind !== 'creature' || authority.command.targetIds.length !== 1 ||
    !activity.checks?.some(check => check.kind === 'attack-roll') ||
    !dnd5eDistinctTargetBonusAttackFeatures(source, authority.command.actorId, authority.command.targetIds[0])
      .some(feature => feature.id === conditionalBonusId))) {
    return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: ['distinct-target-bonus-unavailable'] } }
  }
  const featureAttackSlot = conditionalBonusId && options.featureAttackBudget
    ? { attackNumber: options.featureAttackBudget.attacksUsed + 1,
        attacksAllowed: options.featureAttackBudget.attacksUsed + 1, spendsAction: false }
    : options.featureAttackBudget && dnd5eAttackActionSlot({
    ...options.featureAttackBudget, attackKind: 'replacement',
  })
  if ((activity?.usesAttackActionAttack || options.featureAttackBudget) && (
    !activity?.usesAttackActionAttack || !featureAttackSlot || options.equipmentAttackBudget ||
    !source.active || source.initiativeOrder[source.initiativeIndex] !== authority.command.actorId ||
    (!featureAttackSlot.spendsAction && source.combatants[authority.command.actorId]?.classState.weaponAttackActionTurnKey !==
      dnd5eHeadlessTurnKey(source,authority.command.actorId))
  )) return {phase:'resolve',result:{ok:false,reason:'invalid-command',details:['activity-attack-action-budget-unavailable']}}
  const equipmentAttackSlot = featureAttackSlot ?? (options.equipmentAttackBudget && dnd5eAttackActionSlot({
    ...options.equipmentAttackBudget, attackKind: 'replacement',
  }))
  if (options.equipmentAttackBudget && (!equipmentAttackSlot || !authority.equipmentWeaponDamage ||
    !source.active || source.initiativeOrder[source.initiativeIndex] !== authority.command.actorId ||
    activity?.activation.kind !== 'free' || activity.legacySource?.kind === 'spell' || activity.spellInvocation ||
    activity.authorityBinding || activity.invocation?.kind === 'triggered' ||
    activity.checks?.some(check => check.kind === 'attack-roll') ||
    activity.consumption?.some(cost => cost.kind === 'action-economy') ||
    !activity.outcomes.some(outcome => outcome.operations.some(op => op.kind === 'damage' && op.equipmentWeaponDamage)))) {
    return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: ['activity-equipment-attack-replacement-unavailable'] } }
  }
  // Native bindings own their rolls and costs; generic choices cannot be silently dropped at dispatch.
  if (activity?.authorityBinding && Object.keys(authority.disadvantageNegationChoices ?? {}).length) {
    return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: ['activity-negation-native-owner-required'] } }
  }
  const continuation = activity ? prepareDnd5eActivityContinuationV1(source, authority.command, activity, authority.authoritativeRolls) : undefined
  if (continuation?.error) return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: [continuation.error] } }
  const negation = authority.disadvantageNegationChoices ? createDnd5eActivityNegationSession({
    state: source, activityId: authority.command.activityId, actionId: authority.command.commandId,
    choices: authority.disadvantageNegationChoices,
  }) : undefined
  let executionAuthority = { ...authority, negateDisadvantage: negation?.negate ?? authority.negateDisadvantage, continuationTargetIds: continuation?.pending?.finishActivityId === activity?.id ? continuation?.pending?.visitedTargetIds : undefined, authoritativeRolls: continuation?.rolls ?? authority.authoritativeRolls }
  let counterCheckpoint: ReturnType<typeof stageDnd5eActivityCounterattacks>
  try { counterCheckpoint = stageDnd5eActivityCounterattacks(source, activity, executionAuthority) }
  catch { return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: ['activity-counterattack-invalid'] } } }
  if (counterCheckpoint.requestedKeys.size) executionAuthority = { ...executionAuthority,
    weaponCounterattackSuccessCheckKeys: counterCheckpoint.successKeys }
  let resolution = resolveDnd5eActivityCommand(executionAuthority)
  if (!resolution.ok) return { phase: 'resolve', result: resolution }
  const resolvedSavingThrowKeys = new Set(resolution.checks.filter(check => check.kind === 'saving-throw').map(check => check.key))
  if ([...counterCheckpoint.requestedKeys].some(key => !resolvedSavingThrowKeys.has(key)))
    return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: ['activity-counterattack-unused'] } }

  if (negation && !negation.complete()) return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: ['activity-negation-unused-choice'] } }
  const nativeBinding = activity?.authorityBinding
  if (nativeBinding?.execution === 'headless-event-engine') {
    return {
      phase: 'resolve',
      result: {
        ok: false,
        reason: 'invalid-command',
        details: ['This Activity is settled by the authoritative combat event that opened it.'],
      },
    }
  }
  if (nativeBinding?.execution === 'plugin-headless-action') {
    const targetId = authority.command.targetIds[0] ?? authority.command.actorId
    const result = resolveDnd5eHeadlessAction(source, {
      type: 'plugin',
      pluginId: authority.command.packageId,
      actionId: nativeBinding.actionId!,
      transactionId: authority.command.commandId,
      featureId: `${authority.command.packageId}:${nativeBinding.subclassId}.${nativeBinding.abilityId}`,
      actorId: authority.command.actorId,
      targetId,
      targetIds: [...authority.command.targetIds],
      distanceFeet: authority.distanceFeetByTargetId?.[targetId],
      rolls: Object.fromEntries(Object.entries(authority.authoritativeRolls).map(([id, roll]) => [id, {
        values: [...roll.values],
        modifier: 0,
        total: roll.values.reduce((total, value) => total + value, 0),
      }])),
      interruptChoiceId: authority.command.choices?.interrupt ?? (authority.dmApproved ? 'dm-apply' : undefined),
    })
    return { phase: 'commit', result }
  }
  const reactionState = structuredClone(counterCheckpoint.state), reactionEvents: Dnd5eCombatEvent[] = [...counterCheckpoint.events]
  const cancelledCriticalCheckKeys = new Set<string>()
  for (const check of resolution.checks) {
    if (check.kind !== 'attack-roll' || !check.success || !check.criticalSuccess || !check.targetId || check.dc == null) continue
    const event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }> = {
      type: 'attack-resolved', actorId: authority.command.actorId, targetId: check.targetId,
      d20: check.d20, total: check.total, armorClass: check.dc, hit: true, critical: true,
      activityId: authority.command.activityId,
    }
    if (!settleDnd5eCriticalCancellationCheckpoint(reactionState, event, reactionEvents)) {
      return { phase: 'commit', result: { ok: false, state: structuredClone(source), events: [], reason: 'reaction-unavailable' } }
    }
    if (!event.critical) cancelledCriticalCheckKeys.add(check.key)
  }
  if (cancelledCriticalCheckKeys.size > 0) {
    resolution = resolveDnd5eActivityCommand({ ...executionAuthority, cancelledCriticalCheckKeys, allowCriticalDiceSuperset: true })
    if (!resolution.ok) return { phase: 'resolve', result: resolution }
  }
  const applicableItemConsumptions = resolution.consumptions.filter(
    (consumption): consumption is Dnd5eResolvedItemChargeConsumption =>
      isResolvedItemChargeConsumption(consumption) &&
      consumptionApplies(consumption, resolution, authority.dmApproved === true),
  )
  const inventoryGrantProposals = resolution.proposals.filter(
    (proposal): proposal is Dnd5eResolvedInventoryGrantProposal =>
      proposal.kind === 'grant-inventory-item',
  )
  const inventoryIdentifyProposals = resolution.proposals.filter(
    (proposal): proposal is Dnd5eResolvedInventoryIdentifyProposal =>
      proposal.kind === 'identify-inventory-item',
  )
  const inventoryPurifyProposals = resolution.proposals.filter(
    (proposal): proposal is Dnd5eResolvedInventoryPurifyProposal =>
      proposal.kind === 'purify-inventory-item',
  )
  const inventoryAttunementBreakProposals = resolution.proposals.filter(
    (proposal): proposal is Dnd5eResolvedInventoryAttunementBreakProposal =>
      proposal.kind === 'break-inventory-item-attunement',
  )
  const inventoryLinkedAuthorityProposals = resolution.proposals.filter(
    (proposal): proposal is Dnd5eResolvedSpellAuthorityProposal =>
      proposal.kind === 'establish-spell-authority' &&
      proposal.recordKind === 'linked-planar-object',
  )
  const inventoryLinkedAuthorityTransitions = resolution.proposals.filter(
    (proposal): proposal is Dnd5eResolvedSpellAuthorityTransitionProposal =>
      proposal.kind === 'transition-spell-authority' &&
      proposal.recordKind === 'linked-planar-object',
  )
  let inventoryOwner: Character | undefined
  const inventoryAlterations = resolution.proposals.filter(proposal => proposal.kind === 'alter-inventory-item')
  if (inventoryAlterations.length > 0) {
    // A selected-item charge cost currently reloads its own pre-action snapshot.
    // Reject that combination until both operations share an inventory ledger.
    if (applicableItemConsumptions.length > 0) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    const proposal = inventoryAlterations[0]
    if (proposal.selectionRangeFeet != null) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    const actorCharacterId = authority.actor.characterId ?? authority.command.actorId
    const recipients = proposal.ownerActorId == null ? [authority.actor]
      : authority.targets.filter(target => target.id === proposal.ownerActorId)
    const expectedOwnerId = proposal.ownerActorId == null ? actorCharacterId
      : recipients.length === 1 ? recipients[0].characterId ?? recipients[0].id : undefined
    const owners = (authority.inventoryRoster ?? (authority.inventoryOwner ? [authority.inventoryOwner] : []))
      .filter(owner => owner.id === expectedOwnerId)
    const currentOwner = owners.length === 1 ? owners[0] : undefined
    const { inventoryInstanceId, expectedInventoryRevision } = authority.command
    if (inventoryAlterations.length !== 1 || !currentOwner || recipients.length !== 1 ||
        authority.command.inventoryOwnerId != null && authority.command.inventoryOwnerId !== currentOwner.id ||
        !inventoryInstanceId || proposal.inventoryInstanceId !== inventoryInstanceId || expectedInventoryRevision == null ||
        (proposal.permanent ? proposal.sourceEffectTag != null || proposal.sourceEffectId != null || proposal.sourceSpellcastingModifier != null
          : !proposal.sourceEffectTag)) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    const inventory = normalizeDnd5eInventory(currentOwner)
    const original = inventory.entries.find(entry => entry.instanceId === inventoryInstanceId)
    // Normalization may discard a legacy charge field from a mundane template.
    // Do not let that erase a restriction before alteration authority checks it.
    if (currentOwner.dnd5eInventory?.entries.some(entry => entry.instanceId === inventoryInstanceId && entry.remainingCharges != null))
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-alteration-failed' } }
    const replacement = dnd5eInventoryItemTemplate(proposal.templateId)
    if (!original || !proposal.originalTemplateIds.includes(original.templateId) || !replacement)
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-item-mismatch' } }
    const altered = alterDnd5eInventoryItem({ ...currentOwner, dnd5eInventory: inventory }, {
      expectedInventoryRevision, instanceId: inventoryInstanceId, quantity: proposal.quantity, replacement,
      sourceEffectTag: proposal.sourceEffectTag, sourceEffectOwnerId: proposal.permanent ? undefined : actorCharacterId,
      permanent: proposal.permanent,
      sourceSpellcastingModifier: proposal.sourceSpellcastingModifier,
      splitInstanceId: crypto.randomUUID(),
    })
    if (!altered.ok) return { phase: 'inventory', result: { ok: false, reason: 'inventory-alteration-failed' } }
    inventoryOwner = altered.character
  }
  let completedExchangeRitual = false
  let exchangeMap: BattleMap | undefined
  const exchanges = resolution.proposals.filter(proposal => proposal.kind === 'exchange-inventory-items')
  if (authority.command.inventoryExchange && !exchanges.length) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
  if (exchanges.length) {
    const owner = authority.inventoryOwner, selection = authority.command.inventoryExchange
    if (exchanges.length !== 1 || !owner || !dnd5eInventoryExchangeOwnerMatchesActor(authority) || !selection ||
      inventoryAlterations.length || applicableItemConsumptions.length || inventoryGrantProposals.length ||
      inventoryIdentifyProposals.length || inventoryPurifyProposals.length || inventoryAttunementBreakProposals.length ||
      inventoryLinkedAuthorityProposals.length || inventoryLinkedAuthorityTransitions.length)
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    const proposal = exchanges[0]
    if (activity?.activation.kind === 'minute' || activity?.activation.kind === 'hour') {
      if (!dnd5eInventoryExchangeRitualReady(authority, options.worldMinute)) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
      completedExchangeRitual = true
    }
    const exchange = { ...selection, characterId: owner.id, receiptId: authority.command.commandId,
      output: { templateId: proposal.templateId, quantity: proposal.quantity } }
    if (proposal.sceneRangeFeet != null) {
      const scene = options.exchangeScene
      if (!scene || !selection.targetCell || (authority.actor.id !== owner.id && scene.actorTokenId !== authority.actor.id)) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
      const exchanged = settleDnd5eInventoryExchangeOnMap({ map: scene.map, characters: [owner], actorTokenId: scene.actorTokenId,
        targetCell: selection.targetCell, exchange, policy: proposal.policy, rangeFeet: proposal.sceneRangeFeet })
      if (!exchanged.ok) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
      if (exchanged.deduplicated) return { phase: 'commit', result: { ok: true, state: structuredClone(source), events: [],
        inventoryOwner: owner, map: exchanged.map, inventoryDeduplicated: true } }
      inventoryOwner = exchanged.characters[0]
      exchangeMap = exchanged.map
    } else {
      if (selection.targetCell) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
      const exchanged = applyDnd5eInventoryExchange([owner], exchange, proposal.policy)
      if (!exchanged.ok) return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
      if (exchanged.deduplicated) return { phase: 'commit', result: { ok: true, state: structuredClone(source), events: [],
        inventoryOwner: exchanged.characters[0], inventoryDeduplicated: true } }
      inventoryOwner = exchanged.characters[0]
    }
  }
  if (inventoryLinkedAuthorityProposals.length > 0) {
    const { inventoryInstanceId, expectedInventoryRevision } = authority.command
    const currentOwner = authority.inventoryOwner
    const inventory = currentOwner ? normalizeDnd5eInventory(currentOwner) : undefined
    const proposal = inventoryLinkedAuthorityProposals[0]
    if (
      inventoryLinkedAuthorityProposals.length !== 1 || !inventoryInstanceId ||
      expectedInventoryRevision == null || !currentOwner ||
      currentOwner.id !== authority.command.actorId || proposal.inventoryInstanceId !== inventoryInstanceId ||
      inventory?.revision !== expectedInventoryRevision ||
      !inventory.entries.some((entry) => entry.instanceId === inventoryInstanceId)
    ) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
  }
  if (applicableItemConsumptions.length > 0) {
    const { inventoryInstanceId, expectedInventoryRevision } = authority.command
    if (
      !inventoryInstanceId || expectedInventoryRevision == null || !authority.inventoryOwner ||
      authority.inventoryOwner.id !== authority.command.actorId
    ) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    const inventory = normalizeDnd5eInventory(authority.inventoryOwner)
    const entry = inventory.entries.find((candidate) => candidate.instanceId === inventoryInstanceId)
    const allowedTemplates = new Set(applicableItemConsumptions.flatMap((consumption) => consumption.itemTemplateIds ?? []))
    const sourceItemMatches = activity?.legacySource?.kind === 'item' && activity.legacySource.id === entry?.templateId
    const selectedItemMatches = !!entry && allowedTemplates.size > 0 && allowedTemplates.has(entry.templateId)
    if (!entry || (!sourceItemMatches && !selectedItemMatches)) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-item-mismatch' } }
    }
    const costs = applicableItemConsumptions.map((consumption) =>
      itemActivityCost(consumption.resourceId, consumption.amount, entry.templateId))
    if (costs.some((cost) => !cost)) {
      return { phase: 'inventory', result: { ok: false, reason: 'invalid-cost' } }
    }
    const inventoryResult = applyDnd5eInventoryActivityCosts(authority.inventoryOwner, {
      instanceId: inventoryInstanceId,
      costs: costs as Dnd5eInventoryActivityCost[],
      receiptId: authority.command.commandId,
      expectedInventoryRevision,
    })
    if (!inventoryResult.ok) return { phase: 'inventory', result: inventoryResult }
    if (inventoryResult.deduplicated) {
      return {
        phase: 'commit',
        result: {
          ok: true,
          state: structuredClone(source),
          events: [],
          inventoryOwner: inventoryResult.character,
          inventoryDeduplicated: true,
        },
      }
    }
    inventoryOwner = inventoryResult.character
  }
  if (inventoryIdentifyProposals.length > 0) {
    const { inventoryInstanceId, expectedInventoryRevision } = authority.command
    const currentOwner = inventoryOwner ?? authority.inventoryOwner
    if (
      inventoryIdentifyProposals.length !== 1 || !inventoryInstanceId ||
      expectedInventoryRevision == null || !currentOwner ||
      currentOwner.id !== authority.command.actorId
    ) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    const inventoryResult = applyDnd5eInventoryMutation([currentOwner], {
      type: 'identify', characterId: authority.command.actorId, instanceId: inventoryInstanceId,
      receiptId: authority.command.commandId, expectedInventoryRevision,
    })
    if (!inventoryResult.ok) {
      return {
        phase: 'inventory',
        result: { ok: false, reason: inventoryResult.reason ?? 'item-not-found' },
      }
    }
    if (inventoryResult.deduplicated) {
      return {
        phase: 'commit',
        result: {
          ok: true, state: structuredClone(source), events: [],
          inventoryOwner: inventoryResult.characters[0], inventoryDeduplicated: true,
        },
      }
    }
    inventoryOwner = inventoryResult.characters[0]
  }
  if (inventoryPurifyProposals.length > 0) {
    const { inventoryInstanceId, expectedInventoryRevision } = authority.command
    const currentOwner = inventoryOwner ?? authority.inventoryOwner
    if (
      inventoryPurifyProposals.length !== 1 || !inventoryInstanceId ||
      expectedInventoryRevision == null || !currentOwner ||
      currentOwner.id !== authority.command.actorId
    ) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    const inventoryResult = applyDnd5eInventoryMutation([currentOwner], {
      type: 'purify-consumable', characterId: authority.command.actorId,
      instanceId: inventoryInstanceId, receiptId: authority.command.commandId,
      expectedInventoryRevision,
    })
    if (!inventoryResult.ok) {
      return {
        phase: 'inventory',
        result: { ok: false, reason: inventoryResult.reason ?? 'item-not-found' },
      }
    }
    if (inventoryResult.deduplicated) {
      return {
        phase: 'commit',
        result: {
          ok: true, state: structuredClone(source), events: [],
          inventoryOwner: inventoryResult.characters[0], inventoryDeduplicated: true,
        },
      }
    }
    inventoryOwner = inventoryResult.characters[0]
  }
  if (inventoryAttunementBreakProposals.length > 0) {
    const { inventoryInstanceId, expectedInventoryRevision } = authority.command
    const currentOwner = inventoryOwner ?? authority.inventoryOwner
    const proposal = inventoryAttunementBreakProposals[0]
    if (
      inventoryAttunementBreakProposals.length !== 1 || !inventoryInstanceId ||
      expectedInventoryRevision == null || !currentOwner ||
      currentOwner.id !== proposal.ownerId
    ) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    const inventoryResult = applyDnd5eInventoryMutation([currentOwner], {
      type: 'break-cursed-attunement', characterId: proposal.ownerId,
      instanceId: inventoryInstanceId, receiptId: authority.command.commandId,
      expectedInventoryRevision,
    })
    if (!inventoryResult.ok) {
      return {
        phase: 'inventory',
        result: { ok: false, reason: inventoryResult.reason ?? 'item-not-found' },
      }
    }
    if (inventoryResult.deduplicated) {
      return {
        phase: 'commit',
        result: {
          ok: true, state: structuredClone(source), events: [],
          inventoryOwner: inventoryResult.characters[0], inventoryDeduplicated: true,
        },
      }
    }
    inventoryOwner = inventoryResult.characters[0]
  }
  if (inventoryGrantProposals.length > 0) {
    if(inventoryGrantProposals.some(proposal=>proposal.reuseSourceEffect && proposal.maximumPerSource!=null) && !authority.inventoryRoster)return {phase:'inventory',result:{ok:false,reason:'inventory-context-required'}}
    const currentOwner = inventoryOwner ?? authority.inventoryOwner
    if (!currentOwner || currentOwner.id !== authority.command.actorId) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    const requiresCampaignClock = inventoryGrantProposals.some((proposal) =>
      proposal.expiresAfterMinutes != null)
    const worldMinute = currentOwner.dnd5eWorldTimeAppliedMinute
    if (requiresCampaignClock && (!Number.isSafeInteger(worldMinute) || Number(worldMinute) < 0)) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    const generatedByRulesId = `activity:${authority.command.packageId}:${authority.command.activityId}`
      .toLowerCase()
      .replace(/[^a-z0-9._:-]+/g, '-')
      .slice(0, 200)
    const inventoryResult = applyDnd5eInventoryGrantBundle([currentOwner,...(authority.inventoryRoster??[]).filter(character=>character.id!==currentOwner.id)], {
      characterId: authority.command.actorId,
      grants: inventoryGrantProposals.map((proposal) => ({
        templateId: proposal.templateId,
        equipToFreeHand: proposal.equipToFreeHand,
        quantity: proposal.quantity,
        identified: proposal.identified,
        sourceEffectTag: proposal.sourceEffectTag,
              maximumPerSource: proposal.maximumPerSource,
              sourceSpellcastingModifier: proposal.sourceSpellcastingModifier,
        expiresAtWorldMinute: proposal.expiresAfterMinutes == null
          ? undefined
          : Number(worldMinute) + proposal.expiresAfterMinutes,
        generatedByRulesId,
      })),
      receiptId: authority.command.commandId,
    })
    if (!inventoryResult.ok) {
      return {
        phase: 'inventory',
        result: { ok: false, reason: inventoryResult.reason ?? 'invalid-quantity' },
      }
    }
    if (inventoryResult.deduplicated) {
      return {
        phase: 'commit',
        result: {
          ok: true,
          state: structuredClone(source),
          events: [],
          inventoryOwner: inventoryResult.characters[0],
          inventoryDeduplicated: true,
        },
      }
    }
    inventoryOwner = inventoryResult.characters[0]
  }
  if (inventoryLinkedAuthorityProposals.length > 0 || inventoryLinkedAuthorityTransitions.length > 0) {
    const currentOwner = inventoryOwner ?? authority.inventoryOwner
    const sourceActor = source.combatants[authority.command.actorId]
    if (!currentOwner || currentOwner.id !== authority.command.actorId || !sourceActor) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    const inventory = normalizeDnd5eInventory(currentOwner)
    const receiptId = `spell-authority:${authority.command.commandId}`
    if (!inventory.authorityUseReceipts?.includes(receiptId)) {
      let instanceId: string | undefined
      let recordId: string | undefined
      let planarState: 'material' | 'ethereal' = 'material'
      let clearLink = false
      const establishment = inventoryLinkedAuthorityProposals[0]
      const transition = inventoryLinkedAuthorityTransitions[0]
      if (establishment) {
        instanceId = establishment.inventoryInstanceId
        recordId = dnd5eLinkedPlanarObjectAuthorityRecordId(
          establishment.linkedObjectProfile!,
          authority.command.actorId,
          establishment.inventoryInstanceId!,
        )
        planarState = establishment.linkedObjectProfile === 'secret-chest' ? 'ethereal' : 'material'
      } else if (transition) {
        const record = Object.values(sourceActor.classState.spellAuthorityRecords ?? {}).find((candidate) =>
          (transition.authorityRecordId == null || candidate.id === transition.authorityRecordId) &&
          candidate.kind === 'linked-planar-object' && candidate.profile === transition.linkedObjectProfile)
        if (!record || record.kind !== 'linked-planar-object') {
          return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
        }
        instanceId = record.inventoryInstanceId
        recordId = record.id
        planarState = transition.transition === 'send-to-ethereal' ? 'ethereal' : 'material'
        clearLink = record.profile === 'instant-summons' && transition.transition === 'recall-to-source'
      }
      if (!instanceId || !inventory.entries.some((entry) => entry.instanceId === instanceId)) {
        return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
      }
      inventoryOwner = {
        ...currentOwner,
        dnd5eInventory: {
          ...inventory,
          revision: (inventory.revision ?? 0) + 1,
          entries: inventory.entries.map((entry) => entry.instanceId === instanceId
            ? {
                ...entry,
                planarState,
                linkedSpellAuthorityRecordId: clearLink ? undefined : recordId,
                equippedSlot: planarState === 'ethereal' ? undefined : entry.equippedSlot,
              }
            : entry),
          authorityUseReceipts: [...(inventory.authorityUseReceipts ?? []), receiptId].slice(-512),
        },
      }
    }
  }
  if (!dnd5eCanReceiveCreatedWeaponsInHand(source, authority.command.actorId, resolution.proposals)) {
    return { phase: 'commit', result: { ok: false, state: structuredClone(source), events: [], reason: 'invalid-target' } }
  }
  if (options.equipmentAttackBudget && equipmentAttackSlot) {
    if (!dnd5eInventoryExchangeOwnerMatchesActor(authority)) {
      return { phase: 'inventory', result: { ok: false, reason: 'inventory-context-required' } }
    }
    // Prepare an immutable inventory result; publish it only if combat also commits.
    const ammunition = consumeDnd5eWeaponAmmunition(inventoryOwner ?? authority.inventoryOwner!,
      authority.equipmentWeaponDamage!.profile.weaponId)
    if (!ammunition.ok) return { phase: 'inventory', result: { ok: false, reason: ammunition.reason } }
    inventoryOwner = ammunition.character
  }
  const commitResolution: typeof resolution = {
    ...resolution,
    consumptions: applicableItemConsumptions.length > 0
      ? resolution.consumptions.filter((consumption) => consumption.kind !== 'item-charge')
      : resolution.consumptions,
    proposals: exchanges.length > 0 || inventoryAlterations.length > 0 || inventoryGrantProposals.length > 0
      || inventoryIdentifyProposals.length > 0 || inventoryPurifyProposals.length > 0 ||
        inventoryAttunementBreakProposals.length > 0
      ? resolution.proposals.filter((proposal) =>
          proposal.kind !== 'exchange-inventory-items' && proposal.kind !== 'alter-inventory-item' && proposal.kind !== 'grant-inventory-item' && proposal.kind !== 'identify-inventory-item' &&
          proposal.kind !== 'purify-inventory-item' &&
          proposal.kind !== 'break-inventory-item-attunement')
      : resolution.proposals,
  }
  commitResolution.proposals = commitResolution.proposals.map(proposal =>
    proposal.kind === 'apply-effect' && proposal.disguiseFromGrant
      ? { ...proposal, disguiseGrantEffectId: authority.command.grantEffectId }
      : proposal.kind === 'recognize-granting-disguise' ? {...proposal, grantEffectId: authority.command.grantEffectId} : proposal)
  const sourceKind = activity?.spellInvocation || activity?.legacySource?.kind === 'spell'
    ? 'spell' as const
    : activity?.legacySource?.kind === 'item'
      ? 'item' as const
      : activity?.legacySource?.kind === 'monster' || activity?.legacySource?.kind === 'monster-action'
        ? 'action' as const
        : 'feature' as const
  if (equipmentAttackSlot?.spendsAction) commitResolution.consumptions = [...commitResolution.consumptions,
    { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }]
  // Apply only the validated resource delta after reaction checkpoints, preserving their own costs.
  if (negation) for (const [id, planned] of Object.entries(negation.state().combatants)) {
    for (const [key, resource] of Object.entries(planned.classResources)) {
      const amount = (source.combatants[id]?.classResources[key]?.current ?? resource.current) - resource.current
      if (amount <= 0) continue
      const live = reactionState.combatants[id]?.classResources[key]
      if (!live || live.current < amount) return { phase: 'resolve', result: { ok: false, reason: 'invalid-command', details: ['activity-negation-cost-unavailable'] } }
      live.current -= amount
    }
  }
  let committed = commitDnd5eActivityExecution(reactionState, {
    allowInactiveDamageReactionCommit: options.allowInactiveDamageReactionCommit === true &&
      activity?.activation.kind === 'reaction' && activity.invocation?.kind === 'triggered' &&
      activity.invocation.event === 'before-damage',
    allowInactiveDeathReactionCommit: options.allowInactiveDeathReactionCommit === true &&
      authority.triggerContext?.event === 'creature-died' &&
      (activity?.activation.kind === 'reaction' || activity?.activation.kind === 'free' && activity.legacySource?.kind !== 'spell') &&
      activity.invocation?.kind === 'triggered' && activity.invocation.event === 'creature-died',
    allowInactiveRestCommit: completedExchangeRitual || options.allowInactiveRestCommit === true &&
      ['long-rest-complete','short-rest-complete','long-rest-started','short-rest-started'].includes(authority.triggerContext?.event??''),
    allowInactiveAwakeningCommit: options.allowInactiveAwakeningCommit === true &&
      authority.triggerContext?.event === 'creature-awakened' && activity?.requiresEffectGrant === true &&
      activity.activation.kind === 'free' && activity.invocation?.kind === 'triggered' &&
      activity.invocation.event === 'creature-awakened',
    actorId: authority.command.actorId,
    activityId: authority.command.activityId,
    attackOrigin: featureAttackSlot ? 'attack-action' : undefined,
    damageMitigationInterrupts: authority.damageMitigationInterrupts,
    activityTeleportInterruptions: authority.activityTeleportInterruptions,
    spellcastingSavingThrows: authority.spellcastingSavingThrows,
    sourceActionInterruptionReaction: authority.sourceActionInterruptionReaction,
      counterspellReaction: authority.counterspellReaction,
    featureSpellInvocation: activity?.spellInvocation ? { ...activity.spellInvocation,
      interruptedCheckIds: (activity.checks ?? []).filter(check =>
        !dnd5eInterruptedFeatureSpellActivity(activity).checks?.some(retained => retained.id === check.id)).map(check => check.id),
    } : undefined,
    castLevel: activity?.spellInvocation?.castAtLevel ?? authority.command.castLevel,
    targetIds: authority.command.targetIds,
    healingRecipientAuthorizations: activity?.outcomes.flatMap(outcome => outcome.operations.flatMap(operation => {
      if (operation.kind !== 'healing' || !operation.recipientChoice) return []
      const targetId = authority.command.choices?.[operation.recipientChoice.choiceId]
      return targetId ? [{ operationId: operation.id, targetId }] : []
    })),
    resolution: commitResolution,
    dmApproved: authority.dmApproved,
    usageKeys: activity?.requirements?.flatMap((requirement) =>
      requirement.kind === 'once-per-turn' ? [requirement.key] : []) ?? [],
    source: {
      kind: sourceKind,
      id: activity?.spellInvocation?.spellId ?? activity?.legacySource?.id ?? authority.command.activityId,
      packageId: authority.command.packageId,
    },
  })
  if (!committed.ok && reactionEvents.length > 0) return { phase: 'commit', result: { ...committed, state: structuredClone(source), ...(counterCheckpoint.requestedKeys.size ? {events: []} : {}) } }
  if (committed.ok) committed = { ...committed, events: [...reactionEvents, ...committed.events] }
  if (committed.ok && activity?.spellInvocation) {
    const events = [...committed.events]
    recordDnd5eFeatureSpellInvocation(source, committed.state,
      authority.command.actorId, authority.command.targetIds[0] ?? authority.command.actorId,
      activity.spellInvocation, activity.activation.kind, events)
    committed = { ...committed, events }
  }
  if (committed.ok && equipmentAttackSlot?.spendsAction) {
    const actor = committed.state.combatants[authority.command.actorId]
    actor.classState.weaponAttackActionTurnKey = dnd5eHeadlessTurnKey(committed.state, actor.id)
    actor.classState.restrictedExtraActionAttackTurnKey = undefined
    const events = [...committed.events]
    grantDnd5eFirstOwnTurnWeaponAttack(committed.state, actor.id, events)
    committed = { ...committed, events }
  }
  if (committed.ok && equipmentAttackSlot) {
    const actor = committed.state.combatants[authority.command.actorId]
    const history = advanceDnd5eAttackActionHistory(actor.classState.attackActionHistory, {
      turnKey: dnd5eHeadlessTurnKey(committed.state, actor.id), startsAction: equipmentAttackSlot.spendsAction,
      targetId: '', creature: false, restricted: false,
    })
    // Spending an attack slot on a save-only effect is not an attack against its targets.
    const attackedIds = resolution.checks.filter(check => check.kind === 'attack-roll').flatMap(check =>
      check.targetId ? [check.targetId] : authority.command.targetIds.length === 1 ? authority.command.targetIds : [])
    for (const targetId of attackedIds) {
      const target = committed.state.combatants[targetId]
      if (history && target && target.objectDamageThreshold == null && !target.objectInteractionOnly &&
        !history.creatureTargetIds.includes(targetId)) history.creatureTargetIds.push(targetId)
    }
    actor.classState.attackActionHistory = history
    if (conditionalBonusId && history) {
      history.bonusAttacksTakenThisTurn = (history.bonusAttacksTakenThisTurn ?? 0) + 1
      history.usedDistinctTargetBonusFeatureIds = [...history.usedDistinctTargetBonusFeatureIds ?? [], conditionalBonusId]
    }
  }
  if (committed.ok && activity && continuation) finishDnd5eActivityContinuationV1(committed.state, authority.command, activity, continuation.rolls, resolution.checks, continuation.pending)
  if (committed.ok) stampDnd5eActivityGrantProvenance(committed.state, committed.events,
    `activity:${source.combatId}:${authority.currentRevision}:${authority.command.commandId}`)
  if (committed.ok && inventoryOwner) {
    if (completedExchangeRitual && inventoryOwner.dnd5eInventory) inventoryOwner = { ...inventoryOwner, dnd5eInventory: { ...inventoryOwner.dnd5eInventory, pendingExchangeRitual: undefined } }
    const liveTags = new Set(Object.values(committed.state.combatants).flatMap(actor => (actor.classState.activeEffects ?? []).flatMap(effect => effect.tags ?? [])))
    inventoryOwner = expireDnd5eSourceBoundInventory(inventoryOwner,liveTags,new Set(Object.keys(committed.state.combatants)))
  }
  return {
    phase: 'commit',
    result: committed.ok ? { ...committed, ...(equipmentAttackSlot ? { equipmentAttackSlot } : {}),
      ...(inventoryOwner ? { inventoryOwner, ...(exchangeMap ? { map: exchangeMap } : {}) } : {}) } : committed,
  }
}

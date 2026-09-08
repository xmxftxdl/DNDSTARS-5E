import {
  commitDnd5eActivityExecution,
  resolveDnd5eHeadlessAction,
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

export interface Dnd5eItemActivityCommitMetadata {
  inventoryOwner?: Character
  inventoryDeduplicated?: boolean
}

export type Dnd5eActivityHeadlessAuthorityBridgeResult =
  | { phase: 'resolve'; result: Extract<Dnd5eActivityAuthorityResult, { ok: false }> }
  | {
      phase: 'inventory'
      result: {
        ok: false
        reason: Dnd5eInventoryActivityCostFailure | Dnd5eInventoryMutationFailure |
          'inventory-context-required' | 'inventory-item-mismatch'
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
): Dnd5eActivityHeadlessAuthorityBridgeResult {
  const resolution = resolveDnd5eActivityCommand(authority)
  if (!resolution.ok) return { phase: 'resolve', result: resolution }
  const activity = getRegisteredDnd5eActivity(authority.command.packageId, authority.command.activityId)
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
    const inventoryResult = applyDnd5eInventoryGrantBundle([currentOwner], {
      characterId: authority.command.actorId,
      grants: inventoryGrantProposals.map((proposal) => ({
        templateId: proposal.templateId,
        quantity: proposal.quantity,
        identified: proposal.identified,
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
  const commitResolution: typeof resolution = {
    ...resolution,
    consumptions: applicableItemConsumptions.length > 0
      ? resolution.consumptions.filter((consumption) => consumption.kind !== 'item-charge')
      : resolution.consumptions,
    proposals: inventoryGrantProposals.length > 0
      || inventoryIdentifyProposals.length > 0 || inventoryPurifyProposals.length > 0 ||
        inventoryAttunementBreakProposals.length > 0
      ? resolution.proposals.filter((proposal) =>
          proposal.kind !== 'grant-inventory-item' && proposal.kind !== 'identify-inventory-item' &&
          proposal.kind !== 'purify-inventory-item' &&
          proposal.kind !== 'break-inventory-item-attunement')
      : resolution.proposals,
  }
  const sourceKind = activity?.legacySource?.kind === 'spell'
    ? 'spell' as const
    : activity?.legacySource?.kind === 'item'
      ? 'item' as const
      : activity?.legacySource?.kind === 'monster' || activity?.legacySource?.kind === 'monster-action'
        ? 'action' as const
        : 'feature' as const
  const committed = commitDnd5eActivityExecution(source, {
    actorId: authority.command.actorId,
    activityId: authority.command.activityId,
    castLevel: authority.command.castLevel,
    targetIds: authority.command.targetIds,
    resolution: commitResolution,
    dmApproved: authority.dmApproved,
    usageKeys: activity?.requirements?.flatMap((requirement) =>
      requirement.kind === 'once-per-turn' ? [requirement.key] : []) ?? [],
    source: {
      kind: sourceKind,
      id: activity?.legacySource?.id ?? authority.command.activityId,
      packageId: authority.command.packageId,
    },
  })
  return {
    phase: 'commit',
    result: committed.ok && inventoryOwner ? { ...committed, inventoryOwner } : committed,
  }
}

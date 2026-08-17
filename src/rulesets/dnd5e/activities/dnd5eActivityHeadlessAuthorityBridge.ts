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
import type { Dnd5eActivityExecutionResult, Dnd5eResolvedActivityConsumption } from './dnd5eActivityExecutor'
import {
  applyDnd5eInventoryActivityCosts,
  normalizeDnd5eInventory,
  type Dnd5eInventoryActivityCost,
  type Dnd5eInventoryActivityCostFailure,
} from '../items'
import type { Character } from '../../../types/character'

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
        reason: Dnd5eInventoryActivityCostFailure | 'inventory-context-required' | 'inventory-item-mismatch'
      }
    }
  | { phase: 'commit'; result: Dnd5eActivityAuthorityCommitResult & Dnd5eItemActivityCommitMetadata }

type Dnd5eResolvedItemChargeConsumption = Dnd5eResolvedActivityConsumption & {
  kind: 'item-charge'
  resourceId: string
  amount: number
  itemTemplateIds?: readonly string[]
}

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
  let inventoryOwner: Character | undefined
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
  const commitResolution: typeof resolution = applicableItemConsumptions.length > 0
    ? {
        ...resolution,
        consumptions: resolution.consumptions.filter((consumption) => consumption.kind !== 'item-charge'),
      }
    : resolution
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
    },
  })
  return {
    phase: 'commit',
    result: committed.ok && inventoryOwner ? { ...committed, inventoryOwner } : committed,
  }
}

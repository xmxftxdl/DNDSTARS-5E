import type { CombatTransaction, RollLedgerReroll } from '../../lib/combatTransaction'
import type { Character } from '../../types/character'
import type { Dnd5eAttackRollRerollEffect } from '../../types/inventory'
import {
  applyDnd5eInventoryActivityCosts,
  normalizeDnd5eInventory,
  type Dnd5eInventoryActivityCostFailure,
} from './items'
import { dnd5eAttackRollRerollCandidateForInstance } from './inventoryHeadlessEffects'

export const DND5E_INVENTORY_TRIGGER_COMMAND_SCHEMA_VERSION = 1 as const

/**
 * Player/interrupt intent only. It never carries a replacement die supplied by
 * the client; the Host records that die in the RollLedger before this commit.
 */
export interface Dnd5eCommitAttackRollRerollCommandV1 {
  schemaVersion: typeof DND5E_INVENTORY_TRIGGER_COMMAND_SCHEMA_VERSION
  commandId: string
  transactionId: string
  actorId: string
  instanceId: string
  effectId: string
  resourceId: string
  rollLedgerEntryId: string
  rerollIndex: number
  expectedInventoryRevision: number
}

export type Dnd5eInventoryTriggeredEffectFailure =
  | Dnd5eInventoryActivityCostFailure
  | 'invalid-command'
  | 'unauthorized-actor'
  | 'transaction-mismatch'
  | 'effect-unavailable'
  | 'roll-ledger-mismatch'

export type Dnd5eInventoryTriggeredEffectCommitResult =
  | {
      ok: true
      character: Character
      transaction: CombatTransaction
      effect?: Dnd5eAttackRollRerollEffect
      deduplicated: boolean
    }
  | {
      ok: false
      character: Character
      transaction: CombatTransaction
      reason: Dnd5eInventoryTriggeredEffectFailure
    }

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,299}$/i

export function validateDnd5eCommitAttackRollRerollCommandV1(
  command: Dnd5eCommitAttackRollRerollCommandV1,
): readonly string[] {
  const errors: string[] = []
  if (command.schemaVersion !== DND5E_INVENTORY_TRIGGER_COMMAND_SCHEMA_VERSION) {
    errors.push('unsupported schemaVersion')
  }
  for (const [label, value] of Object.entries({
    commandId: command.commandId,
    transactionId: command.transactionId,
    actorId: command.actorId,
    instanceId: command.instanceId,
    effectId: command.effectId,
    resourceId: command.resourceId,
    rollLedgerEntryId: command.rollLedgerEntryId,
  })) {
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) errors.push(`invalid ${label}`)
  }
  if (!Number.isSafeInteger(command.rerollIndex) || command.rerollIndex < 0 || command.rerollIndex > 31) {
    errors.push('invalid rerollIndex')
  }
  if (
    !Number.isSafeInteger(command.expectedInventoryRevision) ||
    command.expectedInventoryRevision < 0
  ) errors.push('invalid expectedInventoryRevision')
  return errors
}

function matchingReroll(
  transaction: CombatTransaction,
  command: Dnd5eCommitAttackRollRerollCommandV1,
): RollLedgerReroll | undefined {
  const entry = transaction.rollLedger.entries.find((candidate) => candidate.id === command.rollLedgerEntryId)
  if (!entry || entry.kind !== 'attack' || entry.dice.sides !== 20) return undefined
  const reroll = entry.rerolls[command.rerollIndex]
  if (
    !reroll || reroll.method === 'replace' || reroll.sourceId !== command.instanceId ||
    reroll.spentResource?.characterId !== command.actorId ||
    reroll.spentResource.instanceId !== command.instanceId ||
    reroll.spentResource.resourceId !== command.resourceId ||
    reroll.spentResource.amount !== 1
  ) return undefined
  return reroll
}

/**
 * Host-only atomic commit for a triggered equipment effect. The RollLedger is
 * the signed settlement intent; inventory cost and its durable receipt are
 * returned in the same character snapshot that the map result publishes.
 */
export function commitDnd5eAttackRollRerollEffect(input: {
  character: Character
  transaction: CombatTransaction
  command: Dnd5eCommitAttackRollRerollCommandV1
  weaponId: string
}): Dnd5eInventoryTriggeredEffectCommitResult {
  const { character, transaction, command } = input
  if (validateDnd5eCommitAttackRollRerollCommandV1(command).length > 0) {
    return { ok: false, character, transaction, reason: 'invalid-command' }
  }
  if (character.id !== command.actorId || transaction.actorId !== command.actorId) {
    return { ok: false, character, transaction, reason: 'unauthorized-actor' }
  }
  if (transaction.id !== command.transactionId || transaction.status === 'rolled-back') {
    return { ok: false, character, transaction, reason: 'transaction-mismatch' }
  }
  if (!matchingReroll(transaction, command)) {
    return { ok: false, character, transaction, reason: 'roll-ledger-mismatch' }
  }
  const inventory = normalizeDnd5eInventory(character)
  if (inventory.authorityUseReceipts?.includes(command.commandId)) {
    return { ok: true, character, transaction, deduplicated: true }
  }
  const candidate = dnd5eAttackRollRerollCandidateForInstance(
    character,
    input.weaponId,
    command.instanceId,
    command.effectId,
  )
  if (!candidate || candidate.effect.resourceId !== command.resourceId) {
    return { ok: false, character, transaction, reason: 'effect-unavailable' }
  }

  if (candidate.resource.current < 1) {
    return { ok: false, character, transaction, reason: 'insufficient-resource' }
  }
  const cost = applyDnd5eInventoryActivityCosts(character, {
    instanceId: command.instanceId,
    costs: [{ kind: 'resource', resourceId: command.resourceId, amount: 1 }],
    receiptId: command.commandId,
    expectedInventoryRevision: command.expectedInventoryRevision,
  })
  if (!cost.ok) return { ok: false, character, transaction, reason: cost.reason }
  return {
    ok: true,
    character: cost.character,
    transaction,
    effect: candidate.effect,
    deduplicated: cost.deduplicated,
  }
}

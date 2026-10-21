import type { Character } from '../../types/character'
import { dnd5eInventoryExchangeOwnerMatchesActor } from './inventoryExchangeAuthority'
import type { Dnd5eActivityAuthorityInput, Dnd5eExecuteActivityCommandV1 } from './activities/dnd5eActivityCommand'
import { resolveDnd5eActivityCommand } from './activities/dnd5eActivityCommand'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { normalizeDnd5eInventory } from './items'
import { applyDnd5eInventoryExchange } from './inventoryExchange'
import { normalizeDnd5eInventoryExchangeRitual, dnd5eInventoryExchangeRitualActorUnavailable } from './inventoryExchangeRitualState'
import type { Dnd5eInventoryExchangeSelection } from './inventoryExchangeSelection'

function selectionIdentity(selection: Dnd5eInventoryExchangeSelection): string {
  return JSON.stringify({ revision: selection.expectedInventoryRevision, inputs: selection.inputs,
    coins: selection.coins ?? [], original: selection.originalInstanceId ?? null,
    ...(selection.outputTemplateId ? {outputTemplateId:selection.outputTemplateId} : {}) })
}
/** Host begins a persisted ritual. Does not consume materials, resources or advance time. */
export function beginDnd5eInventoryExchangeRitual(authority: Dnd5eActivityAuthorityInput, worldMinute: number):
  { ok: true; character: Character; command: Dnd5eExecuteActivityCommandV1 } | { ok: false } {
  const activity = getRegisteredDnd5eActivity(authority.command.packageId, authority.command.activityId)
  const owner = authority.inventoryOwner, selection = authority.command.inventoryExchange
  if (!owner || dnd5eInventoryExchangeRitualActorUnavailable(owner) || !dnd5eInventoryExchangeOwnerMatchesActor(authority) || !activity || !selection || authority.combatActive === true ||
    !Number.isSafeInteger(worldMinute) || worldMinute < 0 || !['minute','hour'].includes(activity.activation.kind)) return { ok: false }
  if (activity.activation.kind !== 'minute' && activity.activation.kind !== 'hour') return { ok: false }
  const duration = activity.activation.value * (activity.activation.kind === 'hour' ? 60 : 1)
  const inventory = normalizeDnd5eInventory(owner)
  if (inventory.pendingExchangeRitual || !Number.isSafeInteger(duration) || duration < 1 || !Number.isSafeInteger(worldMinute + duration)) return { ok: false }
  const resolved = resolveDnd5eActivityCommand(authority)
  if (!resolved.ok) return { ok: false }
  const exchanges = resolved.proposals.filter(proposal => proposal.kind === 'exchange-inventory-items')
  if (exchanges.length !== 1) return { ok: false }
  const exchange = exchanges[0]
  const preview = applyDnd5eInventoryExchange([owner], { ...selection, characterId: owner.id, receiptId: authority.command.commandId,
    output: { templateId: exchange.templateId, quantity: exchange.quantity } }, exchange.policy)
  if (!preview.ok || preview.deduplicated) return { ok: false }
  const revision = (inventory.revision ?? 0) + 1
  const nextSelection = { ...selection, expectedInventoryRevision: revision }
  const record = normalizeDnd5eInventoryExchangeRitual({ schemaVersion: 1, commandId: authority.command.commandId,
    packageId: authority.command.packageId, packageVersion: authority.command.packageVersion, activityId: activity.id,
    definition: JSON.stringify(activity), selection: selectionIdentity(nextSelection), startedWorldMinute: worldMinute,
    completesWorldMinute: worldMinute + duration, inventoryRevision: revision })
  if (!record) return { ok: false }
  return { ok: true, character: { ...owner, dnd5eInventory: { ...inventory, revision, pendingExchangeRitual: record } },
    command: { ...authority.command, inventoryExchange: nextSelection } }
}
/** No timestamps or records from player commands are trusted. */
export function dnd5eInventoryExchangeRitualReady(authority: Dnd5eActivityAuthorityInput, worldMinute: number | undefined): boolean {
  const owner = authority.inventoryOwner, selection = authority.command.inventoryExchange
  const activity = getRegisteredDnd5eActivity(authority.command.packageId, authority.command.activityId)
  if (!owner || dnd5eInventoryExchangeRitualActorUnavailable(owner) || !dnd5eInventoryExchangeOwnerMatchesActor(authority) || !selection || !activity || authority.combatActive === true || !Number.isSafeInteger(worldMinute)) return false
  const inventory = normalizeDnd5eInventory(owner), record = inventory.pendingExchangeRitual
  return !!record && Number(worldMinute) >= record.completesWorldMinute &&
    record.inventoryRevision === inventory.revision && record.commandId === authority.command.commandId &&
    record.packageId === authority.command.packageId && record.packageVersion === authority.command.packageVersion &&
    record.activityId === activity.id && record.definition === JSON.stringify(activity) && record.selection === selectionIdentity(selection)
}

/** Host cancellation releases the pending ritual without granting or charging anything. */
export function cancelDnd5eInventoryExchangeRitual(character: Character, commandId: string): Character | undefined {
  const inventory = normalizeDnd5eInventory(character)
  const revision = (inventory.revision ?? 0) + 1
  if (inventory.pendingExchangeRitual?.commandId !== commandId || !Number.isSafeInteger(revision)) return undefined
  return { ...character, dnd5eInventory: { ...inventory, revision, pendingExchangeRitual: undefined } }
}

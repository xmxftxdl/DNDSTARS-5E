import type { Character } from '../../../types/character'
import { beginDnd5eInventoryExchangeRitual, cancelDnd5eInventoryExchangeRitual } from '../inventoryExchangeRitual'
import { normalizeDnd5eInventory } from '../items'
import { validateDnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import { dnd5eCombatantEntitledToActivityV1 } from './dnd5eActivityEntitlements'
import { dnd5eActivityActorSnapshotFromCombatantV1, resolveRegisteredDnd5eActivityInCombatV1,
  type Dnd5eRegisteredActivityCombatAuthorityInputV1 } from './dnd5eActivityCombatAuthority'

/** Host-only transaction preparation. Publish the returned character or completion
 * plan atomically with the checked room revision; this function does not save state. */
export function settleDnd5eInventoryExchangeRitualV1(input: Dnd5eRegisteredActivityCombatAuthorityInputV1 & {
  actorCharacter: Character
  worldMinute: number
  decision: 'begin' | 'cancel' | 'complete'
}) {
  const reject = (reason: string) => ({ ok: false as const, reason })
  const { command, actorCharacter: owner } = input
  if (!['begin', 'cancel', 'complete'].includes(input.decision) ||
    validateDnd5eExecuteActivityCommandV1(command).length || command.expectedRevision !== input.combatRevision ||
    !Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0) return reject('invalid-command')
  const actor = input.state.combatants[command.actorId]
  if (!actor || (actor.classState.wardingBondParticipantCharacterId ?? actor.id) !== owner.id ||
    (input.inventoryOwner && input.inventoryOwner.id !== owner.id)) return reject('ritual-owner-mismatch')
  // Cancellation remains available if the granting feature was removed mid-ritual.
  if (input.decision === 'cancel') {
    const pending = normalizeDnd5eInventory(owner).pendingExchangeRitual
    if (!pending || pending.packageId !== command.packageId || pending.activityId !== command.activityId ||
      pending.packageVersion !== command.packageVersion) return reject('ritual-unavailable')
    const character = cancelDnd5eInventoryExchangeRitual(owner, command.commandId)
    return character ? { ok: true as const, outcome: 'cancelled' as const, character } : reject('ritual-unavailable')
  }
  const activity = getRegisteredDnd5eActivity(command.packageId, command.activityId)
  const registered = listRegisteredDnd5eActivityPackages().find(entry => entry.packageId === command.packageId)
  if (!activity || registered?.packageVersion !== command.packageVersion ||
    !['minute', 'hour'].includes(activity.activation.kind) ||
    !activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'exchange-inventory-items')) ||
    !dnd5eCombatantEntitledToActivityV1({ packageId: command.packageId, activity, combatant: actor,
      character: owner, targetIds: command.targetIds })) return reject('ritual-activity-unavailable')
  if (input.decision === 'complete') {
    const resolution = resolveRegisteredDnd5eActivityInCombatV1({ ...input, inventoryOwner: owner })
    if (resolution.phase !== 'commit' || !resolution.result.ok) return reject('ritual-settlement-rejected')
    return { ok: true as const, outcome: 'completed' as const, resolution }
  }
  const targets = command.targetIds.map(id => input.state.combatants[id])
  if (targets.some(target => !target)) return reject('invalid-target')
  const begun = beginDnd5eInventoryExchangeRitual({ command, currentRevision: input.combatRevision,
    combatActive: input.state.active, actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor),
    targets: targets.map(target => dnd5eActivityActorSnapshotFromCombatantV1(target!, actor)),
    combatants: Object.values(input.state.combatants).map(value => dnd5eActivityActorSnapshotFromCombatantV1(value, actor)),
    authoritativeRolls: input.authoritativeRolls, inventoryOwner: owner, confirmedBy: input.confirmedBy,
  }, input.worldMinute)
  return begun.ok ? { ...begun, outcome: 'begun' as const } : reject('ritual-start-rejected')
}

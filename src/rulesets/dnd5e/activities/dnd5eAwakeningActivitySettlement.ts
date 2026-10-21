import type { Character } from '../../../types/character'
import { consumeDnd5eAwakeningEvent } from '../awakeningEvents'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import { validateDnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { resolveRegisteredDnd5eActivityInCombatV1, type Dnd5eRegisteredActivityCombatAuthorityInputV1 } from './dnd5eActivityCombatAuthority'

/** Host snapshot only. Commit receiptPatch and resolution atomically; a failed
 * resolution neither consumes the event nor modifies the caller's character. */
export function settleDnd5eAwakeningActivity(input: Omit<Dnd5eRegisteredActivityCombatAuthorityInputV1, 'actorCharacter' | 'triggerContext'> & {
  actorCharacter: Character; worldMinute: number; awakeningEventId: string
}) {
  const reject = (reason: string) => ({ ok: false as const, reason })
  const { command, actorCharacter: owner } = input
  if (validateDnd5eExecuteActivityCommandV1(command).length || command.expectedRevision !== input.combatRevision ||
    !command.grantEffectId || command.targetIds.length !== 1 || command.targetIds[0] !== command.actorId) return reject('invalid-command')
  const actor = input.state.combatants[command.actorId]
  if (!actor || (actor.classState.wardingBondParticipantCharacterId ?? actor.id) !== owner.id) return reject('awakening-owner-mismatch')
  const activity = getRegisteredDnd5eActivity(command.packageId, command.activityId)
  if (!activity || !activity.requiresEffectGrant || activity.invocation?.kind !== 'triggered' ||
    activity.invocation.event !== 'creature-awakened' || activity.activation.kind !== 'free' ||
    listRegisteredDnd5eActivityPackages().find(entry => entry.packageId === command.packageId)?.packageVersion !== command.packageVersion) return reject('awakening-activity-unavailable')
  const receiptPatch = consumeDnd5eAwakeningEvent(owner, { eventId: input.awakeningEventId,
    grantEffectId: command.grantEffectId, worldMinute: input.worldMinute })
  if (!receiptPatch) return reject('awakening-event-unavailable')
  // The durable receipt contains structured identity; the command wire accepts
  // a bounded opaque identifier. Its scope is the already verified owner.
  const eventIndex = owner.dnd5eAwakeningEvents!.findIndex(event => event.id === input.awakeningEventId)
  const triggerId = `awakening:${owner.dnd5eAwakeningEvents![eventIndex].worldMinute}:${eventIndex}`
  const resolution = resolveRegisteredDnd5eActivityInCombatV1({ ...input,
    allowInactiveAwakeningCommit: true,
    command: { ...command, triggerEventId: triggerId },
    triggerContext: { event: 'creature-awakened', eventId: triggerId,
      eligibleActorIds: [actor.id], eligibleTargetIds: [actor.id], source: { kind: 'combat', id: 'creature-awakened' } },
  })
  if (resolution.phase !== 'commit' || !resolution.result.ok) return { ok: false as const, reason: 'awakening-settlement-rejected', resolution }
  return { ok: true as const, resolution, receiptPatch: { dnd5eAwakeningEvents: receiptPatch.dnd5eAwakeningEvents } }
}

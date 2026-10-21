import { planDnd5eMapResultApplication } from './mapBridge'
import type { resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { settleDnd5eTempleMovementEntries } from './templeMovementSettlement'

/** Keep trigger damage and receipts, but adjudicate entry before arrival/falling. */
export async function settleDnd5ePersistentAreaTempleEntry(input: {
  prepared: Parameters<typeof resolvePreparedDnd5ePersistentAreaTrigger>[0]['prepared']
  resolved: ReturnType<typeof resolvePreparedDnd5ePersistentAreaTrigger>
  roll: Parameters<typeof settleDnd5eTempleMovementEntries>[0]['roll']
  isCurrent: () => boolean
  rollEffectDice?: Parameters<typeof settleDnd5eTempleMovementEntries>[0]['rollEffectDice']
}) {
  const { resolved, prepared } = input
  if (!resolved.result.ok || !resolved.application) return { ok: true as const, resolved }
  if (!resolved.result.events.some(event => event.type === 'moved')) return { ok: true as const, resolved }
  const entry = await settleDnd5eTempleMovementEntries({
    state: resolved.result.state, events: resolved.result.events,
    map: resolved.application.map, roll: input.roll, isCurrent: input.isCurrent, rollEffectDice: input.rollEffectDice,
  })
  if (!entry.ok) return entry
  if (!entry.changed) return { ok: true as const, resolved }
  const previous = resolved.application
  const application = planDnd5eMapResultApplication({
    state: entry.state, events: entry.events, map: previous.map, characters: previous.characters,
    characterIdByCombatantId: prepared.characterIdByCombatantId,
  })
  return { ok: true as const, resolved: {
    ...resolved, result: { ...resolved.result, state: entry.state, events: entry.events },
    application: {
      ...previous, ...application,
      tokenPatches: { ...previous.tokenPatches, ...Object.fromEntries(Object.entries(application.tokenPatches ?? {})
        .map(([id, patch]) => [id, { ...previous.tokenPatches?.[id], ...patch }])) },
      characterPatches: { ...previous.characterPatches, ...Object.fromEntries(Object.entries(application.characterPatches ?? {})
        .map(([id, patch]) => [id, { ...previous.characterPatches?.[id], ...patch }])) },
      changedTokenIds: [...new Set([...previous.changedTokenIds, ...application.changedTokenIds])],
      changedCharacterIds: [...new Set([...previous.changedCharacterIds, ...application.changedCharacterIds])],
    },
  } }
}

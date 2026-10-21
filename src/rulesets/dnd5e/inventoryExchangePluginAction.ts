import type { PreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { prepareDnd5eInventoryExchangeRitualMapApplication } from './inventoryExchangeRitualMapApplication'
import { validDnd5eInventoryExchangeSelection } from './inventoryExchangeSelection'
import { listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'

/** Decode player intent while rebuilding time, combat scope and inventory on Host. */
export function resolveDnd5eInventoryExchangePluginAction(input: {
  prepared: PreparedDnd5ePluginFeatureAction
  payload: unknown
  authority?: { worldMinute: number; combatRevision: number; combatActive: boolean }
}) {
  const reject = () => ({ ok: false as const, reason: 'invalid-exchange-request' })
  if (!input.authority || !input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) return reject()
  const raw = (input.payload as Record<string, unknown>).inventoryExchangeRitual
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reject()
  const request = raw as Record<string, unknown>
  if (Object.keys(request).some(key => !['decision', 'ritualId', 'selection'].includes(key)) ||
    !['begin', 'cancel', 'complete'].includes(String(request.decision)) || !validDnd5eInventoryExchangeSelection(request.selection)) return reject()
  const decision = request.decision as 'begin' | 'cancel' | 'complete'
  if (decision === 'begin' ? request.ritualId != null : typeof request.ritualId !== 'string') return reject()
  const action = input.prepared.headlessAction
  const packageVersion = listRegisteredDnd5eActivityPackages().find(entry => entry.packageId === action.pluginId)?.packageVersion
  if (!packageVersion) return reject()
  return prepareDnd5eInventoryExchangeRitualMapApplication({
    decision, worldMinute: input.authority.worldMinute, combatRevision: input.authority.combatRevision,
    state: { ...input.prepared.state, active: input.authority.combatActive },
    map: input.prepared.map, characters: input.prepared.characters,
    characterIdByCombatantId: input.prepared.characterIdByCombatantId,
    authoritativeRolls: {}, confirmedBy: 'actor',
    command: { schemaVersion: 1, commandId: decision === 'begin' ? input.prepared.action.id : request.ritualId as string,
      actorId: action.actorId, packageId: action.pluginId, packageVersion, activityId: action.actionId,
      targetIds: action.targetIds ?? [action.actorId], expectedRevision: input.authority.combatRevision,
      inventoryExchange: request.selection },
  })
}

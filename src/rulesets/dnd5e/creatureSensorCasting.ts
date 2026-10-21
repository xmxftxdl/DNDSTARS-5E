import { prepareDnd5eCreatureSensorProjection } from './creatureSensorResolution'
import { refreshDnd5ePluginRestFeatureCasting } from './pluginFeatureAction'
import { invalidateDnd5eLongCasting } from './longCastingContinuity'

/** Rebind a known creature by Host identity before rebuilding a long cast.
 * Returned projection is calculation-only and must use the sensor commit plan. */
export function projectDnd5eCreatureSensorCastingTarget(input:
  Pick<Parameters<typeof refreshDnd5ePluginRestFeatureCasting>[0], 'prepared'> &
  Pick<Parameters<typeof prepareDnd5eCreatureSensorProjection>[0], 'room' | 'receipt'>) {
  const payload = input.prepared.headlessAction.payload
  const rawChoices = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.activityChoices : undefined
  const choices = rawChoices && typeof rawChoices === 'object' && !Array.isArray(rawChoices)
    ? Object.fromEntries(Object.entries(rawChoices).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
  return prepareDnd5eCreatureSensorProjection({ room: input.room, receipt: input.receipt,
    actionId: input.prepared.action.id, packageId: input.prepared.headlessAction.pluginId,
    activityId: input.prepared.headlessAction.actionId, choices })
}

export function refreshDnd5eCreatureSensorCasting(input:
  Omit<Parameters<typeof refreshDnd5ePluginRestFeatureCasting>[0], 'map' | 'maps' | 'characters'> &
  Pick<Parameters<typeof prepareDnd5eCreatureSensorProjection>[0], 'room' | 'receipt'>) {
  const projected = projectDnd5eCreatureSensorCastingTarget(input)
  if (!projected.ok) {
    invalidateDnd5eLongCasting(input.castingReceipt)
    return projected
  }
  const { projection } = projected
  const target = projection.map.tokens.find(token => token.id === projection.targetId)!
  const prepared = { ...input.prepared,
    targetTokens: [target], targetToken: target,
    action: { ...input.prepared.action, targetTokenId: target.id, targetTokenIds: [target.id] },
    headlessAction: { ...input.prepared.headlessAction, targetId: target.id, targetIds: [target.id] },
  }
  const refreshed = refreshDnd5ePluginRestFeatureCasting({ ...input, prepared,
    map: projection.map, maps: input.room.maps, characters: input.room.characters })
  return refreshed.ok ? { ...refreshed, projection } : refreshed
}

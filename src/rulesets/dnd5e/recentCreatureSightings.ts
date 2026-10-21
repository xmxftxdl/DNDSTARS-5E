import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'

/** Keep the campaign's integer minute untouched; only sighting comparisons use fractional minutes. */
export function dnd5eSightingWorldMinute(worldMinute?: number, worldSecondRemainder?: number): number | undefined {
  if (worldMinute == null || !Number.isFinite(worldMinute) || worldMinute < 0 ||
    worldSecondRemainder == null || !Number.isInteger(worldSecondRemainder) || worldSecondRemainder < 0 || worldSecondRemainder >= 60) return undefined
  return worldMinute + worldSecondRemainder / 60
}

export interface Dnd5eCreatureSighting { mapId: string; worldMinute: number; label?: string }

export function dnd5eCreatureSeenRecently(input: {
  history?: Readonly<Record<string, Dnd5eCreatureSighting>>
  targetId: string
  mapId: string
  worldMinute?: number
  maximumAgeSeconds: number
  currentlyVisible?: boolean
}): boolean {
  if (!Number.isFinite(input.maximumAgeSeconds) || input.maximumAgeSeconds < 0) return false
  // Current Host visibility is sufficient even when historical game time is unavailable.
  if (input.currentlyVisible === true) return true
  if (input.worldMinute == null || !Number.isFinite(input.worldMinute) || input.worldMinute < 0) return false
  const sighting = input.history?.[input.targetId]
  if (!sighting || sighting.mapId !== input.mapId || !Number.isFinite(sighting.worldMinute) || sighting.worldMinute < 0) return false
  const ageSeconds = (input.worldMinute - sighting.worldMinute) * 60
  return ageSeconds >= 0 && ageSeconds <= input.maximumAgeSeconds + 1e-7
}

/** Only call with Host-projected vision and game time. No positions are retained or revealed. */
export function recordDnd5eCreatureSightings(
  state: Dnd5eHeadlessCombatState,
  worldMinute: number | undefined,
  canSee: (state: Dnd5eHeadlessCombatState, viewerId: string, targetId: string) => boolean,
): void {
  if (!state.mapId || worldMinute == null || !Number.isFinite(worldMinute) || worldMinute < 0) return
  for (const observer of Object.values(state.combatants)) {
    if (observer.objectDamageThreshold != null || observer.objectInteractionOnly) continue
    const history: Record<string, Dnd5eCreatureSighting> = Object.fromEntries(
      Object.entries(observer.classState.recentCreatureSightings ?? {}).filter(([targetId]) =>
        dnd5eCreatureSeenRecently({ history: observer.classState.recentCreatureSightings, targetId,
          mapId: state.mapId!, worldMinute, maximumAgeSeconds: 60 })),
    )
    for (const target of Object.values(state.combatants)) {
      if (observer.id !== target.id && target.objectDamageThreshold == null && !target.objectInteractionOnly && canSee(state, observer.id, target.id)) {
        history[target.id] = { mapId: state.mapId, worldMinute, label: target.name }
      }
    }
    observer.classState.recentCreatureSightings = Object.keys(history).length ? history : undefined
  }
}

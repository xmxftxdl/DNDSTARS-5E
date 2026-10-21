import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { detectDnd5ePlanarPortal, type Dnd5ePlanarPortalReport } from './planarPortalDetection'
import { dnd5eSightingWorldMinute } from './recentCreatureSightings'

export interface Dnd5ePlanarPortalReceipt {
  sourceActivityId: string
  mapId: string
  origin: { x: number; y: number; elevationFeet: number }
  rangeFeet: number
  round: number
  worldMinute?: number
  report: Exclude<Dnd5ePlanarPortalReport, { status: 'unavailable' }>
}

export function planDnd5ePlanarPortalReport(state: Dnd5eHeadlessCombatState, actorId: string,
  sourceActivityId: string, rangeFeet: number): Dnd5ePlanarPortalReceipt | undefined {
  const actor = state.combatants[actorId], scene = state.companionScene
  if (!actor || !scene || !state.mapId || scene.map.id !== state.mapId ||
    !Number.isFinite(rangeFeet) || rangeFeet < 1 || rangeFeet > 10_000) return undefined
  const origin = { ...actor.position, elevationFeet: actor.elevationFeet ?? 0 }
  const report = detectDnd5ePlanarPortal({ map: scene.map, maps: scene.roomPlaneFacts ?? [scene.map],
    scenes: scene.interactionScenes ?? [], origin, rangeFeet })
  if (report.status === 'unavailable') return undefined
  return { sourceActivityId, mapId: state.mapId, origin, rangeFeet, round: state.round,
    worldMinute: dnd5eSightingWorldMinute(scene.worldMinute, scene.worldSecondRemainder), report }
}

/** Mutates only the private actor receipt after an authoritative query succeeds. */
export function recordDnd5ePlanarPortalReport(state: Dnd5eHeadlessCombatState, actorId: string,
  sourceActivityId: string, rangeFeet: number): boolean {
  const receipt = planDnd5ePlanarPortalReport(state, actorId, sourceActivityId, rangeFeet)
  if (!receipt) return false
  const actor = state.combatants[actorId]
  actor.classState.planarPortalReports = { ...actor.classState.planarPortalReports,
    [sourceActivityId]: receipt }
  return true
}

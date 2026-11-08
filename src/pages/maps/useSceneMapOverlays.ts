import { useMemo } from 'react'
import type { OrchestratedScene } from '../../lib/sceneOrchestration'

export function useSceneMapOverlays(activeMapId: string | null | undefined, activeMapScenes: OrchestratedScene[], orchestratedScenes: OrchestratedScene[], sceneEditorVisible: boolean, mapTravelEditing: boolean, isDM: boolean) {
  const sceneTriggerZones = useMemo(() => activeMapId
    ? activeMapScenes.flatMap((scene) => scene.triggers.map((trigger) => ({
        sceneId: scene.id,
        triggerId: trigger.id,
        name: trigger.name,
        enabled: trigger.enabled,
        region: trigger.region,
      })))
    : [], [activeMapId, activeMapScenes])
  const visibleSceneTriggerZones = useMemo(
    () => sceneEditorVisible || mapTravelEditing ? sceneTriggerZones : [],
    [sceneEditorVisible, mapTravelEditing, sceneTriggerZones],
  )
  const sceneInteractionPoints = useMemo(() => activeMapId
    ? activeMapScenes.flatMap((scene) => scene.interactionPoints.map((point) => ({
        ...point,
        sceneId: scene.id,
      })))
        .filter((point) => isDM
          ? point.enabled || sceneEditorVisible
          : point.enabled && point.visibleToPlayers)
    : [], [activeMapId, activeMapScenes, isDM, sceneEditorVisible])
  const sceneTeleportDestinations = useMemo(() => activeMapId && (sceneEditorVisible || mapTravelEditing)
    ? orchestratedScenes.flatMap((scene) => scene.triggers.flatMap((trigger) =>
        trigger.actions.flatMap((action) => action.kind === 'teleport' && action.targetMapId === activeMapId
          ? [{
              sceneId: scene.id,
              triggerId: trigger.id,
              actionId: action.id,
              name: `${scene.name} · ${trigger.name}`,
              enabled: trigger.enabled && action.enabled,
              x: action.x,
              y: action.y,
            }]
          : [])))
    : [], [activeMapId, orchestratedScenes, sceneEditorVisible, mapTravelEditing])
  return { visibleSceneTriggerZones, sceneInteractionPoints, sceneTeleportDestinations }
}

import type { SceneRegion, SceneInteractionPointIcon } from '../../lib/sceneOrchestration'

export interface MoveCircle {
  centerX: number
  centerY: number
  radiusPx: number
}

export interface SceneTriggerZoneOverlay {
  sceneId: string
  triggerId: string
  name: string
  enabled: boolean
  region: SceneRegion
}

export interface SceneInteractionPointOverlay {
  sceneId: string
  id: string
  name: string
  enabled: boolean
  visibleToPlayers: boolean
  icon: SceneInteractionPointIcon
  x: number
  y: number
  prompt: string
}

export interface SceneTeleportDestinationOverlay {
  sceneId: string
  triggerId: string
  actionId: string
  name: string
  enabled: boolean
  x: number
  y: number
}


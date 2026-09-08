import type { MobileMovementIntent } from './mobileActionCommands'

export function mobileExplorationMoveMutation(input: {
  mapId: string
  tokenId: string
  characterId: string
  from: { x: number; y: number; elevationFeet?: number }
  to: { x: number; y: number }
  intent: MobileMovementIntent
  updatedAt: number
}): Record<string, unknown> {
  const currentElevation = Number.isFinite(input.from.elevationFeet) ? input.from.elevationFeet! : 0
  return {
    operation: 'move-owned-token',
    mapId: input.mapId,
    tokenId: input.tokenId,
    characterId: input.characterId,
    expectedPosition: { x: input.from.x, y: input.from.y },
    targetPosition: { x: input.to.x, y: input.to.y },
    // Exploration movement is a geometry transaction. The Host expects every
    // route point in map-world coordinates, not grid row/column coordinates.
    path: [{ x: input.from.x, y: input.from.y }, { x: input.to.x, y: input.to.y }],
    updatedAt: input.updatedAt,
    traversalMode: input.intent.traversalMode,
    expectedElevationFeet: currentElevation,
    targetElevationFeet: Number.isFinite(input.intent.targetElevationFeet)
      ? input.intent.targetElevationFeet
      : currentElevation,
  }
}

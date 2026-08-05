import {
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
} from '../../lib/gridCombat'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import type { Character } from '../../types/character'
import { dnd5eMovementPathCells } from '../../rulesets/dnd5e/itemAreas'
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'
import {
  collectDnd5ePersistentAreaTriggers,
  type Dnd5ePersistentAreaTriggerCandidate,
} from '../../rulesets/dnd5e/pluginAreas'

type BattleMap = Parameters<typeof createDnd5eMapCombatSnapshot>[0]['map']

export interface ForcedMovementPersistentAreaResult {
  map: BattleMap
  characters: Character[]
  logs: string[]
}

export async function coordinateForcedMovementPersistentAreas(input: {
  beforeMap: BattleMap
  afterMap: BattleMap
  characters: readonly Character[]
  tokenId: string
  round: number
  turnKey: string
  settleCandidates(input: {
    candidates: readonly Dnd5ePersistentAreaTriggerCandidate[]
    map: BattleMap
    characters: readonly Character[]
    round: number
  }): Promise<ForcedMovementPersistentAreaResult>
}): Promise<ForcedMovementPersistentAreaResult> {
  const beforeToken = input.beforeMap.tokens.find((token) => token.id === input.tokenId)
  const afterToken = input.afterMap.tokens.find((token) => token.id === input.tokenId)
  if (!beforeToken || !afterToken) {
    return { map: input.afterMap, characters: [...input.characters], logs: [] }
  }
  const geometry = mapGeometryRuntimeForMap(input.afterMap.id)
  const beforeElevationFeet = mapGeometryTokenElevation(geometry, beforeToken)
  const afterElevationFeet = mapGeometryTokenElevation(geometry, afterToken)
  if (
    beforeToken.x === afterToken.x &&
    beforeToken.y === afterToken.y &&
    Math.abs(beforeElevationFeet - afterElevationFeet) <= 1e-4
  ) {
    return { map: input.afterMap, characters: [...input.characters], logs: [] }
  }
  const fromCell = tokenAnchorCellFromPixel(
    beforeToken.x,
    beforeToken.y,
    beforeToken,
    input.afterMap,
  )
  const toCell = tokenAnchorCellFromPixel(
    afterToken.x,
    afterToken.y,
    beforeToken,
    input.afterMap,
  )
  const forcedPathCells = dnd5eMovementPathCells(fromCell, toCell)
  const forcedPath = forcedPathCells.length === 1 && Math.abs(beforeElevationFeet - afterElevationFeet) > 1e-4
    ? [
        { x: beforeToken.x, y: beforeToken.y },
        { x: afterToken.x, y: afterToken.y },
      ]
    : forcedPathCells.map((cell) => tokenCenterForAnchorCell(cell, beforeToken, input.afterMap))
  const forcedPathElevationsFeet = forcedPath.map((_, index) => {
    const ratio = forcedPath.length <= 1 ? 1 : index / (forcedPath.length - 1)
    return beforeElevationFeet + (afterElevationFeet - beforeElevationFeet) * ratio
  })
  const movement = {
    token: beforeToken,
    to: { x: afterToken.x, y: afterToken.y },
    path: forcedPath,
    pathElevationsFeet: forcedPathElevationsFeet,
  }
  const candidates = [
    ...collectDnd5ePersistentAreaTriggers({
      map: input.afterMap,
      timing: 'on-enter',
      round: input.round,
      turnKey: input.turnKey,
      movement,
    }),
    ...collectDnd5ePersistentAreaTriggers({
      map: input.afterMap,
      timing: 'on-move-distance',
      round: input.round,
      turnKey: input.turnKey,
      movement,
    }),
  ].sort((left, right) => (left.pathIndex ?? 0) - (right.pathIndex ?? 0))
  return input.settleCandidates({
    candidates,
    map: input.afterMap,
    characters: input.characters,
    round: input.round,
  })
}

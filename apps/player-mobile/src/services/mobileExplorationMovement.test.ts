import { describe, expect, it } from 'vitest'
import { mobileExplorationMoveMutation } from './mobileExplorationMovement'

describe('mobile exploration movement', () => {
  it('keeps the complete route in map-world coordinates', () => {
    expect(mobileExplorationMoveMutation({
      mapId: 'map-1', tokenId: 'token-1', characterId: 'character-1',
      from: { x: 542.5, y: 577.5, elevationFeet: 5 },
      to: { x: 612.5, y: 507.5 },
      intent: { traversalMode: 'walk' }, updatedAt: 123,
    })).toMatchObject({
      expectedPosition: { x: 542.5, y: 577.5 },
      targetPosition: { x: 612.5, y: 507.5 },
      path: [{ x: 542.5, y: 577.5 }, { x: 612.5, y: 507.5 }],
      expectedElevationFeet: 5,
      targetElevationFeet: 5,
    })
  })
})

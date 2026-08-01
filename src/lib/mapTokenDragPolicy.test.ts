import { describe, expect, it } from 'vitest'
import {
  canDragMapToken,
  dmTokenPlacementBypassesMovementBlockers,
  resolveOptimisticTokenMovePreview,
  shouldReleaseOptimisticTokenMovePreview,
  shouldValidateMapTokenMoveLocally,
} from './mapTokenDragPolicy'

const base = {
  isDm: false,
  combatActive: false,
  token: { id: 'hero-token', type: 'player' as const },
  playerMovableTokenIds: [] as string[],
  measureMode: false,
  deleteSelectMode: false,
  gridAdjustMode: false,
  fogEditMode: false,
  geometryEditMode: false,
  lockDragTokenIds: [] as string[],
}

describe('map Token drag policy', () => {
  it('lets a player drag only an explicitly authorized player Token', () => {
    expect(canDragMapToken({
      ...base,
      playerMovableTokenIds: ['hero-token'],
    })).toBe(true)
    expect(canDragMapToken({
      ...base,
      token: { id: 'other-player-token', type: 'player' },
      playerMovableTokenIds: ['hero-token'],
    })).toBe(false)
    expect(canDragMapToken({
      ...base,
      token: { id: 'enemy-token', type: 'enemy' },
      playerMovableTokenIds: ['enemy-token'],
    })).toBe(false)
  })

  it('preserves DM drag access and all shared editor locks', () => {
    expect(canDragMapToken({
      ...base,
      isDm: true,
      token: { id: 'enemy-token', type: 'enemy' },
    })).toBe(true)
    expect(canDragMapToken({
      ...base,
      playerMovableTokenIds: ['hero-token'],
      geometryEditMode: true,
    })).toBe(false)
    expect(canDragMapToken({
      ...base,
      playerMovableTokenIds: ['hero-token'],
      lockDragTokenIds: ['hero-token'],
    })).toBe(false)
  })

  it('disables every enemy drag during combat while preserving setup placement', () => {
    expect(canDragMapToken({
      ...base,
      isDm: true,
      combatActive: false,
      token: { id: 'current-monster', type: 'enemy' },
    })).toBe(true)

    // The current manually controlled monster moves by selecting a legal cell,
    // never by bypassing Headless movement with a placement drag.
    expect(canDragMapToken({
      ...base,
      isDm: true,
      combatActive: true,
      token: { id: 'current-monster', type: 'enemy' },
    })).toBe(false)

    // A monster that has not reached its turn cannot be repositioned either.
    expect(canDragMapToken({
      ...base,
      isDm: true,
      combatActive: true,
      token: { id: 'waiting-monster', type: 'enemy' },
    })).toBe(false)
  })

  it('lets the DM freely place every Token type through movement blockers', () => {
    expect(dmTokenPlacementBypassesMovementBlockers({
      isDm: true,
      token: { type: 'player' },
    })).toBe(true)
    expect(dmTokenPlacementBypassesMovementBlockers({
      isDm: true,
      token: { type: 'enemy' },
    })).toBe(true)
    expect(dmTokenPlacementBypassesMovementBlockers({
      isDm: true,
      token: { type: 'npc' },
    })).toBe(true)
    expect(dmTokenPlacementBypassesMovementBlockers({
      isDm: false,
      token: { type: 'player' },
    })).toBe(false)
  })

  it('skips local collision for DM placement and keeps player movement validated', () => {
    expect(shouldValidateMapTokenMoveLocally({
      isDm: true,
      token: { id: 'active-monster', type: 'enemy' },
      authoritativeMovementTokenIds: ['active-monster'],
    })).toBe(false)
    expect(shouldValidateMapTokenMoveLocally({
      isDm: true,
      token: { id: 'other-monster', type: 'enemy' },
      authoritativeMovementTokenIds: ['active-monster'],
    })).toBe(false)
    expect(shouldValidateMapTokenMoveLocally({
      isDm: false,
      token: { id: 'hero-token', type: 'player' },
      authoritativeMovementTokenIds: [],
    })).toBe(true)
  })

  it('holds the dragged position until authority catches up or rejects it', () => {
    expect(shouldReleaseOptimisticTokenMovePreview({
      dragActive: true,
      requestPending: false,
      authoritative: { x: 10, y: 10 },
      preview: { x: 10, y: 10 },
    })).toBe(false)
    expect(shouldReleaseOptimisticTokenMovePreview({
      requestPending: true,
      authoritative: { x: 10, y: 10 },
      preview: { x: 50, y: 50 },
    })).toBe(false)
    expect(shouldReleaseOptimisticTokenMovePreview({
      requestPending: true,
      authoritative: { x: 50, y: 50 },
      preview: { x: 50, y: 50 },
    })).toBe(false)
    expect(shouldReleaseOptimisticTokenMovePreview({
      requestPending: false,
      authoritative: { x: 10, y: 10 },
      preview: { x: 50, y: 50 },
    })).toBe(true)
  })

  it('consumes the matching authority animation instead of replaying it for the mover', () => {
    expect(resolveOptimisticTokenMovePreview({
      requestPending: false,
      authoritative: {
        x: 50,
        y: 50,
        movementAnimation: { id: 'player-move:action-1:hero-token' },
      },
      preview: { x: 50, y: 50 },
    })).toEqual({
      release: true,
      suppressMovementAnimationId: 'player-move:action-1:hero-token',
    })

    expect(resolveOptimisticTokenMovePreview({
      requestPending: false,
      authoritative: {
        x: 45,
        y: 50,
        movementAnimation: { id: 'player-move:action-1:hero-token' },
      },
      preview: { x: 50, y: 50 },
    })).toEqual({
      release: true,
      suppressMovementAnimationId: 'player-move:action-1:hero-token',
    })

    expect(resolveOptimisticTokenMovePreview({
      requestPending: false,
      authoritative: { x: 10, y: 10 },
      preview: { x: 50, y: 50 },
    })).toEqual({ release: true })
  })
})

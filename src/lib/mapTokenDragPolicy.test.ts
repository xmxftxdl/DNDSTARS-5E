import { describe, expect, it } from 'vitest'
import {
  canDragMapToken,
  dmPlayerTokenPlacementBypassesMovementBlockers,
  shouldReleaseOptimisticTokenMovePreview,
  shouldValidateMapTokenMoveLocally,
} from './mapTokenDragPolicy'

const base = {
  isDm: false,
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

  it('only lets the DM place player Tokens through movement blockers', () => {
    expect(dmPlayerTokenPlacementBypassesMovementBlockers({
      isDm: true,
      token: { type: 'player' },
    })).toBe(true)
    expect(dmPlayerTokenPlacementBypassesMovementBlockers({
      isDm: true,
      token: { type: 'enemy' },
    })).toBe(false)
    expect(dmPlayerTokenPlacementBypassesMovementBlockers({
      isDm: false,
      token: { type: 'player' },
    })).toBe(false)
  })

  it('defers only the active authoritative monster movement to Headless', () => {
    expect(shouldValidateMapTokenMoveLocally({
      isDm: true,
      token: { id: 'active-monster', type: 'enemy' },
      authoritativeMovementTokenIds: ['active-monster'],
    })).toBe(false)
    expect(shouldValidateMapTokenMoveLocally({
      isDm: true,
      token: { id: 'other-monster', type: 'enemy' },
      authoritativeMovementTokenIds: ['active-monster'],
    })).toBe(true)
    expect(shouldValidateMapTokenMoveLocally({
      isDm: false,
      token: { id: 'hero-token', type: 'player' },
      authoritativeMovementTokenIds: [],
    })).toBe(true)
  })

  it('holds the dragged position until authority catches up or rejects it', () => {
    expect(shouldReleaseOptimisticTokenMovePreview({
      requestPending: true,
      authoritative: { x: 10, y: 10 },
      preview: { x: 50, y: 50 },
    })).toBe(false)
    expect(shouldReleaseOptimisticTokenMovePreview({
      requestPending: true,
      authoritative: { x: 50, y: 50 },
      preview: { x: 50, y: 50 },
    })).toBe(true)
    expect(shouldReleaseOptimisticTokenMovePreview({
      requestPending: false,
      authoritative: { x: 10, y: 10 },
      preview: { x: 50, y: 50 },
    })).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  EMPTY_MAP_TABLETOP_STATE,
  mapTabletopForMap,
  parseMapTabletopEvent,
  reduceMapTabletopState,
} from './mapTabletop'

const annotation = {
  type: 'annotation' as const,
  id: 'annotation-123',
  mapId: 'map-a',
  memberId: 'dm-member',
  memberName: '地下城主',
  role: 'dm' as const,
  createdAt: 1_000,
  expiresAt: 20_000,
  shape: 'arrow' as const,
  from: { x: 10, y: 20 },
  to: { x: 30, y: 40 },
  color: '#fbbf24',
}

describe('map tabletop events', () => {
  it('rejects malformed or unbounded geometry', () => {
    expect(parseMapTabletopEvent({ ...annotation, to: { x: Number.POSITIVE_INFINITY, y: 0 } })).toBeNull()
    expect(parseMapTabletopEvent({ ...annotation, color: 'red' })).toBeNull()
  })

  it('keeps temporary annotations per map and clears only the requested map', () => {
    const mapB = { ...annotation, id: 'annotation-456', mapId: 'map-b' }
    const withBoth = reduceMapTabletopState(
      reduceMapTabletopState(EMPTY_MAP_TABLETOP_STATE, annotation, 2_000),
      mapB,
      2_000,
    )
    const cleared = reduceMapTabletopState(withBoth, {
      type: 'clear-annotations', id: 'clear-annotations-1', mapId: 'map-a',
      memberId: 'dm-member', memberName: '地下城主', role: 'dm', createdAt: 3_000, expiresAt: 4_000,
    }, 3_000)
    expect(mapTabletopForMap(cleared, 'map-a', 3_000).annotations).toHaveLength(0)
    expect(mapTabletopForMap(cleared, 'map-b', 3_000).annotations).toHaveLength(1)
  })

  it('drops expired pings during any reducer pass', () => {
    const withPing = reduceMapTabletopState(EMPTY_MAP_TABLETOP_STATE, {
      type: 'ping', id: 'ping-event-1', mapId: 'map-a', point: { x: 1, y: 2 },
      memberId: 'player-member', memberName: '玩家', role: 'player', createdAt: 1_000, expiresAt: 2_000,
    }, 1_500)
    expect(reduceMapTabletopState(withPing, null, 2_001).pings).toHaveLength(0)
  })
})

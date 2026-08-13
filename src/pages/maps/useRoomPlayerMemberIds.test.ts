import { describe, expect, it } from 'vitest'
import { sameRoomPlayerMemberIds } from './useRoomPlayerMemberIds'

describe('sameRoomPlayerMemberIds', () => {
  it('treats equal rosters as unchanged regardless of insertion order', () => {
    expect(sameRoomPlayerMemberIds(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
  })

  it('detects member joins and leaves', () => {
    expect(sameRoomPlayerMemberIds(new Set(['a']), new Set(['a', 'b']))).toBe(false)
    expect(sameRoomPlayerMemberIds(undefined, new Set())).toBe(false)
  })
})

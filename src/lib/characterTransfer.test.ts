import { describe, expect, it } from 'vitest'
import { parseCharacterExport, prepareDmCharacterImport } from './characterTransfer'

describe('DM character JSON import', () => {
  it('puts an exported character in the current room without retaining its previous owner', () => {
    const source = {
      name: 'Imported hero', roomId: 'old-room', roomMemberId: 'old-member',
      ownerAccountId: 'old-account', player: 'Old player', visibleToPlayers: false,
      dnd5eFeatIds: ['test:feat'], skills: ['perception'],
    }
    const parsed = parseCharacterExport({ schema: 'stars-character', version: 1, character: source })
    expect(parsed).not.toBeNull()
    const imported = prepareDmCharacterImport(parsed!, 'current-room')
    expect(imported).toMatchObject({
      roomId: 'current-room', player: 'DM 待分配', visibleToPlayers: true,
      dnd5eFeatIds: ['test:feat'], skills: ['perception'],
    })
    expect(imported.roomMemberId).toBeUndefined()
    expect(imported.ownerAccountId).toBeUndefined()
    expect(source.roomId).toBe('old-room')
    expect(source.ownerAccountId).toBe('old-account')
  })

  it('rejects unrelated JSON using the existing player import parser', () => {
    expect(parseCharacterExport({ unrelated: true })).toBeNull()
  })
})

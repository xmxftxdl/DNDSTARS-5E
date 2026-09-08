import { describe, expect, it } from 'vitest'
import {
  normalizeSharedRoomChat,
  normalizeSharedRoomJournal,
  parseRoomChatRollCommand,
} from './roomCommunications'

describe('room communications client contracts', () => {
  it('uses the same bounded dice syntax as the authority', () => {
    expect(parseRoomChatRollCommand('/roll d20-2 潜行')).toEqual({
      expression: '1d20-2', count: 1, sides: 20, modifier: -2, label: '潜行',
    })
    expect(parseRoomChatRollCommand('/roll 0d6')).toBeNull()
  })

  it('drops malformed projected messages', () => {
    const normalized = normalizeSharedRoomChat({
      messages: [
        { id: 'broken' },
        {
          id: 'ok', channel: 'ooc', createdAt: 1, senderMemberId: 'player',
          senderRole: 'player', senderDisplayName: '甲', persona: { kind: 'player', name: '甲', avatar: '👤' },
          text: '测试',
        },
      ],
      updatedAt: 1,
    })
    expect(normalized.messages.map((entry) => entry.id)).toEqual(['ok'])
  })

  it('keeps only fully host-resolved telepathic-bond messages', () => {
    const common = {
      channel: 'telepathic-bond', createdAt: 1, senderMemberId: 'player-a',
      senderRole: 'player', senderDisplayName: '甲',
      persona: { kind: 'character', name: '艾琳', avatar: '🧝', sourceId: 'hero-a' },
      text: '心灵讯息',
    }
    const normalized = normalizeSharedRoomChat({
      messages: [
        { id: 'missing-audience', ...common },
        {
          id: 'resolved', ...common,
          telepathicNetworkKey: 'caster:telepathic-bond',
          telepathicParticipantCharacterIds: ['hero-a', 'hero-b'],
          telepathicParticipantNames: ['艾琳', '博林'],
          audienceMemberIds: ['player-a', 'player-b'],
        },
      ],
      updatedAt: 1,
    })
    expect(normalized.messages).toMatchObject([{
      id: 'resolved', channel: 'telepathic-bond', audienceMemberIds: ['player-a', 'player-b'],
    }])
  })

  it('normalizes all three journal collections', () => {
    const normalized = normalizeSharedRoomJournal({
      handouts: [{
        id: 'draft',
        title: '待发布讲义',
        body: '正文',
        audience: 'dm',
        authorMemberId: 'dm',
        authorName: 'DM',
        createdAt: 1,
        updatedAt: 1,
      }],
      campaignEntries: [],
      sharedNotes: [],
      authorityMutationReceipts: ['receipt-1', '', 'receipt-2'],
      updatedAt: 42,
    })
    expect(normalized).toMatchObject({
      handouts: [{ id: 'draft', audience: 'dm' }],
      campaignEntries: [],
      sharedNotes: [],
      authorityMutationReceipts: ['receipt-1', 'receipt-2'],
      updatedAt: 42,
    })
  })
})

import { describe, expect, it } from 'vitest'
import type { MobileCredentials } from './mobileApi'
import { buildMobileWorkspace } from './workspaceAdapter'

const credentials: MobileCredentials = {
  serverUrl: 'https://example.test',
  account: {
    accountId: 'account-1', displayName: '玩家一', sessionToken: 'account-token', createdAt: 1,
  },
  room: {
    roomId: 'ROOM01', roomName: '测试房间', rulesetId: 'dnd5e-2014-srd-5.1',
    memberId: 'member-1', roomToken: 'room-token', accountId: 'account-1', clientId: 'mobile-1',
    role: 'player', slot: 'player1', displayName: '玩家一', createdAt: 1,
  },
}

describe('mobile workspace player projection', () => {
  it('projects portraits, handout images, racial spells and owned rest reports', () => {
    const workspace = buildMobileWorkspace({
      credentials,
      rules: null,
      activeCharacterId: 'character-1',
      resources: {
        characters: { characters: [{
          id: 'character-1', ownerAccountId: 'account-1', name: '奈落', race: '提夫林', dnd5eRaceId: 'tiefling',
          charClass: '法师', level: 5, maxHp: 30, currentHp: 24, ac: 13, speed: 30,
          abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
        }] },
        maps: { selectedId: 'map-1', updatedAt: 2, maps: [{
          id: 'map-1', name: '森林', width: 1000, height: 800,
          tokens: [{ id: 'token-1', characterId: 'character-1', label: '奈落', x: 100, y: 150, size: 1, tokenPortraitImageId: 'portrait-1', viewerControlled: true, dnd5eSide: 'player' }],
        }] },
        'room-journal': { handouts: [{ id: 'handout-1', title: '密信', body: '信件正文', imageId: 'handout-image', createdAt: 3 }], campaignEntries: [{ id: 'chapter-1', title: '第一幕', body: '抵达森林。', source: 'dm', authorName: 'DM', createdAt: 2, updatedAt: 3 }] },
        'campaign-time': { advances: [{
          id: 'rest-1', kind: 'long-rest', createdAt: 4, toWorldMinute: 480, reason: '营地休息',
          restRecoveryReports: [
            { characterId: 'character-1', characterName: '奈落', entries: [{ category: 'hit-points', label: '生命值', outcome: 'restored', before: 24, after: 30, maximum: 30 }] },
            { characterId: 'other-character', characterName: '其他玩家', entries: [{ category: 'hit-points', label: '生命值', outcome: 'restored' }] },
          ],
        }] },
        spellbook: {}, combat: {}, 'room-chat': {}, 'combat-log': {}, 'combat-interrupts': {}, 'player-action-ack': {},
      },
    })

    expect(workspace.scene?.controlledTokens[0].portraitSource?.uri).toContain('/api/images/portrait-1?room=ROOM01')
    expect(workspace.handouts[0].imageSource?.uri).toContain('/api/images/handout-image?room=ROOM01')
    expect(workspace.campaignJournal[0]).toMatchObject({ id: 'chapter-1', title: '第一幕', authorName: 'DM' })
    expect(workspace.spells.some((spell) => spell.racialInnate && spell.racialCastAtLevel === 2)).toBe(true)
    expect(workspace.restAdvances[0].recoveryReports).toHaveLength(1)
    expect(workspace.restAdvances[0].recoveryReports[0].entries[0]).toMatchObject({ before: 24, after: 30, maximum: 30 })
  })
})

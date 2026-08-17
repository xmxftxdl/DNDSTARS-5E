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
  it('projects player-safe lights, elevation contours and visible persistent areas', () => {
    const workspace = buildMobileWorkspace({
      credentials, rules: null, activeCharacterId: 'character-1', resources: {
        characters: { characters: [{ id: 'character-1', ownerAccountId: 'account-1', name: '奈落', maxHp: 12, currentHp: 12 }] },
        maps: { selectedId: 'map-1', maps: [{
          id: 'map-1', width: 700, height: 700, gridSize: 70,
          tokens: [{ id: 'token-1', type: 'player', characterId: 'character-1', x: 70, y: 70, viewerControlled: true }],
          dnd5ePluginAreas: [{
            id: 'moon-area', pluginId: 'demo.plugin', label: '月光', color: '#8b5cf6', sourceCharacterId: 'character-1', sourceTokenId: 'token-1',
            cells: [{ col: 2, row: 2 }], movement: { economy: 'action', maximumFeet: 60 },
          }, {
            id: 'secret-area', pluginId: 'dm.secret', label: '隐藏陷阱', color: '#ef4444', sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token',
            hiddenFromPlayers: true, cells: [{ col: 4, row: 4 }],
          }],
        }] },
        'map-geometry': { maps: [{ mapId: 'map-1', obstacles: [{ id: 'ridge', label: '高地', terrainRegion: true, terrainElevationFeet: 15, points: [{ x: 0, y: 0 }, { x: 140, y: 0 }, { x: 140, y: 140 }] }], lights: [{ id: 'torch', label: '火把', enabled: true, points: [{ x: 210, y: 210 }], brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#f59e0b' }] }] },
        spellbook: {}, combat: {}, 'room-chat': {}, 'room-journal': {}, 'combat-log': {}, 'combat-interrupts': {}, 'player-action-ack': {},
      },
    })
    expect(workspace.scene?.persistentAreas).toEqual([expect.objectContaining({ id: 'moon-area', ownerPluginId: 'demo.plugin' })])
    expect(workspace.scene?.terrainElevations).toEqual([expect.objectContaining({ id: 'ridge', elevationFeet: 15 })])
    expect(workspace.scene?.lights).toEqual([expect.objectContaining({ id: 'torch', brightRadiusFeet: 20, dimRadiusFeet: 20 })])
  })

  it('resolves desktop-relative token artwork against the server and keeps an avatar fallback', () => {
    const workspace = buildMobileWorkspace({
      credentials,
      rules: null,
      activeCharacterId: 'character-1',
      resources: {
        characters: { characters: [{
          id: 'character-1', ownerAccountId: 'account-1', name: '奈落', avatar: '🧙',
          tokenPortrait: '/assets/portraits/hero-token.png', maxHp: 12, currentHp: 12,
        }] },
        maps: { selectedId: 'map-1', maps: [{ id: 'map-1', width: 100, height: 100, tokens: [{ id: 'token-1', type: 'player', characterId: 'character-1', x: 10, y: 10, viewerControlled: true }] }] },
        spellbook: {}, combat: {}, 'room-chat': {}, 'room-journal': {}, 'combat-log': {}, 'combat-interrupts': {}, 'player-action-ack': {},
      },
    })

    expect(workspace.scene?.visibleTokens[0]).toMatchObject({
      avatar: '🧙',
      portraitSource: { uri: 'https://example.test/assets/portraits/hero-token.png' },
    })
  })

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
        }], worldMinute: 510, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [{ id: 'timer-1', kind: 'reminder', status: 'active', label: '火把熄灭', expiresAtWorldMinute: 570 }] },
        spellbook: {}, combat: {}, 'room-chat': {}, 'combat-log': {}, 'combat-interrupts': {}, 'player-action-ack': {},
      },
    })

    expect(workspace.scene?.controlledTokens[0].portraitSource?.uri).toContain('/api/images/portrait-1?room=ROOM01')
    expect(workspace.handouts[0].imageSource?.uri).toContain('/api/images/handout-image?room=ROOM01')
    expect(workspace.campaignJournal[0]).toMatchObject({ id: 'chapter-1', title: '第一幕', authorName: 'DM' })
    expect(workspace.spells.some((spell) => spell.racialInnate && spell.racialCastAtLevel === 2)).toBe(true)
    expect(workspace.restAdvances[0].recoveryReports).toHaveLength(1)
    expect(workspace.campaignTime).toMatchObject({ formatted: '第 1 日 08:30', worldMinute: 510 })
    expect(workspace.campaignTime.activeTimers[0]).toMatchObject({ id: 'timer-1', remainingMinutes: 60 })
    expect(workspace.restAdvances[0].recoveryReports[0].entries[0]).toMatchObject({ before: 24, after: 30, maximum: 30 })
    const character = workspace.characters.find((entry) => entry.id === workspace.activeCharacterId)
    expect(character?.features?.some((feature) => feature.source === 'class' && feature.level != null)).toBe(true)
    expect(character?.features?.some((feature) => feature.source === 'race' && feature.name === '先天施法' && feature.automation === 'full')).toBe(true)
    expect(character?.levelUpPlans?.some((plan) =>
      plan.classId === 'wizard'
      && plan.fromLevel === 5
      && plan.toLevel === 6
      && plan.fromClassLevel === 5
      && plan.toClassLevel === 6
      && plan.eligible,
    )).toBe(true)
  })

  it('projects subclass choices and spell growth without granting the level on the client', () => {
    const workspace = buildMobileWorkspace({
      credentials,
      rules: null,
      activeCharacterId: 'fighter-2',
      resources: {
        characters: { characters: [{
          id: 'fighter-2', ownerAccountId: 'account-1', name: '安娜', race: '人类', background: '士兵',
          charClass: '战士', level: 2, maxHp: 20, currentHp: 20, ac: 16, speed: 30,
          abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          dnd5eClassLevels: { fighter: 2 },
          dnd5eClassChoices: { fighter: { fightingStyles: ['defense'] } },
          savingThrows: ['str', 'con'], skills: ['athletics'],
        }] },
        maps: {}, spellbook: {}, combat: {}, 'room-chat': {}, 'room-journal': {}, 'combat-log': {}, 'combat-interrupts': {}, 'player-action-ack': {},
      },
    })

    const character = workspace.characters.find((entry) => entry.id === workspace.activeCharacterId)
    const plans = character?.levelUpPlans?.filter((plan) => plan.classId === 'fighter') ?? []
    expect(character?.level).toBe(2)
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.every((plan) => plan.toLevel === 3 && plan.subclassChoiceUnlocked && plan.proposedSubclassId)).toBe(true)
    expect(plans.every((plan) => plan.fighterCurrentStyles?.includes('defense'))).toBe(true)
  })
})

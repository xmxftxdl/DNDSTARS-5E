import { describe, expect, it } from 'vitest'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import type { Character } from '../../types/character'
import { reconcileDnd5eCharacterCampaignTime } from './campaignTimeRules'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: '测试角色', player: '玩家', avatar: '🛡️', accent: 'from-violet-500',
    race: '人类', charClass: '战士', level: 1, background: '士兵', experience: 0, reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 12, currentHp: 1, tempHp: 0, hitDice: 'd10',
    ac: 16, speed: 30, initiativeBonus: 1, saveDC: 13, passivePerception: 10,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

function clock(worldMinute: number, advances: SharedCampaignTimeState['advances']): SharedCampaignTimeState {
  return { schemaVersion: 2, worldMinute, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances, updatedAt: 1 }
}

describe('D&D 5e campaign-time reconciliation', () => {
  it('uses the first observation as a migration baseline', () => {
    const result = reconcileDnd5eCharacterCampaignTime(character(), clock(2_000, []))
    expect(result.character.dnd5eWorldTimeAppliedMinute).toBe(2_000)
    expect(result.character.currentHp).toBe(1)
  })

  it('applies dawn resources and Divine Intervention by elapsed calendar days', () => {
    const source = character({
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: { divineInterventionCooldownDays: 7 },
      classResources: { 'dnd5e-divine-intervention': { current: 0, max: 1 } },
      dnd5eInventory: {
        schemaVersion: 2,
        entries: [{
          instanceId: 'wand', templateId: 'test-wand', quantity: 1, acquiredAt: 0, item: {
            id: 'wand', name: '测试魔杖', englishName: 'Test Wand', category: 'adventuring-gear',
            description: '测试', rulesText: '测试', stackable: false, icon: 'magic-wand',
            resources: [{ id: 'charge', label: '充能', maximum: 2, resetOn: 'dawn' }],
            source: { book: 'DM 自定义', license: '用户内容' },
          },
          resources: { charge: { id: 'charge', label: '充能', current: 0, maximum: 2, resetOn: 'dawn' } },
        }],
      },
    })
    const result = reconcileDnd5eCharacterCampaignTime(source, clock(1_800, [{
      id: 'advance', kind: 'advance', fromWorldMinute: 480, toWorldMinute: 1_800, minutes: 1_320,
      reason: '推进', dawnsCrossed: 1, expiredTimerIds: [], createdAt: 1,
    }]))
    expect(result.dawnsApplied).toBe(1)
    expect(result.character.dnd5eCombatState?.divineInterventionCooldownDays).toBe(6)
    expect(result.character.dnd5eInventory?.entries[0].resources?.charge.current).toBe(2)
  })

  it('grants only one long-rest benefit inside a 24-hour interval', () => {
    const source = character({ dnd5eWorldTimeAppliedMinute: 480 })
    const result = reconcileDnd5eCharacterCampaignTime(source, clock(1_440, [
      { id: 'rest-1', kind: 'long-rest', fromWorldMinute: 480, toWorldMinute: 960, minutes: 480, reason: '长休', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1 },
      { id: 'rest-2', kind: 'long-rest', fromWorldMinute: 960, toWorldMinute: 1_440, minutes: 480, reason: '长休', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 2 },
    ]))
    expect(result.longRestsApplied).toBe(1)
    expect(result.longRestsBlocked).toBe(1)
    expect(result.character.currentHp).toBe(12)
    expect(result.character.dnd5eLastLongRestWorldMinute).toBe(960)
  })
})

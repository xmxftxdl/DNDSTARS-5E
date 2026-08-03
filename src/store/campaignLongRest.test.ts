import { describe, expect, it, vi } from 'vitest'
import type { SharedCampaignTimeState } from '../lib/campaignTime'
import type { Character } from '../types/character'
import { reconcileDnd5eCharacterCampaignTime } from '../rulesets/dnd5e/campaignTimeRules'
import { runDnd5eCampaignLongRestTransaction } from './campaignLongRest'

function wizard(patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'wizard',
    name: '测试法师',
    player: '玩家',
    avatar: '',
    accent: 'from-violet-500',
    race: '人类',
    charClass: '法师',
    dnd5eClassLevels: { wizard: 5 },
    level: 5,
    background: '贤者',
    experience: 0,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: [],
    maxHp: 28,
    currentHp: 9,
    tempHp: 0,
    hitDice: '5d6',
    ac: 12,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 15,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    classResources: {
      'dnd5e-spell-slot-1': { current: 0, max: 4 },
      'dnd5e-spell-slot-2': { current: 0, max: 3 },
      'dnd5e-spell-slot-3': { current: 0, max: 2 },
    },
    ...patch,
  }
}

function clock(
  worldMinute: number,
  advances: SharedCampaignTimeState['advances'] = [],
): SharedCampaignTimeState {
  return {
    schemaVersion: 2,
    worldMinute,
    displayMode: 'campaign-day',
    displayMinuteOffset: 0,
    timers: [],
    advances,
    updatedAt: worldMinute,
  }
}

describe('DM campaign long-rest transaction', () => {
  it('establishes a new wizard clock baseline before restoring spent spell slots', async () => {
    let character = wizard()
    const before = clock(480)
    const after = clock(960, [{
      id: 'dm-long-rest',
      kind: 'long-rest',
      fromWorldMinute: 480,
      toWorldMinute: 960,
      minutes: 480,
      reason: 'DM 完整长休',
      dawnsCrossed: 0,
      expiredTimerIds: [],
      createdAt: 1,
    }])
    const reconciledMinutes: number[] = []
    const mutate = vi.fn(async () => after)

    await runDnd5eCampaignLongRestTransaction({
      currentClock: before,
      reason: 'DM 完整长休',
      mutate,
      reconcileCharacters: async (nextClock) => {
        reconciledMinutes.push(nextClock.worldMinute)
        character = reconcileDnd5eCharacterCampaignTime(character, nextClock).character
      },
    })

    expect(reconciledMinutes).toEqual([480, 960])
    expect(mutate).toHaveBeenCalledWith({ operation: 'long-rest', reason: 'DM 完整长休' })
    expect(character.dnd5eWorldTimeAppliedMinute).toBe(960)
    expect(character.dnd5eLastLongRestWorldMinute).toBe(960)
    expect(character.currentHp).toBe(28)
    expect(character.classResources).toMatchObject({
      'dnd5e-spell-slot-1': { current: 4, max: 4 },
      'dnd5e-spell-slot-2': { current: 3, max: 3 },
      'dnd5e-spell-slot-3': { current: 2, max: 2 },
    })
  })
})

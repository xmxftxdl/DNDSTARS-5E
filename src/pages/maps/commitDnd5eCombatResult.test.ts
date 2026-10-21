// Match the combat entry's effect initialization before loading item/campaign-time helpers.
import '../../rulesets/dnd5e/activeEffects'
import { describe, expect, it, vi } from 'vitest'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import {
  applyDnd5eCombatResultApplication,
  compensateDnd5eCompletedLongCastApplication,
  rebaseDnd5eCompletedBenefitHistoryApplication,
  commitDnd5eCombatResult,
  mergeDnd5eCharacterPatchIntoResult,
  mergeDnd5eMapTokenChangesIntoResult,
  mergeDnd5eCombatCharacterResult,
} from './commitDnd5eCombatResult'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { reconcileDnd5eCharacterCampaignTime } from '../../rulesets/dnd5e/campaignTimeRules'
import { applyDnd5eInventoryGrantBundle, applyDnd5eInventoryMutation } from '../../rulesets/dnd5e/items'
import { normalizeCharacter } from '../../store/characters'

function plan(patch: Partial<Dnd5eMapResultPlan> = {}): Dnd5eMapResultPlan {
  const hero = { id: 'hero', name: 'Hero' } as Character
  const token = { id: 'token', label: 'Hero' } as Token
  return {
    map: { id: 'map', tokens: [token] } as BattleMap,
    characters: [hero],
    changedCharacterIds: ['hero'],
    changedTokenIds: ['token'],
    ...patch,
  }
}

describe('战斗结果提交协调器', () => {
  it('publishes spent reactions only after entity commit and deduplicates the receipt', () => {
    const order: string[] = [], reaction = { current: 1 }
    const input = { application: plan({ spentReactions: { round: 2, tokenIds: ['token', 'token'] } }), mapId: 'map',
      applyCharacter: () => { order.push('character') }, applyToken: () => { order.push('token') },
      applySpentReaction: (id: string, round: number) => {
        expect(id).toBe('token'); expect(round).toBe(2)
        reaction.current = 0; order.push('reaction')
      } }
    expect(reaction.current).toBe(1)
    applyDnd5eCombatResultApplication(input)
    expect(order).toEqual(['character', 'token', 'reaction'])
    applyDnd5eCombatResultApplication(input)
    expect(reaction.current).toBe(0)
  })
  it('rejects an invalid reaction receipt before any state is published', () => {
    const write = vi.fn()
    expect(() => applyDnd5eCombatResultApplication({ mapId: 'map',
      application: plan({ spentReactions: { round: 1, tokenIds: ['absent'] } }),
      applyCharacter: write, applyToken: write, applySpentReaction: write })).toThrow('combat-result-reaction-receipt-invalid')
    expect(write).not.toHaveBeenCalled()
  })
  it.each([60, 70])('starts new Ceremony history at completion after %s minutes without changing old history or dropping commit patches', minutes => {
    const record = (id: string, subjectActorId: string, createdWorldMinute: number) => ({ schemaVersion: 1 as const,
      kind: 'benefit-history' as const, id, sourceActorId: 'caster', subjectActorId, sourceActivityId: 'ceremony',
      sourcePackageId: 'test.ceremony', benefitKey: id, createdWorldMinute })
    const old = record('old', 'hero', 100)
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', dnd5eWorldTimeAppliedMinute: 200, dnd5eCombatState: {
      schemaVersion: 2, spellAuthorityRecords: { old, new: record('new', 'hero', 200) } } })
    const npc: Token = { id: 'token', label: 'NPC', x: 0, y: 0, type: 'enemy', size: 1, color: '', emoji: '', hp: 10, maxHp: 10,
      dnd5eWorldTimeAppliedMinute: 200, dnd5eCombatState: { schemaVersion: 2, spellAuthorityRecords: { new: record('new', 'token', 200) } } }
    // The authoritative patches differ from stale full snapshots, just as an entity-mode transaction can.
    const input = plan({ characters: [{ ...hero, dnd5eCombatState: { schemaVersion: 2, spellAuthorityRecords: { old } } }],
      map: { id: 'map', tokens: [{ ...npc, dnd5eCombatState: { schemaVersion: 2 } }] } as BattleMap,
      characterPatches: { hero: { dnd5eCombatState: hero.dnd5eCombatState } },
      tokenPatches: { token: { dnd5eCombatState: npc.dnd5eCombatState } } })
    const before = structuredClone(input)
    const clock = 200 + minutes
    const result = rebaseDnd5eCompletedBenefitHistoryApplication(input,
      new Map([['hero', new Set(['new'])]]), new Map([['token', new Set(['new'])]]), clock)
    expect(result.characters[0].dnd5eCombatState!.spellAuthorityRecords!.new.createdWorldMinute).toBe(clock)
    expect(result.characterPatches!.hero.dnd5eCombatState).toEqual(result.characters[0].dnd5eCombatState)
    expect(result.map.tokens[0].dnd5eCombatState!.spellAuthorityRecords!.new.createdWorldMinute).toBe(clock)
    expect(result.tokenPatches!.token.dnd5eCombatState).toEqual(result.map.tokens[0].dnd5eCombatState)
    expect(result.characters[0].dnd5eCombatState!.spellAuthorityRecords!.old).toEqual(old)
    expect(input).toEqual(before)
    expect(rebaseDnd5eCompletedBenefitHistoryApplication(result,
      new Map([['hero', new Set(['new'])]]), new Map([['token', new Set(['new'])]]), clock)).toBe(result)
    const alreadyCompletedPatch = plan({ ...input, characterPatches: result.characterPatches, tokenPatches: result.tokenPatches })
    const recovered = rebaseDnd5eCompletedBenefitHistoryApplication(alreadyCompletedPatch,
      new Map([['hero', new Set(['new'])]]), new Map([['token', new Set(['new'])]]), clock)
    expect(recovered.characters[0].dnd5eCombatState).toEqual(result.characters[0].dnd5eCombatState)
    expect(recovered.map.tokens[0].dnd5eCombatState).toEqual(result.map.tokens[0].dnd5eCombatState)
    const appliedCharacters: Character[] = [], appliedTokens: Token[] = []
    applyDnd5eCombatResultApplication({ application: result, mapId: 'map',
      applyCharacter: (_id, character, patch) => appliedCharacters.push({ ...character, ...patch }),
      applyToken: (_mapId, _id, token, patch) => appliedTokens.push({ ...token, ...patch }) })
    expect(appliedCharacters[0].dnd5eCombatState!.spellAuthorityRecords!.new.createdWorldMinute).toBe(clock)
    expect(appliedTokens[0].dnd5eCombatState!.spellAuthorityRecords!.new.createdWorldMinute).toBe(clock)
    expect(() => rebaseDnd5eCompletedBenefitHistoryApplication(input, new Map(), new Map(), NaN)).toThrow('invalid-benefit-completion-clock')
    expect(() => rebaseDnd5eCompletedBenefitHistoryApplication(result,
      new Map([['hero', new Set(['new'])]]), new Map(), 199)).toThrow('benefit-completion-clock-before-record')
  })
  it.each([false, true])('includes off-map transferred inventory expiry in the completion commit, ageAll=%s', ageAll => {
    const tag = 'item-lease:11111111-1111-1111-1111-111111111111'
    const effect = createDnd5eMechanicalEffect({ id: 'old', definitionId: 'old', label: 'Old', targetId: 'hero', source: { kind: 'spell', actorId: 'hero' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' }, modifiers: {} })
    effect.tags = [tag]
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', dnd5eWorldTimeAppliedMinute: 480, dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] } })
    const holder = normalizeCharacter({ id: 'holder', name: 'Holder', dnd5eWorldTimeAppliedMinute: 480 })
    const grant = applyDnd5eInventoryGrantBundle([hero, holder], { characterId: 'hero', receiptId: 'grant', grants: [{ templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1, sourceEffectTag: tag }] })
    const item = grant.characters[0].dnd5eInventory!.entries.find(entry => entry.sourceEffectTag === tag)!
    const transferred = applyDnd5eInventoryMutation(grant.characters, { type: 'transfer', characterId: 'hero', targetCharacterId: 'holder', instanceId: item.instanceId, quantity: 1 })
    const held = transferred.characters[1].dnd5eInventory!.entries.find(entry => entry.sourceEffectTag === tag)!
    const equipped = applyDnd5eInventoryMutation(transferred.characters, { type: 'equip', characterId: 'holder', instanceId: held.instanceId })
    const input = plan({ characters: equipped.characters, characterPatches: { hero: {} }, map: { id: 'map', tokens: [] } as unknown as BattleMap, changedTokenIds: [] })
    const result = compensateDnd5eCompletedLongCastApplication(input, new Map([['hero', new Set(['new-effect'])]]), 1, {
      schemaVersion: 2, worldMinute: 481, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1,
    }, new Map(), new Map(), ageAll)
    expect(result.changedCharacterIds).toContain('holder')
    expect(result.characters[1].dnd5eInventory?.entries.some(entry => entry.sourceEffectTag === tag)).toBe(false)
    expect(result.characterPatches?.holder?.dnd5eInventory).toEqual(result.characters[1].dnd5eInventory)
    expect(result.characterPatches?.holder?.equipment?.mainWeapon).toBeUndefined()
    expect(result.characters[1].equipment?.mainWeapon).toBeUndefined()
    expect(input.characters[1].equipment?.mainWeapon).toBeDefined()
  })
  it('preserves consumed rest receipts against stale combat snapshots while accepting an explicit atomic receipt patch',()=>{
    const receipt:NonNullable<Character['dnd5eRestActivityWindow']>={schemaVersion:1,characterId:'hero',eventId:'rest:long-rest-complete:480',event:'long-rest-complete',completedWorldMinute:480,receipts:{'["test.rest","bless"]':'used'}}
    const current={...plan().characters[0],dnd5eRestActivityWindow:receipt}
    const stale={...current,dnd5eRestActivityWindow:{...receipt,receipts:{}}}
    expect(mergeDnd5eCombatCharacterResult(current,stale).dnd5eRestActivityWindow).toEqual(receipt)
    const application=mergeDnd5eCharacterPatchIntoResult(plan({characters:[stale]}),'hero',{dnd5eRestActivityWindow:receipt})
    expect(application.characterPatches?.hero?.dnd5eRestActivityWindow).toEqual(receipt)
    expect(mergeDnd5eCombatCharacterResult(stale,application.characters[0],application.characterPatches?.hero).dnd5eRestActivityWindow).toEqual(receipt)
  })
  it('同步补偿长施法新效果的完整快照与实体提交补丁', () => {
    const effect = createDnd5eMechanicalEffect({
      id: 'mirage', definitionId: 'activity:mirage', label: '海市蜃楼',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'mirage-arcane' }, targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 144_000, tickOn: 'target-turn-end' },
    })
    const hero = {
      ...plan().characters[0], rulesetId: 'dnd5e-2014-srd-5.1', conditions: [],
      dnd5eWorldTimeAppliedMinute: 480,
    } as Character
    const application = compensateDnd5eCompletedLongCastApplication(plan({
      characters: [hero],
      characterPatches: { hero: { dnd5eCombatState: { activeEffects: [effect] } } },
    }), new Map([['hero', new Set(['mirage'])]]), 10, {
      schemaVersion: 2, worldMinute: 490, displayMode: 'campaign-day', displayMinuteOffset: 0,
      timers: [], advances: [], updatedAt: 1,
    })
    expect(application.characters[0]?.dnd5eCombatState?.activeEffects?.[0]?.duration)
      .toMatchObject({ remainingRounds: 144_000 })
    expect(application.characterPatches?.hero?.dnd5eCombatState?.activeEffects?.[0]?.duration)
      .toMatchObject({ remainingRounds: 144_000 })
    expect(application.characterPatches?.hero?.dnd5eWorldTimeAppliedMinute).toBe(490)
  })

  it('长施法完成时不提前触发新周期治疗或身体再生，但既有效果照常流逝', () => {
    const existing = createDnd5eMechanicalEffect({
      id: 'existing', definitionId: 'activity:existing', label: '既有再生',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'existing' }, targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 100, tickOn: 'target-turn-start' },
      periodicHealing: { amount: 1, timing: 'target-turn-start' },
    })
    const regenerate = createDnd5eMechanicalEffect({
      id: 'regenerate', definitionId: 'activity:regenerate', label: '再生术',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'regenerate' }, targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-start' },
      periodicHealing: { amount: 1, timing: 'target-turn-start' },
      bodyRestoration: { roundsRemaining: 20 },
    })
    const hero = {
      ...plan().characters[0], rulesetId: 'dnd5e-2014-srd-5.1', conditions: [],
      maxHp: 100, currentHp: 50, dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: { bodyPresent: true, missingBodyParts: ['左臂'] },
    } as Character
    const application = compensateDnd5eCompletedLongCastApplication(plan({
      characters: [hero],
      characterPatches: {
        hero: {
          currentHp: 50,
          dnd5eCombatState: { bodyPresent: true, missingBodyParts: ['左臂'], activeEffects: [existing, regenerate] },
        },
      },
    }), new Map([['hero', new Set(['regenerate', 'activity:regenerate'])]]), 1, {
      schemaVersion: 2, worldMinute: 481, displayMode: 'campaign-day', displayMinuteOffset: 0,
      timers: [], advances: [], updatedAt: 1,
    })

    expect(application.characters[0]?.currentHp).toBe(60)
    expect(application.characters[0]?.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({ id: 'existing', duration: expect.objectContaining({ remainingRounds: 90 }) }),
      expect.objectContaining({
        id: 'regenerate',
        duration: expect.objectContaining({ remainingRounds: 600 }),
        bodyRestoration: { roundsRemaining: 20 },
      }),
    ])
    expect(application.characterPatches?.hero).toMatchObject({
      currentHp: 60,
      dnd5eWorldTimeAppliedMinute: 481,
      dnd5eCombatState: {
        activeEffects: [
          { id: 'existing', duration: { remainingRounds: 90 } },
          { id: 'regenerate', duration: { remainingRounds: 600 }, bodyRestoration: { roundsRemaining: 20 } },
        ],
      },
    })

    const afterOneMinute = reconcileDnd5eCharacterCampaignTime(application.characters[0], {
      schemaVersion: 2, worldMinute: 482, displayMode: 'campaign-day', displayMinuteOffset: 0,
      timers: [], advances: [], updatedAt: 2,
    }).character
    expect(afterOneMinute.dnd5eCombatState).toMatchObject({
      missingBodyParts: ['左臂'],
      activeEffects: [
        { id: 'existing', duration: { remainingRounds: 80 } },
        { id: 'regenerate', duration: { remainingRounds: 590 }, bodyRestoration: { roundsRemaining: 10 } },
      ],
    })
    const afterTwoMinutes = reconcileDnd5eCharacterCampaignTime(afterOneMinute, {
      schemaVersion: 2, worldMinute: 483, displayMode: 'campaign-day', displayMinuteOffset: 0,
      timers: [], advances: [], updatedAt: 3,
    }).character
    expect(afterTwoMinutes.dnd5eCombatState).toMatchObject({ bodyPresent: true })
    expect(afterTwoMinutes.dnd5eCombatState?.missingBodyParts).toBeUndefined()
    expect(afterTwoMinutes.dnd5eCombatState?.activeEffects?.[1]?.bodyRestoration).toBeUndefined()
  })

  it('长施法完成时保留没有 ActiveEffect 行的专注摘要', () => {
    const hero = {
      ...plan().characters[0], rulesetId: 'dnd5e-2014-srd-5.1', conditions: [],
      concentrating: true,
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: {
        concentrationSpellId: 'scrying',
        concentrationSpellLevel: 5,
        concentrationTargetIds: ['token'],
        concentrationRoundsRemaining: 100,
      },
    } as Character
    const application = compensateDnd5eCompletedLongCastApplication(plan({
      characters: [hero],
      characterPatches: {
        hero: {
          concentrating: true,
          dnd5eCombatState: hero.dnd5eCombatState,
        },
      },
    }), new Map(), 10, {
      schemaVersion: 2, worldMinute: 490, displayMode: 'campaign-day', displayMinuteOffset: 0,
      timers: [], advances: [], updatedAt: 1,
    }, new Map([['hero', 'scrying']]))

    expect(application.characters[0]).toMatchObject({
      concentrating: true,
      dnd5eWorldTimeAppliedMinute: 490,
      dnd5eCombatState: {
        concentrationSpellId: 'scrying',
        concentrationSpellLevel: 5,
        concentrationTargetIds: ['token'],
        concentrationRoundsRemaining: 100,
      },
    })
    expect(application.characterPatches?.hero).toMatchObject({
      concentrating: true,
      dnd5eWorldTimeAppliedMinute: 490,
      dnd5eCombatState: {
        concentrationSpellId: 'scrying',
        concentrationRoundsRemaining: 100,
      },
    })
  })

  it('长施法完成时不会让新施加给未关联怪物的效果损失施法时间', () => {
    const existing = createDnd5eMechanicalEffect({
      id: 'existing-monster-effect', definitionId: 'activity:existing-monster-effect', label: '既有效果',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'existing' }, targetId: 'monster-token',
      duration: { type: 'rounds', remainingRounds: 100, tickOn: 'target-turn-end' },
    })
    const geas = createDnd5eMechanicalEffect({
      id: 'geas-monster-effect', definitionId: 'activity:geas:geas-charmed', label: '魅惑',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'geas' }, targetId: 'monster-token',
      duration: { type: 'rounds', remainingRounds: 5_256_000, tickOn: 'target-turn-end' },
    })
    const monster = {
      id: 'monster-token', label: '强盗头目', type: 'enemy', x: 0, y: 0,
      color: '#000', emoji: '👹', size: 1, hp: 65, maxHp: 65,
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: { activeEffects: [existing, geas] },
    } as Token
    const application = compensateDnd5eCompletedLongCastApplication(plan({
      map: { id: 'map', tokens: [monster] } as BattleMap,
      changedTokenIds: [monster.id],
      tokenPatches: { [monster.id]: { dnd5eCombatState: monster.dnd5eCombatState } },
    }), new Map(), 1, {
      schemaVersion: 2, worldMinute: 481, displayMode: 'campaign-day', displayMinuteOffset: 0,
      timers: [], advances: [], updatedAt: 1,
    }, new Map(), new Map([[monster.id, new Set([geas.id, geas.definitionId])]]))

    expect(application.map.tokens[0]).toMatchObject({
      dnd5eWorldTimeAppliedMinute: 481,
      dnd5eCombatState: {
        activeEffects: [
          { id: existing.id, duration: { remainingRounds: 90 } },
          { id: geas.id, duration: { remainingRounds: 5_256_000 } },
        ],
      },
    })
    expect(application.tokenPatches?.[monster.id]).toMatchObject({
      dnd5eWorldTimeAppliedMinute: 481,
      dnd5eCombatState: {
        activeEffects: [
          { id: existing.id, duration: { remainingRounds: 90 } },
          { id: geas.id, duration: { remainingRounds: 5_256_000 } },
        ],
      },
    })
  })

  it('保留事务提交时角色最新的法师法术书和准备法术', () => {
    const current: Character = {
      ...plan().characters[0],
      id: 'hero',
      currentHp: 30,
      dnd5eClassChoices: {
        classes: {
          wizard: {
            subclass: 'evocation',
            selections: {
              'wizard-spellbook': ['magic-missile', 'shield', 'fireball'],
              'spell-prepared': ['shield', 'fireball'],
            },
          },
        },
      },
    }
    const staleCombatResult: Character = {
      ...current,
      currentHp: 12,
      dnd5eClassChoices: {
        classes: {
          wizard: {
            subclass: 'evocation',
            selections: {
              'wizard-spellbook': ['magic-missile'],
              'spell-prepared': [],
            },
          },
        },
      },
    }

    const merged = mergeDnd5eCombatCharacterResult(current, staleCombatResult)

    expect(merged.currentHp).toBe(12)
    expect(merged.dnd5eClassChoices).toEqual(current.dnd5eClassChoices)
    expect(merged.dnd5eClassChoices?.classes?.wizard?.selections?.['spell-prepared'])
      .toEqual(['shield', 'fireball'])
  })

  it('先完成全部预检，缺失记录时不会产生半提交', () => {
    const applyCharacter = vi.fn()
    const applyToken = vi.fn()
    expect(() => applyDnd5eCombatResultApplication({
      application: plan({ changedTokenIds: ['missing'] }),
      mapId: 'map', applyCharacter, applyToken,
    })).toThrow('combat-result-token-missing:missing')
    expect(applyCharacter).not.toHaveBeenCalled()
    expect(applyToken).not.toHaveBeenCalled()
  })

  it('拒绝把其他地图的 Headless 结果写入当前地图', () => {
    expect(() => applyDnd5eCombatResultApplication({
      application: plan(),
      mapId: 'other-map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
    })).toThrow('combat-result-map-mismatch:map:other-map')
  })

  it('去重后按角色再 Token 的顺序写入权威 Store', () => {
    const order: string[] = []
    const receipt = applyDnd5eCombatResultApplication({
      application: plan({
        changedCharacterIds: ['hero', 'hero'],
        changedTokenIds: ['token', 'token'],
      }),
      mapId: 'map',
      applyCharacter: (id) => order.push(`character:${id}`),
      applyToken: (_mapId, id) => order.push(`token:${id}`),
    })
    expect(order).toEqual(['character:hero', 'token:token'])
    expect(receipt).toEqual({ mapId: 'map', characterIds: ['hero'], tokenIds: ['token'] })
  })

  it('地图级事务只提交一次完整地图，不暴露半完成 Token/区域状态', () => {
    const applyCharacter = vi.fn()
    const applyToken = vi.fn()
    const applyMap = vi.fn()
    const application = plan()
    applyDnd5eCombatResultApplication({
      application,
      mapId: 'map',
      applyCharacter,
      applyToken,
      applyMap,
      applicationMode: 'map',
    })
    expect(applyCharacter).toHaveBeenCalledOnce()
    expect(applyToken).not.toHaveBeenCalled()
    expect(applyMap).toHaveBeenCalledOnce()
    expect(applyMap).toHaveBeenCalledWith('map', application.map)
  })

  it('地图级事务允许权威结果原子删除 changedTokenIds 中的 Token', () => {
    const applyCharacter = vi.fn()
    const applyToken = vi.fn()
    const applyMap = vi.fn()
    const application = plan({
      changedTokenIds: ['token'],
      map: { ...plan().map, tokens: [] },
    })

    const receipt = applyDnd5eCombatResultApplication({
      application,
      mapId: 'map',
      applyCharacter,
      applyToken,
      applyMap,
      applicationMode: 'map',
    })

    expect(receipt.tokenIds).toEqual(['token'])
    expect(applyToken).not.toHaveBeenCalled()
    expect(applyMap).toHaveBeenCalledWith('map', application.map)
  })

  it('地图级事务在重复 Token 或缺少地图端口时 fail closed', () => {
    const duplicate = { id: 'token', label: 'duplicate' } as Token
    const applyCharacter = vi.fn()
    const applyMap = vi.fn()
    expect(() => applyDnd5eCombatResultApplication({
      application: plan({
        map: { id: 'map', tokens: [{ id: 'token', label: 'Hero' } as Token, duplicate] } as BattleMap,
      }),
      mapId: 'map',
      applyCharacter,
      applyToken: vi.fn(),
      applyMap,
      applicationMode: 'map',
    })).toThrow('combat-result-token-duplicate')
    expect(applyCharacter).not.toHaveBeenCalled()
    expect(applyMap).not.toHaveBeenCalled()

    expect(() => applyDnd5eCombatResultApplication({
      application: plan(),
      mapId: 'map',
      applyCharacter,
      applyToken: vi.fn(),
      applicationMode: 'map',
    })).toThrow('combat-result-map-application-port-missing')
    expect(applyCharacter).not.toHaveBeenCalled()
  })

  it('等待两个共享快照完成后才返回，并允许强制保存地图级变化', async () => {
    let resolveCharacters!: () => void
    let resolveMap!: () => void
    let completed = false
    const application = plan({ changedCharacterIds: [], changedTokenIds: [] })
    const committed = commitDnd5eCombatResult({
      application,
      mapId: 'map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
      saveCharacters: () => new Promise<void>((resolve) => { resolveCharacters = resolve }),
      saveMap: () => new Promise<void>((resolve) => { resolveMap = resolve }),
      forceSaveCharacters: true,
      forceSaveMap: true,
    })
    void committed.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)
    resolveCharacters()
    await Promise.resolve()
    expect(completed).toBe(false)
    resolveMap()
    await committed
    expect(completed).toBe(true)
  })

  it('propagates an authoritative persistence rejection to the transaction coordinator', async () => {
    await expect(commitDnd5eCombatResult({
      application: plan(),
      mapId: 'map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
      saveCharacters: async () => {
        throw new Error('characters-save-rejected:conflict')
      },
      saveMap: async () => undefined,
    })).rejects.toThrow('characters-save-rejected:conflict')
  })

  it('applies only declared combat patches so a newer DM edit is preserved', () => {
    const current = {
      id: 'hero',
      name: 'Hero',
      currentHp: 27,
      tempHp: 4,
      playerNotes: 'DM edited while dice were rolling',
    } as unknown as Character
    const staleResolved = {
      ...current,
      currentHp: 10,
      tempHp: 0,
      playerNotes: 'stale snapshot',
    }
    expect(mergeDnd5eCombatCharacterResult(current, staleResolved, {
      currentHp: 10,
      tempHp: 0,
    })).toMatchObject({
      currentHp: 10,
      tempHp: 0,
      playerNotes: 'DM edited while dice were rolling',
    })
  })

  it('merges inventory rewards into an existing Headless character patch', () => {
    const inventory = {
      schemaVersion: 3 as const,
      entries: [],
      currency: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 },
      authorityGrantReceipts: ['interaction:bookshelf'],
    }
    const application = plan({
      characterPatches: { hero: { currentHp: 7 } },
    })

    const merged = mergeDnd5eCharacterPatchIntoResult(application, 'hero', {
      dnd5eInventory: inventory,
    })

    expect(merged.characterPatches?.hero).toMatchObject({
      currentHp: 7,
      dnd5eInventory: inventory,
    })
    expect(merged.characters[0].dnd5eInventory).toEqual(inventory)
    expect(merged.changedCharacterIds).toEqual(['hero'])
  })

  it('persists a Word of Recall sanctuary alongside the existing spell-slot patch', () => {
    const sanctuaryRecord = {
      schemaVersion: 1 as const,
      id: 'recall-sanctuary:hero',
      kind: 'recall-sanctuary' as const,
      sourceActorId: 'hero',
      subjectActorId: 'hero',
      sourceActivityId: 'cast-word-of-recall',
      createdWorldMinute: 1_234,
      slotLevel: 6,
      sanctuaryName: '主祭坛',
      deityConnection: '奉献给晨曦之主',
      destinationMapId: 'temple-map',
      destinationMapName: '神殿',
      destinationX: 425,
      destinationY: 575,
      destinationElevationFeet: 0,
    }
    const application = mergeDnd5eCharacterPatchIntoResult(plan({
      characterPatches: { hero: { currentHp: 7 } },
    }), 'hero', {
      dnd5eCombatState: {
        schemaVersion: 2,
        spellAuthorityRecords: { [sanctuaryRecord.id]: sanctuaryRecord },
      },
    })
    let committed: Character | undefined

    applyDnd5eCombatResultApplication({
      application,
      mapId: 'map',
      applyCharacter: (_id, resolved, patch) => {
        committed = mergeDnd5eCombatCharacterResult(
          { ...plan().characters[0], currentHp: 9 } as Character,
          resolved,
          patch,
        )
      },
      applyToken: vi.fn(),
    })

    expect(committed).toMatchObject({
      currentHp: 7,
      dnd5eCombatState: {
        spellAuthorityRecords: {
          'recall-sanctuary:hero': {
            kind: 'recall-sanctuary',
            destinationMapId: 'temple-map',
            destinationX: 425,
            destinationY: 575,
          },
        },
      },
    })
  })

  it('uses one coupled persistence operation when an atomic saver is available', async () => {
    const saveAll = vi.fn(async () => undefined)
    const saveCharacters = vi.fn(async () => undefined)
    const saveMap = vi.fn(async () => undefined)
    await commitDnd5eCombatResult({
      application: plan(),
      mapId: 'map',
      applyCharacter: vi.fn(),
      applyToken: vi.fn(),
      saveAll,
      saveCharacters,
      saveMap,
    })
    expect(saveAll).toHaveBeenCalledOnce()
    expect(saveCharacters).not.toHaveBeenCalled()
    expect(saveMap).not.toHaveBeenCalled()
  })
})

it('commits handoff movement with an existing state patch without overwriting unrelated live fields', () => {
  const token = { id: 'token', label: 'Target', x: 375, y: 275, hp: 50, elevationFeet: 10 } as Token
  const input = plan({ map: { id: 'map', tokens: [token] } as BattleMap,
    changedCharacterIds: [], tokenPatches: { token: { hp: 50 } } })
  const moved = { ...token, x: 425, elevationFeet: undefined }
  const merged = mergeDnd5eMapTokenChangesIntoResult(input, { ...input.map, tokens: [moved] })
  let live = { ...token, label: 'Renamed during settlement' }
  applyDnd5eCombatResultApplication({ application: merged, mapId: 'map',
    applyCharacter: vi.fn(), applyToken: (_map, _id, resolved, patch) => { live = { ...live, ...(patch ?? resolved) } } })
  expect(live).toMatchObject({ x: 425, y: 275, hp: 50, label: 'Renamed during settlement' })
  expect(live.elevationFeet).toBeUndefined()
  expect(merged.tokenPatches?.token).toEqual({ hp: 50, x: 425, elevationFeet: undefined })
  expect(input.map.tokens[0].x).toBe(375)
})

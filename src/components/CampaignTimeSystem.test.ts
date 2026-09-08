import { describe, expect, it } from 'vitest'
import type { CampaignTimeAdvance, SharedCampaignTimeState } from '../lib/campaignTime'
import {
  campaignRestAdvanceForViewer,
  campaignRestReceiptBaselineIds,
  latestCampaignRestAdvanceForViewer,
} from './campaignRestNotificationModel'
import {
  campaignTimeCharacterReconciliationKey,
  canReconcileCampaignTimeCharacters,
  projectDnd5eCampaignTimeAirborneTokens,
  projectDnd5eCampaignTimeCreatedObjects,
  projectDnd5eCampaignTimeCreatureTokens,
} from './CampaignTimeSystem'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import type { Character } from '../types/character'
import type { BattleMap } from '../store/maps'

function restAdvance(
  id: string,
  createdAt: number,
  reports: Array<{ characterId: string; characterName: string }>,
): CampaignTimeAdvance {
  return {
    id,
    kind: 'long-rest',
    fromWorldMinute: 480,
    toWorldMinute: 960,
    minutes: 480,
    reason: 'DM 安排队伍长休',
    dawnsCrossed: 0,
    expiredTimerIds: [],
    createdAt,
    restRecoveryReports: reports.map((report) => ({ ...report, entries: [{
      category: 'feature-resource',
      label: '法术位',
      outcome: 'restored',
      before: 0,
      after: 1,
      maximum: 1,
    }] })),
  }
}

describe('CampaignTimeSystem rest notification projection', () => {
  const ownId = 'player-wizard'
  const otherId = 'other-wizard'

  it('does not replay rest settlements created before this room session mounted', () => {
    const history = [restAdvance('historical-rest', 900, [{ characterId: ownId, characterName: '本角色' }])]
    const candidate = latestCampaignRestAdvanceForViewer(history, {
      isDm: false,
      playerOwnedCharacterIds: new Set([ownId]),
      seenIds: new Set(campaignRestReceiptBaselineIds(history)),
    })

    expect(candidate).toBeNull()
  })

  it('shows a player only reports for characters owned by that room member', () => {
    const projected = campaignRestAdvanceForViewer(
      restAdvance('current-rest', 1_100, [
        { characterId: ownId, characterName: '本角色' },
        { characterId: otherId, characterName: '另一名法师' },
      ]),
      { isDm: false, playerOwnedCharacterIds: new Set([ownId]) },
    )

    expect(projected?.restRecoveryReports?.map((report) => report.characterId)).toEqual([ownId])
  })

  it('keeps the full party report for the DM and selects only the latest new settlement', () => {
    const older = restAdvance('older-new-rest', 1_100, [{ characterId: ownId, characterName: '本角色' }])
    const latest = restAdvance('latest-new-rest', 1_200, [
      { characterId: ownId, characterName: '本角色' },
      { characterId: otherId, characterName: '另一名法师' },
    ])
    const candidate = latestCampaignRestAdvanceForViewer([older, latest], {
      isDm: true,
      playerOwnedCharacterIds: new Set(),
      seenIds: new Set(),
    })

    expect(candidate?.id).toBe(latest.id)
    expect(candidate?.restRecoveryReports).toHaveLength(2)
  })
})

describe('CampaignTimeSystem authoritative hydration gate', () => {
  it('does not publish persisted startup characters before both room resources hydrate', () => {
    const baseline = {
      isDm: true,
      currentRoomId: 'room-a',
      clockHydratedRoomId: 'room-a',
      charactersHydrated: true,
    }

    expect(canReconcileCampaignTimeCharacters(baseline)).toBe(true)
    expect(canReconcileCampaignTimeCharacters({ ...baseline, charactersHydrated: false })).toBe(false)
    expect(canReconcileCampaignTimeCharacters({ ...baseline, clockHydratedRoomId: null })).toBe(false)
    expect(canReconcileCampaignTimeCharacters({ ...baseline, clockHydratedRoomId: 'room-b' })).toBe(false)
    expect(canReconcileCampaignTimeCharacters({ ...baseline, isDm: false })).toBe(false)
  })

  it('lands an exploration token safely while its controlled descent ages', () => {
    const descent = createDnd5eMechanicalEffect({
      definitionId: 'wind-walk-cloud:after-effect-ends', label: '御风而行（结束后）',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'wind-walk:after-effect-ends' },
      targetId: 'hero', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: { controlledDescent: {
        maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true,
      } },
    })
    const character = {
      id: 'hero', rulesetId: 'dnd5e-2014-srd-5.1', dnd5eWorldTimeAppliedMinute: 1_000,
      dnd5eCombatState: { activeEffects: [descent] },
    } as Character
    const map = {
      id: 'map', tokens: [{
        id: 'hero-token', characterId: 'hero', type: 'player', x: 25, y: 25,
        label: 'Hero', color: '#fff', emoji: 'H', size: 1, elevationFeet: 65,
      }],
    } as BattleMap
    const result = projectDnd5eCampaignTimeAirborneTokens({
      maps: [map], geometryMaps: [], characters: [character],
      clock: {
        schemaVersion: 2, worldMinute: 1_001, displayMode: 'campaign-day',
        displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1,
      },
    })
    expect(result.airborneCharacterIds.has('hero')).toBe(true)
    expect(result.descendedCharacterIds.has('hero')).toBe(true)
    expect(result.maps[0].tokens[0].elevationFeet).toBe(0)
  })

  it('keys reconciliation to the authoritative clock rather than ordinary character renders', () => {
    const clock: SharedCampaignTimeState = {
      schemaVersion: 2,
      worldMinute: 1_000,
      displayMode: 'campaign-day',
      displayMinuteOffset: 0,
      timers: [],
      advances: [],
      updatedAt: 10,
    }
    expect(campaignTimeCharacterReconciliationKey('room-a', clock))
      .toBe(campaignTimeCharacterReconciliationKey('room-a', { ...clock }))
    expect(campaignTimeCharacterReconciliationKey('room-a', { ...clock, worldMinute: 1_001, updatedAt: 11 }))
      .not.toBe(campaignTimeCharacterReconciliationKey('room-a', clock))
  })

  it('expires bounded effects on unlinked creatures as the campaign clock advances', () => {
    const friendship = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'warhorse-token',
      source: { kind: 'spell', actorId: 'druid-token', rulesId: 'animal-friendship' },
      duration: { type: 'rounds', remainingRounds: 14_400, tickOn: 'target-turn-end' },
    })
    const druid = {
      id: 'druid', rulesetId: 'dnd5e-2014-srd-5.1', dnd5eWorldTimeAppliedMinute: 1_000,
    } as Character
    const map = {
      id: 'map', tokens: [{
        id: 'druid-token', characterId: 'druid', type: 'player', x: 0, y: 0,
        label: 'Druid', color: '#fff', emoji: 'D', size: 1,
      }, {
        id: 'warhorse-token', type: 'enemy', x: 5, y: 0, hp: 19, maxHp: 19,
        label: 'Warhorse', color: '#fff', emoji: 'W', size: 2,
        dnd5eCombatState: { activeEffects: [friendship], conditions: ['charmed'] },
      }],
    } as BattleMap
    const clock: SharedCampaignTimeState = {
      schemaVersion: 2, worldMinute: 2_440, displayMode: 'campaign-day',
      displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1,
    }

    const projected = projectDnd5eCampaignTimeCreatureTokens({
      maps: [map], characters: [druid], clock,
    })
    const warhorse = projected.maps[0].tokens[1]
    expect(projected.changed).toBe(true)
    expect(warhorse.dnd5eWorldTimeAppliedMinute).toBe(2_440)
    expect(warhorse.dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(warhorse.dnd5eCombatState?.conditions).toBeUndefined()
  })

  it('ages and restores timed hit-point maximum reductions on unlinked creatures', () => {
    const map = {
      id: 'map', tokens: [{
        id: 'assassin-token', type: 'enemy', x: 5, y: 0, hp: 1, maxHp: 41,
        label: 'Assassin', color: '#fff', emoji: 'A', size: 1,
        dnd5eWorldTimeAppliedMinute: 1_000,
        dnd5eCombatState: {
          hitPointMaximumReductionLedger: {
            schemaVersion: 1,
            baseMaximum: 78,
            entries: [{
              id: 'harm-reduction', amount: 37,
              recovery: 'greater-restoration-or-other-magic', remainingRounds: 600,
              sourceActionId: 'harm', damageType: 'necrotic',
            }],
          },
        },
      }],
    } as BattleMap

    const halfway = projectDnd5eCampaignTimeCreatureTokens({
      maps: [map], characters: [],
      clock: {
        schemaVersion: 2, worldMinute: 1_030, displayMode: 'campaign-day',
        displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1,
      },
    })
    const halfwayAssassin = halfway.maps[0].tokens[0]
    expect(halfwayAssassin.maxHp).toBe(41)
    expect(halfwayAssassin.hp).toBe(1)
    expect(halfwayAssassin.dnd5eCombatState?.hitPointMaximumReductionLedger?.entries[0])
      .toMatchObject({ amount: 37, remainingRounds: 300 })

    const expired = projectDnd5eCampaignTimeCreatureTokens({
      maps: halfway.maps, characters: [],
      clock: {
        schemaVersion: 2, worldMinute: 1_060, displayMode: 'campaign-day',
        displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 2,
      },
    })
    const restoredAssassin = expired.maps[0].tokens[0]
    expect(restoredAssassin.maxHp).toBe(78)
    expect(restoredAssassin.hp).toBe(1)
    expect(restoredAssassin.dnd5eCombatState?.hitPointMaximumReductionLedger).toBeUndefined()
    expect(restoredAssassin.dnd5eWorldTimeAppliedMinute).toBe(1_060)
  })

  it('ends Animate Dead control at exactly 24 hours without removing the undead', () => {
    const map = {
      id: 'map', tokens: [{
        id: 'controlled-skeleton', type: 'enemy', x: 25, y: 25, hp: 13, maxHp: 13,
        label: '受控骷髅', color: '#fff', emoji: '💀', size: 1, poolId: 'srd-5.1:skeleton',
        dnd5eSummon: {
          schemaVersion: 1, pluginId: 'core-srd-spell', featureId: 'spell:animate-dead',
          sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', createdRound: 1,
          expiresAfterRound: 14_400, persistent: true, side: 'player',
          createdWorldMinute: 1_001, controlExpiresAtWorldMinute: 2_441,
        },
      }],
    } as BattleMap
    const clock: SharedCampaignTimeState = {
      schemaVersion: 2, worldMinute: 2_441, displayMode: 'campaign-day',
      displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1,
    }
    const projected = projectDnd5eCampaignTimeCreatureTokens({ maps: [map], characters: [], clock })
    expect(projected.maps[0].tokens).toHaveLength(1)
    expect(projected.maps[0].tokens[0].dnd5eSummon?.controlEnded).toBe(true)
  })
})

describe('CampaignTimeSystem Creation object expiry', () => {
  it('keeps the object before its exact minute and removes it at expiry', () => {
    const map = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5,
      tokens: [{
        id: 'creation-object', label: '秘银箱', x: 100, y: 100,
        color: '#a78bfa', emoji: '📦', size: 1, type: 'obstacle',
        dnd5eObjectState: {
          schemaVersion: 1,
          creation: {
            schemaVersion: 1,
            sourceTokenId: 'caster-token', sourceCharacterId: 'caster', sourceActionId: 'cast-1',
            slotLevel: 5, objectDescription: '秘银箱', materials: ['adamantine-or-mithral'],
            edgeFeet: 5, createdWorldMinute: 100, expiresAtWorldMinute: 101,
            cannotBeSpellMaterial: true,
          },
        },
      }],
    } as BattleMap
    expect(projectDnd5eCampaignTimeCreatedObjects({ maps: [map], worldMinute: 100 }).changed).toBe(false)
    const expired = projectDnd5eCampaignTimeCreatedObjects({ maps: [map], worldMinute: 101 })
    expect(expired.changed).toBe(true)
    expect(expired.removedTokenIds).toEqual(['creation-object'])
    expect(expired.maps[0]?.tokens).toHaveLength(0)
  })
})

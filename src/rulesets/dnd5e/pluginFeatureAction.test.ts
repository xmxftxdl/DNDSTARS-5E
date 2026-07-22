import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { registerDnd5eRulesPlugin } from './pluginApi'
import {
  prepareDnd5ePluginFeatureAction,
  resolvePreparedDnd5ePluginFeatureAction,
} from './pluginFeatureAction'

const ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id,
    name: id,
    player: id,
    avatar: '🛡️',
    accent: 'from-slate-500 to-slate-700',
    race: '人类',
    charClass: '战士',
    level: 3,
    background: '士兵',
    experience: 0,
    reputation: 0,
    abilities: ABILITIES,
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d10',
    ac: 16,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    
    
    passivePerception: 10,
    inspiration: 0,
    
    
    
    
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, characterId: string, x: number, type: Token['type'] = 'player'): Token {
  return {
    id,
    label: id,
    x,
    y: 25,
    color: '#34d399',
    emoji: '●',
    type,
    size: 1,
    characterId,
  }
}

function action(featureId: string): SharedPlayerActionState {
  return {
    id: 'plugin-action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-plugin-action',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'ally-token',
    dnd5ePluginAction: { featureId },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1,
  }
}

describe('D&D 5e plugin feature authority action', () => {
  it('creates a declared summon, joins initiative, and starts concentration', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.summon', name: 'Summon', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'call-wolf', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'call-wolf', name: '召狼', summary: '召唤一只狼。', description: '测试召唤。', automation: 'full',
          action: {
            id: 'call-wolf', label: '召狼', economy: 'action',
            targeting: {
              kind: 'area', relation: 'any', maximumTargets: 1,
              template: { shape: 'circle', origin: 'point', radiusFeet: 0, placeRangeFeet: 30 },
            },
            summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10, concentration: true },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Summon map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [token('hero-token', hero.id, 25), token('enemy-token', enemy.id, 425, 'enemy')],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: 'H', color: '#fff', roll: 20 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: 'E', color: '#f00', roll: 5 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: undefined, targetCell: { col: 2, row: 0 } },
        map, characters: [hero, enemy], initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        summonInitiativeD20: 12,
      })
      expect(resolved.result.ok ? 'ok' : resolved.result.reason).toBe('ok')
      expect(resolved.application?.map.tokens).toHaveLength(3)
      expect(resolved.application?.map.tokens[2]).toMatchObject({
        id: 'plugin-summon:plugin-action-1', poolId: 'srd-5.1:wolf',
        dnd5eSummon: { side: 'player', concentrationId: 'plugin-summon:plugin-action-1' },
      })
      expect(resolved.summonedInitiativeEntries).toEqual([
        expect.objectContaining({ tokenId: 'plugin-summon:plugin-action-1', roll: 14 }),
      ])
      expect(resolved.application?.characters[0]).toMatchObject({
        concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'plugin-summon:plugin-action-1' },
      })
    } finally {
      dispose()
    }
  })

  it('rebuilds area targets and creates a concentration-bound persistent map entity', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.area', name: 'Area', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'ward', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'ward', name: '守护区域', summary: '测试范围。', description: '测试范围。', automation: 'full',
          action: {
            id: 'ward', label: '放置', economy: 'action',
            targeting: {
              kind: 'area', relation: 'ally', maximumTargets: 4,
              template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 30 },
            },
            persistentArea: {
              label: '守护区域', color: '#22c55e', durationRounds: 3, concentration: true,
              visual: { preset: 'toxic-cloud', intensity: 'strong' },
            },
          },
        })
      },
    })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ally = character('ally')
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1', name: 'Area map', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('ally-token', ally.id, 125),
          token('enemy-token', enemy.id, 125, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 15 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: '●', color: '#fff', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: {
          ...action(featureId),
          targetTokenId: undefined,
          targetTokenIds: ['enemy-token'],
          targetCell: { col: 4, row: 0 },
        },
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens).toEqual([])
      expect(prepared.prepared.headlessAction.targetId).toBeUndefined()
      expect(prepared.prepared.headlessAction.targetIds).toEqual([])
      expect(prepared.prepared.headlessAction.targetCell).toEqual({ col: 4, row: 0 })
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.application?.map.dnd5ePluginAreas).toEqual([
        expect.objectContaining({
          id: 'plugin-area:plugin-action-1', label: '守护区域', color: '#22c55e',
          cells: expect.arrayContaining([{ col: 4, row: 0 }]),
          concentrationId: 'plugin-area:plugin-action-1', expiresAfterRound: 3,
          visual: { preset: 'toxic-cloud', intensity: 'strong' },
        }),
      ])
      expect(resolved.application?.characters.find((entry) => entry.id === hero.id)).toMatchObject({
        concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'plugin-area:plugin-action-1' },
      })
    } finally {
      dispose()
    }
  })

  it('validates character ownership, spends the action, and applies Headless state', async () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.vertical-slice',
        name: 'Vertical Slice',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({
          id: 'guardian-spark',
          resolve({ target, grantTemporaryHitPoints, succeed, fail }) {
            if (!target) return fail('invalid-target')
            grantTemporaryHitPoints(target.id, 3)
            return succeed()
          },
        })
        featureId = api.registerFeature({
          id: 'guardian-spark',
          name: '守护火花',
          summary: '纵向切片测试特性。',
          description: '以一个动作令30尺内友方获得3点临时生命值。',
          minimumLevel: 1,
          automation: 'full',
          action: {
            id: 'guardian-spark',
            label: '使用守护火花',
            economy: 'action',
            targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, includeSelf: true },
          },
        })
      },
    }, { integrity: 'sha256-YWJjZA==' })
    try {
      const hero = character('hero', { dnd5ePluginFeatureIds: [featureId] })
      const ally = character('ally')
      const enemy = character('enemy')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Plugin map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        feetPerCell: 5,
        showGrid: true,
        tokens: [
          token('hero-token', hero.id, 25),
          token('ally-token', ally.id, 75),
          token('enemy-token', enemy.id, 225, 'enemy'),
        ],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 15 },
        { slotId: 'enemy-token:normal', tokenId: 'enemy-token', label: 'enemy', emoji: '●', color: '#fff', roll: 10 },
      ]
      const prepared = prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: [{
          id: 'com.example.vertical-slice',
          version: '1.0.0',
          integrity: 'sha256-YWJjZA==',
        }],
        turnEconomy: {
          turnKey: 'combat-1:1:hero-token',
          attacksUsed: 0,
          action: { current: 1, max: 1 },
          bonusAction: { current: 1, max: 1 },
          reaction: { current: 1, max: 1 },
          movement: { current: 30, max: 30 },
        },
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return

      const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.result.events).toContainEqual({
        type: 'turn-resource-spent',
        actorId: 'hero-token',
        resource: 'action',
      })
      expect(resolved.application?.characters.find((item) => item.id === ally.id)?.tempHp).toBe(3)

      expect(prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: [],
      })).toEqual({ ok: false, reason: 'plugin-not-enabled-for-room' })
      expect(prepareDnd5ePluginFeatureAction({
        action: action(featureId),
        map,
        characters: [hero, ally, enemy],
        initiativeOrder,
        roomRequiredPlugins: null,
      })).toEqual({ ok: false, reason: 'room-rules-unavailable' })
    } finally {
      dispose()
    }
  })

  it('rejects a registered feature that the actor did not select', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.ownership',
        name: 'Ownership',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Example',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'self', resolve: ({ succeed }) => succeed() })
        featureId = api.registerFeature({
          id: 'self',
          name: '未选择特性',
          summary: '测试。',
          description: '测试角色所有权。',
          automation: 'full',
          action: { id: 'self', label: '使用', economy: 'none', targeting: { kind: 'self' } },
        })
      },
    })
    try {
      const hero = character('hero')
      const ally = character('ally')
      const map: BattleMap = {
        id: 'map-1',
        name: 'Plugin map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [token('hero-token', hero.id, 25), token('ally-token', ally.id, 75)],
      }
      const initiativeOrder: InitiativeEntry[] = [
        { slotId: 'hero-token:normal', tokenId: 'hero-token', label: 'hero', emoji: '●', color: '#fff', roll: 20 },
        { slotId: 'ally-token:normal', tokenId: 'ally-token', label: 'ally', emoji: '●', color: '#fff', roll: 10 },
      ]
      expect(prepareDnd5ePluginFeatureAction({
        action: { ...action(featureId), targetTokenId: 'hero-token' },
        map,
        characters: [hero, ally],
        initiativeOrder,
      })).toEqual({ ok: false, reason: 'feature-not-selected' })
    } finally {
      dispose()
    }
  })
})

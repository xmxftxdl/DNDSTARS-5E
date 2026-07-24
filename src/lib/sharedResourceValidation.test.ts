import { describe, expect, it } from 'vitest'
import { validateAndMigrateSharedResource } from './sharedResourceValidation'
import { createDnd5eConditionEffect } from '../rulesets/dnd5e/activeEffects'

describe('shared resource runtime validation', () => {
  it('covers every current shared envelope and allows future plugin objects', () => {
    const resources: Record<string, object> = {
      characters: { characters: [], updatedAt: 1 },
      maps: { maps: [], updatedAt: 1 },
      spellbook: { spells: [], updatedAt: 1 },
      'custom-monsters': { schemaVersion: 1, monsters: [], updatedAt: 1 },
      combat: { active: false, updatedAt: 1 },
      'combat-log': { entries: [], updatedAt: 1 },
      'room-chat': { schemaVersion: 1, messages: [], updatedAt: 1 },
      'room-journal': { schemaVersion: 1, handouts: [], campaignEntries: [], sharedNotes: [], updatedAt: 1 },
      'group-ability-checks': { schemaVersion: 1, checks: [], updatedAt: 1 },
      'campaign-time': { schemaVersion: 2, worldMinute: 480, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1 },
      'scene-orchestration': { schemaVersion: 1, scenes: [], runtime: { paused: false, pendingRuns: [], receipts: [], history: [] }, updatedAt: 1 },
      'scene-audio-library': { schemaVersion: 1, assets: [], updatedAt: 1 },
      'scene-audio-playback': { schemaVersion: 1, status: 'stopped', positionSeconds: 0, anchorServerMs: 0, loop: false, volume: 0.7, fadeMs: 0, updatedAt: 1 },
      'dice-events': { events: [], updatedAt: 1 },
      'combat-interrupts': { interrupts: [], updatedAt: 1 },
      'player-action-requests': { requests: [], updatedAt: 1 },
      'player-action-processed': { actionIds: [], updatedAt: 1 },
      'map-fog': { schemaVersion: 1, maps: [], updatedAt: 1 },
      'dm-authority-ready': { ready: false, updatedAt: 1 },
      'player-action': { id: 'action', updatedAt: 1 },
      'player-action-ack': { id: 'ack', updatedAt: 1 },
      dice: { id: 'dice', updatedAt: 1 },
      'future-plugin-state': { schemaVersion: 1, payload: {} },
    }
    for (const [name, value] of Object.entries(resources)) {
      expect(validateAndMigrateSharedResource(name, value).status, name).toBe('valid')
    }
  })

  it('rejects broken envelopes instead of passing them to a Store', () => {
    expect(validateAndMigrateSharedResource('characters', null).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('characters', { characters: 'broken' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', { maps: [{ id: '' }] }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('spellbook', { spells: 'broken' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('custom-monsters', { monsters: 'broken' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('combat', { active: 'yes' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('room-chat', { messages: 'broken' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('room-journal', { handouts: [], campaignEntries: 'broken', sharedNotes: [] }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('room-journal', {
      handouts: [],
      campaignEntries: [],
      sharedNotes: [],
      authorityMutationReceipts: [''],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('group-ability-checks', { schemaVersion: 1, checks: [{ id: 'broken' }] }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('campaign-time', { schemaVersion: 1, worldMinute: -1, timers: [], advances: [] }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('scene-orchestration', { schemaVersion: 1, scenes: 'hidden', runtime: {} }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('scene-audio-library', { schemaVersion: 1, assets: [{ id: '../escape' }] }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('scene-audio-playback', { schemaVersion: 1, status: 'playing', assetId: '../escape' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('map-fog', {
      schemaVersion: 1,
      updatedAt: 1,
      maps: [{ mapId: 'map', filled: true, color: '#000000', opacity: 0.98, shapes: [{ kind: 'rect' }] }],
    }).status).toBe('invalid')
  })

  it('bounds inline character portraits before the aggregate can exceed shared-state capacity', () => {
    const portrait = `data:image/webp;base64,${'A'.repeat(580_000)}`
    expect(validateAndMigrateSharedResource('characters', {
      characters: [{ id: 'hero', portrait }],
    }).status).toBe('valid')
    expect(validateAndMigrateSharedResource('characters', {
      characters: Array.from({ length: 7 }, (_, index) => ({ id: `hero-${index}`, portrait })),
    })).toMatchObject({
      status: 'invalid',
      reasons: expect.arrayContaining([expect.stringContaining('人物立绘总量超过房间同步上限')]),
    })
  })

  it('physically migrates the retired enemy AP ledger', () => {
    const result = validateAndMigrateSharedResource('combat', {
      active: true,
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    })
    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') throw new Error('expected migration')
    expect(result.value.enemyApByToken).toBeUndefined()
  })

  it('migrates the legacy campaign-day clock to the configurable V2 display', () => {
    const result = validateAndMigrateSharedResource('campaign-time', {
      schemaVersion: 1,
      worldMinute: 600,
      timers: [],
      advances: [],
      updatedAt: 1,
    })
    expect(result).toMatchObject({
      status: 'migrated',
      value: {
        schemaVersion: 2,
        worldMinute: 600,
        displayMode: 'campaign-day',
        displayMinuteOffset: 0,
      },
    })
  })

  it('migrates legacy condition/timed state into schema v2 at the shared boundary', () => {
    const result = validateAndMigrateSharedResource('characters', {
      characters: [{
        id: 'hero', name: '英雄', conditions: ['blinded'],
        dnd5eCombatState: {
          timedEffects: [{
            id: 'ray', sourceActorId: 'wizard', sourceSpellId: 'ray-of-frost',
            kind: 'speed-penalty', amount: 10, expiresAt: 'source-next-turn-start',
          }],
        },
      }],
    })
    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') throw new Error('expected migration')
    const character = (result.value.characters as Array<Record<string, unknown>>)[0]
    expect(character.conditions).toEqual(['blinded'])
    const combatState = character.dnd5eCombatState as {
      schemaVersion?: number
      activeEffects?: Array<{ standardCondition?: string; modifiers?: { speedPenaltyFeet?: number } }>
      timedEffects?: unknown
    }
    expect(combatState.schemaVersion).toBe(2)
    expect(combatState.activeEffects?.some((effect) => effect.standardCondition === 'blinded')).toBe(true)
    expect(combatState.activeEffects?.some((effect) => effect.modifiers?.speedPenaltyFeet === 10)).toBe(true)
    expect(combatState.timedEffects).toBeUndefined()
  })

  it('accepts an empty condition projection without manufacturing combat state', () => {
    const result = validateAndMigrateSharedResource('characters', {
      characters: [{ id: 'hero', name: '英雄', conditions: [] }],
    })
    expect(result.status).toBe('valid')
  })

  it('fails closed for malformed v2 effects and a forged conditions projection', () => {
    const effect = createDnd5eConditionEffect({
      id: 'blind', condition: 'blinded', targetId: 'hero', source: { kind: 'dm' },
    })
    expect(validateAndMigrateSharedResource('characters', {
      characters: [{
        id: 'hero', conditions: ['blinded'],
        dnd5eCombatState: { schemaVersion: 2, activeEffects: [{ ...effect, duration: { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' } }] },
      }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('characters', {
      characters: [{
        id: 'hero', conditions: [],
        dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] },
      }],
    }).status).toBe('invalid')
  })

  it('fails closed for malformed plugin persistent areas at the shared map boundary', () => {
    const validArea = {
      id: 'plugin-area:action-1', pluginId: 'com.example.area', featureId: 'com.example.area:ward',
      label: '守护区域', color: '#22c55e', sourceCharacterId: 'hero', sourceTokenId: 'hero-token',
      cells: [{ col: 2, row: 3 }], createdRound: 1, expiresAfterRound: 3,
      concentrationId: 'plugin-area:action-1',
    }
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{ ...validArea, visual: { preset: 'toxic-cloud', intensity: 'normal' } }] }],
    }).status).toBe('valid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{
        ...validArea,
        lighting: { kind: 'light', brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fbbf24', spellLevel: 0 },
      }] }],
    }).status).toBe('valid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{
        ...validArea, lighting: { kind: 'javascript', code: 'fetch("/")' },
      }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{
        ...validArea,
        lighting: {
          kind: 'light', brightRadiusFeet: 20, dimRadiusFeet: 20,
          color: '#fbbf24', spellLevel: 0, code: 'fetch("/")',
        },
      }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{ ...validArea, label: 'x'.repeat(121) }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{ ...validArea, expiresAfterRound: 14_401 }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{ ...validArea, visual: { preset: 'remote-script' } }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [{ ...validArea, cells: [{ col: 2.5, row: 3 }] }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [], dnd5ePluginAreas: [validArea, validArea] }],
    }).status).toBe('invalid')
  })

  it('fails closed for malformed token movement paths at the shared map boundary', () => {
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{
        id: 'map',
        tokens: [{
          id: 'hero',
          movementAnimation: { id: 'bad', points: [{ x: 1, y: 2 }], durationMs: 50_000, issuedAt: 1 },
        }],
      }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{
        id: 'map',
        tokens: [{
          id: 'hero',
          movementAnimation: {
            id: 'move', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], durationMs: 500, issuedAt: 1,
          },
        }],
      }],
    }).status).toBe('valid')
  })

  it('fails closed for malformed summoned-token ownership metadata', () => {
    const summon = {
      schemaVersion: 1, pluginId: 'com.example', featureId: 'com.example:wolf',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
      expiresAfterRound: 10, concentrationId: 'plugin-summon:action-1', side: 'player',
    }
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'summon', dnd5eSummon: summon }] }],
    }).status).toBe('valid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'summon', dnd5eSummon: { ...summon, side: 'neutral' } }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'summon', dnd5eSummon: { ...summon, expiresAfterRound: 0 } }] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'summon', dnd5eSummon: { ...summon, expiresAfterRound: 14_401 } }] }],
    }).status).toBe('invalid')
  })

  it('fails closed for malformed core spell effect-token ownership metadata', () => {
    const effect = {
      schemaVersion: 1, spellId: 'flaming-sphere', sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token', createdRound: 2, expiresAfterRound: 12,
      concentrationId: 'flaming-sphere',
    }
    const area = {
      id: 'sphere-area', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:flaming-sphere',
      sourceKind: 'core-spell', coreSpellId: 'flaming-sphere', label: '炽焰法球', color: '#f97316',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 1, row: 1 }],
      createdRound: 2, expiresAfterRound: 12, anchorMode: 'effect-token', anchorTokenId: 'sphere',
    }
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'sphere', type: 'obstacle', dnd5eSpellEffect: effect }], dnd5ePluginAreas: [area] }],
    }).status).toBe('valid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'sphere', type: 'obstacle', dnd5eSpellEffect: { ...effect, spellId: '' } }], dnd5ePluginAreas: [area] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'sphere', type: 'obstacle', dnd5eSpellEffect: { ...effect, expiresAfterRound: 1 } }], dnd5ePluginAreas: [area] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'sphere', type: 'player', dnd5eSpellEffect: effect }], dnd5ePluginAreas: [area] }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', {
      maps: [{ id: 'map', tokens: [{ id: 'sphere', type: 'obstacle', dnd5eSpellEffect: effect }], dnd5ePluginAreas: [] }],
    }).status).toBe('invalid')
  })

  it('migrates legacy interrupts and rejects duplicate active transaction locks', () => {
    const legacy = {
      mapId: 'map', updatedAt: 2,
      interrupts: [{
        id: 'shield', mapId: 'map', kind: 'shield-spell', status: 'pending', payload: {},
        createdAt: 1, updatedAt: 1,
      }],
    }
    const migrated = validateAndMigrateSharedResource('combat-interrupts', legacy)
    expect(migrated.status).toBe('migrated')
    if (migrated.status !== 'migrated') return
    expect((migrated.value.interrupts as Array<Record<string, unknown>>)[0]).toMatchObject({
      transactionId: 'shield', phase: 'before-hit', timeoutPolicy: 'rollback',
    })
    const duplicate = {
      ...migrated.value,
      interrupts: [
        ...(migrated.value.interrupts as unknown[]),
        {
          id: 'second', transactionId: 'shield', mapId: 'map', kind: 'uncanny-dodge',
          status: 'pending', phase: 'before-damage', timeoutPolicy: 'rollback', payload: {},
          createdAt: 2, updatedAt: 2,
        },
      ],
    }
    expect(validateAndMigrateSharedResource('combat-interrupts', duplicate).status).toBe('invalid')
  })
})

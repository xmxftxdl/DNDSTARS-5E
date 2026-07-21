import { describe, expect, it } from 'vitest'
import { migrateMapsState, MAPS_PERSIST_VERSION } from './maps'

// maps store 此前裸跑 `{ name:'stars-maps' }`（无 version/migrate）。
// 任何旧 localStorage 形状缺字段都可能在渲染期崩。这里验证 v0（无版本）旧 blob 经 migrate
// 被规整为可直接渲染的当前 BattleMap 形状，且 version 已落定。

describe('T10/AC3 — maps store version + migrate', () => {
  it('exposes a non-zero persist version', () => {
    expect(MAPS_PERSIST_VERSION).toBeGreaterThan(0)
  })

  it('migrates a v0 (versionless) legacy blob into a valid current shape without crashing', () => {
    // 早期形状：token 缺 color/emoji/size/type，map 缺 grid* 字段，tokens 可能整个缺失。
    const v0Blob = {
      maps: [
        {
          id: 'map-legacy',
          name: '旧地图',
          width: 800,
          height: 600,
          tokens: [
            { id: 'tok-legacy', label: '老怪' }, // 缺 x/y/color/emoji/size/type
          ],
        },
        {
          // 极端残缺：几乎什么都没有
          id: 'map-bare',
        },
      ],
      selectedId: 'map-legacy',
    }

    const result = migrateMapsState(v0Blob)

    expect(result.maps).toHaveLength(2)
    const m0 = result.maps[0]
    expect(m0.id).toBe('map-legacy')
    expect(m0.gridSize).toBeGreaterThan(0)
    expect(typeof m0.showGrid).toBe('boolean')
    expect(Array.isArray(m0.tokens)).toBe(true)

    const tok = m0.tokens[0]
    expect(tok.id).toBe('tok-legacy')
    // 缺失字段被填默认，渲染所依赖的字段全部有值
    expect(typeof tok.color).toBe('string')
    expect(tok.color.length).toBeGreaterThan(0)
    expect(typeof tok.emoji).toBe('string')
    expect(tok.size).toBeGreaterThan(0)
    expect(['player', 'enemy', 'npc', 'obstacle']).toContain(tok.type)
    expect(Number.isFinite(tok.x)).toBe(true)
    expect(Number.isFinite(tok.y)).toBe(true)

    // 残缺地图也被补成可渲染形状
    const m1 = result.maps[1]
    expect(Number.isFinite(m1.width)).toBe(true)
    expect(Number.isFinite(m1.height)).toBe(true)
    expect(Array.isArray(m1.tokens)).toBe(true)

    expect(result.selectedId).toBe('map-legacy')
  })

  it('tolerates a completely empty / undefined persisted blob', () => {
    expect(migrateMapsState(undefined)).toEqual({ maps: [], selectedId: null })
    expect(migrateMapsState({})).toEqual({ maps: [], selectedId: null })
  })

  it('drops a dangling selectedId that no longer points at an existing map', () => {
    const result = migrateMapsState({ maps: [{ id: 'a', name: 'A' }], selectedId: 'gone' })
    expect(result.selectedId).toBe('a')
  })

  it('normalizes valid persistent item areas and drops malformed entries', () => {
    const result = migrateMapsState({
      maps: [{
        id: 'map', name: '地图', width: 100, height: 100,
        dnd5eItemAreas: [
          { id: 'good', kind: 'caltrops', cells: [{ col: 1, row: 1 }], armed: true },
          { id: 'bad', kind: 'unknown', cells: [] },
        ],
      }],
    })
    expect(result.maps[0].dnd5eItemAreas).toEqual([
      expect.objectContaining({ id: 'good', kind: 'caltrops', cells: [{ col: 1, row: 1 }], armed: true }),
    ])
  })

  it('keeps bounded movement paths and drops malformed animation metadata', () => {
    const result = migrateMapsState({
      maps: [{
        id: 'map', name: '地图', width: 100, height: 100,
        tokens: [
          {
            id: 'valid', movementAnimation: {
              id: 'move', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], durationMs: 500, issuedAt: 1,
            },
          },
          {
            id: 'invalid', movementAnimation: {
              id: 'bad', points: [{ x: 0, y: 0 }], durationMs: 50_000, issuedAt: 1,
            },
          },
        ],
      }],
    })
    expect(result.maps[0].tokens[0].movementAnimation?.id).toBe('move')
    expect(result.maps[0].tokens[1].movementAnimation).toBeUndefined()
  })

  it('keeps valid core spell effect tokens and drops malformed metadata', () => {
    const effect = {
      schemaVersion: 1, spellId: 'flaming-sphere', sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token', createdRound: 2, expiresAfterRound: 12,
      concentrationId: 'flaming-sphere',
    }
    const result = migrateMapsState({
      maps: [{
        id: 'map', name: '地图', width: 100, height: 100,
        tokens: [
          { id: 'valid', type: 'obstacle', dnd5eSpellEffect: effect },
          { id: 'invalid', type: 'obstacle', dnd5eSpellEffect: { ...effect, expiresAfterRound: 1 } },
        ],
      }],
    })
    expect(result.maps[0].tokens[0].dnd5eSpellEffect).toEqual(effect)
    expect(result.maps[0].tokens[1].dnd5eSpellEffect).toBeUndefined()
  })

  it('keeps whitelisted persistent-area visuals and drops unsafe renderer metadata', () => {
    const area = {
      pluginId: 'com.example.area', featureId: 'com.example.area:cloud', label: '毒云', color: '#65a30d',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', cells: [{ col: 1, row: 1 }],
      createdRound: 1, expiresAfterRound: 10,
    }
    const result = migrateMapsState({
      maps: [{
        id: 'map', name: '地图', width: 100, height: 100,
        dnd5ePluginAreas: [
          { ...area, id: 'safe', visual: { preset: 'toxic-cloud', intensity: 'strong' } },
          { ...area, id: 'unsafe', visual: { preset: 'remote-script', url: 'https://example.invalid/effect.js' } },
        ],
      }],
    })
    expect(result.maps[0].dnd5ePluginAreas?.[0].visual).toEqual({ preset: 'toxic-cloud', intensity: 'strong' })
    expect(result.maps[0].dnd5ePluginAreas?.[1].visual).toBeUndefined()
  })

  it('migrates bounded core-spell anchor and movement metadata while rejecting incomplete core sources', () => {
    const base = {
      pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:test', label: '核心区域', color: '#8b5cf6',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', cells: [{ col: 1, row: 1 }],
      createdRound: 1, expiresAfterRound: 10, sourceKind: 'core-spell',
    }
    const result = migrateMapsState({
      maps: [{
        id: 'map', name: '地图', width: 500, height: 500,
        dnd5ePluginAreas: [
          {
            ...base, id: 'valid', coreSpellId: 'test', slotLevel: 3,
            anchorMode: 'source-token', anchorTokenId: 'hero-token', anchorCell: { col: 1, row: 1 },
            movement: { economy: 'bonus-action', maximumFeet: 30 }, movementCostMultiplier: 2,
          },
          { ...base, id: 'missing-spell-id' },
        ],
      }],
    })
    expect(result.maps[0].dnd5ePluginAreas).toHaveLength(1)
    expect(result.maps[0].dnd5ePluginAreas?.[0]).toMatchObject({
      sourceKind: 'core-spell', coreSpellId: 'test', slotLevel: 3,
      anchorMode: 'source-token', anchorCell: { col: 1, row: 1 },
      movement: { economy: 'bonus-action', maximumFeet: 30 }, movementCostMultiplier: 2,
    })
  })
})

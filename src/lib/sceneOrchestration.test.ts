import { describe, expect, it } from 'vitest'
import {
  normalizeSharedSceneOrchestration,
  resolveSceneAudioPreset,
  sceneInteractionPointPublicSummary,
  sceneInteractionReceiptId,
  scenePointInsideRegion,
  sceneRegionMovedWithinMap,
  sceneTriggerAcceptsToken,
  sceneTriggerReceiptKey,
  validateSharedSceneOrchestration,
  type OrchestratedScene,
  type SceneTrigger,
} from './sceneOrchestration'
import { DEFAULT_SCENE_WEATHER } from './sceneWeather'

const trigger: SceneTrigger = {
  id: 'trigger-1',
  name: 'Gate',
  enabled: true,
  region: { kind: 'circle', x: 20, y: 20, radius: 10 },
  events: ['enter'],
  tokenFilter: 'player',
  repeat: 'per-token',
  actions: [{ id: 'action-1', kind: 'light', enabled: true, ambientLight: 'dim' }],
}

const scene: OrchestratedScene = {
  id: 'scene-1',
  mapId: 'map-1',
  name: 'Ruins',
  description: '',
  environmentLabel: 'underground',
  weather: { ...DEFAULT_SCENE_WEATHER },
  backgroundCue: 'mystery',
  backgroundAudioMode: 'inherit',
  backgroundAudioLoop: true,
  backgroundAudioVolume: 0.7,
  backgroundAudioAutoPlay: false,
  boundHandoutIds: [],
  boundJournalEntryIds: [],
  interactionPoints: [],
  triggers: [trigger],
  createdAt: 1,
  updatedAt: 1,
}

const shared = {
  schemaVersion: 1,
  globalAudio: { loop: true, volume: 0.7, autoPlay: false },
  scenes: [scene],
  runtime: { paused: false, pendingRuns: [], receipts: [], history: [] },
  updatedAt: 1,
}

describe('scene orchestration shared model', () => {
  it('validates a complete declaration and rejects malformed actions', () => {
    expect(validateSharedSceneOrchestration(shared)).toBe(true)
    expect(validateSharedSceneOrchestration({
      ...shared,
      scenes: [{ ...scene, triggers: [{ ...trigger, actions: [{ id: 'bad', kind: 'network-request' }] }] }],
    })).toBe(false)
  })

  it('normalizes old or partial runtime state without executing arbitrary data', () => {
    expect(normalizeSharedSceneOrchestration({ ...shared, runtime: null })).toMatchObject({
      schemaVersion: 1,
      runtime: { paused: false, pendingRuns: [], receipts: [], history: [] },
    })
  })

  it('normalizes legacy scenes to no weather and validates weather settings', () => {
    const legacyScene = { ...scene } as Record<string, unknown>
    delete legacyScene.weather
    expect(normalizeSharedSceneOrchestration({ ...shared, scenes: [legacyScene] }).scenes[0].weather)
      .toEqual(DEFAULT_SCENE_WEATHER)
    expect(validateSharedSceneOrchestration({
      ...shared,
      scenes: [{ ...scene, weather: { kind: 'thunderstorm', intensity: 0.8, windAngleDegrees: -18, speed: 1.3 } }],
    })).toBe(true)
    expect(validateSharedSceneOrchestration({
      ...shared,
      scenes: [{ ...scene, weather: { kind: 'rain', intensity: 4, windAngleDegrees: 0, speed: 1 } }],
    })).toBe(false)
  })

  it('resolves global music, map overrides, and explicit map silence deterministically', () => {
    const configured = normalizeSharedSceneOrchestration({
      ...shared,
      globalAudio: { assetId: 'global-track', loop: true, volume: 0.55, autoPlay: true },
    })
    expect(resolveSceneAudioPreset(configured, 'unconfigured-map')).toMatchObject({
      source: 'global', assetId: 'global-track', loop: true, volume: 0.55, autoPlay: true,
    })
    expect(resolveSceneAudioPreset({
      ...configured,
      scenes: [{
        ...scene,
        backgroundAudioMode: 'override',
        backgroundAudioId: 'map-track',
        backgroundAudioAutoPlay: true,
        backgroundAudioLoop: false,
        backgroundAudioVolume: 0.8,
      }],
    }, 'map-1')).toMatchObject({
      source: 'map', sceneId: 'scene-1', assetId: 'map-track', loop: false, volume: 0.8, autoPlay: true,
    })
    expect(resolveSceneAudioPreset({
      ...configured,
      scenes: [{ ...scene, backgroundAudioMode: 'silent' }],
    }, 'map-1')).toMatchObject({ source: 'silent', autoPlay: true, volume: 0 })
  })

  it('accepts legacy group-roll actions but removes them from the client runtime', () => {
    const legacy = {
      ...shared,
      runtime: {
        ...shared.runtime,
        pendingRuns: [{
          id: 'legacy-run',
          sceneId: scene.id,
          triggerId: trigger.id,
          mapId: scene.mapId,
          event: 'enter',
          nextActionIndex: 1,
          createdAt: 1,
        }],
      },
      scenes: [{
        ...scene,
        triggers: [{
          ...trigger,
          actions: [
            {
              id: 'legacy-group-roll',
              kind: 'group-roll',
              enabled: true,
              label: '旧群体豁免',
              selection: 'save:dex',
              dc: 15,
              mode: 'normal',
              allowPassiveFallback: false,
            },
            ...trigger.actions,
          ],
        }],
      }],
    }
    expect(validateSharedSceneOrchestration(legacy)).toBe(true)
    expect(normalizeSharedSceneOrchestration(legacy)).toMatchObject({
      scenes: [{ triggers: [{ actions: trigger.actions }] }],
      runtime: { pendingRuns: [] },
    })
  })

  it('evaluates circle and rectangle regions at their boundaries', () => {
    expect(scenePointInsideRegion({ x: 30, y: 20 }, trigger.region)).toBe(true)
    expect(scenePointInsideRegion({ x: 31, y: 20 }, trigger.region)).toBe(false)
    expect(scenePointInsideRegion({ x: 7, y: 9 }, { kind: 'rect', x: 2, y: 3, width: 5, height: 6 })).toBe(true)
  })

  it('moves authored regions without resizing them and keeps them on the map', () => {
    expect(sceneRegionMovedWithinMap(
      { kind: 'circle', x: 20, y: 20, radius: 10 },
      { x: -40, y: 95 },
      { width: 100, height: 80 },
    )).toEqual({ kind: 'circle', x: 10, y: 70, radius: 10 })
    expect(sceneRegionMovedWithinMap(
      { kind: 'rect', x: 20, y: 20, width: 30, height: 24 },
      { x: 92, y: -4 },
      { width: 100, height: 80 },
    )).toEqual({ kind: 'rect', x: 70, y: 0, width: 30, height: 24 })
  })

  it('applies token filters and deterministic repeat receipts', () => {
    const player = { tokenId: 'hero', label: 'Hero', type: 'player' as const, x: 0, y: 0 }
    const enemy = { tokenId: 'wolf', label: 'Wolf', type: 'enemy' as const, x: 0, y: 0 }
    expect(sceneTriggerAcceptsToken(trigger, player)).toBe(true)
    expect(sceneTriggerAcceptsToken(trigger, enemy)).toBe(false)
    expect(sceneTriggerReceiptKey(scene, trigger, player.tokenId)).toBe('scene-1:trigger-1:token:hero')
    expect(sceneTriggerReceiptKey(scene, { ...trigger, repeat: 'once' }, player.tokenId)).toBe('scene-1:trigger-1:once')
    expect(sceneTriggerReceiptKey(scene, { ...trigger, repeat: 'always' }, player.tokenId)).toBeNull()
  })

  it('validates interaction points while keeping player projections free of checks and rewards', () => {
    const point = {
      id: 'bookshelf',
      name: '旧书柜',
      enabled: true,
      visibleToPlayers: true,
      icon: 'bookshelf' as const,
      x: 40,
      y: 50,
      interactionRadiusFeet: 5,
      prompt: '搜索书柜。',
      repeat: 'per-character' as const,
      check: { label: '调查', selection: 'skill:investigation' as const, dc: 13, mode: 'normal' as const },
      successText: '找到夹层。',
      failureText: '没有发现。',
      rewards: [{ templateId: 'srd-5.1:item:potion-of-healing', quantity: 1, identified: true }],
      successEffects: [
        { id: 'coins', kind: 'currency' as const, currency: 'gp' as const, amount: 12 },
        {
          id: 'handout',
          kind: 'handout' as const,
          handoutId: 'secret-letter',
          audience: 'triggering-player' as const,
        },
      ],
      failureEffects: [{
        id: 'trap',
        kind: 'damage' as const,
        count: 2,
        sides: 6,
        bonus: 0,
        damageType: 'piercing' as const,
      }],
    }
    expect(validateSharedSceneOrchestration({
      ...shared,
      scenes: [{ ...scene, interactionPoints: [point] }],
    })).toBe(true)
    expect(sceneInteractionPointPublicSummary(point)).not.toHaveProperty('check')
    expect(sceneInteractionPointPublicSummary(point).rewards).toEqual([])
    expect(sceneInteractionPointPublicSummary(point).successEffects).toEqual([])
    expect(sceneInteractionPointPublicSummary(point).failureEffects).toEqual([])
    expect(sceneInteractionReceiptId(scene, point, 'hero', 'request')).toBe(
      'scene-interaction:scene-1:bookshelf:character:hero',
    )
    expect(validateSharedSceneOrchestration({
      ...shared,
      scenes: [{
        ...scene,
        interactionPoints: [{ ...point, rewards: [{ ...point.rewards[0], quantity: -1 }] }],
      }],
    })).toBe(false)
    expect(validateSharedSceneOrchestration({
      ...shared,
      scenes: [{
        ...scene,
        interactionPoints: [{
          ...point,
          failureEffects: [{ ...point.failureEffects[0], count: 0 }],
        }],
      }],
    })).toBe(false)
  })
})

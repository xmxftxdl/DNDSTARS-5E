import { describe, expect, it } from 'vitest'
import {
  normalizeSharedSceneOrchestration,
  sceneInteractionPointPublicSummary,
  sceneInteractionReceiptId,
  scenePointInsideRegion,
  sceneTriggerAcceptsToken,
  sceneTriggerReceiptKey,
  validateSharedSceneOrchestration,
  type OrchestratedScene,
  type SceneTrigger,
} from './sceneOrchestration'

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
  backgroundCue: 'mystery',
  backgroundAudioLoop: true,
  backgroundAudioVolume: 0.7,
  boundHandoutIds: [],
  boundJournalEntryIds: [],
  interactionPoints: [],
  triggers: [trigger],
  createdAt: 1,
  updatedAt: 1,
}

const shared = {
  schemaVersion: 1,
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

  it('evaluates circle and rectangle regions at their boundaries', () => {
    expect(scenePointInsideRegion({ x: 30, y: 20 }, trigger.region)).toBe(true)
    expect(scenePointInsideRegion({ x: 31, y: 20 }, trigger.region)).toBe(false)
    expect(scenePointInsideRegion({ x: 7, y: 9 }, { kind: 'rect', x: 2, y: 3, width: 5, height: 6 })).toBe(true)
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

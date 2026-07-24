import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import { loadSharedResource, saveSharedResourceWithResult } from '../lib/sharedApi'
import { createSharedWriteWatermark } from '../lib/sharedWriteWatermark'
import {
  SCENE_MAX_HISTORY,
  SCENE_ORCHESTRATION_RESOURCE,
  SCENE_ORCHESTRATION_SCHEMA_VERSION,
  normalizeSharedSceneOrchestration,
  sceneTriggerAcceptsToken,
  sceneTriggerReceiptKey,
  type OrchestratedScene,
  type SceneAction,
  type SceneHistoryEntry,
  type SceneInteractionPoint,
  type ScenePendingRun,
  type SceneRegion,
  type SceneTrigger,
  type SceneTriggerEvent,
  type SceneTriggerTokenSnapshot,
  type SharedSceneOrchestrationState,
} from '../lib/sceneOrchestration'

const sharedWriteWatermark = createSharedWriteWatermark()

export interface SceneOrchestrationStore {
  shared: SharedSceneOrchestrationState
  loadShared: () => Promise<void>
  saveSharedNow: () => Promise<void>
  ensureScene: (mapId: string, mapName: string, center?: { x: number; y: number }) => string
  updateScene: (sceneId: string, patch: Partial<Pick<OrchestratedScene,
    'name' | 'description' | 'environmentLabel' | 'backgroundCue' | 'backgroundAudioId' | 'backgroundAudioLoop' |
    'backgroundAudioVolume' | 'boundHandoutIds' | 'boundJournalEntryIds'
  >>) => void
  removeScene: (sceneId: string) => void
  removeAudioReferences: (assetId: string) => void
  addInteractionPoint: (sceneId: string, position: { x: number; y: number }) => string
  updateInteractionPoint: (
    sceneId: string,
    interactionPointId: string,
    patch: Partial<Omit<SceneInteractionPoint, 'id'>>,
  ) => void
  setInteractionPointPosition: (
    sceneId: string,
    interactionPointId: string,
    position: { x: number; y: number },
  ) => void
  removeInteractionPoint: (sceneId: string, interactionPointId: string) => void
  addTrigger: (sceneId: string, region: SceneRegion) => string
  updateTrigger: (sceneId: string, triggerId: string, patch: Partial<Omit<SceneTrigger, 'id' | 'actions'>>) => void
  setTriggerRegion: (sceneId: string, triggerId: string, region: SceneRegion) => void
  removeTrigger: (sceneId: string, triggerId: string) => void
  addAction: (sceneId: string, triggerId: string, action: SceneAction) => void
  updateAction: (sceneId: string, triggerId: string, actionId: string, patch: Partial<SceneAction>) => void
  removeAction: (sceneId: string, triggerId: string, actionId: string) => void
  setPaused: (paused: boolean) => void
  enqueueRun: (input: {
    sceneId: string
    triggerId: string
    mapId: string
    event: SceneTriggerEvent
    token?: SceneTriggerTokenSnapshot
  }) => string | null
  advanceRun: (runId: string, history: SceneHistoryEntry) => void
  failRun: (runId: string, message: string) => void
  discardRun: (runId: string) => void
  clearReceipts: (sceneId?: string) => void
  markHistoryUndone: (historyId: string) => void
  reset: () => void
}

function emptyShared(): SharedSceneOrchestrationState {
  return {
    schemaVersion: SCENE_ORCHESTRATION_SCHEMA_VERSION,
    scenes: [],
    runtime: { paused: false, pendingRuns: [], receipts: [], history: [] },
    updatedAt: 0,
  }
}

async function publish(shared: SharedSceneOrchestrationState): Promise<void> {
  if (!canWriteSharedState()) return
  const ticket = sharedWriteWatermark.begin()
  const payload = { ...shared, updatedAt: ticket.updatedAt }
  const result = await saveSharedResourceWithResult(SCENE_ORCHESTRATION_RESOURCE, payload)
  sharedWriteWatermark.settle(ticket, result.status === 'saved')
}

function withUpdatedAt(shared: SharedSceneOrchestrationState, update: (current: SharedSceneOrchestrationState) => SharedSceneOrchestrationState) {
  return normalizeSharedSceneOrchestration({ ...update(shared), updatedAt: Date.now() })
}

export const useSceneOrchestrationStore = create<SceneOrchestrationStore>()(
  persist((set, get) => {
    const mutate = (update: (current: SharedSceneOrchestrationState) => SharedSceneOrchestrationState) => {
      const shared = withUpdatedAt(get().shared, update)
      set({ shared })
      void publish(shared)
    }

    const updateTriggerTree = (
      sceneId: string,
      triggerId: string,
      update: (trigger: SceneTrigger) => SceneTrigger,
    ) => mutate((shared) => ({
      ...shared,
      scenes: shared.scenes.map((scene) => scene.id === sceneId ? {
        ...scene,
        triggers: scene.triggers.map((trigger) => trigger.id === triggerId ? update(trigger) : trigger),
        updatedAt: Date.now(),
      } : scene),
    }))

    return {
      shared: emptyShared(),
      loadShared: async () => {
        const loaded = normalizeSharedSceneOrchestration(
          await loadSharedResource<SharedSceneOrchestrationState>(SCENE_ORCHESTRATION_RESOURCE),
        )
        if (!sharedWriteWatermark.shouldApplyRemote(loaded.updatedAt)) return
        sharedWriteWatermark.acceptRemote(loaded.updatedAt)
        set({ shared: loaded })
      },
      saveSharedNow: async () => publish(get().shared),
      ensureScene: (mapId, mapName, center = { x: 200, y: 200 }) => {
        const existing = get().shared.scenes.find((scene) => scene.mapId === mapId)
        if (existing) return existing.id
        const now = Date.now()
        const sceneId = crypto.randomUUID()
        const scene: OrchestratedScene = {
          id: sceneId,
          mapId,
          name: mapName || '未命名场景',
          description: '',
          environmentLabel: '',
          backgroundCue: 'none',
          backgroundAudioLoop: true,
          backgroundAudioVolume: 0.7,
          boundHandoutIds: [],
          boundJournalEntryIds: [],
          interactionPoints: [],
          triggers: [{
            id: crypto.randomUUID(),
            name: '入口触发区',
            enabled: true,
            region: { kind: 'circle', x: center.x, y: center.y, radius: 70 },
            events: ['enter'],
            tokenFilter: 'player',
            repeat: 'per-token',
            actions: [],
          }],
          createdAt: now,
          updatedAt: now,
        }
        mutate((shared) => ({ ...shared, scenes: [...shared.scenes, scene] }))
        return sceneId
      },
      updateScene: (sceneId, patch) => mutate((shared) => ({
        ...shared,
        scenes: shared.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...patch, id: scene.id, mapId: scene.mapId, updatedAt: Date.now() } : scene),
      })),
      removeScene: (sceneId) => mutate((shared) => ({
        ...shared,
        scenes: shared.scenes.filter((scene) => scene.id !== sceneId),
        runtime: {
          ...shared.runtime,
          pendingRuns: shared.runtime.pendingRuns.filter((run) => run.sceneId !== sceneId),
          receipts: shared.runtime.receipts.filter((receipt) => !receipt.startsWith(`${sceneId}:`)),
        },
      })),
      removeAudioReferences: (assetId) => mutate((shared) => ({
        ...shared,
        scenes: shared.scenes.map((scene) => ({
          ...scene,
          ...(scene.backgroundAudioId === assetId ? { backgroundAudioId: undefined } : {}),
          triggers: scene.triggers.map((trigger) => ({
            ...trigger,
            actions: trigger.actions.filter((action) => action.kind !== 'audio' || action.assetId !== assetId),
          })),
          updatedAt: Date.now(),
        })),
      })),
      addInteractionPoint: (sceneId, position) => {
        const interactionPointId = crypto.randomUUID()
        mutate((shared) => ({
          ...shared,
          scenes: shared.scenes.map((scene) => scene.id === sceneId ? {
            ...scene,
            updatedAt: Date.now(),
            interactionPoints: [...scene.interactionPoints, {
              id: interactionPointId,
              name: `互动点 ${scene.interactionPoints.length + 1}`,
              enabled: true,
              visibleToPlayers: true,
              icon: 'search',
              x: position.x,
              y: position.y,
              interactionRadiusFeet: 5,
              prompt: '仔细调查这里。',
              repeat: 'per-character',
              check: {
                label: '智力（调查）检定',
                selection: 'skill:investigation',
                dc: 12,
                mode: 'normal',
              },
              successText: '你发现了一些有用的东西。',
              failureText: '你没有发现异常。',
              rewards: [],
              successEffects: [],
              failureEffects: [],
            }],
          } : scene),
        }))
        return interactionPointId
      },
      updateInteractionPoint: (sceneId, interactionPointId, patch) => mutate((shared) => ({
        ...shared,
        scenes: shared.scenes.map((scene) => scene.id === sceneId ? {
          ...scene,
          updatedAt: Date.now(),
          interactionPoints: scene.interactionPoints.map((point) => point.id === interactionPointId
            ? { ...point, ...patch, id: point.id }
            : point),
        } : scene),
      })),
      setInteractionPointPosition: (sceneId, interactionPointId, position) => mutate((shared) => ({
        ...shared,
        scenes: shared.scenes.map((scene) => scene.id === sceneId ? {
          ...scene,
          updatedAt: Date.now(),
          interactionPoints: scene.interactionPoints.map((point) => point.id === interactionPointId
            ? { ...point, x: position.x, y: position.y }
            : point),
        } : scene),
      })),
      removeInteractionPoint: (sceneId, interactionPointId) => mutate((shared) => ({
        ...shared,
        scenes: shared.scenes.map((scene) => scene.id === sceneId ? {
          ...scene,
          updatedAt: Date.now(),
          interactionPoints: scene.interactionPoints.filter((point) => point.id !== interactionPointId),
        } : scene),
      })),
      addTrigger: (sceneId, region) => {
        const triggerId = crypto.randomUUID()
        mutate((shared) => ({
          ...shared,
          scenes: shared.scenes.map((scene) => scene.id === sceneId ? {
            ...scene,
            updatedAt: Date.now(),
            triggers: [...scene.triggers, {
              id: triggerId, name: `触发区 ${scene.triggers.length + 1}`, enabled: true, region,
              events: ['enter'], tokenFilter: 'player', repeat: 'per-token', actions: [],
            }],
          } : scene),
        }))
        return triggerId
      },
      updateTrigger: (sceneId, triggerId, patch) => updateTriggerTree(sceneId, triggerId, (trigger) => ({ ...trigger, ...patch, id: trigger.id, actions: trigger.actions })),
      setTriggerRegion: (sceneId, triggerId, region) => updateTriggerTree(sceneId, triggerId, (trigger) => ({ ...trigger, region })),
      removeTrigger: (sceneId, triggerId) => mutate((shared) => ({
        ...shared,
        scenes: shared.scenes.map((scene) => scene.id === sceneId ? {
          ...scene, updatedAt: Date.now(), triggers: scene.triggers.filter((trigger) => trigger.id !== triggerId),
        } : scene),
        runtime: { ...shared.runtime, pendingRuns: shared.runtime.pendingRuns.filter((run) => run.triggerId !== triggerId) },
      })),
      addAction: (sceneId, triggerId, action) => updateTriggerTree(sceneId, triggerId, (trigger) => ({ ...trigger, actions: [...trigger.actions, action] })),
      updateAction: (sceneId, triggerId, actionId, patch) => updateTriggerTree(sceneId, triggerId, (trigger) => ({
        ...trigger,
        actions: trigger.actions.map((action) => action.id === actionId ? { ...action, ...patch, id: action.id } as SceneAction : action),
      })),
      removeAction: (sceneId, triggerId, actionId) => updateTriggerTree(sceneId, triggerId, (trigger) => ({
        ...trigger, actions: trigger.actions.filter((action) => action.id !== actionId),
      })),
      setPaused: (paused) => mutate((shared) => ({ ...shared, runtime: { ...shared.runtime, paused, lastError: undefined } })),
      enqueueRun: ({ sceneId, triggerId, mapId, event, token }) => {
        const scene = get().shared.scenes.find((candidate) => candidate.id === sceneId)
        const trigger = scene?.triggers.find((candidate) => candidate.id === triggerId)
        if (!scene || !trigger || !trigger.enabled || trigger.actions.length < 1) return null
        if (event !== 'manual' && !trigger.events.includes(event)) return null
        if (token && !sceneTriggerAcceptsToken(trigger, token)) return null
        const receipt = sceneTriggerReceiptKey(scene, trigger, token?.tokenId)
        if (receipt && get().shared.runtime.receipts.includes(receipt)) return null
        const duplicate = get().shared.runtime.pendingRuns.some((run) =>
          run.sceneId === sceneId && run.triggerId === triggerId && run.event === event && run.token?.tokenId === token?.tokenId)
        if (duplicate) return null
        const runId = crypto.randomUUID()
        const run: ScenePendingRun = {
          id: runId, sceneId, triggerId, mapId, event, ...(token ? { token } : {}), nextActionIndex: 0, createdAt: Date.now(),
        }
        mutate((shared) => ({
          ...shared,
          runtime: {
            ...shared.runtime,
            pendingRuns: [...shared.runtime.pendingRuns, run].slice(-50),
            lastError: undefined,
          },
        }))
        return runId
      },
      advanceRun: (runId, history) => mutate((shared) => {
        const run = shared.runtime.pendingRuns.find((candidate) => candidate.id === runId)
        if (!run) return shared
        const trigger = shared.scenes.find((scene) => scene.id === run.sceneId)?.triggers.find((candidate) => candidate.id === run.triggerId)
        const nextActionIndex = run.nextActionIndex + 1
        const complete = !trigger || nextActionIndex >= trigger.actions.length
        const scene = shared.scenes.find((candidate) => candidate.id === run.sceneId)
        const receipt = complete && scene && trigger
          ? sceneTriggerReceiptKey(scene, trigger, run.token?.tokenId)
          : null
        return {
          ...shared,
          runtime: {
            ...shared.runtime,
            pendingRuns: complete
              ? shared.runtime.pendingRuns.filter((candidate) => candidate.id !== runId)
              : shared.runtime.pendingRuns.map((candidate) => candidate.id === runId ? { ...candidate, nextActionIndex } : candidate),
            history: [...shared.runtime.history, history].slice(-SCENE_MAX_HISTORY),
            receipts: receipt && !shared.runtime.receipts.includes(receipt)
              ? [...shared.runtime.receipts, receipt].slice(-2_000)
              : shared.runtime.receipts,
            lastError: undefined,
          },
        }
      }),
      failRun: (_runId, message) => mutate((shared) => ({
        ...shared, runtime: { ...shared.runtime, paused: true, lastError: message.slice(0, 500) },
      })),
      discardRun: (runId) => mutate((shared) => ({
        ...shared, runtime: { ...shared.runtime, pendingRuns: shared.runtime.pendingRuns.filter((run) => run.id !== runId), lastError: undefined },
      })),
      clearReceipts: (sceneId) => mutate((shared) => ({
        ...shared,
        runtime: {
          ...shared.runtime,
          receipts: sceneId ? shared.runtime.receipts.filter((receipt) => !receipt.startsWith(`${sceneId}:`)) : [],
        },
      })),
      markHistoryUndone: (historyId) => mutate((shared) => ({
        ...shared,
        runtime: {
          ...shared.runtime,
          history: shared.runtime.history.map((entry) => entry.id === historyId ? { ...entry, undoneAt: Date.now() } : entry),
        },
      })),
      reset: () => set({ shared: emptyShared() }),
    }
  }, {
    name: 'dndstars-scene-orchestration-v1',
    partialize: (state) => ({ shared: state.shared }),
  }),
)

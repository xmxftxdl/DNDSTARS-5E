import { useCallback, useEffect, useRef, useState } from 'react'
import type { BattleMap, Token } from '../../store/maps'
import { useMapStore } from '../../store/maps'
import { useMapGeometryStore } from '../../store/mapGeometry'
import { useFogStore } from '../../store/fog'
import { useCharacterStore } from '../../store/characters'
import { useRoomCommunicationsStore } from '../../store/roomCommunications'
import { useGroupAbilityChecksStore } from '../../store/groupAbilityChecks'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'
import { useSceneAudioStore } from '../../store/sceneAudio'
import { getEnemyTemplate } from '../../lib/enemyPool'
import { publishSharedEvent, subscribeSharedEvent } from '../../lib/sharedApi'
import { playSceneAudioCue } from '../../lib/sceneAudio'
import {
  SCENE_PRESENTATION_CHANNEL,
  sceneActionSummary,
  scenePointInsideRegion,
  sceneTriggerAcceptsToken,
  type SceneAction,
  type SceneHistoryEntry,
  type ScenePendingRun,
  type ScenePresentationEvent,
  type SceneRegion,
  type SceneTriggerTokenSnapshot,
  type SceneUndoDescriptor,
} from '../../lib/sceneOrchestration'
import SceneOrchestrationPanel from './SceneOrchestrationPanel'

export interface SceneDrawTarget {
  sceneId: string
  triggerId: string
  kind: SceneRegion['kind']
}

export interface SceneOrchestrationSystemProps {
  map: BattleMap
  isDm: boolean
  drawing?: SceneDrawTarget | null
  onBeginDraw: (target: SceneDrawTarget) => void
  onCancelDraw: () => void
  onStartCombat: () => Promise<void> | void
  onEditorVisibilityChange?: (visible: boolean) => void
}

function tokenSnapshot(token: Token): SceneTriggerTokenSnapshot {
  return {
    tokenId: token.id,
    ...(token.characterId ? { characterId: token.characterId } : {}),
    label: token.label || token.emoji || 'Token',
    type: token.type,
    x: token.x,
    y: token.y,
  }
}

function wait(delayMs = 0): Promise<void> {
  return delayMs > 0 ? new Promise((resolve) => window.setTimeout(resolve, delayMs)) : Promise.resolve()
}

export default function SceneOrchestrationSystem({
  map,
  isDm,
  drawing,
  onBeginDraw,
  onCancelDraw,
  onStartCombat,
  onEditorVisibilityChange,
}: SceneOrchestrationSystemProps) {
  const shared = useSceneOrchestrationStore((state) => state.shared)
  const [notice, setNotice] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const previousInsideRef = useRef(new Map<string, boolean>())
  const seededMapsRef = useRef(new Set<string>())
  const executingRef = useRef(false)

  useEffect(() => () => onEditorVisibilityChange?.(false), [onEditorVisibilityChange])

  useEffect(() => subscribeSharedEvent<ScenePresentationEvent>(SCENE_PRESENTATION_CHANNEL, (event) => {
    if (event.kind === 'sound' && event.cue) playSceneAudioCue(event.cue)
    if (event.text) {
      setNotice(event.text)
      window.setTimeout(() => setNotice((current) => current === event.text ? '' : current), 5_000)
    }
  }), [])

  const executeAction = useCallback(async (
    run: ScenePendingRun,
    action: SceneAction,
  ): Promise<{ summary: string; undo?: SceneUndoDescriptor; reversible: boolean }> => {
    await wait(action.delayMs)
    const maps = useMapStore.getState()
    const geometry = useMapGeometryStore.getState()
    const communications = useRoomCommunicationsStore.getState()
    const characters = useCharacterStore.getState().characters
    const summary = sceneActionSummary(action)

    if (!action.enabled) return { summary: `已跳过：${summary}`, reversible: false }

    if (action.kind === 'reveal-handout') {
      const source = communications.journal.handouts.find((handout) => handout.id === action.handoutId)
      if (!source) throw new Error(`找不到绑定讲义：${action.handoutId}`)
      const character = run.token?.characterId ? characters.find((candidate) => candidate.id === run.token?.characterId) : undefined
      const memberId = character?.roomMemberId
      if (action.audience === 'triggering-player' && !memberId) throw new Error('触发 Token 没有关联在线玩家，无法定向展示讲义。')
      await communications.mutateJournal({
        operation: 'add-handout',
        title: source.title,
        body: source.body,
        audience: action.audience === 'all' ? 'all' : [memberId!],
        ...(source.imageId ? { imageId: source.imageId, imageMimeType: source.imageMimeType, imageName: source.imageName } : {}),
      })
      return { summary, reversible: false }
    }

    if (action.kind === 'whisper') {
      const character = run.token?.characterId ? characters.find((candidate) => candidate.id === run.token?.characterId) : undefined
      if (!character?.roomMemberId) throw new Error('触发 Token 没有关联玩家，无法发送密语。')
      await communications.sendMessage({ channel: 'dm-private', text: action.text, recipientMemberId: character.roomMemberId })
      return { summary, reversible: false }
    }

    if (action.kind === 'group-roll') {
      const participantCharacterIds = [...new Set(
        map.tokens.filter((token) => token.type === 'player' && token.characterId).map((token) => token.characterId!),
      )]
      if (participantCharacterIds.length < 1) throw new Error('当前地图没有已关联玩家角色，无法发起群体检定。')
      await useGroupAbilityChecksStore.getState().mutate({
        operation: 'create',
        label: action.label,
        selection: action.selection,
        dc: action.dc,
        mode: action.mode,
        allowPassiveFallback: action.allowPassiveFallback,
        participantCharacterIds,
        mapId: run.mapId,
      })
      return { summary, reversible: false }
    }

    if (action.kind === 'door') {
      const mapGeometry = geometry.maps.find((candidate) => candidate.mapId === run.mapId)
      const door = mapGeometry?.doors.find((candidate) => candidate.id === action.doorId)
      if (!door) throw new Error(`找不到场景动作绑定的门：${action.doorId}`)
      geometry.setDoorState(run.mapId, action.doorId, action.state)
      return {
        summary,
        reversible: true,
        undo: { kind: 'door', mapId: run.mapId, doorId: action.doorId, previousState: door.state },
      }
    }

    if (action.kind === 'light') {
      const mapGeometry = geometry.maps.find((candidate) => candidate.mapId === run.mapId)
      if (!mapGeometry) throw new Error('当前地图尚未建立几何/光照配置。')
      geometry.setVision(run.mapId, { ambientLight: action.ambientLight })
      return {
        summary,
        reversible: true,
        undo: { kind: 'light', mapId: run.mapId, previousAmbientLight: mapGeometry.vision.ambientLight },
      }
    }

    if (action.kind === 'fog') {
      if (action.operation === 'fill') useFogStore.getState().fill(run.mapId)
      else useFogStore.getState().clear(run.mapId)
      return { summary, reversible: false }
    }

    if (action.kind === 'encounter') {
      const entries = action.entries.flatMap((entry) => {
        const template = getEnemyTemplate(entry.monsterId)
        return template ? [{ template, quantity: entry.quantity }] : []
      })
      if (entries.length !== action.entries.length) throw new Error('遭遇预设中包含当前规则包找不到的怪物。')
      const tokenIds = maps.addEncounterFromPool(run.mapId, entries)
      if (action.startInitiative) await onStartCombat()
      return {
        summary,
        reversible: !action.startInitiative,
        ...(!action.startInitiative ? { undo: { kind: 'remove-tokens', mapId: run.mapId, tokenIds } as SceneUndoDescriptor } : {}),
      }
    }

    if (action.kind === 'sound') {
      await publishSharedEvent<ScenePresentationEvent>(SCENE_PRESENTATION_CHANNEL, {
        id: crypto.randomUUID(), kind: 'sound', cue: action.cue, createdAt: Date.now(),
      })
      return { summary, reversible: false }
    }

    if (action.kind === 'audio') {
      await useSceneAudioStore.getState().control(action.operation === 'stop'
        ? { operation: 'stop' }
        : { operation: 'play', assetId: action.assetId!, loop: action.loop, volume: action.volume })
      return { summary, reversible: false }
    }

    if (action.kind === 'teleport') {
      if (!maps.maps.some((candidate) => candidate.id === action.targetMapId)) throw new Error('传送目标地图不存在。')
      if (action.moveTriggeringToken) {
        if (!run.token) throw new Error('手动触发没有指定 Token，无法执行 Token 传送。')
        const moved = maps.transferToken(run.mapId, action.targetMapId, run.token.tokenId, { x: action.x, y: action.y })
        if (!moved) throw new Error('Token 传送失败：来源或目标地图状态已经变化。')
        return {
          summary,
          reversible: true,
          undo: {
            kind: 'teleport', tokenId: run.token.tokenId, fromMapId: run.mapId, toMapId: action.targetMapId,
            x: run.token.x, y: run.token.y,
          },
        }
      }
      maps.select(action.targetMapId)
      return { summary, reversible: false }
    }

    if (action.kind === 'task') {
      await communications.mutateJournal({ operation: 'add-shared-note', kind: 'task', title: action.title, body: action.body })
      return { summary, reversible: false }
    }

    await communications.mutateJournal({ operation: 'add-campaign-entry', title: action.title, body: action.body, source: 'dm' })
    return { summary, reversible: false }
  }, [map.tokens, onStartCombat])

  const executeNext = useCallback(async (runAll: boolean) => {
    if (!isDm || executingRef.current) return
    executingRef.current = true
    try {
      do {
        const store = useSceneOrchestrationStore.getState()
        const run = store.shared.runtime.pendingRuns[0]
        if (!run) return
        const scene = store.shared.scenes.find((candidate) => candidate.id === run.sceneId)
        const trigger = scene?.triggers.find((candidate) => candidate.id === run.triggerId)
        if (!scene || !trigger) {
          store.discardRun(run.id)
          continue
        }
        const action = trigger.actions[run.nextActionIndex]
        if (!action) {
          store.discardRun(run.id)
          continue
        }
        try {
          const result = await executeAction(run, action)
          const history: SceneHistoryEntry = {
            id: crypto.randomUUID(), runId: run.id, sceneId: scene.id, triggerId: trigger.id,
            actionId: action.id, summary: result.summary, executedAt: Date.now(), reversible: result.reversible,
            ...(result.undo ? { undo: result.undo } : {}),
          }
          store.advanceRun(run.id, history)
        } catch (cause) {
          store.failRun(run.id, cause instanceof Error ? cause.message : '场景动作执行失败。')
          return
        }
        if (!runAll || useSceneOrchestrationStore.getState().shared.runtime.paused) return
      } while (useSceneOrchestrationStore.getState().shared.runtime.pendingRuns.length > 0)
    } finally {
      executingRef.current = false
    }
  }, [executeAction, isDm])

  useEffect(() => {
    if (!isDm || shared.runtime.paused || shared.runtime.pendingRuns.length < 1) return
    void executeNext(true)
  }, [executeNext, isDm, shared.runtime.paused, shared.runtime.pendingRuns])

  useEffect(() => {
    if (!isDm) return
    const scenes = shared.scenes.filter((scene) => scene.mapId === map.id)
    const keys = new Set<string>()
    const seeded = seededMapsRef.current.has(map.id)
    for (const scene of scenes) {
      for (const trigger of scene.triggers) {
        if (!trigger.enabled) continue
        for (const token of map.tokens) {
          const snapshot = tokenSnapshot(token)
          if (!sceneTriggerAcceptsToken(trigger, snapshot)) continue
          const key = `${scene.id}:${trigger.id}:${token.id}`
          keys.add(key)
          const inside = scenePointInsideRegion(token, trigger.region)
          const previous = previousInsideRef.current.get(key)
          previousInsideRef.current.set(key, inside)
          if (!seeded || previous == null || previous === inside) continue
          const event = inside ? 'enter' : 'leave'
          if (!trigger.events.includes(event)) continue
          useSceneOrchestrationStore.getState().enqueueRun({
            sceneId: scene.id, triggerId: trigger.id, mapId: map.id, event, token: snapshot,
          })
        }
      }
    }
    const currentScenePrefixes = scenes.map((scene) => `${scene.id}:`)
    for (const key of previousInsideRef.current.keys()) {
      if (currentScenePrefixes.some((prefix) => key.startsWith(prefix)) && !keys.has(key)) {
        previousInsideRef.current.delete(key)
      }
    }
    seededMapsRef.current.add(map.id)
  }, [isDm, map, shared.scenes])

  const undoLast = useCallback(() => {
    const store = useSceneOrchestrationStore.getState()
    const history = [...store.shared.runtime.history].reverse().find((entry) => entry.reversible && !entry.undoneAt && entry.undo)
    if (!history?.undo) return
    const undo = history.undo
    if (undo.kind === 'door') useMapGeometryStore.getState().setDoorState(undo.mapId, undo.doorId, undo.previousState)
    else if (undo.kind === 'light') useMapGeometryStore.getState().setVision(undo.mapId, { ambientLight: undo.previousAmbientLight })
    else if (undo.kind === 'remove-tokens') undo.tokenIds.forEach((tokenId) => useMapStore.getState().removeToken(undo.mapId, tokenId))
    else useMapStore.getState().transferToken(undo.toMapId, undo.fromMapId, undo.tokenId, { x: undo.x, y: undo.y })
    store.markHistoryUndone(history.id)
  }, [])

  const runTrigger = useCallback((sceneId: string, triggerId: string, tokenId?: string) => {
    const token = tokenId ? map.tokens.find((candidate) => candidate.id === tokenId) : undefined
    useSceneOrchestrationStore.getState().enqueueRun({
      sceneId, triggerId, mapId: map.id, event: 'manual', ...(token ? { token: tokenSnapshot(token) } : {}),
    })
  }, [map])

  const playBackgroundCue = useCallback(async () => {
    const scene = useSceneOrchestrationStore.getState().shared.scenes.find((candidate) => candidate.mapId === map.id)
    if (!scene) return
    if (scene.backgroundAudioId) {
      await useSceneAudioStore.getState().control({
        operation: 'play',
        assetId: scene.backgroundAudioId,
        loop: scene.backgroundAudioLoop,
        volume: scene.backgroundAudioVolume,
      })
      return
    }
    if (scene.backgroundCue === 'none') return
    await publishSharedEvent<ScenePresentationEvent>(SCENE_PRESENTATION_CHANNEL, {
      id: crypto.randomUUID(), kind: 'sound', cue: scene.backgroundCue, text: `场景氛围：${scene.name}`, createdAt: Date.now(),
    })
  }, [map.id])

  return (
    <>
      {isDm && <SceneOrchestrationPanel
        map={map}
        open={editorOpen}
        onOpenChange={(visible) => {
          setEditorOpen(visible)
          onEditorVisibilityChange?.(visible)
          if (!visible) onCancelDraw()
        }}
        drawing={drawing}
        onBeginDraw={onBeginDraw}
        onCancelDraw={onCancelDraw}
        onRunTrigger={runTrigger}
        onStep={() => void executeNext(false)}
        onUndo={undoLast}
        onPlayBackground={() => void playBackgroundCue()}
        onStopAudio={() => void useSceneAudioStore.getState().control({ operation: 'stop' })}
      />}
      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-[125] -translate-x-1/2 rounded-2xl border border-violet-300/25 bg-void-950/94 px-5 py-3 text-sm font-semibold text-violet-100 shadow-2xl backdrop-blur">
          {notice}
        </div>
      )}
    </>
  )
}

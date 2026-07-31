import { useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Circle,
  Eye,
  FastForward,
  MapPinned,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react'
import type { BattleMap } from '../../store/maps'
import { useMapStore } from '../../store/maps'
import { useMapGeometryStore } from '../../store/mapGeometry'
import { useRoomCommunicationsStore } from '../../store/roomCommunications'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'
import { useSceneAudioStore } from '../../store/sceneAudio'
import { searchEnemyPool } from '../../lib/enemyPool'
import {
  sceneActionSummary,
  type SceneAction,
  type SceneAudioCue,
} from '../../lib/sceneOrchestration'
import type { SceneDrawTarget } from './SceneOrchestrationSystem'
import type { SceneAudioAsset, SceneAudioKind } from '../../lib/sceneAudioLibrary'
import SceneInteractionPointsEditor from './SceneInteractionPointsEditor'

interface SceneOrchestrationPanelProps {
  map: BattleMap
  combatActive: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  drawing?: SceneDrawTarget | null
  onBeginDraw: (target: SceneDrawTarget) => void
  onCancelDraw: () => void
  onRunTrigger: (sceneId: string, triggerId: string, tokenId?: string) => void
  onStep: () => void
  onUndo: () => void
  onPlayBackground: () => void
  onStopAudio: () => void
}

type ActionKind = Exclude<SceneAction['kind'], 'group-roll'>

const ACTION_LABELS: Readonly<Record<ActionKind, string>> = {
  'reveal-handout': '展示讲义',
  whisper: '发送密语',
  door: '切换门状态',
  light: '改变环境光',
  fog: '改变迷雾',
  encounter: '投放预设遭遇',
  sound: '播放音效',
  audio: '播放/停止房间音频',
  teleport: '传送地图/楼层',
  task: '写入任务进度',
  journal: '写入战役日志',
}

const AUDIO_LABELS: Readonly<Record<SceneAudioCue, string>> = {
  none: '无背景氛围', discovery: '发现', danger: '危险', door: '机关/门', mystery: '神秘', victory: '胜利',
}

function fieldClass() {
  return 'w-full rounded-lg border border-white/10 bg-void-900 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-violet-300/35'
}

export default function SceneOrchestrationPanel({
  map,
  combatActive,
  open,
  onOpenChange,
  drawing,
  onBeginDraw,
  onCancelDraw,
  onRunTrigger,
  onStep,
  onUndo,
  onPlayBackground,
  onStopAudio,
}: SceneOrchestrationPanelProps) {
  const shared = useSceneOrchestrationStore((state) => state.shared)
  const ensureScene = useSceneOrchestrationStore((state) => state.ensureScene)
  const updateScene = useSceneOrchestrationStore((state) => state.updateScene)
  const removeScene = useSceneOrchestrationStore((state) => state.removeScene)
  const addTrigger = useSceneOrchestrationStore((state) => state.addTrigger)
  const updateTrigger = useSceneOrchestrationStore((state) => state.updateTrigger)
  const removeTrigger = useSceneOrchestrationStore((state) => state.removeTrigger)
  const addAction = useSceneOrchestrationStore((state) => state.addAction)
  const removeAction = useSceneOrchestrationStore((state) => state.removeAction)
  const setPaused = useSceneOrchestrationStore((state) => state.setPaused)
  const discardRun = useSceneOrchestrationStore((state) => state.discardRun)
  const clearReceipts = useSceneOrchestrationStore((state) => state.clearReceipts)
  const maps = useMapStore((state) => state.maps)
  const geometryMaps = useMapGeometryStore((state) => state.maps)
  const journal = useRoomCommunicationsStore((state) => state.journal)
  const audioLibrary = useSceneAudioStore((state) => state.library)
  const audioPlayback = useSceneAudioStore((state) => state.playback)
  const controlAudio = useSceneAudioStore((state) => state.control)
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [manualTokenId, setManualTokenId] = useState('')
  const [actionKind, setActionKind] = useState<ActionKind>('whisper')
  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState('')
  const [doorState, setDoorState] = useState<'open' | 'closed' | 'locked'>('open')
  const [ambientLight, setAmbientLight] = useState<'bright' | 'dim' | 'darkness'>('dim')
  const [fogOperation, setFogOperation] = useState<'fill' | 'clear'>('clear')
  const [cue, setCue] = useState<Exclude<SceneAudioCue, 'none'>>('discovery')
  const [audioOperation, setAudioOperation] = useState<'play' | 'stop'>('play')
  const [audioLoop, setAudioLoop] = useState(true)
  const [audioVolume, setAudioVolume] = useState(0.7)
  const [targetMapId, setTargetMapId] = useState('')
  const [targetX, setTargetX] = useState(100)
  const [targetY, setTargetY] = useState(100)
  const [monsterQuery, setMonsterQuery] = useState('')
  const [encounterEntries, setEncounterEntries] = useState<Array<{ monsterId: string; name: string; quantity: number }>>([])
  const [startInitiative, setStartInitiative] = useState(true)

  const scene = shared.scenes.find((candidate) => candidate.mapId === map.id)
  const selectedTrigger = scene?.triggers.find((trigger) => trigger.id === selectedTriggerId) ?? scene?.triggers[0]
  const geometry = geometryMaps.find((candidate) => candidate.mapId === map.id)
  const monsterResults = useMemo(() => monsterQuery.trim() ? searchEnemyPool(monsterQuery).slice(0, 8) : [], [monsterQuery])
  const reversibleHistory = [...shared.runtime.history].reverse().find((entry) => entry.reversible && !entry.undoneAt)

  const buildAction = (): SceneAction | null => {
    const base = { id: crypto.randomUUID(), enabled: true }
    if (actionKind === 'reveal-handout') return primary ? { ...base, kind: actionKind, handoutId: primary, audience: secondary === 'triggering-player' ? 'triggering-player' : 'all' } : null
    if (actionKind === 'whisper') return primary.trim() ? { ...base, kind: actionKind, text: primary.trim() } : null
    if (actionKind === 'door') return primary ? { ...base, kind: actionKind, doorId: primary, state: doorState } : null
    if (actionKind === 'light') return { ...base, kind: actionKind, ambientLight }
    if (actionKind === 'fog') return { ...base, kind: actionKind, operation: fogOperation }
    if (actionKind === 'encounter') return encounterEntries.length > 0 ? {
      ...base, kind: actionKind, entries: encounterEntries.map(({ monsterId, quantity }) => ({ monsterId, quantity })), startInitiative,
    } : null
    if (actionKind === 'sound') return { ...base, kind: actionKind, cue }
    if (actionKind === 'audio') return audioOperation === 'stop'
      ? { ...base, kind: actionKind, operation: 'stop', loop: false, volume: audioVolume }
      : primary ? { ...base, kind: actionKind, operation: 'play', assetId: primary, loop: audioLoop, volume: audioVolume } : null
    if (actionKind === 'teleport') return targetMapId ? {
      ...base, kind: actionKind, targetMapId, x: targetX, y: targetY, moveTriggeringToken: true,
    } : null
    if (actionKind === 'task') return primary.trim() ? { ...base, kind: actionKind, title: primary.trim(), body: secondary.trim() } : null
    return primary.trim() ? { ...base, kind: 'journal', title: primary.trim(), body: secondary.trim() } : null
  }

  const appendAction = () => {
    if (!scene || !selectedTrigger) return
    const action = buildAction()
    if (!action) return
    addAction(scene.id, selectedTrigger.id, action)
    setPrimary('')
    setSecondary('')
    if (actionKind === 'encounter') setEncounterEntries([])
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="absolute right-4 top-16 z-[92] flex items-center gap-2 rounded-xl border border-violet-300/25 bg-void-950/92 px-3 py-2 text-xs font-bold text-violet-100 shadow-xl backdrop-blur hover:border-violet-300/45"
      >
        <MapPinned className="h-4 w-4" />场景编排
        {shared.runtime.pendingRuns.length > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] text-slate-950">{shared.runtime.pendingRuns.length}</span>}
      </button>

      {open && (
        <aside className="absolute bottom-4 right-4 top-28 z-[118] flex w-[min(440px,calc(100%-2rem))] flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-void-950/96 shadow-2xl backdrop-blur-xl">
          <header className="flex items-start gap-3 border-b border-white/8 p-4">
            <div className="min-w-0 flex-1"><h2 className="font-bold text-violet-100">场景编排 V1</h2><p className="mt-1 text-[11px] text-slate-500">DM 权威 · 触发区与预设不会投影给玩家</p></div>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5"><X className="h-4 w-4" /></button>
          </header>

          {!scene ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MapPinned className="h-10 w-10 text-violet-300" />
              <h3 className="mt-4 font-bold text-slate-100">把“{map.name}”升级为场景</h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">建立后可绘制触发区，串联讲义、检定、门、光照、迷雾、遭遇、音效、传送和任务。</p>
              <button type="button" onClick={() => { const id = ensureScene(map.id, map.name, { x: map.width / 2, y: map.height / 2 }); setSelectedTriggerId(useSceneOrchestrationStore.getState().shared.scenes.find((entry) => entry.id === id)?.triggers[0]?.id ?? null) }} className="mt-5 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white">建立场景</button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <section className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <div className="flex items-center gap-2"><input value={scene.name} onChange={(event) => updateScene(scene.id, { name: event.target.value })} className={`${fieldClass()} font-bold`} /><button type="button" onClick={() => { if (window.confirm('删除此场景及全部触发器？')) removeScene(scene.id) }} className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div>
                <textarea value={scene.description} onChange={(event) => updateScene(scene.id, { description: event.target.value })} placeholder="场景说明与 DM 备注" rows={2} className={fieldClass()} />
                <input value={scene.environmentLabel} onChange={(event) => updateScene(scene.id, { environmentLabel: event.target.value })} placeholder="环境：潮湿地牢、强风……" className={fieldClass()} />
                <div className="grid grid-cols-2 gap-2"><select value={scene.backgroundAudioId ?? ''} onChange={(event) => updateScene(scene.id, { backgroundAudioId: event.target.value || undefined })} className={fieldClass()}><option value="">不绑定导入音频</option>{audioLibrary.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.kind === 'music' ? '音乐' : asset.kind === 'ambience' ? '环境' : '音效'} · {asset.name}</option>)}</select><select value={scene.backgroundCue} disabled={!!scene.backgroundAudioId} onChange={(event) => updateScene(scene.id, { backgroundCue: event.target.value as SceneAudioCue })} className={fieldClass()}>{Object.entries(AUDIO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                {scene.backgroundAudioId && <div className="grid grid-cols-[1fr_auto] gap-2"><label className="flex items-center gap-2 text-[11px] text-slate-400"><span>房间音量</span><input type="range" min={0} max={1} step={0.05} value={scene.backgroundAudioVolume} onChange={(event) => updateScene(scene.id, { backgroundAudioVolume: Number(event.target.value) })} className="min-w-0 flex-1" /><span>{Math.round(scene.backgroundAudioVolume * 100)}%</span><input type="checkbox" checked={scene.backgroundAudioLoop} onChange={(event) => updateScene(scene.id, { backgroundAudioLoop: event.target.checked })} />循环</label><span className="text-[11px] text-slate-500">{audioPlayback.assetId === scene.backgroundAudioId ? audioPlayback.status === 'paused' ? '已暂停' : '正在播放' : '未播放'}</span></div>}
                <div className="flex gap-2"><button type="button" disabled={!scene.backgroundAudioId && scene.backgroundCue === 'none'} onClick={onPlayBackground} className="flex items-center gap-1 rounded-lg border border-violet-300/20 px-3 py-2 text-xs text-violet-200 disabled:opacity-30"><Volume2 className="h-4 w-4" />全房间播放</button><button type="button" disabled={audioPlayback.status === 'stopped'} onClick={() => void controlAudio({ operation: audioPlayback.status === 'paused' ? 'resume' : 'pause' })} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 disabled:opacity-30">{audioPlayback.status === 'paused' ? '继续' : '暂停'}</button><button type="button" disabled={audioPlayback.status === 'stopped'} onClick={onStopAudio} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 disabled:opacity-30">停止</button></div>
                <details><summary className="cursor-pointer text-xs font-semibold text-slate-400">绑定讲义与日志</summary><div className="mt-2 max-h-32 space-y-1 overflow-auto text-xs">{journal.handouts.map((handout) => <label key={handout.id} className="flex items-center gap-2"><input type="checkbox" checked={scene.boundHandoutIds.includes(handout.id)} onChange={(event) => updateScene(scene.id, { boundHandoutIds: event.target.checked ? [...scene.boundHandoutIds, handout.id] : scene.boundHandoutIds.filter((id) => id !== handout.id) })} />{handout.title}</label>)}{journal.campaignEntries.map((entry) => <label key={entry.id} className="flex items-center gap-2"><input type="checkbox" checked={scene.boundJournalEntryIds.includes(entry.id)} onChange={(event) => updateScene(scene.id, { boundJournalEntryIds: event.target.checked ? [...scene.boundJournalEntryIds, entry.id] : scene.boundJournalEntryIds.filter((id) => id !== entry.id) })} />日志：{entry.title}</label>)}</div></details>
              </section>

              <SceneAudioLibraryManager />

              <SceneInteractionPointsEditor
                map={map}
                scene={scene}
                combatActive={combatActive}
                placingInteractionPointId={
                  drawing?.kind === 'interaction-point' ? drawing.interactionPointId : null
                }
                onBeginPlace={(interactionPointId) => onBeginDraw({
                  sceneId: scene.id,
                  interactionPointId,
                  kind: 'interaction-point',
                })}
                onCancelPlace={onCancelDraw}
              />

              <section className="mt-4">
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">触发区域</h3><button type="button" onClick={() => { const id = addTrigger(scene.id, { kind: 'circle', x: map.width / 2, y: map.height / 2, radius: Math.max(30, map.gridSize) }); setSelectedTriggerId(id) }} className="flex items-center gap-1 text-xs text-violet-300"><Plus className="h-3.5 w-3.5" />添加</button></div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{scene.triggers.map((trigger) => <button key={trigger.id} type="button" onClick={() => setSelectedTriggerId(trigger.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs ${selectedTrigger?.id === trigger.id ? 'border-violet-300/40 bg-violet-500/15 text-violet-100' : 'border-white/8 text-slate-500'}`}>{trigger.enabled ? '●' : '○'} {trigger.name}</button>)}</div>
              </section>

              {selectedTrigger && <section className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
                <div className="flex gap-2"><input value={selectedTrigger.name} onChange={(event) => updateTrigger(scene.id, selectedTrigger.id, { name: event.target.value })} className={fieldClass()} /><button type="button" onClick={() => removeTrigger(scene.id, selectedTrigger.id)} className="rounded-lg p-2 text-slate-600 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div>
                <div className="mt-2 grid grid-cols-3 gap-2"><select value={selectedTrigger.tokenFilter} onChange={(event) => updateTrigger(scene.id, selectedTrigger.id, { tokenFilter: event.target.value as typeof selectedTrigger.tokenFilter })} className={fieldClass()}><option value="player">玩家</option><option value="enemy">敌人</option><option value="any">任意 Token</option></select><select value={selectedTrigger.repeat} onChange={(event) => updateTrigger(scene.id, selectedTrigger.id, { repeat: event.target.value as typeof selectedTrigger.repeat })} className={fieldClass()}><option value="per-token">每 Token 一次</option><option value="once">全局一次</option><option value="always">每次进入</option></select><label className="flex items-center justify-center gap-2 rounded-lg border border-white/10 text-xs text-slate-300"><input type="checkbox" checked={selectedTrigger.enabled} onChange={(event) => updateTrigger(scene.id, selectedTrigger.id, { enabled: event.target.checked })} />启用</label></div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="text-slate-600">触发：</span>{(['enter', 'leave'] as const).map((eventName) => <label key={eventName} className="flex items-center gap-1 text-slate-300"><input type="checkbox" checked={selectedTrigger.events.includes(eventName)} onChange={(event) => updateTrigger(scene.id, selectedTrigger.id, { events: event.target.checked ? [...selectedTrigger.events, eventName] : selectedTrigger.events.filter((value) => value !== eventName) })} />{eventName === 'enter' ? '进入' : '离开'}</label>)}<span className="ml-auto text-slate-600">{selectedTrigger.region.kind === 'circle' ? `圆形 · 半径 ${Math.round(selectedTrigger.region.radius)}px` : `矩形 · ${Math.round(selectedTrigger.region.width)}×${Math.round(selectedTrigger.region.height)}px`}</span></div>
                <div className="mt-3 flex gap-2"><button type="button" onClick={() => onBeginDraw({ sceneId: scene.id, triggerId: selectedTrigger.id, kind: 'circle' })} className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${drawing?.kind === 'circle' && drawing.triggerId === selectedTrigger.id ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100' : 'border-white/10 text-slate-300'}`}><Circle className="h-3.5 w-3.5" />绘制圆形</button><button type="button" onClick={() => onBeginDraw({ sceneId: scene.id, triggerId: selectedTrigger.id, kind: 'rect' })} className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${drawing?.kind === 'rect' && drawing.triggerId === selectedTrigger.id ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100' : 'border-white/10 text-slate-300'}`}><Square className="h-3.5 w-3.5" />绘制矩形</button>{drawing && drawing.kind !== 'interaction-point' && <button type="button" onClick={onCancelDraw} className="rounded-lg border border-white/10 px-2 text-slate-400"><X className="h-3.5 w-3.5" /></button>}</div>

                <div className="mt-4 border-t border-white/8 pt-3"><div className="flex items-center justify-between"><h4 className="text-xs font-bold text-slate-300">动作序列</h4><button type="button" onClick={() => setPreview((value) => !value)} className="flex items-center gap-1 text-[11px] text-cyan-300"><Eye className="h-3.5 w-3.5" />{preview ? '关闭预览' : '预览'}</button></div>{selectedTrigger.actions.length === 0 ? <p className="mt-3 text-center text-xs text-slate-600">尚未添加动作</p> : <ol className="mt-2 space-y-1">{selectedTrigger.actions.map((action, index) => <li key={action.id} className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-2 py-2 text-xs"><span className="w-5 text-center text-slate-600">{index + 1}</span><span className="min-w-0 flex-1 truncate text-slate-300">{sceneActionSummary(action)}</span><button type="button" onClick={() => removeAction(scene.id, selectedTrigger.id, action.id)} className="text-slate-600 hover:text-red-300"><X className="h-3.5 w-3.5" /></button></li>)}</ol>}{preview && <div className="mt-2 rounded-lg border border-cyan-300/15 bg-cyan-500/[0.05] p-2 text-[11px] leading-5 text-cyan-100/80">触发后将按上方顺序执行；暂停模式下动作进入队列，可逐步执行。消息、讲义、日志、检定与已开始的战斗不可撤销。</div>}</div>

                <ActionBuilder
                  kind={actionKind} setKind={setActionKind} primary={primary} setPrimary={setPrimary} secondary={secondary} setSecondary={setSecondary}
                  handouts={journal.handouts.filter((handout) => scene.boundHandoutIds.length === 0 || scene.boundHandoutIds.includes(handout.id))}
                  doors={geometry?.doors ?? []} doorState={doorState} setDoorState={setDoorState} ambientLight={ambientLight} setAmbientLight={setAmbientLight}
                  fogOperation={fogOperation} setFogOperation={setFogOperation} cue={cue} setCue={setCue}
                  audioAssets={audioLibrary.assets} audioOperation={audioOperation} setAudioOperation={setAudioOperation} audioLoop={audioLoop} setAudioLoop={setAudioLoop} audioVolume={audioVolume} setAudioVolume={setAudioVolume}
                  maps={maps.filter((candidate) => candidate.id !== map.id)} targetMapId={targetMapId} setTargetMapId={setTargetMapId} targetX={targetX} setTargetX={setTargetX} targetY={targetY} setTargetY={setTargetY}
                  monsterQuery={monsterQuery} setMonsterQuery={setMonsterQuery} monsterResults={monsterResults} encounterEntries={encounterEntries} setEncounterEntries={setEncounterEntries} startInitiative={startInitiative} setStartInitiative={setStartInitiative}
                  onAdd={appendAction}
                />

                <div className="mt-4 flex items-center gap-2 border-t border-white/8 pt-3"><select value={manualTokenId} onChange={(event) => setManualTokenId(event.target.value)} className={`${fieldClass()} min-w-0 flex-1`}><option value="">无触发 Token</option>{map.tokens.filter((token) => token.type !== 'obstacle').map((token) => <option key={token.id} value={token.id}>{token.label}</option>)}</select><button type="button" onClick={() => onRunTrigger(scene.id, selectedTrigger.id, manualTokenId || undefined)} className="flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-white"><Play className="h-3.5 w-3.5" />触发</button></div>
              </section>}

              <section className="mt-4 rounded-xl border border-amber-300/15 bg-amber-500/[0.04] p-3"><div className="flex items-center gap-2"><button type="button" onClick={() => setPaused(!shared.runtime.paused)} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200">{shared.runtime.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{shared.runtime.paused ? '继续自动执行' : '暂停编排'}</button><button type="button" title={shared.runtime.paused ? '执行队列中的一个动作' : '请先暂停编排'} disabled={!shared.runtime.paused || shared.runtime.pendingRuns.length < 1} onClick={onStep} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-30"><FastForward className="h-3.5 w-3.5" />单步</button><button type="button" disabled={!reversibleHistory} onClick={onUndo} className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-30"><RotateCcw className="h-3.5 w-3.5" />撤销</button></div>{shared.runtime.lastError && <p className="mt-2 rounded-lg bg-red-500/10 px-2 py-2 text-xs text-red-200">已暂停：{shared.runtime.lastError}</p>}{shared.runtime.pendingRuns.length > 0 && <div className="mt-2 space-y-1">{shared.runtime.pendingRuns.map((run) => <div key={run.id} className="flex items-center gap-2 text-[11px] text-amber-100/80"><ChevronRight className="h-3 w-3" /><span className="min-w-0 flex-1 truncate">{run.token?.label ?? '手动'} · 动作 {run.nextActionIndex + 1}</span><button type="button" onClick={() => discardRun(run.id)} className="text-slate-500"><X className="h-3 w-3" /></button></div>)}</div>}<button type="button" onClick={() => clearReceipts(scene.id)} className="mt-3 text-[11px] text-slate-500 hover:text-slate-300">重置本场景“一次性”触发记录</button></section>
            </div>
          )}
        </aside>
      )}
    </>
  )
}

interface ActionBuilderProps {
  kind: ActionKind; setKind: (value: ActionKind) => void
  primary: string; setPrimary: (value: string) => void; secondary: string; setSecondary: (value: string) => void
  handouts: Array<{ id: string; title: string }>
  doors: Array<{ id: string; label: string }>; doorState: 'open' | 'closed' | 'locked'; setDoorState: (value: 'open' | 'closed' | 'locked') => void
  ambientLight: 'bright' | 'dim' | 'darkness'; setAmbientLight: (value: 'bright' | 'dim' | 'darkness') => void
  fogOperation: 'fill' | 'clear'; setFogOperation: (value: 'fill' | 'clear') => void
  cue: Exclude<SceneAudioCue, 'none'>; setCue: (value: Exclude<SceneAudioCue, 'none'>) => void
  audioAssets: SceneAudioAsset[]; audioOperation: 'play' | 'stop'; setAudioOperation: (value: 'play' | 'stop') => void
  audioLoop: boolean; setAudioLoop: (value: boolean) => void; audioVolume: number; setAudioVolume: (value: number) => void
  maps: BattleMap[]; targetMapId: string; setTargetMapId: (value: string) => void; targetX: number; setTargetX: (value: number) => void; targetY: number; setTargetY: (value: number) => void
  monsterQuery: string; setMonsterQuery: (value: string) => void
  monsterResults: ReturnType<typeof searchEnemyPool>; encounterEntries: Array<{ monsterId: string; name: string; quantity: number }>; setEncounterEntries: (value: Array<{ monsterId: string; name: string; quantity: number }>) => void
  startInitiative: boolean; setStartInitiative: (value: boolean) => void; onAdd: () => void
}

function ActionBuilder(props: ActionBuilderProps) {
  const input = fieldClass()
  return <div className="mt-4 rounded-xl border border-violet-300/12 bg-violet-500/[0.035] p-3"><div className="flex items-center gap-2"><select value={props.kind} onChange={(event) => { props.setKind(event.target.value as ActionKind); props.setPrimary(''); props.setSecondary('') }} className={`${input} flex-1`}>{Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={props.onAdd} className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />加入</button></div><div className="mt-2 space-y-2">
    {props.kind === 'reveal-handout' && <><select value={props.primary} onChange={(event) => props.setPrimary(event.target.value)} className={input}><option value="">选择已绑定讲义…</option>{props.handouts.map((handout) => <option key={handout.id} value={handout.id}>{handout.title}</option>)}</select><select value={props.secondary || 'all'} onChange={(event) => props.setSecondary(event.target.value)} className={input}><option value="all">展示给全体</option><option value="triggering-player">只展示给触发玩家</option></select></>}
    {props.kind === 'whisper' && <textarea rows={2} value={props.primary} onChange={(event) => props.setPrimary(event.target.value)} placeholder="只发送给触发 Token 所属玩家" className={input} />}
    {props.kind === 'door' && <div className="grid grid-cols-2 gap-2"><select value={props.primary} onChange={(event) => props.setPrimary(event.target.value)} className={input}><option value="">选择门…</option>{props.doors.map((door) => <option key={door.id} value={door.id}>{door.label}</option>)}</select><select value={props.doorState} onChange={(event) => props.setDoorState(event.target.value as typeof props.doorState)} className={input}><option value="open">开启</option><option value="closed">关闭</option><option value="locked">上锁</option></select></div>}
    {props.kind === 'light' && <select value={props.ambientLight} onChange={(event) => props.setAmbientLight(event.target.value as typeof props.ambientLight)} className={input}><option value="bright">明亮</option><option value="dim">昏暗</option><option value="darkness">黑暗</option></select>}
    {props.kind === 'fog' && <select value={props.fogOperation} onChange={(event) => props.setFogOperation(event.target.value as typeof props.fogOperation)} className={input}><option value="clear">清除全部迷雾</option><option value="fill">完全遮蔽地图</option></select>}
    {props.kind === 'sound' && <select value={props.cue} onChange={(event) => props.setCue(event.target.value as typeof props.cue)} className={input}>{Object.entries(AUDIO_LABELS).filter(([value]) => value !== 'none').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
    {props.kind === 'audio' && <><select value={props.audioOperation} onChange={(event) => props.setAudioOperation(event.target.value as 'play' | 'stop')} className={input}><option value="play">播放同步音频</option><option value="stop">停止当前同步音频</option></select>{props.audioOperation === 'play' && <><select value={props.primary} onChange={(event) => props.setPrimary(event.target.value)} className={input}><option value="">选择房间音频…</option>{props.audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select><label className="flex items-center gap-2 text-[11px] text-slate-400"><span>音量</span><input type="range" min={0} max={1} step={0.05} value={props.audioVolume} onChange={(event) => props.setAudioVolume(Number(event.target.value))} className="min-w-0 flex-1" /><span>{Math.round(props.audioVolume * 100)}%</span><input type="checkbox" checked={props.audioLoop} onChange={(event) => props.setAudioLoop(event.target.checked)} />循环</label></>}</>}
    {props.kind === 'teleport' && <><select value={props.targetMapId} onChange={(event) => props.setTargetMapId(event.target.value)} className={input}><option value="">选择目标地图/楼层…</option>{props.maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="number" value={props.targetX} onChange={(event) => props.setTargetX(Number(event.target.value) || 0)} placeholder="目标 X" className={input} /><input type="number" value={props.targetY} onChange={(event) => props.setTargetY(Number(event.target.value) || 0)} placeholder="目标 Y" className={input} /></div></>}
    {(props.kind === 'task' || props.kind === 'journal') && <><input value={props.primary} onChange={(event) => props.setPrimary(event.target.value)} placeholder={props.kind === 'task' ? '任务标题' : '日志标题'} className={input} /><textarea rows={2} value={props.secondary} onChange={(event) => props.setSecondary(event.target.value)} placeholder="内容" className={input} /></>}
    {props.kind === 'encounter' && <><input value={props.monsterQuery} onChange={(event) => props.setMonsterQuery(event.target.value)} placeholder="搜索 SRD 怪物中英文名称" className={input} />{props.monsterResults.length > 0 && <div className="max-h-28 overflow-auto rounded-lg border border-white/8 bg-void-950 p-1">{props.monsterResults.map((monster) => <button key={monster.id} type="button" onClick={() => { if (!props.encounterEntries.some((entry) => entry.monsterId === monster.id)) props.setEncounterEntries([...props.encounterEntries, { monsterId: monster.id, name: monster.name, quantity: 1 }]); props.setMonsterQuery('') }} className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5">{monster.name} · CR {monster.challengeRating ?? '—'}</button>)}</div>}<div className="space-y-1">{props.encounterEntries.map((entry) => <div key={entry.monsterId} className="flex items-center gap-2 text-xs text-slate-300"><span className="min-w-0 flex-1 truncate">{entry.name}</span><input type="number" min={1} max={50} value={entry.quantity} onChange={(event) => props.setEncounterEntries(props.encounterEntries.map((candidate) => candidate.monsterId === entry.monsterId ? { ...candidate, quantity: Math.max(1, Math.min(50, Number(event.target.value) || 1)) } : candidate))} className="w-16 rounded border border-white/10 bg-black/20 px-2 py-1" /><button type="button" onClick={() => props.setEncounterEntries(props.encounterEntries.filter((candidate) => candidate.monsterId !== entry.monsterId))}><X className="h-3.5 w-3.5" /></button></div>)}</div><label className="flex items-center gap-2 text-[11px] text-slate-400"><input type="checkbox" checked={props.startInitiative} onChange={(event) => props.setStartInitiative(event.target.checked)} />投放后立即开始先攻</label></>}
  </div></div>
}

function SceneAudioLibraryManager() {
  const inputRef = useRef<HTMLInputElement>(null)
  const library = useSceneAudioStore((state) => state.library)
  const playback = useSceneAudioStore((state) => state.playback)
  const upload = useSceneAudioStore((state) => state.upload)
  const remove = useSceneAudioStore((state) => state.remove)
  const control = useSceneAudioStore((state) => state.control)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SceneAudioKind>('ambience')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const importFile = async (file?: File) => {
    if (!file || busy) return
    setBusy(true)
    setError('')
    try {
      await upload(file, { name, kind })
      setName('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '音频导入失败。')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  return (
    <details className="mt-4 rounded-xl border border-cyan-300/12 bg-cyan-500/[0.025] p-3">
      <summary className="cursor-pointer text-xs font-bold text-cyan-100"><span className="inline-flex items-center gap-2"><Music2 className="h-4 w-4" />房间场景音频库 · {library.assets.length}</span></summary>
      <div className="mt-3 space-y-2">
        <input ref={inputRef} type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac,audio/webm,.mp3,.ogg,.wav,.m4a,.aac,.webm" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
        <div className="grid grid-cols-[1fr_90px_auto] gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="显示名称（可选）" className={fieldClass()} /><select value={kind} onChange={(event) => setKind(event.target.value as SceneAudioKind)} className={fieldClass()}><option value="ambience">环境音</option><option value="music">音乐</option><option value="sfx">音效</option></select><button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="flex items-center gap-1 rounded-lg bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-100 disabled:opacity-40"><Upload className="h-3.5 w-3.5" />{busy ? '导入中' : '导入'}</button></div>
        <p className="text-[10px] text-slate-600">单文件不超过 24 MiB；支持 MP3、Ogg、WAV、M4A、AAC、WebM。音频只存入当前房间。</p>
        {error && <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">{error}</p>}
        {library.assets.length > 0 && <div className="max-h-48 space-y-1 overflow-y-auto">{library.assets.map((asset) => <div key={asset.id} className="flex items-center gap-2 rounded-lg border border-white/6 bg-black/15 px-2 py-2 text-xs"><span className="min-w-0 flex-1"><span className="block truncate text-slate-200">{asset.name}</span><span className="text-[10px] text-slate-600">{asset.kind === 'music' ? '音乐' : asset.kind === 'ambience' ? '环境音' : '音效'} · {formatDuration(asset.durationSeconds)} · {(asset.sizeBytes / 1024 / 1024).toFixed(1)} MiB</span></span><button type="button" onClick={() => void control({ operation: 'play', assetId: asset.id, loop: asset.kind !== 'sfx', volume: 0.7 }).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))} className="rounded-lg p-2 text-cyan-200 hover:bg-white/5"><Play className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void remove(asset.id).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))} className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>{playback.assetId === asset.id && <span className="h-2 w-2 rounded-full bg-emerald-400" title="正在房间中播放" />}</div>)}</div>}
      </div>
    </details>
  )
}

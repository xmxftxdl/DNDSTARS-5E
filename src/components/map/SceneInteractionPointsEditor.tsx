import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Crosshair, MapPin, PackagePlus, Plus, Search, Trash2 } from 'lucide-react'
import { ABILITIES, SKILLS } from '../../lib/dnd'
import type {
  OrchestratedScene,
  SceneInteractionOutcomeEffect,
  SceneInteractionPoint,
} from '../../lib/sceneOrchestration'
import {
  DND5E_SRD_ITEM_TEMPLATES,
} from '../../rulesets/dnd5e/items'
import {
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginItems,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e/pluginApi'
import type { BattleMap } from '../../store/maps'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'
import { useRoomCommunicationsStore } from '../../store/roomCommunications'
import { DND5E_DAMAGE_TYPES } from '../../rulesets/dnd5e/damageTypes'
import {
  DND5E_STANDARD_CONDITIONS,
  DND5E_STANDARD_CONDITION_IDS,
} from '../../rulesets/dnd5e/conditions'
import {
  DND5E_EDITABLE_CURRENCIES,
  DND5E_EDITABLE_CURRENCY_LABELS,
} from '../../types/inventory'

const ICON_LABELS: Readonly<Record<SceneInteractionPoint['icon'], string>> = {
  bookshelf: '书柜',
  chest: '宝箱',
  search: '调查',
  altar: '祭坛',
  switch: '机关',
  custom: '自定义',
}

const REPEAT_LABELS: Readonly<Record<SceneInteractionPoint['repeat'], string>> = {
  once: '全房间仅一次',
  'per-character': '每个角色一次',
  always: '允许重复',
}

function fieldClass() {
  return 'w-full rounded-lg border border-white/10 bg-void-900 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-amber-300/40 disabled:cursor-not-allowed disabled:opacity-45'
}

function defaultCheck(point: SceneInteractionPoint): NonNullable<SceneInteractionPoint['check']> {
  return point.check ?? {
    label: '智力（调查）检定',
    selection: 'skill:investigation',
    dc: 12,
    mode: 'normal',
  }
}

const DAMAGE_TYPE_LABELS: Readonly<Record<(typeof DND5E_DAMAGE_TYPES)[number], string>> = {
  acid: '强酸',
  bludgeoning: '钝击',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
}

function outcomeEffect(
  kind: SceneInteractionOutcomeEffect['kind'],
  input: {
    firstHandoutId?: string
  },
): SceneInteractionOutcomeEffect | null {
  const id = crypto.randomUUID()
  if (kind === 'currency') return { id, kind, currency: 'gp', amount: 1 }
  if (kind === 'handout') {
    return input.firstHandoutId
      ? { id, kind, handoutId: input.firstHandoutId, audience: 'triggering-player' }
      : null
  }
  if (kind === 'task') {
    return { id, kind, operation: 'add', title: '新任务', body: '' }
  }
  if (kind === 'damage') {
    return { id, kind, count: 1, sides: 6, bonus: 0, damageType: 'piercing' }
  }
  return { id, kind, condition: 'poisoned', duration: { type: 'rounds', rounds: 1 } }
}

function OutcomeEffectsEditor({
  title,
  effects,
  disabled,
  onChange,
}: {
  title: string
  effects: SceneInteractionOutcomeEffect[]
  disabled: boolean
  onChange: (effects: SceneInteractionOutcomeEffect[]) => void
}) {
  const journal = useRoomCommunicationsStore((state) => state.journal)
  const tasks = journal.sharedNotes.filter((note) => note.kind === 'task')
  const update = (index: number, patch: Partial<SceneInteractionOutcomeEffect>) => {
    onChange(effects.map((effect, effectIndex) =>
      effectIndex === index ? { ...effect, ...patch } as SceneInteractionOutcomeEffect : effect))
  }
  const add = (kind: SceneInteractionOutcomeEffect['kind']) => {
    const next = outcomeEffect(kind, {
      firstHandoutId: journal.handouts[0]?.id,
    })
    if (next) onChange([...effects, next])
  }
  return (
    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-300">{title}</h4>
          <p className="mt-0.5 text-[10px] text-slate-600">按列表顺序执行；所有骰子和目标状态均由 Host 校验。</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {([
            ['currency', '金币'],
            ['handout', '讲义'],
            ['task', '任务'],
            ['damage', '伤害'],
            ['condition', '状态'],
          ] as const).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              disabled={disabled || effects.length >= 24 || (kind === 'handout' && journal.handouts.length < 1)}
              onClick={() => add(kind)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:border-amber-300/30 hover:text-amber-100 disabled:opacity-35"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>
      {effects.length === 0 ? (
        <p className="mt-3 text-center text-[11px] text-slate-600">没有额外结果动作。</p>
      ) : (
        <div className="mt-3 space-y-2">
          {effects.map((effect, index) => (
            <div key={effect.id} className="rounded-lg border border-white/8 bg-void-950/60 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70">
                  {index + 1}. {effect.kind === 'currency' ? '金币' : effect.kind === 'handout' ? '讲义' : effect.kind === 'task' ? '任务' : effect.kind === 'damage' ? '陷阱伤害' : '状态效果'}
                </span>
                <div className="flex gap-1">
                  <button type="button" disabled={disabled || index === 0} onClick={() => {
                    const next = [...effects]
                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                    onChange(next)
                  }} className="rounded px-1.5 text-xs text-slate-500 disabled:opacity-25" aria-label="上移结果动作">↑</button>
                  <button type="button" disabled={disabled || index === effects.length - 1} onClick={() => {
                    const next = [...effects]
                    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                    onChange(next)
                  }} className="rounded px-1.5 text-xs text-slate-500 disabled:opacity-25" aria-label="下移结果动作">↓</button>
                  <button type="button" disabled={disabled} onClick={() => onChange(effects.filter((_, effectIndex) => effectIndex !== index))} className="rounded p-1 text-slate-600 hover:text-red-300 disabled:opacity-25" aria-label="删除结果动作"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {effect.kind === 'currency' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={effect.currency} disabled={disabled} onChange={(event) => update(index, { currency: event.target.value as typeof effect.currency })} className={fieldClass()}>
                    {DND5E_EDITABLE_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>{DND5E_EDITABLE_CURRENCY_LABELS[currency]}</option>
                    ))}
                  </select>
                  <input type="number" min={1} max={1_000_000} value={effect.amount} disabled={disabled} onChange={(event) => update(index, { amount: Math.max(1, Math.min(1_000_000, Math.floor(Number(event.target.value) || 1))) })} className={fieldClass()} aria-label="金币数量" />
                </div>
              )}
              {effect.kind === 'handout' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={effect.handoutId} disabled={disabled} onChange={(event) => update(index, { handoutId: event.target.value })} className={fieldClass()}>
                    {journal.handouts.map((handout) => <option key={handout.id} value={handout.id}>{handout.title}</option>)}
                  </select>
                  <select value={effect.audience} disabled={disabled} onChange={(event) => update(index, { audience: event.target.value as typeof effect.audience })} className={fieldClass()}>
                    <option value="triggering-player">只给触发玩家</option><option value="all">给全体玩家</option>
                  </select>
                </div>
              )}
              {effect.kind === 'task' && (
                <div className="space-y-2">
                  <select value={effect.operation} disabled={disabled} onChange={(event) => {
                    const operation = event.target.value as typeof effect.operation
                    update(index, {
                      operation,
                      ...(operation === 'complete'
                        ? { taskId: effect.taskId ?? tasks[0]?.id ?? '', title: '', body: '' }
                        : { taskId: undefined, title: effect.title || '新任务' }),
                    })
                  }} className={fieldClass()}>
                    <option value="add">新增任务</option><option value="complete">完成已有任务</option>
                  </select>
                  {effect.operation === 'complete' ? (
                    <select value={effect.taskId ?? ''} disabled={disabled || tasks.length < 1} onChange={(event) => update(index, { taskId: event.target.value })} className={fieldClass()}>
                      <option value="">选择任务…</option>
                      {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                    </select>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={effect.title} maxLength={120} disabled={disabled} onChange={(event) => update(index, { title: event.target.value })} className={fieldClass()} placeholder="任务标题" />
                      <input value={effect.body} maxLength={4_000} disabled={disabled} onChange={(event) => update(index, { body: event.target.value })} className={fieldClass()} placeholder="任务说明" />
                    </div>
                  )}
                </div>
              )}
              {effect.kind === 'damage' && (
                <div className="grid gap-2 sm:grid-cols-4">
                  <input type="number" min={1} max={40} value={effect.count} disabled={disabled} onChange={(event) => update(index, { count: Math.max(1, Math.min(40, Math.floor(Number(event.target.value) || 1))) })} className={fieldClass()} aria-label="伤害骰数量" />
                  <select value={effect.sides} disabled={disabled} onChange={(event) => update(index, { sides: Number(event.target.value) })} className={fieldClass()}>
                    {[4, 6, 8, 10, 12, 20, 100].map((sides) => <option key={sides} value={sides}>d{sides}</option>)}
                  </select>
                  <input type="number" min={-1_000} max={1_000} value={effect.bonus} disabled={disabled} onChange={(event) => update(index, { bonus: Math.max(-1_000, Math.min(1_000, Math.floor(Number(event.target.value) || 0))) })} className={fieldClass()} aria-label="伤害调整值" />
                  <select value={effect.damageType} disabled={disabled} onChange={(event) => update(index, { damageType: event.target.value as typeof effect.damageType })} className={fieldClass()}>
                    {DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{DAMAGE_TYPE_LABELS[type]}</option>)}
                  </select>
                </div>
              )}
              {effect.kind === 'condition' && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <select value={effect.condition} disabled={disabled} onChange={(event) => update(index, { condition: event.target.value as typeof effect.condition })} className={fieldClass()}>
                    {DND5E_STANDARD_CONDITION_IDS.map((condition) => <option key={condition} value={condition}>{DND5E_STANDARD_CONDITIONS[condition].label}</option>)}
                  </select>
                  <select value={effect.duration.type} disabled={disabled} onChange={(event) => update(index, {
                    duration: event.target.value === 'permanent' ? { type: 'permanent' } : { type: 'rounds', rounds: 1 },
                  })} className={fieldClass()}>
                    <option value="rounds">固定轮数</option><option value="permanent">永久，直到移除</option>
                  </select>
                  {effect.duration.type === 'rounds' && (
                    <input type="number" min={1} max={10_000} value={effect.duration.rounds} disabled={disabled} onChange={(event) => update(index, { duration: { type: 'rounds', rounds: Math.max(1, Math.min(10_000, Math.floor(Number(event.target.value) || 1))) } })} className={fieldClass()} aria-label="状态持续轮数" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SceneInteractionPointsEditor({
  map,
  scene,
  combatActive,
  placingInteractionPointId,
  onBeginPlace,
  onCancelPlace,
}: {
  map: BattleMap
  scene: OrchestratedScene
  combatActive: boolean
  placingInteractionPointId?: string | null
  onBeginPlace: (interactionPointId: string) => void
  onCancelPlace: () => void
}) {
  const addInteractionPoint = useSceneOrchestrationStore((state) => state.addInteractionPoint)
  const updateInteractionPoint = useSceneOrchestrationStore((state) => state.updateInteractionPoint)
  const removeInteractionPoint = useSceneOrchestrationStore((state) => state.removeInteractionPoint)
  const loadJournal = useRoomCommunicationsStore((state) => state.loadJournal)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [itemFilter, setItemFilter] = useState('')
  const pluginRegistryRevision = useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )

  useEffect(() => {
    void loadJournal().catch(() => undefined)
  }, [loadJournal])

  const selected = scene.interactionPoints.find((point) => point.id === selectedId) ??
    scene.interactionPoints[0]
  const allItems = useMemo(() => {
    const byId = new Map(
      [...DND5E_SRD_ITEM_TEMPLATES, ...registeredDnd5ePluginItems()]
        .map((item) => [item.id, item] as const),
    )
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }, [pluginRegistryRevision])
  const query = itemFilter.trim().toLocaleLowerCase('zh-CN')
  const filteredItems = allItems.filter((item) =>
    !query ||
    item.name.toLocaleLowerCase('zh-CN').includes(query) ||
    item.englishName?.toLocaleLowerCase('en').includes(query),
  )

  const updateSelected = (patch: Partial<Omit<SceneInteractionPoint, 'id'>>) => {
    if (!selected || combatActive) return
    updateInteractionPoint(scene.id, selected.id, patch)
  }

  const updateCheck = (patch: Partial<NonNullable<SceneInteractionPoint['check']>>) => {
    if (!selected) return
    updateSelected({ check: { ...defaultCheck(selected), ...patch } })
  }

  const updateReward = (
    index: number,
    patch: Partial<SceneInteractionPoint['rewards'][number]>,
  ) => {
    if (!selected) return
    updateSelected({
      rewards: selected.rewards.map((reward, rewardIndex) =>
        rewardIndex === index ? { ...reward, ...patch } : reward),
    })
  }

  const addPoint = () => {
    if (combatActive) return
    const id = addInteractionPoint(scene.id, { x: map.width / 2, y: map.height / 2 })
    setSelectedId(id)
    onBeginPlace(id)
  }

  return (
    <section
      className="mt-4 rounded-xl border border-amber-300/15 bg-amber-500/[0.035] p-3"
      data-testid="scene-interaction-points-editor"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-100">
            <MapPin className="h-4 w-4" />
            地图互动点
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            玩家点击图标后，由 DM Host 校验距离、角色归属、检定和奖励；玩家端不会收到 DC 或物品配置。
          </p>
        </div>
        <button
          type="button"
          disabled={combatActive}
          onClick={addPoint}
          className="flex items-center gap-1 rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          添加互动点
        </button>
      </div>

      {combatActive && (
        <p className="mt-3 rounded-lg border border-amber-300/15 bg-black/20 px-3 py-2 text-[11px] text-amber-100/70">
          战斗进行中只允许玩家使用已有互动点；结束战斗后才能修改配置。
        </p>
      )}

      {scene.interactionPoints.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/8 py-6 text-center text-xs text-slate-600">
          尚未添加互动点。可以先建立“书柜”，再在地图上点击放置。
        </p>
      ) : (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {scene.interactionPoints.map((point) => (
              <button
                key={point.id}
                type="button"
                onClick={() => setSelectedId(point.id)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-xs ${
                  selected?.id === point.id
                    ? 'border-amber-300/40 bg-amber-500/15 text-amber-50'
                    : 'border-white/8 text-slate-500'
                }`}
              >
                {point.enabled ? '●' : '○'} {point.name}
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-3 space-y-3 rounded-xl border border-white/8 bg-black/15 p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
                <input
                  value={selected.name}
                  maxLength={160}
                  disabled={combatActive}
                  onChange={(event) => updateSelected({ name: event.target.value })}
                  className={fieldClass()}
                  aria-label="互动点名称"
                />
                <select
                  value={selected.icon}
                  disabled={combatActive}
                  onChange={(event) => updateSelected({
                    icon: event.target.value as SceneInteractionPoint['icon'],
                  })}
                  className={fieldClass()}
                  aria-label="互动点图标"
                >
                  {Object.entries(ICON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={combatActive}
                  onClick={() => placingInteractionPointId === selected.id
                    ? onCancelPlace()
                    : onBeginPlace(selected.id)}
                  className="flex items-center justify-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  {placingInteractionPointId === selected.id ? '取消放置' : '地图放置'}
                </button>
                <button
                  type="button"
                  disabled={combatActive}
                  onClick={() => {
                    removeInteractionPoint(scene.id, selected.id)
                    setSelectedId(null)
                    if (placingInteractionPointId === selected.id) onCancelPlace()
                  }}
                  className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                  aria-label="删除互动点"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                <label className="text-[11px] text-slate-500">
                  检定
                  <select
                    value={defaultCheck(selected).selection}
                    disabled={combatActive}
                    onChange={(event) => {
                      const selection = event.target.value as NonNullable<SceneInteractionPoint['check']>['selection']
                      const skill = SKILLS.find((entry) => `skill:${entry.key}` === selection)
                      const ability = ABILITIES.find((entry) => `ability:${entry.key}` === selection)
                      updateCheck({
                        selection,
                        label: skill ? `${skill.label}检定` : `${ability?.label ?? '属性'}检定`,
                      })
                    }}
                    className={`mt-1 ${fieldClass()}`}
                  >
                    <optgroup label="技能">
                      {SKILLS.map((skill) => (
                        <option key={skill.key} value={`skill:${skill.key}`}>{skill.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="属性">
                      {ABILITIES.map((ability) => (
                        <option key={ability.key} value={`ability:${ability.key}`}>{ability.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="text-[11px] text-slate-500">
                  DC
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={combatActive}
                    value={defaultCheck(selected).dc}
                    onChange={(event) => updateCheck({
                      dc: Math.max(0, Math.min(100, Math.floor(Number(event.target.value) || 0))),
                    })}
                    className={`mt-1 ${fieldClass()}`}
                  />
                </label>
                <label className="text-[11px] text-slate-500">
                  掷骰方式
                  <select
                    value={defaultCheck(selected).mode}
                    disabled={combatActive}
                    onChange={(event) => updateCheck({
                      mode: event.target.value as NonNullable<SceneInteractionPoint['check']>['mode'],
                    })}
                    className={`mt-1 ${fieldClass()}`}
                  >
                    <option value="normal">正常</option>
                    <option value="advantage">优势</option>
                    <option value="disadvantage">劣势</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-500">
                  交互距离（尺）
                  <input
                    type="number"
                    min={5}
                    max={120}
                    step={5}
                    disabled={combatActive}
                    value={selected.interactionRadiusFeet}
                    onChange={(event) => updateSelected({
                      interactionRadiusFeet: Math.max(5, Math.min(120, Number(event.target.value) || 5)),
                    })}
                    className={`mt-1 ${fieldClass()}`}
                  />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-[11px] text-slate-500">
                  使用限制
                  <select
                    value={selected.repeat}
                    disabled={combatActive}
                    onChange={(event) => updateSelected({
                      repeat: event.target.value as SceneInteractionPoint['repeat'],
                    })}
                    className={`mt-1 ${fieldClass()}`}
                  >
                    {Object.entries(REPEAT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    disabled={combatActive}
                    onChange={(event) => updateSelected({ enabled: event.target.checked })}
                  />
                  启用互动
                </label>
                <label className="flex items-end gap-2 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selected.visibleToPlayers}
                    disabled={combatActive}
                    onChange={(event) => updateSelected({ visibleToPlayers: event.target.checked })}
                  />
                  对玩家显示
                </label>
              </div>

              <p className="text-[10px] text-slate-600">
                地图坐标：{Math.round(selected.x)}, {Math.round(selected.y)}
              </p>

              <label className="block text-[11px] text-slate-500">
                点击提示
                <textarea
                  rows={2}
                  value={selected.prompt}
                  maxLength={1_000}
                  disabled={combatActive}
                  onChange={(event) => updateSelected({ prompt: event.target.value })}
                  className={`mt-1 resize-y ${fieldClass()}`}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-[11px] text-slate-500">
                  成功结果
                  <textarea
                    rows={2}
                    value={selected.successText}
                    maxLength={1_000}
                    disabled={combatActive}
                    onChange={(event) => updateSelected({ successText: event.target.value })}
                    className={`mt-1 resize-y ${fieldClass()}`}
                  />
                </label>
                <label className="text-[11px] text-slate-500">
                  失败结果
                  <textarea
                    rows={2}
                    value={selected.failureText}
                    maxLength={1_000}
                    disabled={combatActive}
                    onChange={(event) => updateSelected({ failureText: event.target.value })}
                    className={`mt-1 resize-y ${fieldClass()}`}
                  />
                </label>
              </div>

              <div className="border-t border-white/8 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">成功奖励</h4>
                    <p className="mt-0.5 text-[10px] text-slate-600">检定成功后直接写入执行检定角色的库存。</p>
                  </div>
                  <button
                    type="button"
                    disabled={combatActive || selected.rewards.length >= 12 || allItems.length < 1}
                    onClick={() => updateSelected({
                      rewards: [...selected.rewards, {
                        templateId: allItems.find((item) => item.id === 'srd-5.1:item:potion-of-healing')?.id ??
                          allItems[0].id,
                        quantity: 1,
                        identified: true,
                      }],
                    })}
                    className="flex items-center gap-1 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-40"
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    添加奖励
                  </button>
                </div>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-600" />
                  <input
                    value={itemFilter}
                    onChange={(event) => setItemFilter(event.target.value)}
                    placeholder="筛选物品名称"
                    className={`${fieldClass()} pl-8`}
                  />
                </div>
                {selected.rewards.length === 0 ? (
                  <p className="mt-2 text-center text-[11px] text-slate-600">成功时只显示结果文字，不发放物品。</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selected.rewards.map((reward, index) => {
                      const choices = filteredItems.some((item) => item.id === reward.templateId)
                        ? filteredItems
                        : [
                            ...allItems.filter((item) => item.id === reward.templateId),
                            ...filteredItems,
                          ]
                      const item = allItems.find((candidate) => candidate.id === reward.templateId)
                      return (
                        <div
                          key={`${reward.templateId}:${index}`}
                          className="grid gap-2 rounded-lg border border-white/8 bg-black/20 p-2 sm:grid-cols-[minmax(0,1fr)_80px_auto_auto]"
                        >
                          <select
                            value={reward.templateId}
                            disabled={combatActive}
                            onChange={(event) => updateReward(index, { templateId: event.target.value })}
                            className={fieldClass()}
                          >
                            {choices.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}{candidate.englishName ? ` · ${candidate.englishName}` : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={reward.quantity}
                            disabled={combatActive}
                            onChange={(event) => updateReward(index, {
                              quantity: Math.max(1, Math.min(999, Math.floor(Number(event.target.value) || 1))),
                            })}
                            className={fieldClass()}
                            aria-label="奖励数量"
                          />
                          <label className="flex items-center gap-1 px-1 text-[11px] text-slate-400">
                            <input
                              type="checkbox"
                              checked={reward.identified}
                              disabled={combatActive || !item?.magicItem}
                              onChange={(event) => updateReward(index, { identified: event.target.checked })}
                            />
                            已鉴定
                          </label>
                          <button
                            type="button"
                            disabled={combatActive}
                            onClick={() => updateSelected({
                              rewards: selected.rewards.filter((_, rewardIndex) => rewardIndex !== index),
                            })}
                            className="rounded-lg p-2 text-slate-600 hover:text-red-300 disabled:opacity-40"
                            aria-label="删除奖励"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="grid gap-3 border-t border-white/8 pt-3 xl:grid-cols-2">
                <OutcomeEffectsEditor
                  title="成功后的有序结果"
                  effects={selected.successEffects}
                  disabled={combatActive}
                  onChange={(successEffects) => updateSelected({ successEffects })}
                />
                <OutcomeEffectsEditor
                  title="失败后的有序结果"
                  effects={selected.failureEffects}
                  disabled={combatActive}
                  onChange={(failureEffects) => updateSelected({ failureEffects })}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Hammer, Search, Skull, Swords, X } from 'lucide-react'
import {
  DND5E_SRD_ENEMY_POOL,
  searchEnemyPool,
  selectNextEnemyVisualVariantId,
  type EnemyTemplate,
} from '../../lib/enemyPool'
import { useCustomMonsterStore } from '../../store/customMonsters'
import Dnd5eEncounterBuilderDialog from './Dnd5eEncounterBuilderDialog'
import type { Dnd5eEncounterEntry } from '../../rulesets/dnd5e/encounterBuilder'
import {
  registeredDnd5ePluginMonsters,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e/pluginApi'
import Dnd5eMonsterWorkshopDialog from './Dnd5eMonsterWorkshopDialog'
import { composeDnd5eEnemyPool } from './enemyPoolComposition'

function EnemyPoolThumbnail({ monster }: { monster: EnemyTemplate }) {
  const [failedSource, setFailedSource] = useState<string>()
  const portrait = monster.tokenPortrait
  const showPortrait = !!portrait && failedSource !== portrait

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-void-900 text-xl"
      style={{ borderColor: monster.color }}
    >
      {showPortrait ? (
        <img
          src={portrait}
          alt={`${monster.name} Token`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedSource(portrait)}
        />
      ) : monster.emoji}
    </span>
  )
}

export default function EnemyPoolPicker({
  open,
  title = '怪物池',
  hint,
  canManageCustom = false,
  onClose,
  onPick,
  onBuildEncounter,
  enableAutomaticAppearanceSelection = false,
  getUsedVisualVariantIds,
}: {
  open: boolean
  title?: string
  hint?: string
  canManageCustom?: boolean
  onClose: () => void
  onPick: (template: EnemyTemplate) => void
  onBuildEncounter?: (entries: readonly Dnd5eEncounterEntry[]) => void
  enableAutomaticAppearanceSelection?: boolean
  getUsedVisualVariantIds?: (template: EnemyTemplate) => readonly (string | undefined)[]
}) {
  const [query, setQuery] = useState('')
  const [autoSelectNextAppearance, setAutoSelectNextAppearance] = useState(false)
  const [encounterOpen, setEncounterOpen] = useState(false)
  const [monsterWorkshopOpen, setMonsterWorkshopOpen] = useState(false)
  const [appearanceTarget, setAppearanceTarget] = useState<EnemyTemplate>()
  const customMonsters = useCustomMonsterStore((state) => state.monsters)
  const customMonstersLoaded = useCustomMonsterStore((state) => state.loaded)
  const [customMonsterLoadError, setCustomMonsterLoadError] = useState<string>()
  const [pluginMonsters, setPluginMonsters] = useState(() => registeredDnd5ePluginMonsters())
  useEffect(() => subscribeDnd5eRulesPluginRegistry(() => {
    setPluginMonsters(registeredDnd5ePluginMonsters())
  }), [])
  useEffect(() => {
    if (!open) return
    let active = true
    void useCustomMonsterStore.getState().loadShared().then(() => {
      if (active) setCustomMonsterLoadError(undefined)
    }).catch((error) => {
      if (active) setCustomMonsterLoadError(error instanceof Error ? error.message : String(error))
    })
    return () => {
      active = false
    }
  }, [open])
  const pool = useMemo(
    () => composeDnd5eEnemyPool(customMonsters, pluginMonsters),
    [customMonsters, pluginMonsters],
  )

  const allResults = useMemo(() => searchEnemyPool(query, pool), [pool, query])
  const results = allResults

  if (!open) return null

  const closePicker = () => {
    setAppearanceTarget(undefined)
    onClose()
  }

  const finishPick = (template: EnemyTemplate, visualVariantId?: string) => {
    onPick({ ...template, visualVariantId })
    setAppearanceTarget(undefined)
    setQuery('')
    onClose()
  }

  return <>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={closePicker}
    >
      <div
        className="glass flex max-h-[min(640px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Skull className="h-5 w-5 shrink-0 text-rose-400" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            {hint && <p className="text-xs text-slate-500">{hint}</p>}
          </div>
          {canManageCustom && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMonsterWorkshopOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-arcane-500/15 px-2.5 py-1.5 text-xs font-semibold text-arcane-100 hover:bg-arcane-500/25"
            >
              <Hammer className="h-3.5 w-3.5" />
              房间怪物工坊
            </button>
            <button
              type="button"
              onClick={() => setEncounterOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
            >
              <Swords className="h-3.5 w-3.5" />
              遭遇构建
            </button>
          </div>}
          <button
            type="button"
            onClick={closePicker}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称、标签或描述…"
              className="w-full rounded-xl border border-white/10 bg-void-900/80 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-arcane-500"
            />
          </div>
          {enableAutomaticAppearanceSelection && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06]">
              <input
                type="checkbox"
                checked={autoSelectNextAppearance}
                onChange={(event) => setAutoSelectNextAppearance(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-200">自动选择下一张不同立绘</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  勾选后不再询问立绘，优先使用当前地图中尚未添加的形象；全部用过后按顺序循环。
                </span>
              </span>
            </label>
          )}
          <p className="mt-2 text-xs text-slate-500">
            SRD 5.1：{DND5E_SRD_ENEMY_POOL.length} · 房间怪物：{customMonsters.length}
            {' '}· 扩展怪物：{pluginMonsters.length} · 显示 {results.length}/{allResults.length} 项
          </p>
          {!customMonstersLoaded && <p className="mt-1 text-xs text-cyan-200">正在恢复当前房间的怪物目录…</p>}
          {customMonsterLoadError && (
            <p className="mt-1 text-xs text-rose-300">房间怪物目录恢复失败：{customMonsterLoadError}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">没有匹配的怪物</p>
          ) : (
            <ul className="space-y-1">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if ((m.visualVariants?.length ?? 0) > 1) {
                        if (enableAutomaticAppearanceSelection && autoSelectNextAppearance) {
                          finishPick(
                            m,
                            selectNextEnemyVisualVariantId(m, getUsedVisualVariantIds?.(m) ?? []),
                          )
                          return
                        }
                        setAppearanceTarget(m)
                        return
                      }
                      finishPick(m)
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-rose-500/30 hover:bg-rose-500/10"
                  >
                    <EnemyPoolThumbnail monster={m} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-100">{m.name}</span>
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-rose-200">
                          HP {m.maxHp}
                        </span>
                        {m.armorClass != null && (
                          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-200">
                            AC {m.armorClass}
                          </span>
                        )}
                        {m.challengeRating && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200">
                            CR {m.challengeRating}
                          </span>
                        )}
                        {m.size != null && m.size !== 1 && (
                          <span className="text-[10px] text-slate-500">{m.size}× 体型</span>
                        )}
                      </div>
                      {m.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{m.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
    {appearanceTarget && (
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        onClick={() => setAppearanceTarget(undefined)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`选择${appearanceTarget.name}形象`}
          className="glass flex max-h-[min(760px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
            <Skull className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-100">选择{appearanceTarget.name}形象</h2>
              <p className="mt-1 text-xs text-slate-500">地图 Token 与先攻头像会使用同一套形象；每次放置都可重新选择。</p>
            </div>
            <button
              type="button"
              onClick={() => setAppearanceTarget(undefined)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="返回怪物列表"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {appearanceTarget.visualVariants?.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => finishPick(appearanceTarget, variant.id)}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left transition hover:border-emerald-300/60 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <div className="aspect-[288/376] overflow-hidden bg-void-950">
                    <img
                      src={variant.initiativePortrait}
                      alt={`${appearanceTarget.name}·${variant.label}`}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <img
                      src={variant.tokenPortrait}
                      alt=""
                      aria-hidden="true"
                      className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover"
                      loading="lazy"
                    />
                    <span className="min-w-0 text-xs font-semibold text-slate-200">{variant.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    <Dnd5eEncounterBuilderDialog
      open={encounterOpen}
      pool={pool}
      onClose={() => setEncounterOpen(false)}
      onConfirm={(entries) => {
        onBuildEncounter?.(entries)
        setEncounterOpen(false)
        closePicker()
      }}
    />
    {monsterWorkshopOpen && (
      <Dnd5eMonsterWorkshopDialog
        open
        context="room"
        draftStorageScope="map-room-monsters"
        onClose={() => setMonsterWorkshopOpen(false)}
      />
    )}
  </>
}

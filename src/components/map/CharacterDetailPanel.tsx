import { useEffect, useRef, useState } from 'react'
import { X, Shield, Footprints, HeartPulse, Sparkles, Trash2 } from 'lucide-react'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { ABILITIES, abilityMod, formatMod } from '../../lib/dnd'
import { getAc } from '../../lib/combatStats'
import Dnd5eConditionEditor, { Dnd5eConditionTags } from './Dnd5eConditionEditor'
import type { Dnd5eActiveEffectInstance } from '../../rulesets/dnd5e/activeEffects'
import { parseLiveHitPointDraft, resolveHitPointDisplay } from './characterHitPoints'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import {
  closeCharacterDetailOnPrimaryPointerDown,
  shouldCloseCharacterDetailForKey,
} from './characterDetailClose'
import { showAppConfirm } from '../../lib/appDialog'

interface CharacterDetailPanelProps {
  token: Token
  character: Character
  onSetHitPoints: (input: {
    currentHp: number
    maxHp: number
    temporaryHp: number
    manuallySetMaximum: boolean
  }) => void | Promise<unknown>
  isDM?: boolean
  canManageConditions?: boolean
  onConditionsChange?: (conditions: string[], activeEffects: Dnd5eActiveEffectInstance[]) => void
  conditionSourceOptions?: readonly { id: string; label: string }[]
  onRemoveFromMap?: () => void | Promise<void>
  onClose: () => void
}

export default function CharacterDetailPanel({
  token,
  character,
  onSetHitPoints,
  isDM = false,
  canManageConditions = false,
  onConditionsChange,
  conditionSourceOptions,
  onRemoveFromMap,
  onClose,
}: CharacterDetailPanelProps) {
  const portrait = resolveMapTokenPortrait(character, token)
  const tempHp = character.tempHp ?? 0
  const [currentHpDraft, setCurrentHpDraft] = useState(String(character.currentHp))
  const [maxHpDraft, setMaxHpDraft] = useState(String(character.maxHp))
  const [editingCurrentHp, setEditingCurrentHp] = useState(false)
  const [editingMaxHp, setEditingMaxHp] = useState(false)
  const [removingFromMap, setRemovingFromMap] = useState(false)
  const [removeFromMapError, setRemoveFromMapError] = useState<string>()
  const [pendingHitPoints, setPendingHitPoints] = useState<{
    currentHp: number
    maxHp: number
  } | null>(null)
  const hitPointRequestIdRef = useRef(0)
  const submittedHitPointsRef = useRef<{ currentHp: number; maxHp: number } | null>(null)
  const displayedHitPoints = resolveHitPointDisplay({
    currentHp: character.currentHp,
    maxHp: character.maxHp,
    currentHpDraft,
    maxHpDraft,
    editingCurrentHp,
    editingMaxHp,
    pending: pendingHitPoints,
  })
  const defeated = displayedHitPoints.currentHp <= 0
  const setHp = (hp: number, maxHp = character.maxHp, manuallySetMaximum = false) => {
    if (!isDM) return
    const nextHp = Math.max(0, Math.min(maxHp, hp))
    const submitted = submittedHitPointsRef.current
    if (submitted?.currentHp === nextHp && submitted.maxHp === maxHp) return
    const requestId = ++hitPointRequestIdRef.current
    submittedHitPointsRef.current = { currentHp: nextHp, maxHp }
    setPendingHitPoints({ currentHp: nextHp, maxHp })
    const result = onSetHitPoints({
      currentHp: nextHp,
      maxHp,
      temporaryHp: character.tempHp,
      manuallySetMaximum,
    })
    if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') {
      if (hitPointRequestIdRef.current === requestId) {
        submittedHitPointsRef.current = null
        setPendingHitPoints(null)
      }
      return
    }
    const clearPendingRequest = () => {
      if (hitPointRequestIdRef.current === requestId) {
        submittedHitPointsRef.current = null
        setPendingHitPoints(null)
      }
    }
    void Promise.resolve(result).then(clearPendingRequest, clearPendingRequest)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldCloseCharacterDetailForKey(event.key)) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const commitCurrentHp = () => {
    const nextHp = parseLiveHitPointDraft(currentHpDraft, character.maxHp) ?? character.currentHp
    setEditingCurrentHp(false)
    setCurrentHpDraft(String(nextHp))
    const changed =
      nextHp !== character.currentHp ||
      token.hp !== nextHp ||
      token.maxHp !== character.maxHp
    if (changed) setHp(nextHp)
  }

  const updateCurrentHpDraft = (draft: string) => {
    setCurrentHpDraft(draft)
    const nextHp = parseLiveHitPointDraft(draft, character.maxHp)
    if (nextHp == null) return
    const changed =
      nextHp !== character.currentHp ||
      token.hp !== nextHp ||
      token.maxHp !== character.maxHp
    if (changed) setHp(nextHp)
  }

  const updateMaxHpDraft = (draft: string) => {
    setMaxHpDraft(draft)
    if (draft.trim() === '') return
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) return
    const nextMaxHp = Math.max(1, Math.floor(parsed))
    const nextCurrentHp = Math.min(displayedHitPoints.currentHp, nextMaxHp)
    if (
      nextMaxHp !== character.maxHp ||
      nextCurrentHp !== character.currentHp ||
      token.maxHp !== nextMaxHp ||
      token.hp !== nextCurrentHp
    ) setHp(nextCurrentHp, nextMaxHp, true)
  }

  const commitMaxHp = () => {
    const parsed = Number(maxHpDraft)
    const nextMaxHp = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : character.maxHp
    const nextCurrentHp = Math.min(character.currentHp, nextMaxHp)
    setEditingMaxHp(false)
    setMaxHpDraft(String(nextMaxHp))
    setCurrentHpDraft(String(nextCurrentHp))
    if (nextMaxHp !== character.maxHp || nextCurrentHp !== character.currentHp) {
      setHp(nextCurrentHp, nextMaxHp, true)
    }
  }

  const removeFromMap = async () => {
    if (!isDM || !onRemoveFromMap || removingFromMap) return
    if (!await showAppConfirm({
      title: '移除冒险者标记',
      message: `从当前地图移除“${character.name}”的 Token？人物卡、装备和角色数据都会保留，之后可以重新放置。`,
      confirmLabel: '移除标记',
      tone: 'danger',
    })) return
    setRemovingFromMap(true)
    setRemoveFromMapError(undefined)
    try {
      await onRemoveFromMap()
      onClose()
    } catch (cause) {
      setRemoveFromMapError(cause instanceof Error ? cause.message : '冒险者标记未能安全移除，请重试。')
      setRemovingFromMap(false)
    }
  }

  return (
    <div
      data-testid="character-detail-panel"
      data-defeated={defeated || undefined}
      className="glass absolute bottom-3 left-3 z-[90] flex max-h-[min(720px,calc(100%-6rem))] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
    >
      <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-void-900 text-2xl"
          style={{ borderColor: token.color || '#34d399' }}
        >
          {portrait ? (
            <img src={portrait} alt={`${character.name}的地图 Token`} className="h-full w-full object-cover" />
          ) : (
            character.avatar || token.emoji
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-100">{character.name}</h2>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
              Lv {character.level}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              {character.charClass}
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              {character.race}
            </span>
          </div>
        </div>
        <button
          type="button"
          data-testid="close-character-detail"
          aria-label="关闭角色详情"
          onPointerDown={(event) => {
            closeCharacterDetailOnPrimaryPointerDown(event, onClose)
          }}
          onClick={(event) => {
            event.stopPropagation()
            // Pointer input closes on pointerdown so an authoritative death
            // snapshot cannot replace the panel between down/up and swallow
            // the click. Keyboard and assistive activation still arrive as a
            // click with detail === 0 and close through this fallback.
            if (event.detail === 0) onClose()
          }}
          className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-rose-200">
            <HeartPulse className="h-3.5 w-3.5" />
            生命值
          </div>
          <div className="mb-2 flex items-center gap-1">
            {isDM ? (
              <>
                <input
                  type="number"
                  aria-label="当前生命值"
                  min={0}
                  max={displayedHitPoints.maxHp}
                  value={editingCurrentHp ? currentHpDraft : String(displayedHitPoints.currentHp)}
                  onFocus={(event) => {
                    setCurrentHpDraft(String(character.currentHp))
                    setEditingCurrentHp(true)
                    event.currentTarget.select()
                  }}
                  onChange={(event) => updateCurrentHpDraft(event.target.value)}
                  onBlur={commitCurrentHp}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  className="w-20 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                />
                <span className="text-xs text-slate-500">/</span>
                <input
                  type="number"
                  aria-label="最大生命值"
                  min={1}
                  value={editingMaxHp ? maxHpDraft : String(displayedHitPoints.maxHp)}
                  onFocus={(event) => {
                    setMaxHpDraft(String(character.maxHp))
                    setEditingMaxHp(true)
                    event.currentTarget.select()
                  }}
                  onChange={(event) => updateMaxHpDraft(event.target.value)}
                  onBlur={commitMaxHp}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  className="w-20 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                />
              </>
            ) : (
              <span className="rounded border border-white/10 bg-void-950/50 px-2 py-1 text-sm font-semibold tabular-nums text-slate-100">
                {character.currentHp} / {character.maxHp}
              </span>
            )}
            {tempHp > 0 && (
              <span className="ml-auto rounded bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                临时 {tempHp}
              </span>
            )}
          </div>
        </section>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Shield className="h-4 w-4 text-sky-400" />
            <div>
              <p className="text-[10px] text-slate-500">AC</p>
              <p className="text-sm font-semibold text-slate-100">{getAc(character)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Footprints className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-[10px] text-slate-500">速度</p>
              <p className="text-sm font-semibold text-slate-100">{character.speed} 尺</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <div>
              <p className="text-[10px] text-slate-500">熟练</p>
              <p className="text-sm font-semibold text-slate-100">+{Math.max(2, Math.ceil(character.level / 4) + 1)}</p>
            </div>
          </div>
        </div>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">属性</h3>
          <div className="grid grid-cols-3 gap-2">
            {ABILITIES.map(({ key, label }) => (
              <div key={key} className="flex flex-col items-center rounded-xl border border-white/5 bg-void-900/40 px-2 py-2">
                <span className="text-[10px] font-medium text-slate-500">{label}</span>
                <span className="text-lg font-bold text-arcane-200">{formatMod(abilityMod(character.abilities[key]))}</span>
                <span className="text-[10px] tabular-nums text-slate-500">{character.abilities[key]}</span>
              </div>
            ))}
          </div>
        </section>

        {canManageConditions && onConditionsChange ? (
          <div className="mt-4">
            <Dnd5eConditionEditor
              conditions={character.conditions}
              activeEffects={character.dnd5eCombatState?.activeEffects}
              targetId={token.id}
              sourceOptions={conditionSourceOptions}
              onChange={onConditionsChange}
            />
          </div>
        ) : character.conditions.length > 0 ? (
          <section className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">D&D 5e 状态</h3>
            <Dnd5eConditionTags conditions={character.conditions} />
          </section>
        ) : null}

        {isDM && onRemoveFromMap ? (
          <section className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs leading-relaxed text-slate-500">
              仅移除当前地图上的 Token；不会删除人物卡、装备或战役记录。
            </p>
            {removeFromMapError ? <p className="mt-2 text-xs text-rose-300">{removeFromMapError}</p> : null}
            <button
              type="button"
              data-testid="remove-character-token"
              disabled={removingFromMap}
              onClick={() => void removeFromMap()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {removingFromMap ? '正在移除…' : '从地图移除标记'}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  )
}

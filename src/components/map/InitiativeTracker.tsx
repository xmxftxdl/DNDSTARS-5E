import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getImage } from '../../lib/imageStore'
import { resolveAvailablePortraitSource } from '../../lib/portraitPresentation'

export interface InitiativeEntry {
  /** Stable identity for one turn slot. A creature can own more than one slot. */
  slotId?: string
  /** The scheduler removes this slot after the first combat round wraps. */
  firstRoundOnly?: boolean
  turnKind?: 'thief-reflexes'
  tokenId: string
  label: string
  emoji: string
  /** 角色的先攻栏取景；未单独裁切时使用完整人物立绘。 */
  portrait?: string
  /** 怪物/NPC 立绘的共享图片引用。 */
  portraitImageId?: string
  color: string
  accent?: string
  /** Current-turn flowing border color, normally sourced from the actor's class palette. */
  turnGlowColor?: string
  roll: number
}

const VISIBLE_MAX = 7
const PORTRAIT_WIDTH = Math.round(Math.round(72 * 1.05) * 1.1)
const PORTRAIT_HEIGHT = Math.round(Math.round(94 * 1.05) * 1.1)
const ACTIVE_PORTRAIT_SCALE = 1.15

function InitiativePortrait({ entry, active }: { entry: InitiativeEntry; active: boolean }) {
  const [loaded, setLoaded] = useState<{ imageId: string; src: string }>()
  const sourceKey = JSON.stringify([entry.tokenId, entry.portrait ?? null, entry.portraitImageId ?? null])
  const [failed, setFailed] = useState<{ key: string; sources: string[] }>({ key: sourceKey, sources: [] })
  const failedSources = failed.key === sourceKey ? failed.sources : []

  useEffect(() => {
    if (!entry.portraitImageId) return
    const imageId = entry.portraitImageId
    let activeRequest = true
    let objectUrl: string | undefined
    void getImage(imageId).then((blob) => {
      if (!blob || !activeRequest) return
      objectUrl = URL.createObjectURL(blob)
      setLoaded({ imageId, src: objectUrl })
    })
    return () => {
      activeRequest = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [entry.portraitImageId])

  const sharedSrc = loaded && loaded.imageId === entry.portraitImageId ? loaded.src : undefined
  const src = resolveAvailablePortraitSource(entry.portrait, sharedSrc, failedSources)
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={() => {
          setFailed((current) => {
            const currentSources = current.key === sourceKey ? current.sources : []
            return currentSources.includes(src)
              ? current
              : { key: sourceKey, sources: [...currentSources, src] }
          })
        }}
      />
    )
  }
  return (
    <span className="leading-none transition-transform duration-300" style={{ fontSize: active ? 40 : 36 }}>
      {entry.emoji}
    </span>
  )
}

interface InitiativeTrackerProps {
  entries: InitiativeEntry[]
  activeIndex: number
  scrollOffset: number
  round?: number
  hpByToken?: Record<string, { hp: number; max: number; temp?: number }>
  defeatedTokenIds?: string[]
  /** DM-authoritative active monster whose Headless plan is still pending. */
  monsterThinkingTokenId?: string
  onScroll: (offset: number) => void
  onSelect: (tokenId: string) => void
}

export default function InitiativeTracker({
  entries,
  activeIndex,
  scrollOffset,
  round,
  hpByToken,
  defeatedTokenIds = [],
  monsterThinkingTokenId,
  onScroll,
  onSelect,
}: InitiativeTrackerProps) {
  if (entries.length === 0) return null

  const maxScroll = Math.max(0, entries.length - VISIBLE_MAX)
  const clampedScroll = Math.min(scrollOffset, maxScroll)
  const visible = entries.slice(clampedScroll, clampedScroll + VISIBLE_MAX)
  const canPrev = clampedScroll > 0
  const canNext = clampedScroll < maxScroll

  return (
    <div className="pointer-events-none relative flex items-center gap-[7px] px-1 pb-1 pt-[22px] drop-shadow-[0_8px_14px_rgba(0,0,0,0.72)]">
      {round != null && (
        <span className="pointer-events-none absolute left-1 top-0 rounded-full border border-amber-300/55 bg-amber-950/75 px-[9px] py-1 text-xs font-black leading-none tabular-nums text-amber-100 shadow-lg backdrop-blur-sm">
          R{round}
        </span>
      )}
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onScroll(Math.max(0, clampedScroll - 1))}
        className={[
          'pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-void-950/55 shadow-lg backdrop-blur-sm transition-colors',
          canPrev ? 'text-slate-200 hover:border-white/25 hover:bg-void-900/80 hover:text-white' : 'cursor-not-allowed opacity-35 text-slate-500',
        ].join(' ')}
        title="查看靠前的先攻"
        aria-label="先攻向左"
      >
        <ChevronLeft className="h-[22px] w-[22px]" />
      </button>

      <div className="flex items-end gap-[7px] px-0.5">
        {visible.map((entry, i) => {
          const globalIndex = clampedScroll + i
          const isActive = globalIndex === activeIndex
          const defeated = defeatedTokenIds.includes(entry.tokenId)
          const monsterThinking = isActive && !defeated && monsterThinkingTokenId === entry.tokenId
          const hp = hpByToken?.[entry.tokenId]
          const tempHp = Math.max(0, hp?.temp ?? 0)
          const hpDenominator = hp ? Math.max(1, hp.max + tempHp) : 1
          const hpPct = hp ? Math.max(0, Math.min(1, hp.hp / hpDenominator)) : 0
          const tempHpPct = hp ? Math.max(0, Math.min(1 - hpPct, tempHp / hpDenominator)) : 0
          const realHpPct = hp ? Math.max(0, Math.min(1, hp.hp / Math.max(1, hp.max))) : 0
          const portraitWidth = Math.round(PORTRAIT_WIDTH * (isActive && !defeated ? ACTIVE_PORTRAIT_SCALE : 1))
          const portraitHeight = Math.round(PORTRAIT_HEIGHT * (isActive && !defeated ? ACTIVE_PORTRAIT_SCALE : 1))
          const hpColor =
            realHpPct > 0.55 ? 'bg-emerald-400' : realHpPct > 0.25 ? 'bg-amber-400' : 'bg-rose-400'
          return (
            <button
              key={entry.slotId ?? entry.tokenId}
              data-testid={`initiative-token-${entry.tokenId}${entry.turnKind ? `-${entry.turnKind}` : ''}`}
              data-active-turn={isActive && !defeated ? 'true' : 'false'}
              type="button"
              onClick={() => onSelect(entry.tokenId)}
              className="pointer-events-auto group flex shrink-0 flex-col items-center gap-1 outline-none transition-[width] duration-200"
              style={{ width: portraitWidth }}
              title={`${entry.label} · 先攻 ${entry.roll}${entry.turnKind === 'thief-reflexes' ? ' · 盗贼反射额外回合' : ''}${hp ? ` · HP ${hp.hp}/${hp.max}` : ''}${defeated ? ' · 已阵亡' : ''}${isActive && !defeated ? ' · 当前回合' : ''}`}
              aria-label={`${entry.label}，先攻 ${entry.roll}${hp ? `，生命值 ${hp.hp}/${hp.max}` : ''}${isActive && !defeated ? '，当前回合' : ''}`}
            >
              <div
                className={[
                  'relative transition-transform duration-200',
                  isActive && !defeated ? '-translate-y-1' : '',
                ].join(' ')}
              >
                <div
                  className={[
                    'relative flex items-center justify-center overflow-hidden rounded-md border-2 bg-void-900 shadow-[0_5px_14px_rgba(0,0,0,0.7)] transition-all duration-200',
                    entry.accent && !defeated ? `bg-gradient-to-br ${entry.accent}` : '',
                    defeated ? 'grayscale opacity-50' : '',
                    isActive && !defeated ? 'initiative-active-ring z-10' : 'group-hover:border-white/35',
                  ].join(' ')}
                  style={{
                    width: portraitWidth,
                    height: portraitHeight,
                    borderColor: defeated ? '#64748b' : isActive ? undefined : entry.color,
                    ...(isActive && !defeated
                      ? { '--initiative-turn-color': entry.turnGlowColor ?? entry.color }
                      : {}),
                  } as CSSProperties}
                >
                  <InitiativePortrait entry={entry} active={isActive} />
                </div>
                <span
                  data-testid={`initiative-roll-${entry.tokenId}${entry.turnKind ? `-${entry.turnKind}` : ''}`}
                  className={[
                    'absolute -right-[7px] -top-[9px] z-20 flex min-w-[31px] items-center justify-center rounded-full border px-[7px] py-1 text-[15px] font-black leading-none tabular-nums shadow-[0_3px_8px_rgba(0,0,0,0.8)]',
                    defeated
                      ? 'border-slate-500/70 bg-slate-900 text-slate-500'
                      : isActive
                        ? 'border-amber-200/80 bg-amber-400 text-slate-950'
                        : 'border-white/25 bg-void-950/95 text-slate-100',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {entry.roll}
                </span>
                {monsterThinking && (
                  <span
                    data-testid={`initiative-thinking-${entry.tokenId}`}
                    className="pointer-events-none absolute bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-violet-200/60 bg-violet-950/90 px-2 py-1 text-[10px] font-semibold text-violet-100 shadow-[0_3px_10px_rgba(0,0,0,0.8)] backdrop-blur-sm"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" aria-hidden="true" />
                    AI 思考中…
                  </span>
                )}
              </div>
              <div
                data-testid={`initiative-health-${entry.tokenId}${entry.turnKind ? `-${entry.turnKind}` : ''}`}
                className="h-2 overflow-hidden rounded-full bg-slate-950/90 shadow-md ring-1 ring-white/15 transition-[width] duration-200"
                style={{ width: portraitWidth }}
                title={hp ? `HP ${hp.hp}/${hp.max}${tempHp > 0 ? ` + ${tempHp} 临时生命` : ''}` : '无生命值数据'}
              >
                {hp ? (
                  <div className="relative h-full w-full">
                    <div
                      className={`absolute inset-y-0 left-0 ${defeated ? 'bg-slate-600' : hpColor}`}
                      style={{ width: `${defeated ? 0 : hpPct * 100}%` }}
                    />
                    {tempHp > 0 && (
                      <>
                        <div
                          className="absolute inset-y-0 bg-amber-300/90"
                          style={{
                            left: `${defeated ? 0 : hpPct * 100}%`,
                            width: `${defeated ? 0 : tempHpPct * 100}%`,
                          }}
                        />
                        {hpPct > 0 && tempHpPct > 0 && (
                          <div
                            className="absolute inset-y-0 w-px bg-slate-950/75"
                            style={{ left: `${defeated ? 0 : hpPct * 100}%` }}
                          />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="h-full w-0" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onScroll(Math.min(maxScroll, clampedScroll + 1))}
        className={[
          'pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-void-950/55 shadow-lg backdrop-blur-sm transition-colors',
          canNext ? 'text-slate-200 hover:border-white/25 hover:bg-void-900/80 hover:text-white' : 'cursor-not-allowed opacity-35 text-slate-500',
        ].join(' ')}
        title="查看靠后的先攻"
        aria-label="先攻向右"
      >
        <ChevronRight className="h-[22px] w-[22px]" />
      </button>

      {entries.length > VISIBLE_MAX && (
        <span className="ml-1 hidden rounded-full bg-void-950/55 px-2 py-1 text-[10px] tabular-nums text-slate-300 shadow-lg backdrop-blur-sm sm:inline">
          {clampedScroll + 1}–{Math.min(clampedScroll + VISIBLE_MAX, entries.length)}/{entries.length}
        </span>
      )}
    </div>
  )
}

export { VISIBLE_MAX as INITIATIVE_VISIBLE_MAX }

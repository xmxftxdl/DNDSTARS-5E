import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getImage } from '../../lib/imageStore'

export interface InitiativeEntry {
  /** Stable identity for one turn slot. A creature can own more than one slot. */
  slotId?: string
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
  roll: number
}

const VISIBLE_MAX = 7
const PORTRAIT_WIDTH = 72
const PORTRAIT_HEIGHT = 94

function InitiativePortrait({ entry, active }: { entry: InitiativeEntry; active: boolean }) {
  const [loaded, setLoaded] = useState<{ imageId: string; src: string }>()

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
  const src = entry.portrait ?? sharedSrc
  if (src) {
    return <img src={src} alt={`${entry.label}的完整立绘`} className="h-full w-full object-cover" />
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
    <div className="relative flex items-center gap-1.5 px-1 pb-1 pt-5 drop-shadow-[0_8px_14px_rgba(0,0,0,0.72)]">
      {round != null && (
        <span className="pointer-events-none absolute left-1 top-0 rounded-full border border-amber-300/55 bg-amber-950/75 px-2 py-1 text-[11px] font-black leading-none tabular-nums text-amber-100 shadow-lg backdrop-blur-sm">
          R{round}
        </span>
      )}
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onScroll(Math.max(0, clampedScroll - 1))}
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-void-950/55 shadow-lg backdrop-blur-sm transition-colors',
          canPrev ? 'text-slate-200 hover:border-white/25 hover:bg-void-900/80 hover:text-white' : 'cursor-not-allowed opacity-35 text-slate-500',
        ].join(' ')}
        title="查看靠前的先攻"
        aria-label="先攻向左"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-end gap-1.5 px-0.5">
        {visible.map((entry, i) => {
          const globalIndex = clampedScroll + i
          const isActive = globalIndex === activeIndex
          const defeated = defeatedTokenIds.includes(entry.tokenId)
          const hp = hpByToken?.[entry.tokenId]
          const tempHp = Math.max(0, hp?.temp ?? 0)
          const hpDenominator = hp ? Math.max(1, hp.max + tempHp) : 1
          const hpPct = hp ? Math.max(0, Math.min(1, hp.hp / hpDenominator)) : 0
          const tempHpPct = hp ? Math.max(0, Math.min(1 - hpPct, tempHp / hpDenominator)) : 0
          const realHpPct = hp ? Math.max(0, Math.min(1, hp.hp / Math.max(1, hp.max))) : 0
          const hpColor =
            realHpPct > 0.55 ? 'bg-emerald-400' : realHpPct > 0.25 ? 'bg-amber-400' : 'bg-rose-400'
          return (
            <button
              key={entry.slotId ?? entry.tokenId}
              data-testid={`initiative-token-${entry.tokenId}${entry.turnKind ? `-${entry.turnKind}` : ''}`}
              type="button"
              onClick={() => onSelect(entry.tokenId)}
              className="group flex w-[72px] shrink-0 flex-col items-center gap-1 outline-none"
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
                    width: PORTRAIT_WIDTH,
                    height: PORTRAIT_HEIGHT,
                    borderColor: defeated ? '#64748b' : isActive ? undefined : entry.color,
                  }}
                >
                  <InitiativePortrait entry={entry} active={isActive} />
                </div>
                <span
                  data-testid={`initiative-roll-${entry.tokenId}${entry.turnKind ? `-${entry.turnKind}` : ''}`}
                  className={[
                    'absolute -right-1.5 -top-2 z-20 flex min-w-7 items-center justify-center rounded-full border px-1.5 py-1 text-sm font-black leading-none tabular-nums shadow-[0_3px_8px_rgba(0,0,0,0.8)]',
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
              </div>
              <div
                data-testid={`initiative-health-${entry.tokenId}${entry.turnKind ? `-${entry.turnKind}` : ''}`}
                className="h-[7px] w-[72px] overflow-hidden rounded-full bg-slate-950/90 shadow-md ring-1 ring-white/15"
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
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-void-950/55 shadow-lg backdrop-blur-sm transition-colors',
          canNext ? 'text-slate-200 hover:border-white/25 hover:bg-void-900/80 hover:text-white' : 'cursor-not-allowed opacity-35 text-slate-500',
        ].join(' ')}
        title="查看靠后的先攻"
        aria-label="先攻向右"
      >
        <ChevronRight className="h-5 w-5" />
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

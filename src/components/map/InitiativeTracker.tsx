import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface InitiativeEntry {
  tokenId: string
  label: string
  emoji: string
  color: string
  accent?: string
  roll: number
}

const VISIBLE_MAX = 7
const AVATAR_BASE = 44
const AVATAR_ACTIVE = Math.round(AVATAR_BASE * 1.2)

interface InitiativeTrackerProps {
  entries: InitiativeEntry[]
  activeIndex: number
  scrollOffset: number
  round?: number
  hpByToken?: Record<string, { hp: number; max: number; temp?: number }>
  apByToken?: Record<string, { current: number; max: number }>
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
  apByToken,
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
    <div className="relative flex items-center gap-1.5 rounded-2xl border border-white/10 bg-void-950/88 px-2 py-2 shadow-2xl backdrop-blur-md">
      {round != null && (
        <span className="pointer-events-none absolute left-1 top-1 rounded-full border border-amber-300/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums text-amber-100 shadow-sm">
          R{round}
        </span>
      )}
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onScroll(Math.max(0, clampedScroll - 1))}
        className={[
          'flex h-9 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          canPrev ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-slate-600',
        ].join(' ')}
        title="查看靠前的先攻"
        aria-label="先攻向左"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-end gap-2 px-0.5">
        {visible.map((entry, i) => {
          const globalIndex = clampedScroll + i
          const isActive = globalIndex === activeIndex
          const defeated = defeatedTokenIds.includes(entry.tokenId)
          const hp = hpByToken?.[entry.tokenId]
          const ap = apByToken?.[entry.tokenId]
          const tempHp = Math.max(0, hp?.temp ?? 0)
          const hpDenominator = hp ? Math.max(1, hp.max + tempHp) : 1
          const hpPct = hp ? Math.max(0, Math.min(1, hp.hp / hpDenominator)) : 0
          const tempHpPct = hp ? Math.max(0, Math.min(1 - hpPct, tempHp / hpDenominator)) : 0
          const realHpPct = hp ? Math.max(0, Math.min(1, hp.hp / Math.max(1, hp.max))) : 0
          const hpColor =
            realHpPct > 0.55 ? 'bg-emerald-400' : realHpPct > 0.25 ? 'bg-amber-400' : 'bg-rose-400'
          const size = isActive && !defeated ? AVATAR_ACTIVE : AVATAR_BASE

          return (
            <button
              key={entry.tokenId}
              data-testid={`initiative-token-${entry.tokenId}`}
              type="button"
              onClick={() => onSelect(entry.tokenId)}
              className="group flex flex-col items-center gap-1 outline-none"
              title={`${entry.label} · 先攻 ${entry.roll}${ap ? ` · AP ${ap.current}/${ap.max}` : ''}${hp ? ` · HP ${hp.hp}/${hp.max}` : ''}${defeated ? ' · 已阵亡' : ''}${isActive && !defeated ? ' · 当前回合' : ''}`}
            >
              <div
                className={[
                  'relative flex items-center justify-center rounded-full border-2 bg-void-900 transition-all duration-300',
                  entry.accent && !defeated ? `bg-gradient-to-br ${entry.accent}` : '',
                  defeated ? 'grayscale opacity-50' : '',
                  isActive && !defeated ? 'initiative-active-ring z-10' : 'group-hover:border-white/35',
                ].join(' ')}
                style={{
                  width: size,
                  height: size,
                  borderColor: defeated ? '#64748b' : isActive ? undefined : entry.color,
                }}
              >
                <span
                  className="leading-none transition-transform duration-300"
                  style={{ fontSize: isActive ? 26 : 22 }}
                >
                  {entry.emoji}
                </span>
                {ap && !defeated && (
                  <span
                    className={[
                      'absolute -right-1.5 -top-1.5 rounded-full border border-sky-100/80 bg-sky-500/95 px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums shadow-lg',
                      ap.current > 0 ? 'text-white' : 'text-slate-200 opacity-75',
                    ].join(' ')}
                  >
                    {ap.current}/{ap.max}
                  </span>
                )}
              </div>
              <span
                className={[
                  'max-w-[52px] truncate text-[10px] font-medium leading-tight',
                  defeated ? 'text-slate-600 line-through' : isActive ? 'text-arcane-200' : 'text-slate-500',
                ].join(' ')}
              >
                {entry.label}
              </span>
              <span
                className={[
                  'min-h-4 text-sm font-black leading-none tabular-nums',
                  defeated ? 'text-slate-700' : isActive ? 'text-amber-200' : 'text-slate-300',
                ].join(' ')}
              >
                {entry.roll}
              </span>
              <div className="h-1 w-11 overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-white/5">
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
          'flex h-9 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          canNext ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-slate-600',
        ].join(' ')}
        title="查看靠后的先攻"
        aria-label="先攻向右"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {entries.length > VISIBLE_MAX && (
        <span className="ml-1 hidden text-[10px] tabular-nums text-slate-500 sm:inline">
          {clampedScroll + 1}–{Math.min(clampedScroll + VISIBLE_MAX, entries.length)}/{entries.length}
        </span>
      )}
    </div>
  )
}

export { VISIBLE_MAX as INITIATIVE_VISIBLE_MAX }

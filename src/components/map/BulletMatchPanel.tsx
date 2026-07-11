import { useCallback, useEffect, useRef, useState } from 'react'
import { Gauge, Crosshair } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import type { BulletPuzzleState } from '../../types/character'
import {
  BULLET_GRID_SIZE,
  BULLET_TYPE_COUNT,
  BULLET_TYPE_STYLES,
  BULLET_ANIM_MS,
  computeSwapOffsets,
  createSeededBulletRandom,
  ensureBulletPuzzle,
  planSwapCascade,
  playCascadeAnimation,
} from '../../lib/bulletMatch'
import BulletIcon from './BulletIcon'

interface BulletMatchPanelProps {
  charId: string
  canAct?: boolean
  onSwap?: (from: number, to: number, seed: number) => boolean
}

const CELL_PX = 30

export default function BulletMatchPanel({ charId, canAct = false, onSwap }: BulletMatchPanelProps) {
  const character = useCharacterStore((s) => s.characters.find((c) => c.id === charId))
  const update = useCharacterStore((s) => s.update)

  const [selected, setSelected] = useState<number | null>(null)
  const [display, setDisplay] = useState<BulletPuzzleState | null>(null)
  const [popping, setPopping] = useState<Set<number>>(() => new Set())
  const [fallOffsets, setFallOffsets] = useState<Map<number, number>>(() => new Map())
  const [swapOffsets, setSwapOffsets] = useState<Map<number, { x: number; y: number }>>(() => new Map())
  const [swapping, setSwapping] = useState(false)
  const [animating, setAnimating] = useState(false)
  const animatingRef = useRef(false)

  const stored = character ? ensureBulletPuzzle(character.bulletPuzzle) : null
  const puzzle = display ?? stored

  useEffect(() => {
    if (!character || animatingRef.current) return
    const p = ensureBulletPuzzle(character.bulletPuzzle)
    if (!character.bulletPuzzle) update(charId, { bulletPuzzle: p })
    setDisplay(p)
  }, [charId, character, character?.bulletPuzzle, update])

  const runSwapAnimation = useCallback(
    async (a: number, b: number, seed: number) => {
      if (!character || !stored) return
      animatingRef.current = true
      setAnimating(true)
      setSelected(null)

      const base = ensureBulletPuzzle(character.bulletPuzzle)
      const start = { grid: [...base.grid], ready: [...base.ready] }
      const result = await playCascadeAnimation(start, a, b, CELL_PX, {
        onSwapBegin: (grid, ready) => {
          setSwapping(true)
          setSwapOffsets(new Map())
          setDisplay({ grid, ready })
        },
        onSwapSlide: (from, to) => setSwapOffsets(computeSwapOffsets(from, to, CELL_PX)),
        onSwapEnd: (grid, ready) => {
          setSwapOffsets(new Map())
          setSwapping(false)
          setDisplay({ grid, ready })
        },
        onPop: (matched, grid, ready) => {
          setPopping(matched)
          setDisplay({ grid, ready })
        },
        onFall: (grid, ready, offsets) => {
          setPopping(new Set())
          setFallOffsets(offsets)
          setDisplay({ grid, ready })
        },
        onSettle: (grid, ready) => {
          setFallOffsets(new Map())
          setDisplay({ grid, ready })
        },
      }, createSeededBulletRandom(seed))

      animatingRef.current = false
      setAnimating(false)
      if (result) {
        if (!onSwap) update(charId, { bulletPuzzle: result })
        setDisplay(result)
      } else {
        setDisplay(base)
      }
    },
    [charId, character, onSwap, update],
  )

  const onCellClick = useCallback(
    (index: number) => {
      if (!character || !stored || animatingRef.current) return

      if (selected === null) {
        setSelected(index)
        return
      }

      if (selected === index) {
        setSelected(null)
        return
      }

      if (!canAct || character.currentAP < 1) {
        setSelected(null)
        return
      }

      if (!planSwapCascade(stored, selected, index)) {
        setSelected(null)
        return
      }

      const from = selected
      const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
      if (onSwap && !onSwap(from, index, seed)) {
        setSelected(null)
        return
      }

      void runSwapAnimation(from, index, seed)
    },
    [character, selected, canAct, onSwap, stored, runSwapAnimation],
  )

  if (!character || !puzzle) return null

  const busy = animating

  return (
    <div className="space-y-2">
      <div className="glass flex shrink-0 flex-wrap items-center gap-3 rounded-xl p-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2.5 py-1">
          <Gauge className="h-3.5 w-3.5 text-sky-300" />
          <span className="text-xs text-slate-300">行动点</span>
          <span className="text-sm font-bold text-sky-200">
            {character.currentAP}
            <span className="text-slate-500">/{character.actionPoints}</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          8×8 · 三连自动消除并连锁 · 交换相邻两格（1 AP）
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div
          className={[
            'inline-grid shrink-0 gap-0.5 rounded-lg border border-white/10 bg-void-950/90 p-1',
            busy ? 'pointer-events-none' : '',
          ].join(' ')}
          style={{
            gridTemplateColumns: `repeat(${BULLET_GRID_SIZE}, ${CELL_PX}px)`,
          }}
        >
          {puzzle.grid.map((type, i) => {
            const style = BULLET_TYPE_STYLES[type] ?? BULLET_TYPE_STYLES[0]
            const picked = selected === i
            const isPopping = popping.has(i)
            const fallY = fallOffsets.get(i)
            const swap = swapOffsets.get(i)
            const parts: string[] = []
            if (swap) parts.push(`translate(${swap.x}px, ${swap.y}px)`)
            if (fallY !== undefined) parts.push(`translateY(${fallY}px)`)
            const transform = parts.length > 0 ? parts.join(' ') : undefined
            const isSwappingCell = swapping && swapOffsets.has(i)

            return (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => onCellClick(i)}
                title={style.name}
                className={[
                  'flex items-center justify-center rounded-md',
                  picked && !isPopping && !busy ? 'z-10 scale-105 ring-2 ring-white ring-offset-1 ring-offset-void-950' : '',
                  !isPopping && !busy ? 'hover:bg-white/5' : '',
                  !canAct || busy ? 'cursor-default' : '',
                  isPopping ? 'z-20' : isSwappingCell ? 'z-20' : '',
                ].join(' ')}
                style={{
                  width: CELL_PX,
                  height: CELL_PX,
                  backgroundColor: isPopping
                    ? `${style.bg}55`
                    : picked
                      ? `${style.bg}33`
                      : `${style.bg}18`,
                  transform: isPopping ? undefined : transform,
                  transition: isPopping
                    ? undefined
                    : fallY !== undefined
                      ? 'none'
                      : swapping
                        ? `transform ${BULLET_ANIM_MS.swap}ms cubic-bezier(0.22, 1, 0.36, 1)`
                        : `transform ${BULLET_ANIM_MS.fall}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  animation: isPopping ? 'bullet-pop 320ms ease-in forwards' : undefined,
                }}
              >
                <BulletIcon type={type} size={CELL_PX - 6} />
              </button>
            )
          })}
        </div>

        <div className="min-w-[8.5rem] flex-1 rounded-xl border border-amber-500/25 bg-amber-500/5 p-2">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
            <Crosshair className="h-3 w-3" />
            准备就绪
          </p>
          <ul className="space-y-1.5">
            {Array.from({ length: BULLET_TYPE_COUNT }, (_, t) => {
              const style = BULLET_TYPE_STYLES[t]
              const count = puzzle.ready[t] ?? 0
              return (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-void-950/50">
                    <BulletIcon type={t} size={22} />
                  </span>
                  <span className="flex-1 text-xs text-slate-300">{style.name}</span>
                  <span
                    className={[
                      'min-w-[1.25rem] text-right text-sm font-bold tabular-nums text-amber-100 transition-transform',
                      busy ? '' : '',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

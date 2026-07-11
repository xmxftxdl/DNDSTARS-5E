import type { BulletPuzzleState } from '../types/character'

export const BULLET_GRID_SIZE = 8
export const BULLET_TYPE_COUNT = 7
export const BULLET_CELL_COUNT = BULLET_GRID_SIZE * BULLET_GRID_SIZE

export const BULLET_TYPE_STYLES: { label: string; name: string; bg: string; ring: string }[] = [
  { label: '焰', name: '焰弹', bg: '#dc2626', ring: '#fca5a5' },
  { label: '雷', name: '雷弹', bg: '#ca8a04', ring: '#fde047' },
  { label: '光', name: '光弹', bg: '#eab308', ring: '#fef08a' },
  { label: '毒', name: '毒弹', bg: '#16a34a', ring: '#86efac' },
  { label: '冰', name: '冰弹', bg: '#2563eb', ring: '#93c5fd' },
  { label: '虚', name: '虚弹', bg: '#7c3aed', ring: '#c4b5fd' },
  { label: '钢', name: '钢弹', bg: '#64748b', ring: '#cbd5e1' },
]

/** 子弹贴图路径（可替换 public/bullets 下同名文件） */
export function bulletImageUrl(type: number): string {
  const t = Math.max(0, Math.min(BULLET_TYPE_COUNT - 1, type))
  return `/bullets/${t}.svg`
}

export function isHeavyGunner(charClass: string): boolean {
  return charClass === '重炮手'
}

export function createBulletPuzzle(): BulletPuzzleState {
  return {
    grid: randomGridNoImmediateMatches(),
    ready: Array(BULLET_TYPE_COUNT).fill(0),
  }
}

export function ensureBulletPuzzle(state?: BulletPuzzleState): BulletPuzzleState {
  if (state?.grid?.length === BULLET_CELL_COUNT && state.ready?.length === BULLET_TYPE_COUNT) {
    return state
  }
  return createBulletPuzzle()
}

export function createSeededBulletRandom(seed: number): () => number {
  let state = Math.floor(seed) >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function randomType(random: () => number = Math.random): number {
  return Math.floor(random() * BULLET_TYPE_COUNT)
}

function randomGridNoImmediateMatches(): number[] {
  const grid = Array.from({ length: BULLET_CELL_COUNT }, () => randomType())
  for (let i = 0; i < 80; i++) {
    const matches = findMatchIndices(grid)
    if (matches.size === 0) break
    for (const idx of matches) grid[idx] = randomType()
  }
  return grid
}

export function cellIndex(row: number, col: number): number {
  return row * BULLET_GRID_SIZE + col
}

export function indexToRowCol(index: number): { row: number; col: number } {
  return { row: Math.floor(index / BULLET_GRID_SIZE), col: index % BULLET_GRID_SIZE }
}

export function areAdjacent(a: number, b: number): boolean {
  const ar = indexToRowCol(a)
  const br = indexToRowCol(b)
  return Math.abs(ar.row - br.row) + Math.abs(ar.col - br.col) === 1
}

/** 找出所有参与三连及以上的格子 */
export function findMatchIndices(grid: number[]): Set<number> {
  const matched = new Set<number>()
  const n = BULLET_GRID_SIZE

  for (let r = 0; r < n; r++) {
    let run = 1
    for (let c = 1; c < n; c++) {
      const i = cellIndex(r, c)
      const prev = cellIndex(r, c - 1)
      if (grid[i] === grid[prev]) run++
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k++) matched.add(cellIndex(r, c - 1 - k))
        }
        run = 1
      }
    }
    if (run >= 3) {
      for (let k = 0; k < run; k++) matched.add(cellIndex(r, n - 1 - k))
    }
  }

  for (let c = 0; c < n; c++) {
    let run = 1
    for (let r = 1; r < n; r++) {
      const i = cellIndex(r, c)
      const prev = cellIndex(r - 1, c)
      if (grid[i] === grid[prev]) run++
      else {
        if (run >= 3) {
          for (let k = 0; k < run; k++) matched.add(cellIndex(r - 1 - k, c))
        }
        run = 1
      }
    }
    if (run >= 3) {
      for (let k = 0; k < run; k++) matched.add(cellIndex(n - 1 - k, c))
    }
  }

  return matched
}

export function typesCleared(matched: Set<number>, grid: number[]): number[] {
  const types = new Set<number>()
  for (const idx of matched) types.add(grid[idx])
  return [...types]
}

/** 消除 → 下落 → 顶格填充 */
export function collapseGrid(grid: number[], matched: Set<number>, random: () => number = Math.random): number[] {
  const next = [...grid]
  const n = BULLET_GRID_SIZE
  for (let c = 0; c < n; c++) {
    const col: number[] = []
    for (let r = n - 1; r >= 0; r--) {
      const i = cellIndex(r, c)
      if (!matched.has(i)) col.push(next[i])
    }
    while (col.length < n) col.push(randomType(random))
    for (let r = 0; r < n; r++) {
      next[cellIndex(n - 1 - r, c)] = col[r]
    }
  }
  return next
}

export const BULLET_GRID_GAP = 2

export const BULLET_ANIM_MS = {
  swap: 240,
  pop: 320,
  fall: 300,
  chainPause: 80,
} as const

export interface CascadeStep {
  matched: number[]
  clearedTypes: number[]
  gridAfter: number[]
}

export function swapCells(grid: number[], a: number, b: number): number[] {
  const next = [...grid]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

/** 三连及以上自动连锁消除，返回每一步（含下落填充后的盘面） */
export function buildCascadeSteps(grid: number[], random: () => number = Math.random): CascadeStep[] {
  const steps: CascadeStep[] = []
  let g = [...grid]
  for (let guard = 0; guard < 32; guard++) {
    const matched = findMatchIndices(g)
    if (matched.size === 0) break
    const clearedTypes = typesCleared(matched, g)
    g = collapseGrid(g, matched, random)
    steps.push({ matched: [...matched], clearedTypes, gridAfter: g })
  }
  return steps
}

/** 交换后若形成三连则返回连锁步骤，否则 null */
export function planSwapCascade(
  puzzle: BulletPuzzleState,
  a: number,
  b: number,
  random: () => number = Math.random,
): { swappedGrid: number[]; steps: CascadeStep[]; finalGrid: number[]; finalReady: number[] } | null {
  if (!areAdjacent(a, b)) return null
  const swappedGrid = swapCells(puzzle.grid, a, b)
  const steps = buildCascadeSteps(swappedGrid, random)
  if (steps.length === 0) return null

  const ready = [...puzzle.ready]
  for (const step of steps) {
    for (const t of step.clearedTypes) ready[t] += 1
  }

  return {
    swappedGrid,
    steps,
    finalGrid: steps[steps.length - 1].gridAfter,
    finalReady: ready,
  }
}

/** 交换动画：两格沿网格互相滑动的位移（px） */
export function computeSwapOffsets(
  a: number,
  b: number,
  cellPx: number,
): Map<number, { x: number; y: number }> {
  const ar = indexToRowCol(a)
  const br = indexToRowCol(b)
  const step = cellPx + BULLET_GRID_GAP
  const dx = (br.col - ar.col) * step
  const dy = (br.row - ar.row) * step
  return new Map([
    [a, { x: dx, y: dy }],
    [b, { x: -dx, y: -dy }],
  ])
}

/** 下落/新生子弹的初始 Y 偏移（px），下一帧清掉即触发过渡 */
export function computeFallOffsets(matched: Set<number>, cellPx: number): Map<number, number> {
  const n = BULLET_GRID_SIZE
  const cellH = cellPx + BULLET_GRID_GAP
  const offsets = new Map<number, number>()

  for (let c = 0; c < n; c++) {
    const survivorIdx: number[] = []
    for (let r = n - 1; r >= 0; r--) {
      const i = cellIndex(r, c)
      if (!matched.has(i)) survivorIdx.push(i)
    }

    const afterBottomUp: number[] = []
    for (let r = n - 1; r >= 0; r--) afterBottomUp.push(cellIndex(r, c))

    for (let k = 0; k < survivorIdx.length; k++) {
      const oldIdx = survivorIdx[k]
      const newIdx = afterBottomUp[k]
      const oldRow = indexToRowCol(oldIdx).row
      const newRow = indexToRowCol(newIdx).row
      if (oldRow !== newRow) offsets.set(newIdx, (oldRow - newRow) * cellH)
    }

    for (let k = survivorIdx.length; k < n; k++) {
      const newIdx = afterBottomUp[k]
      const newRow = indexToRowCol(newIdx).row
      offsets.set(newIdx, -(newRow + 1) * cellH)
    }
  }

  return offsets
}

function waitFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** 播放连锁动画用的异步流程（由 UI 调用） */
export async function playCascadeAnimation(
  start: BulletPuzzleState,
  a: number,
  b: number,
  cellPx: number,
  hooks: {
    onSwapBegin: (grid: number[], ready: number[], from: number, to: number) => void
    onSwapSlide: (from: number, to: number) => void
    onSwapEnd: (grid: number[], ready: number[]) => void
    onPop: (matched: Set<number>, grid: number[], ready: number[]) => void
    onFall: (grid: number[], ready: number[], offsets: Map<number, number>) => void
    onSettle: (grid: number[], ready: number[]) => void
  },
  random: () => number = Math.random,
): Promise<BulletPuzzleState | null> {
  const plan = planSwapCascade(start, a, b, random)
  if (!plan) return null

  let grid = [...start.grid]
  const ready = [...start.ready]

  hooks.onSwapBegin(grid, ready, a, b)
  await waitFrame()
  await waitFrame()
  hooks.onSwapSlide(a, b)
  await waitMs(BULLET_ANIM_MS.swap)

  grid = plan.swappedGrid
  hooks.onSwapEnd(grid, ready)

  let gridBefore = grid
  for (const step of plan.steps) {
    const matched = new Set(step.matched)
    hooks.onPop(matched, gridBefore, ready)
    await waitMs(BULLET_ANIM_MS.pop)

    for (const t of step.clearedTypes) ready[t] += 1
    grid = step.gridAfter
    const offsets = computeFallOffsets(matched, cellPx)
    hooks.onFall(grid, ready, offsets)
    await waitFrame()
    await waitFrame()
    hooks.onSettle(grid, ready)
    await waitMs(BULLET_ANIM_MS.fall)
    await waitMs(BULLET_ANIM_MS.chainPause)
    gridBefore = grid
  }

  return { grid: plan.finalGrid, ready: plan.finalReady }
}

/** 交换并瞬间结算（无动画时使用） */
export function trySwap(
  puzzle: BulletPuzzleState,
  a: number,
  b: number,
): { puzzle: BulletPuzzleState; swapped: boolean; message?: string } {
  const plan = planSwapCascade(puzzle, a, b)
  if (!plan) {
    return { puzzle, swapped: false, message: '交换后未形成三连，未消耗 AP' }
  }
  return {
    puzzle: { grid: plan.finalGrid, ready: plan.finalReady },
    swapped: true,
  }
}

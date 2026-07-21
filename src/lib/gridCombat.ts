import type { BattleMap, Token } from '../store/maps'
import { dnd5eCombatTokenSide } from './opportunityAttacks'
import { creatureSizeToFootprintCells, sizeFromTokenSize } from './monsterTypes'

/** DND：1 格 = 5 尺（格宽仅决定屏幕上每格像素） */
export const DND_FEET_PER_CELL = 5

/** Token 在地图上的移动动画时长（秒），与 MapCanvas 一致 */
export const TOKEN_MOVE_DURATION_S = 0.58

export const DEFAULT_GRID_COLOR = '#c4b5fd'
export const DEFAULT_GRID_OPACITY = 0.28

export function gridStrokeRgba(hex: string, opacity: number): string {
  const raw = hex.replace('#', '').trim()
  if (raw.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `rgba(255,255,255,${opacity})`
  }
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

export interface GridCell {
  col: number
  row: number
}

export function pixelToCell(x: number, y: number, map: BattleMap): GridCell {
  const g = Math.max(1, map.gridSize)
  return {
    col: Math.round((x - map.gridOffsetX) / g - 0.5),
    row: Math.round((y - map.gridOffsetY) / g - 0.5),
  }
}

export function cellToPixel(cell: GridCell, map: BattleMap): { x: number; y: number } {
  const g = Math.max(1, map.gridSize)
  return {
    x: map.gridOffsetX + (cell.col + 0.5) * g,
    y: map.gridOffsetY + (cell.row + 0.5) * g,
  }
}

/** 格子距离（含斜向，每格 1） */
export function cellDistance(a: GridCell, b: GridCell): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

export function cellKey(c: GridCell): string {
  return `${c.col},${c.row}`
}

/** 格子左上角像素坐标（与 pixelToCell / cellToPixel 对齐） */
export function cellTopLeft(cell: GridCell, map: BattleMap): { x: number; y: number } {
  const g = Math.max(1, map.gridSize)
  return {
    x: map.gridOffsetX + cell.col * g,
    y: map.gridOffsetY + cell.row * g,
  }
}

const NEIGHBOR_DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** 尺数换算为可移动格数 */
export function feetToCells(feet: number, feetPerCell: number): number {
  const fpc = Math.max(1, feetPerCell)
  return Math.max(1, Math.floor(feet / fpc))
}

/** 尺数 → 可移动格数（1 格 = 5 尺） */
export function feetToMovementCells(feet: number): number {
  return feet / DND_FEET_PER_CELL
}

/** 尺数 → 移动范围圆半径（像素） */
export function movementRadiusPx(feet: number, map: BattleMap): number {
  return feetToMovementCells(feet) * Math.max(1, map.gridSize)
}

/** 测距 / 战术格数：两点间占多少格（切比雪夫，与 DND 方格一致） */
export function measureGridCells(
  a: { x: number; y: number },
  b: { x: number; y: number },
  map: BattleMap,
): number {
  return cellDistance(pixelToCell(a.x, a.y, map), pixelToCell(b.x, b.y, map))
}

/** 测距格数：吸附开→格心切比雪夫；吸附关→任意两点欧氏长度 */
export function measureSegmentCells(
  a: { x: number; y: number },
  b: { x: number; y: number },
  map: BattleMap,
  snapMeasure: boolean,
): number {
  if (snapMeasure) {
    const ac = snapToCellCenter(a.x, a.y, map)
    const bc = snapToCellCenter(b.x, b.y, map)
    return measureGridCells(ac, bc, map)
  }
  const g = Math.max(1, map.gridSize)
  return Math.hypot(b.x - a.x, b.y - a.y) / g
}

/** 测距是否吸附格心（与怪物吸附开关一致） */
export function measureSnapsToGrid(map: BattleMap): boolean {
  return map.snapMonstersToGrid !== false
}

/** 拖放后是否吸附到格心 */
export function shouldSnapTokenOnDrop(token: Token, map: BattleMap): boolean {
  if (token.type === 'player') return true
  if (token.type === 'enemy' || token.type === 'npc') {
    return map.snapMonstersToGrid !== false
  }
  return true
}

export function resolveTokenDropPosition(
  x: number,
  y: number,
  token: Token,
  map: BattleMap,
): { x: number; y: number } {
  if (!shouldSnapTokenOnDrop(token, map)) return { x, y }
  return snapTokenToGridCenter(x, y, token, map)
}

export function isWithinMovementRange(
  center: { x: number; y: number },
  point: { x: number; y: number },
  feet: number,
  map: BattleMap,
): boolean {
  const radius = movementRadiusPx(feet, map)
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius + 0.5
}

export function snapToCellCenter(x: number, y: number, map: BattleMap): { x: number; y: number } {
  return cellToPixel(pixelToCell(x, y, map), map)
}

export function tokenFootprintCells(token: Pick<Token, 'creatureSize' | 'size'>): number {
  return creatureSizeToFootprintCells(token.creatureSize ?? sizeFromTokenSize(token.size))
}

export function tokenAnchorCellFromPixel(
  x: number,
  y: number,
  token: Pick<Token, 'creatureSize' | 'size'>,
  map: BattleMap,
): GridCell {
  const g = Math.max(1, map.gridSize)
  const footprint = tokenFootprintCells(token)
  return {
    col: Math.round((x - map.gridOffsetX) / g - footprint / 2),
    row: Math.round((y - map.gridOffsetY) / g - footprint / 2),
  }
}

export function tokenCenterForAnchorCell(
  anchor: GridCell,
  token: Pick<Token, 'creatureSize' | 'size'>,
  map: BattleMap,
): { x: number; y: number } {
  const g = Math.max(1, map.gridSize)
  const footprint = tokenFootprintCells(token)
  return {
    x: map.gridOffsetX + (anchor.col + footprint / 2) * g,
    y: map.gridOffsetY + (anchor.row + footprint / 2) * g,
  }
}

export function snapTokenToGridCenter(
  x: number,
  y: number,
  token: Pick<Token, 'creatureSize' | 'size'>,
  map: BattleMap,
): { x: number; y: number } {
  return tokenCenterForAnchorCell(tokenAnchorCellFromPixel(x, y, token, map), token, map)
}

export function mapCellExtent(map: BattleMap): { cols: number; rows: number } {
  const g = Math.max(1, map.gridSize)
  return {
    cols: Math.max(1, Math.floor((map.width - map.gridOffsetX) / g)),
    rows: Math.max(1, Math.floor((map.height - map.gridOffsetY) / g)),
  }
}

function tokenFootprintCellsForAnchor(
  token: Pick<Token, 'creatureSize' | 'size'>,
  anchor: GridCell,
): GridCell[] {
  const footprint = tokenFootprintCells(token)
  const cells: GridCell[] = []
  for (let dc = 0; dc < footprint; dc++) {
    for (let dr = 0; dr < footprint; dr++) {
      cells.push({ col: anchor.col + dc, row: anchor.row + dr })
    }
  }
  return cells
}

export function tokenOccupiedCellsAt(
  token: Pick<Token, 'creatureSize' | 'size'>,
  map: BattleMap,
  pos: { x: number; y: number },
): GridCell[] {
  return tokenFootprintCellsForAnchor(token, tokenAnchorCellFromPixel(pos.x, pos.y, token, map))
}

function isFootprintInsideMap(token: Pick<Token, 'creatureSize' | 'size'>, anchor: GridCell, map: BattleMap): boolean {
  const footprint = tokenFootprintCells(token)
  const { cols, rows } = mapCellExtent(map)
  return anchor.col >= 0 && anchor.row >= 0 && anchor.col + footprint <= cols && anchor.row + footprint <= rows
}

export function tokenFootprintDistanceCells(a: Token, b: Token, map: BattleMap): number {
  const aCells = tokenOccupiedCellsAt(a, map, a)
  const bCells = tokenOccupiedCellsAt(b, map, b)
  let best = Number.POSITIVE_INFINITY
  for (const ac of aCells) {
    for (const bc of bCells) {
      best = Math.min(best, cellDistance(ac, bc))
    }
  }
  return Number.isFinite(best) ? best : cellDistance(pixelToCell(a.x, a.y, map), pixelToCell(b.x, b.y, map))
}

/** 地图上 token 的显示半径（随格宽缩放；底图网格时更贴合格心） */
export function tokenDisplayRadius(
  gridSize: number,
  tokenSize = 1,
  builtinGrid = false,
): number {
  const g = Math.max(1, gridSize)
  if (builtinGrid) {
    return tokenSize * g * 0.44
  }
  return (tokenSize * g) / 2 - g * 0.06
}

/** 由拖拽手柄位置反算 token 占格倍数 */
export function tokenSizeFromRadius(
  radiusPx: number,
  gridSize: number,
  builtinGrid = false,
): number {
  const g = Math.max(1, gridSize)
  const r = Math.max(4, radiusPx)
  if (builtinGrid) return r / (g * 0.44)
  return (r * 2 + g * 0.06) / g
}

export function clampTokenSize(size: number, min = 0.5, max = 4): number {
  return Math.round(Math.min(max, Math.max(min, size)) * 4) / 4
}

/** 地图网格尺寸允许范围（随底图宽度自适应） */
export function gridSizeBounds(map: Pick<BattleMap, 'width'>): { min: number; max: number } {
  return {
    min: 8,
    max: Math.max(180, Math.min(480, Math.round(map.width / 6))),
  }
}

export function clampGridSize(size: number, map: Pick<BattleMap, 'width'>): number {
  const { min, max } = gridSizeBounds(map)
  return Math.round(Math.min(max, Math.max(min, size)))
}

/** 角色 token 默认占格倍数（识别底图网格时配合 builtinGrid 渲染贴合） */
export function defaultTokenSizeForMap(map: BattleMap): number {
  void map
  return 1
}

export function realignTokensToGrid(tokens: Token[], map: BattleMap): Token[] {
  return tokens.map((t) => {
    const pos = snapTokenToGridCenter(t.x, t.y, t, map)
    return { ...t, ...pos }
  })
}

/** BFS：从起点出发在 maxDist 格内可达且未被占用的格子 */
export function getReachableCells(
  start: GridCell,
  maxDist: number,
  map: BattleMap,
  tokens: Token[],
  movingTokenId: string,
): GridCell[] {
  const blocked = occupiedCells(tokens, map, movingTokenId)
  const movingToken = tokens.find((t) => t.id === movingTokenId)
  const canOccupy = (cell: GridCell) => {
    if (!movingToken) return !blocked.has(cellKey(cell))
    return (
      isFootprintInsideMap(movingToken, cell, map) &&
      tokenFootprintCellsForAnchor(movingToken, cell).every((occupied) => !blocked.has(cellKey(occupied)))
    )
  }
  const visited = new Map<string, number>()
  const queue: { cell: GridCell; dist: number }[] = [{ cell: start, dist: 0 }]
  const reachable: GridCell[] = []
  visited.set(cellKey(start), 0)

  while (queue.length > 0) {
    const { cell, dist } = queue.shift()!
    if (dist > 0) reachable.push(cell)
    if (dist >= maxDist) continue

    for (const [dc, dr] of NEIGHBOR_DIRS) {
      const next = { col: cell.col + dc, row: cell.row + dr }
      const key = cellKey(next)
      if (!canOccupy(next)) continue
      const nd = dist + 1
      const prev = visited.get(key)
      if (prev != null && prev <= nd) continue
      visited.set(key, nd)
      queue.push({ cell: next, dist: nd })
    }
  }
  return reachable
}

export function occupiedCells(tokens: Token[], map: BattleMap, excludeTokenId: string): Set<string> {
  const set = new Set<string>()
  for (const t of tokens) {
    if (t.id === excludeTokenId || t.dnd5eSpellEffect) continue
    for (const cell of tokenOccupiedCellsAt(t, map, t)) {
      set.add(cellKey(cell))
    }
  }
  return set
}

/**
 * 解析放置目标格：若落点格已被其它 token 占用，则向外按环形搜索最近的空格。
 * 允许 token 停留在自己原本的格子（movingTokenId 排除自身）。找不到空格则回退到原始 snap 坐标。
 * 两个 token 不能共享同一格心。
 */
export function resolveFreeDropCell(
  snapX: number,
  snapY: number,
  movingTokenId: string,
  map: BattleMap,
): { x: number; y: number } {
  const blocked = occupiedCells(map.tokens, map, movingTokenId)
  const movingToken = map.tokens.find((t) => t.id === movingTokenId) ?? ({ size: 1 } as Token)
  const target = tokenAnchorCellFromPixel(snapX, snapY, movingToken, map)
  const canOccupy = (anchor: GridCell) =>
    isFootprintInsideMap(movingToken, anchor, map) &&
    tokenFootprintCellsForAnchor(movingToken, anchor).every((cell) => !blocked.has(cellKey(cell)))
  if (canOccupy(target)) return tokenCenterForAnchorCell(target, movingToken, map)
  // 环形扩散搜索最近空格（切比雪夫距离逐环外扩）
  for (let ring = 1; ring <= 8; ring++) {
    for (let dc = -ring; dc <= ring; dc++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue
        const cand: GridCell = { col: target.col + dc, row: target.row + dr }
        if (canOccupy(cand)) return tokenCenterForAnchorCell(cand, movingToken, map)
      }
    }
  }
  return tokenCenterForAnchorCell(target, movingToken, map)
}

/** 向目标靠近一格（斜向一步） */
export function stepToward(from: GridCell, to: GridCell): GridCell {
  let { col, row } = from
  if (col < to.col) col++
  else if (col > to.col) col--
  if (row < to.row) row++
  else if (row > to.row) row--
  return { col, row }
}

export function isPlayerToken(t: Token): boolean {
  return t.type === 'player'
}

/**
 * 敌人 AI 的「敌对目标」集合：玩家 + npc/友方。
 * 排除 enemy（不打自己人）与 obstacle（障碍物）。仅有 npc 友方的遭遇不再 no-op。
 */
export function isHostileToEnemy(t: Token): boolean {
  return dnd5eCombatTokenSide(t) === 'player' || t.type === 'npc'
}

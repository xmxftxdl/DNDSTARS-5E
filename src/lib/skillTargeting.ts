import type { BattleMap, Token } from '../store/maps'
import {
  cellDistance,
  cellKey,
  DND_FEET_PER_CELL,
  feetToMovementCells,
  tokenOccupiedCellsAt,
  type GridCell,
} from './gridCombat'

export type AoeOrigin = 'self' | 'point'

export interface CircleAoeTargeting {
  shape: 'circle'
  origin: AoeOrigin
  radiusFeet: number
  placeRangeFeet?: number
}

export interface RectAoeTargeting {
  shape: 'rect'
  origin: 'point'
  widthFeet: number
  heightFeet: number
  placeRangeFeet?: number
  rotatable?: boolean
}

export interface LineAoeTargeting {
  shape: 'line'
  origin: 'self'
  widthFeet: number
  lengthFeet: number
  /** 瞄准点相对施法者的最远距离（尺）；不设则不限制 */
  aimRangeFeet?: number
}

export interface ConeAoeTargeting {
  shape: 'cone'
  origin: 'self'
  lengthFeet: number
  /** 瞄准点相对施法者的最远距离（尺）；不设则不限制 */
  aimRangeFeet?: number
}

export type SkillAoeTargeting = CircleAoeTargeting | RectAoeTargeting | LineAoeTargeting | ConeAoeTargeting

export function feetToRadiusCells(feet: number): number {
  return feetToMovementCells(feet)
}

/** 尺数 → 占地格数（宽/高/长） */
export function feetToDimensionCells(feet: number): number {
  return Math.max(1, Math.round(feet / DND_FEET_PER_CELL))
}

/** 八向单位向量：从 from 指向 to */
export function lineDirection(from: GridCell, to: GridCell): { dc: number; dr: number } {
  const dc = to.col - from.col
  const dr = to.row - from.row
  if (dc === 0 && dr === 0) return { dc: 1, dr: 0 }
  return {
    dc: dc === 0 ? 0 : dc > 0 ? 1 : -1,
    dr: dr === 0 ? 0 : dr > 0 ? 1 : -1,
  }
}

function aimVector(from: GridCell, to: GridCell): { x: number; y: number } {
  const x = to.col - from.col
  const y = to.row - from.row
  const len = Math.hypot(x, y)
  if (len <= 0.0001) return { x: 1, y: 0 }
  return { x: x / len, y: y / len }
}

function project(points: { x: number; y: number }[], axis: { x: number; y: number }) {
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    const v = p.x * axis.x + p.y * axis.y
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return { min, max }
}

function intervalsOverlap(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.min <= b.max && b.min <= a.max
}

function cellCorners(cell: GridCell): { x: number; y: number }[] {
  const minX = cell.col - 0.5
  const maxX = cell.col + 0.5
  const minY = cell.row - 0.5
  const maxY = cell.row + 0.5
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

function orientedRectCorners(
  center: { x: number; y: number },
  dir: { x: number; y: number },
  widthCells: number,
  heightCells: number,
): { x: number; y: number }[] {
  const perp = { x: -dir.y, y: dir.x }
  const hx = heightCells / 2
  const hw = widthCells / 2
  return [
    { x: center.x - dir.x * hx + perp.x * hw, y: center.y - dir.y * hx + perp.y * hw },
    { x: center.x + dir.x * hx + perp.x * hw, y: center.y + dir.y * hx + perp.y * hw },
    { x: center.x + dir.x * hx - perp.x * hw, y: center.y + dir.y * hx - perp.y * hw },
    { x: center.x - dir.x * hx - perp.x * hw, y: center.y - dir.y * hx - perp.y * hw },
  ]
}

function polygonsTouch(a: { x: number; y: number }[], b: { x: number; y: number }[], axes: { x: number; y: number }[]): boolean {
  return axes.every((axis) => intervalsOverlap(project(a, axis), project(b, axis)))
}

function polygonAxes(points: { x: number; y: number }[]): { x: number; y: number }[] {
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    const dx = next.x - point.x
    const dy = next.y - point.y
    const length = Math.hypot(dx, dy) || 1
    return { x: -dy / length, y: dx / length }
  })
}

function cellTouchesCircle(cell: GridCell, center: GridCell, radiusCells: number): boolean {
  const minX = cell.col - 0.5
  const maxX = cell.col + 0.5
  const minY = cell.row - 0.5
  const maxY = cell.row + 0.5
  const closestX = Math.max(minX, Math.min(center.col, maxX))
  const closestY = Math.max(minY, Math.min(center.row, maxY))
  return Math.hypot(closestX - center.col, closestY - center.row) <= radiusCells
}

function cellTouchesOrientedRect(
  cell: GridCell,
  center: { x: number; y: number },
  dir: { x: number; y: number },
  widthCells: number,
  heightCells: number,
): boolean {
  const rect = orientedRectCorners(center, dir, widthCells, heightCells)
  const square = cellCorners(cell)
  const perp = { x: -dir.y, y: dir.x }
  return polygonsTouch(rect, square, [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    dir,
    perp,
  ])
}

function uniqueCells(cells: GridCell[]): GridCell[] {
  const seen = new Set<string>()
  const out: GridCell[] = []
  for (const c of cells) {
    const k = cellKey(c)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out
}

export function cellsInCircleRadius(center: GridCell, radiusFeet: number): GridCell[] {
  const r = Math.max(0, radiusFeet / DND_FEET_PER_CELL)
  const scan = Math.ceil(r + 1)
  const cells: GridCell[] = []
  for (let row = Math.floor(center.row - scan); row <= Math.ceil(center.row + scan); row++) {
    for (let col = Math.floor(center.col - scan); col <= Math.ceil(center.col + scan); col++) {
      if (cellTouchesCircle({ col, row }, center, r)) {
        cells.push({ col, row })
      }
    }
  }
  return cells
}

/**
 * 直线路径：从 origin 沿瞄准方向延伸 lengthFeet，宽度 widthFeet 覆盖所有方格。
 */
export function cellsInLine(
  origin: GridCell,
  aim: GridCell,
  widthFeet: number,
  lengthFeet: number,
): GridCell[] {
  const dir = aimVector(origin, aim)
  const lengthCells = lengthFeet / DND_FEET_PER_CELL
  const widthCells = widthFeet / DND_FEET_PER_CELL
  const scan = Math.ceil(lengthCells + widthCells + 1)
  const center = {
    x: origin.col + dir.x * lengthCells / 2,
    y: origin.row + dir.y * lengthCells / 2,
  }

  const cells: GridCell[] = []
  for (let row = origin.row - scan; row <= origin.row + scan; row++) {
    for (let col = origin.col - scan; col <= origin.col + scan; col++) {
      if (cellTouchesOrientedRect({ col, row }, center, dir, widthCells, lengthCells)) {
        cells.push({ col, row })
      }
    }
  }
  return uniqueCells(cells)
}

/**
 * 2014 版锥状模板：尖端位于施法者格中心，末端宽度等于锥长。
 * 以多边形相交而非只测格心，保证大型 Token 与边缘方格也能正确进入范围。
 */
export function cellsInCone(
  origin: GridCell,
  aim: GridCell,
  lengthFeet: number,
): GridCell[] {
  const dir = aimVector(origin, aim)
  const perp = { x: -dir.y, y: dir.x }
  const lengthCells = lengthFeet / DND_FEET_PER_CELL
  const halfWidth = lengthCells / 2
  const end = { x: origin.col + dir.x * lengthCells, y: origin.row + dir.y * lengthCells }
  const cone = [
    { x: origin.col, y: origin.row },
    { x: end.x + perp.x * halfWidth, y: end.y + perp.y * halfWidth },
    { x: end.x - perp.x * halfWidth, y: end.y - perp.y * halfWidth },
  ]
  const scan = Math.ceil(lengthCells + 1)
  const axes = [...polygonAxes(cone), { x: 1, y: 0 }, { x: 0, y: 1 }]
  const cells: GridCell[] = []
  for (let row = origin.row - scan; row <= origin.row + scan; row++) {
    for (let col = origin.col - scan; col <= origin.col + scan; col++) {
      if (polygonsTouch(cone, cellCorners({ col, row }), axes)) cells.push({ col, row })
    }
  }
  return uniqueCells(cells)
}

/**
 * 矩形区域：以 anchor 为中心，长边沿 caster→anchor 方向，覆盖 widthFeet × heightFeet 内所有方格。
 */
export function cellsInRect(
  anchor: GridCell,
  orientFrom: GridCell,
  widthFeet: number,
  heightFeet: number,
): GridCell[] {
  const dir = aimVector(orientFrom, anchor)
  const wCells = widthFeet / DND_FEET_PER_CELL
  const hCells = heightFeet / DND_FEET_PER_CELL
  const scan = Math.ceil(Math.max(wCells, hCells) + 1)

  const cells: GridCell[] = []
  for (let row = Math.floor(anchor.row - scan); row <= Math.ceil(anchor.row + scan); row++) {
    for (let col = Math.floor(anchor.col - scan); col <= Math.ceil(anchor.col + scan); col++) {
      if (cellTouchesOrientedRect({ col, row }, { x: anchor.col, y: anchor.row }, dir, wCells, hCells)) {
        cells.push({ col, row })
      }
    }
  }
  return uniqueCells(cells)
}

export function cellsForAoe(
  aoe: SkillAoeTargeting,
  casterCell: GridCell,
  anchorCell: GridCell,
): GridCell[] {
  switch (aoe.shape) {
    case 'circle': {
      const center = aoe.origin === 'self' ? casterCell : anchorCell
      return cellsInCircleRadius(center, aoe.radiusFeet)
    }
    case 'line':
      return cellsInLine(casterCell, anchorCell, aoe.widthFeet, aoe.lengthFeet)
    case 'cone':
      return cellsInCone(casterCell, anchorCell, aoe.lengthFeet)
    case 'rect':
      return cellsInRect(anchorCell, casterCell, aoe.widthFeet, aoe.heightFeet)
  }
}

export function aoeOrientFromCell(
  aoe: SkillAoeTargeting,
  casterCell: GridCell,
  anchorCell: GridCell,
  opts?: { rectRotation?: number; rectAngleDegrees?: number },
): GridCell {
  if (aoe.shape !== 'rect' || !aoe.rotatable) return casterCell
  if (Number.isFinite(opts?.rectAngleDegrees)) {
    const radians = ((Number(opts?.rectAngleDegrees) - 90) * Math.PI) / 180
    return {
      col: anchorCell.col - Math.cos(radians),
      row: anchorCell.row - Math.sin(radians),
    }
  }
  const rotation = opts?.rectRotation ?? 0
  const dir = [
    { col: 0, row: -1 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: -1, row: 0 },
  ][((rotation % 4) + 4) % 4]
  return { col: anchorCell.col - dir.col, row: anchorCell.row - dir.row }
}

export function canPlaceAoe(
  aoe: SkillAoeTargeting,
  casterCell: GridCell,
  anchorCell: GridCell,
): boolean {
  switch (aoe.shape) {
    case 'circle':
      if (aoe.origin === 'self') return true
      if (aoe.placeRangeFeet == null) return true
      return cellDistance(casterCell, anchorCell) <= feetToRadiusCells(aoe.placeRangeFeet)
    case 'line':
      if (aoe.aimRangeFeet == null) return true
      return cellDistance(casterCell, anchorCell) <= feetToRadiusCells(aoe.aimRangeFeet)
    case 'cone':
      if (aoe.aimRangeFeet == null) return true
      return cellDistance(casterCell, anchorCell) <= feetToRadiusCells(aoe.aimRangeFeet)
    case 'rect':
      if (aoe.placeRangeFeet == null) return true
      return cellDistance(casterCell, anchorCell) <= feetToRadiusCells(aoe.placeRangeFeet)
  }
}

/** @deprecated 使用 canPlaceAoe */
export function canPlaceCircleCenter(
  casterCell: GridCell,
  centerCell: GridCell,
  aoe: CircleAoeTargeting,
): boolean {
  return canPlaceAoe(aoe, casterCell, centerCell)
}

export function tokensInCells(map: BattleMap, tokens: Token[], cells: GridCell[]): Token[] {
  const set = new Set(cells.map(cellKey))
  return tokens.filter((token) =>
    tokenOccupiedCellsAt(token, map, token).some((cell) => set.has(cellKey(cell))),
  )
}

export function formatAoeHint(aoe: SkillAoeTargeting): string {
  switch (aoe.shape) {
    case 'circle': {
      const r = `${aoe.radiusFeet} \u5c3a`
      if (aoe.origin === 'self') return `\u4ee5\u81ea\u8eab\u4e3a\u5706\u5fc3\uff0c${r} \u5706\u5f62\u8303\u56f4`
      const place = aoe.placeRangeFeet != null ? `\u5728 ${aoe.placeRangeFeet} \u5c3a\u5185` : '\u5728\u5730\u56fe\u4e0a'
      return `${place}\u9009\u62e9\u5706\u5fc3\uff0c${r} \u5706\u5f62\u8303\u56f4`
    }
    case 'line':
      return `\u4ece\u89d2\u8272\u6cbf\u7784\u51c6\u65b9\u5411\uff0c${aoe.widthFeet}\u00d7${aoe.lengthFeet} \u5c3a\u76f4\u7ebf\u8def\u5f84`
    case 'cone':
      return `\u4ee5\u81ea\u8eab\u4e3a\u9876\u70b9\uff0c${aoe.lengthFeet} \u5c3a\u9525\u72b6\u8303\u56f4`
    case 'rect': {
      const place = aoe.placeRangeFeet != null ? `\u5728 ${aoe.placeRangeFeet} \u5c3a\u5185` : '\u5728\u5730\u56fe\u4e0a'
      return `${place}\u9009\u62e9\u77e9\u5f62\u4e2d\u5fc3\uff0c${aoe.widthFeet}\u00d7${aoe.heightFeet} \u5c3a\u533a\u57df`
    }
  }
}

export function isSelfOriginCircleAoe(aoe: SkillAoeTargeting): boolean {
  return aoe.shape === 'circle' && aoe.origin === 'self'
}

export function aoeUsesMouseAim(aoe: SkillAoeTargeting): boolean {
  if (aoe.shape === 'line' || aoe.shape === 'cone') return true
  if (aoe.shape === 'circle' && aoe.origin === 'point') return true
  if (aoe.shape === 'rect') return true
  return false
}

export function aoeConfirmHint(aoe: SkillAoeTargeting, valid: boolean): string {
  if (isSelfOriginCircleAoe(aoe)) return ' \u00b7 \u70b9\u51fb\u81ea\u8eab\u786e\u8ba4\u91ca\u653e'
  if (!valid) {
    if (aoe.shape === 'line' || aoe.shape === 'cone') return ' \u00b7 \u7784\u51c6\u70b9\u8d85\u51fa\u8ddd\u79bb'
    if (aoe.shape === 'rect') return ' \u00b7 \u77e9\u5f62\u4e2d\u5fc3\u8d85\u51fa\u8ddd\u79bb'
    return ' \u00b7 \u5706\u5fc3\u8d85\u51fa\u8ddd\u79bb'
  }
  return ' \u00b7 \u79fb\u52a8\u9f20\u6807\u9884\u89c8\uff0c\u70b9\u51fb\u786e\u8ba4'
}

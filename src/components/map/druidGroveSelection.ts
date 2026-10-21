import { normalizeDnd5eGroveWindWall, type Dnd5eGroveWindWall } from '../../rulesets/dnd5e/druidGroveWindWalls'
import type { BattleMap } from '../../store/maps'
import type { GridCell } from '../../lib/gridCombat'
import type { MapGeometryState } from '../../lib/mapGeometry'
import type { AppActionChoiceOptions, AppMultiChoiceOptions } from '../../lib/appDialog'
import type { Dnd5eActivityAreaMapSelectionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import { prepareDnd5eDruidGroveMapPlacement } from '../../rulesets/dnd5e/druidGroveMapPlacement'
import { normalizeDnd5eGroveActivitySelection } from '../../rulesets/dnd5e/druidGroveActivityPlacement'

/** Host-side interactive choices. All returned geometry is revalidated by the map handoff. */
export async function requestDnd5eGroveSelection(input: {
  map: BattleMap; geometry: MapGeometryState; area: Dnd5eActivityAreaMapSelectionV1; actorId: string
  isCurrent: () => boolean
  choose: (options: AppActionChoiceOptions) => Promise<string | null>
  chooseMany: (options: AppMultiChoiceOptions) => Promise<string[] | null>
  promptPassword?: () => Promise<string | null>
  chooseCells: (label: string, cells: readonly GridCell[], count: number, minimumCells?: number) => Promise<readonly GridCell[] | undefined>
}) {
  if (!input.isCurrent() || !input.area.cells.length) return undefined
  const p = input.area.areaPlacement
  if (p.widthFeet !== p.lengthFeet || p.widthFeet !== p.heightFeet || p.widthFeet == null || p.elevationFeet == null) return undefined
  const origin = { col: Math.min(...input.area.cells.map(c => c.col)), row: Math.min(...input.area.cells.map(c => c.row)) }
  const structures = input.geometry.obstacles.filter(obstacle => !obstacle.terrainRegion && obstacle.points.length >= 3 && obstacle.heightFeet > 0)
  const structureIds = structures.length ? await input.chooseMany({ title: '林地 · 建筑与构造物',
    message: '由 DM 勾选属于建筑或其他构造物的障碍；这些空间不受林地影响。', options: structures.map(s => ({ id: s.id, label: s.label || s.id })), selectedIds: [] }) : []
  if (structureIds == null || !input.isCurrent()) return undefined
  const trees = input.map.tokens.filter(t => t.type === 'obstacle' && t.dnd5eObjectState?.vegetation === 'living')
  const treeIds = trees.length ? await input.chooseMany({ title: '林地 · 守卫树木', message: '勾选最多四棵真实树木作为守卫。其他植物不要勾选。',
    options: trees.map(t => ({ id: t.id, label: t.label })), selectedIds: [] }) : []
  if (treeIds == null || treeIds.length > 4 || !input.isCurrent()) return undefined
  const qualifications = { structureObstacleIds: structureIds, treeTokenIds: treeIds }
  const placement = { origin, sideFeet: p.widthFeet, fogCells: [] as readonly GridCell[], undergrowthCells: [] as readonly GridCell[], guardianTreeIds: treeIds }
  const ground = prepareDnd5eDruidGroveMapPlacement({ map: input.map, geometry: input.geometry, placement,
    baseElevationFeet: p.elevationFeet, qualifications })
  if (!ground.ok) return undefined
  const fogCells = await input.chooseCells('林地 · 重雾（可不选）', ground.protectedCells, ground.protectedCells.length, 0)
  if (!fogCells || !input.isCurrent()) return undefined
  const remaining = ground.protectedCells.filter(c => !fogCells.some(f => f.col === c.col && f.row === c.row))
  const undergrowthCells = remaining.length ? await input.chooseCells('林地 · 纠缠灌木（可不选）', remaining, remaining.length, 0) : []
  if (!undergrowthCells || !input.isCurrent()) return undefined
  const exemptTokenIds = await input.chooseMany({ title: '林地 · 免疫生物', message: '勾选不受本次林地任何效果影响的生物。',
    options: input.map.tokens.filter(t => t.type !== 'obstacle').map(t => ({ id: t.id, label: t.label })), selectedIds: [input.actorId] })
  if (!exemptTokenIds || !input.isCurrent()) return undefined
  const secretPhrase = input.promptPassword ? await input.promptPassword() : ''
  if (secretPhrase == null || !input.isCurrent()) return undefined
  const mode = await input.choose({ title: '林地 · 额外效果', message: '选择一组额外效果。', options: [
    { id: 'none', label: '无' }, { id: 'gusts', label: '两处造风术' }, { id: 'spike-growth', label: '一处荆棘丛生' }, { id: 'wind-walls', label: '两处风墙术' },
  ] })
  if (!mode || !input.isCurrent()) return undefined
  let extra: unknown = { kind: mode }
  if (mode === 'spike-growth') {
    const cells = await input.chooseCells('荆棘丛生 · 中心', ground.protectedCells, 1)
    if (!cells?.[0] || !input.isCurrent()) return undefined
    extra = { kind: mode, center: cells[0] }
  } else if (mode === 'gusts' || mode === 'wind-walls') {
    const winds = [], walls: Dnd5eGroveWindWall[] = []
    for (let index = 0; index < 2; index++) {
      if (mode === 'wind-walls') {
        const shape = await input.choose({ title: `风墙 ${index + 1} · 形状`, message: '风墙可以沿地面转折；选择连续路径或直线。',
          options: [{ id: 'path', label: '地图绘制连续路径' }, { id: 'straight', label: '直线' }] })
        if (!shape || !input.isCurrent()) return undefined
        if (shape === 'path') {
          const path = await input.chooseCells(`风墙 ${index + 1} · 按顺序选择相邻格（总长不超过50尺）`, ground.protectedCells, 10, 1)
          const wall = normalizeDnd5eGroveWindWall({ path })
          if (!wall || !input.isCurrent()) return undefined
          walls.push(wall)
          continue
        }
        if (shape !== 'straight') return undefined
      }
      const cells = await input.chooseCells(`${mode === 'gusts' ? '造风术起点' : '风墙中心'}与方向 · 第 ${index + 1} 处`, ground.protectedCells, 2)
      if (cells?.length !== 2 || !input.isCurrent()) return undefined
      if (mode === 'gusts') winds.push({ origin: cells[0], aim: cells[1] })
      else {
        const length = await input.choose({ title: `风墙 ${index + 1} · 长度`, message: '选择风墙长度。',
          options: Array.from({ length: 10 }, (_, i) => ({ id: String((i + 1) * 5), label: `${(i + 1) * 5} 尺` })) })
        if (!length || !input.isCurrent()) return undefined
        walls.push({ center: cells[0], aim: cells[1], lengthFeet: Number(length) })
      }
    }
    extra = mode === 'gusts' ? { kind: mode, winds } : { kind: mode, walls }
  }
  const groveSelection = normalizeDnd5eGroveActivitySelection({ placement: { ...placement, fogCells, undergrowthCells },
    baseElevationFeet: p.elevationFeet, exemptTokenIds, extra, ...(secretPhrase.trim() ? { secretPhrase } : {}) })
  return groveSelection && input.isCurrent() ? { groveSelection, groveQualifications: qualifications } : undefined
}

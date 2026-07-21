import {
  DND_FEET_PER_CELL,
  tokenAnchorCellFromPixel,
  type GridCell,
} from '../../lib/gridCombat'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type {
  Dnd5ePersistentAreaAnchorMode,
  Dnd5ePersistentAreaMovementDeclaration,
  Dnd5ePersistentAreaTriggerDeclaration,
  Dnd5ePersistentAreaTriggerSnapshot,
  Dnd5ePersistentAreaVisual,
} from './persistentAreaTypes'

export interface Dnd5eCoreSpellAreaDamageDeclaration {
  count: number
  sides: number
  modifier?: number
  perHigherSlot?: number
  type: NonNullable<Dnd5ePersistentAreaTriggerDeclaration['damage']>['type']
}

export interface Dnd5eCoreSpellAreaTriggerDeclaration extends Omit<
  Dnd5ePersistentAreaTriggerDeclaration,
  'savingThrow' | 'damage'
> {
  savingThrow?: Omit<NonNullable<Dnd5ePersistentAreaTriggerDeclaration['savingThrow']>, 'dc'>
  damage?: Dnd5eCoreSpellAreaDamageDeclaration
}

export interface Dnd5eCoreSpellAreaDeclaration {
  spellId: string
  label: string
  minimumSlotLevel: number
  template: SkillAoeTargeting
  durationRounds: number
  concentration: boolean
  anchorMode: Dnd5ePersistentAreaAnchorMode
  movement?: Dnd5ePersistentAreaMovementDeclaration
  relation?: 'any' | 'ally' | 'enemy'
  includeSelf?: boolean
  movementCostMultiplier?: number
  damageTypeBySourceAlignment?: { evil: Dnd5eCoreSpellAreaDamageDeclaration['type']; otherwise: Dnd5eCoreSpellAreaDamageDeclaration['type'] }
  color: string
  visual: Dnd5ePersistentAreaVisual
  triggers: readonly Dnd5eCoreSpellAreaTriggerDeclaration[]
}

/**
 * 核心区域注册表按法术逐项扩充。插件不会写入这个表；它们继续通过
 * Headless Plugin API V2 的声明边界创建区域。
 */
export const DND5E_CORE_SPELL_AREA_DECLARATIONS: readonly Dnd5eCoreSpellAreaDeclaration[] = [
  {
    spellId: 'spirit-guardians',
    label: '灵体卫士',
    minimumSlotLevel: 3,
    template: { shape: 'circle', origin: 'self', radiusFeet: 15 },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'source-token',
    relation: 'enemy',
    includeSelf: false,
    movementCostMultiplier: 2,
    damageTypeBySourceAlignment: { evil: 'necrotic', otherwise: 'radiant' },
    color: '#fef3c7',
    visual: { preset: 'spirit-guardians', intensity: 'normal' },
    triggers: [
      {
        id: 'spirit-guardians-enter', label: '灵体卫士·进入区域', timing: 'on-enter', oncePerRound: true,
        savingThrow: { ability: 'wis', onSuccess: 'half' },
        damage: { count: 3, sides: 8, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
      {
        id: 'spirit-guardians-turn-start', label: '灵体卫士·回合开始', timing: 'turn-start', oncePerRound: true,
        savingThrow: { ability: 'wis', onSuccess: 'half' },
        damage: { count: 3, sides: 8, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'moonbeam',
    label: '月华之光',
    minimumSlotLevel: 2,
    template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 120 },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    movement: { economy: 'action', maximumFeet: 60 },
    relation: 'any',
    includeSelf: true,
    color: '#dbeafe',
    visual: { preset: 'moonbeam', intensity: 'strong' },
    triggers: [
      {
        id: 'moonbeam-enter', label: '月华之光·进入光柱', timing: 'on-enter', oncePerRound: true,
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 2, sides: 10, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
      {
        id: 'moonbeam-turn-start', label: '月华之光·回合开始', timing: 'turn-start', oncePerRound: true,
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 2, sides: 10, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
    ],
  },
]

export function getDnd5eCoreSpellAreaDeclaration(
  spellId: string,
): Dnd5eCoreSpellAreaDeclaration | undefined {
  return DND5E_CORE_SPELL_AREA_DECLARATIONS.find((definition) => definition.spellId === spellId)
}

function resolvedTrigger(
  declaration: Dnd5eCoreSpellAreaTriggerDeclaration,
  input: { slotLevel: number; minimumSlotLevel: number; sourceSaveDc: number },
  damageType?: Dnd5eCoreSpellAreaDamageDeclaration['type'],
): Dnd5ePersistentAreaTriggerSnapshot {
  const higherLevels = Math.max(0, input.slotLevel - input.minimumSlotLevel)
  return {
    id: declaration.id,
    label: declaration.label,
    timing: declaration.timing,
    oncePerRound: declaration.oncePerRound !== false,
    movementIntervalFeet: declaration.movementIntervalFeet,
    savingThrow: declaration.savingThrow
      ? { ...declaration.savingThrow, dc: input.sourceSaveDc }
      : undefined,
    damage: declaration.damage
      ? {
          count: declaration.damage.count + higherLevels * (declaration.damage.perHigherSlot ?? 0),
          sides: declaration.damage.sides,
          modifier: declaration.damage.modifier ?? 0,
          type: damageType ?? declaration.damage.type,
        }
      : undefined,
    condition: declaration.condition,
    dmAdjustable: declaration.dmAdjustable === true,
  }
}

export function createDnd5eCoreSpellArea(input: {
  declaration: Dnd5eCoreSpellAreaDeclaration
  actionId: string
  sourceCharacterId: string
  sourceTokenId: string
  slotLevel: number
  sourceSaveDc: number
  round: number
  cells: readonly GridCell[]
  anchorCell: GridCell
  anchorTokenId?: string
  durationRounds?: number
  sourceAlignment?: string
}): Dnd5ePluginArea {
  const declaration = input.declaration
  const sourceIsEvil = /邪恶|evil/i.test(input.sourceAlignment ?? '')
  const alignmentDamageType = declaration.damageTypeBySourceAlignment
    ? sourceIsEvil
      ? declaration.damageTypeBySourceAlignment.evil
      : declaration.damageTypeBySourceAlignment.otherwise
    : undefined
  return {
    id: `core-spell-area:${input.actionId}`,
    pluginId: 'srd-5.1',
    featureId: `srd-5.1:spell:${declaration.spellId}`,
    sourceKind: 'core-spell',
    coreSpellId: declaration.spellId,
    slotLevel: input.slotLevel,
    label: declaration.label,
    color: declaration.color,
    sourceCharacterId: input.sourceCharacterId,
    sourceTokenId: input.sourceTokenId,
    cells: input.cells.map((cell) => ({ ...cell })),
    createdRound: input.round,
    expiresAfterRound: input.round + (input.durationRounds ?? declaration.durationRounds),
    concentrationId: declaration.concentration ? declaration.spellId : undefined,
    anchorMode: declaration.anchorMode,
    anchorTokenId: input.anchorTokenId ?? (
      declaration.anchorMode === 'source-token' ? input.sourceTokenId : undefined
    ),
    anchorCell: { ...input.anchorCell },
    movement: declaration.movement ? { ...declaration.movement } : undefined,
    movementCostMultiplier: declaration.movementCostMultiplier,
    relation: declaration.relation ?? 'any',
    includeSelf: declaration.includeSelf === true,
    visual: { ...declaration.visual },
    triggers: declaration.triggers.map((trigger) => resolvedTrigger(trigger, {
      slotLevel: input.slotLevel,
      minimumSlotLevel: declaration.minimumSlotLevel,
      sourceSaveDc: input.sourceSaveDc,
    }, alignmentDamageType)),
  }
}

function shiftedCells(
  area: Dnd5ePluginArea,
  anchorCell: GridCell,
  map: BattleMap,
): GridCell[] {
  const previous = area.anchorCell ?? area.cells[0]
  const dc = anchorCell.col - previous.col
  const dr = anchorCell.row - previous.row
  const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
  const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
  return area.cells
    .map((cell) => ({ col: cell.col + dc, row: cell.row + dr }))
    .filter((cell) => cell.col >= 0 && cell.row >= 0 && cell.col < columns && cell.row < rows)
}

export function moveDnd5eCoreSpellArea(input: {
  map: BattleMap
  areaId: string
  sourceTokenId: string
  targetCell: GridCell
}): { ok: true; map: BattleMap; area: Dnd5ePluginArea; distanceFeet: number } | { ok: false; reason: string } {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  if (!area || area.sourceKind !== 'core-spell' || !area.movement) return { ok: false, reason: 'area-not-movable' }
  if (area.sourceTokenId !== input.sourceTokenId) return { ok: false, reason: 'invalid-source' }
  const previous = area.anchorCell ?? area.cells[0]
  const cells = Math.max(Math.abs(input.targetCell.col - previous.col), Math.abs(input.targetCell.row - previous.row))
  const distanceFeet = cells * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  if (distanceFeet > area.movement.maximumFeet) return { ok: false, reason: 'target-out-of-range' }
  const nextArea = {
    ...area,
    cells: shiftedCells(area, input.targetCell, input.map),
    anchorCell: { ...input.targetCell },
  }
  if (nextArea.cells.length !== area.cells.length) return { ok: false, reason: 'invalid-target' }
  return {
    ok: true,
    map: {
      ...input.map,
      dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map((candidate) =>
        candidate.id === area.id ? nextArea : candidate,
      ),
    },
    area: nextArea,
    distanceFeet,
  }
}

export function reconcileDnd5ePersistentAreaAnchors(map: BattleMap): BattleMap {
  let changed = false
  const areas = (map.dnd5ePluginAreas ?? []).map((area) => {
    if (area.anchorMode !== 'source-token' && area.anchorMode !== 'effect-token') return area
    const anchorToken = map.tokens.find((token) => token.id === (area.anchorTokenId ?? area.sourceTokenId))
    if (!anchorToken) return area
    const anchorCell = tokenAnchorCellFromPixel(anchorToken.x, anchorToken.y, anchorToken, map)
    if (anchorCell.col === area.anchorCell?.col && anchorCell.row === area.anchorCell?.row) return area
    const cells = shiftedCells(area, anchorCell, map)
    if (cells.length < 1) return area
    changed = true
    return { ...area, cells, anchorCell }
  })
  return changed ? { ...map, dnd5ePluginAreas: areas } : map
}

export function dnd5eCoreSpellAreasOwnedBy(
  map: BattleMap,
  sourceToken: Pick<Token, 'id'>,
): Dnd5ePluginArea[] {
  return (map.dnd5ePluginAreas ?? []).filter((area) =>
    area.sourceKind === 'core-spell' && area.sourceTokenId === sourceToken.id,
  )
}

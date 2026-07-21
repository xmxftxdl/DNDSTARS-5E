import {
  DND_FEET_PER_CELL,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
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
    spellId: 'flaming-sphere',
    label: '炽焰法球',
    minimumSlotLevel: 2,
    template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 60 },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'effect-token',
    movement: { economy: 'bonus-action', maximumFeet: 30 },
    relation: 'any',
    includeSelf: true,
    color: '#f97316',
    visual: { preset: 'flaming-sphere', intensity: 'strong' },
    triggers: [
      {
        id: 'flaming-sphere-impact', label: '炽焰法球·撞击', timing: 'on-area-move-impact',
        oncePerRound: false,
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 2, sides: 6, perHigherSlot: 1, type: 'fire' },
        dmAdjustable: true,
      },
      {
        id: 'flaming-sphere-turn-end', label: '炽焰法球·回合结束', timing: 'turn-end',
        oncePerRound: true,
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 2, sides: 6, perHigherSlot: 1, type: 'fire' },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'spike-growth',
    label: '荆棘丛生',
    minimumSlotLevel: 2,
    template: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 150 },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#84cc16',
    visual: { preset: 'spike-growth', intensity: 'strong' },
    triggers: [{
      id: 'spike-growth-movement', label: '荆棘丛生·区域内移动', timing: 'on-move-distance',
      oncePerRound: false, movementIntervalFeet: 5,
      damage: { count: 2, sides: 4, type: 'piercing' },
      dmAdjustable: true,
    }],
  },
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
        id: 'spirit-guardians-damage', label: '灵体卫士·进入区域', timing: 'on-enter', oncePerTurn: true,
        savingThrow: { ability: 'wis', onSuccess: 'half' },
        damage: { count: 3, sides: 8, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
      {
        id: 'spirit-guardians-damage', label: '灵体卫士·回合开始', timing: 'turn-start', oncePerTurn: true,
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
        id: 'moonbeam-damage', label: '月华之光·进入光柱', timing: 'on-enter', oncePerTurn: true,
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 2, sides: 10, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
      {
        id: 'moonbeam-damage', label: '月华之光·回合开始', timing: 'turn-start', oncePerTurn: true,
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
    oncePerRound: declaration.oncePerTurn === true ? false : declaration.oncePerRound !== false,
    oncePerTurn: declaration.oncePerTurn === true,
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
  const anchorToken = area.anchorMode === 'effect-token' && area.anchorTokenId
    ? input.map.tokens.find((token) => token.id === area.anchorTokenId)
    : undefined
  const anchorPosition = anchorToken
    ? tokenCenterForAnchorCell(input.targetCell, anchorToken, input.map)
    : undefined
  return {
    ok: true,
    map: {
      ...input.map,
      dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map((candidate) =>
        candidate.id === area.id ? nextArea : candidate,
      ),
      tokens: anchorToken && anchorPosition
        ? input.map.tokens.map((token) => token.id === anchorToken.id ? { ...token, ...anchorPosition } : token)
        : input.map.tokens,
    },
    area: nextArea,
    distanceFeet,
  }
}

/**
 * 将一次 Headless 结算对核心法术效果 Token 的增删改合并到最新地图，
 * 避免 Interrupt 等待期间用旧地图快照覆盖其他 Token 的移动或生命值。
 */
export function mergeDnd5eSpellEffectTokenDelta(input: {
  currentMap: BattleMap
  beforeMap: BattleMap
  afterMap: BattleMap
}): Token[] {
  const before = new Map(input.beforeMap.tokens
    .filter((token) => token.dnd5eSpellEffect)
    .map((token) => [token.id, token]))
  const after = new Map(input.afterMap.tokens
    .filter((token) => token.dnd5eSpellEffect)
    .map((token) => [token.id, token]))
  const removedIds = new Set([...before.keys()].filter((id) => !after.has(id)))
  const changed = new Map([...after].filter(([id, token]) =>
    JSON.stringify(before.get(id)) !== JSON.stringify(token),
  ))
  const merged = input.currentMap.tokens
    .filter((token) => !removedIds.has(token.id))
    .map((token) => changed.get(token.id) ?? token)
  const presentIds = new Set(merged.map((token) => token.id))
  for (const [id, token] of changed) {
    if (!presentIds.has(id)) merged.push(token)
  }
  return merged
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

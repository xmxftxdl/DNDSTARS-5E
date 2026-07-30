import {
  DND_FEET_PER_CELL,
  cellKey,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { mapGeometryMovementBlocked, type MapGeometryState } from '../../lib/mapGeometry'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type {
  Dnd5ePersistentAreaAnchorMode,
  Dnd5ePersistentAreaMovementDeclaration,
  Dnd5ePersistentAreaLighting,
  Dnd5ePersistentAreaTriggerDeclaration,
  Dnd5ePersistentAreaTriggerSnapshot,
  Dnd5ePersistentAreaVisual,
} from './persistentAreaTypes'
import { dnd5eMovementPathCells } from './itemAreas'

export interface Dnd5eCoreSpellAreaDamageDeclaration {
  count: number
  sides: number
  modifier?: number
  perHigherSlot?: number
  type: NonNullable<Dnd5ePersistentAreaTriggerDeclaration['damage']>['type']
}

export interface Dnd5eCoreSpellAreaTriggerDeclaration extends Omit<
  Dnd5ePersistentAreaTriggerDeclaration,
  'savingThrow' | 'damage' | 'condition'
> {
  savingThrow?: Omit<NonNullable<Dnd5ePersistentAreaTriggerDeclaration['savingThrow']>, 'dc'>
  damage?: Dnd5eCoreSpellAreaDamageDeclaration
  condition?: Omit<NonNullable<Dnd5ePersistentAreaTriggerDeclaration['condition']>, 'escapeCheck'> & {
    escapeCheck?: Omit<
      NonNullable<NonNullable<Dnd5ePersistentAreaTriggerDeclaration['condition']>['escapeCheck']>,
      'dc'
    >
  }
}

export interface Dnd5eCoreSpellAreaDeclaration {
  spellId: string
  label: string
  minimumSlotLevel: number
  template: SkillAoeTargeting
  durationRounds: number
  /** 区域在施法者下一回合结束时到期，而不是在整轮切换时提前移除。 */
  expiresAtSourceNextTurnEnd?: boolean
  concentration: boolean
  anchorMode: Dnd5ePersistentAreaAnchorMode
  movement?: Dnd5ePersistentAreaMovementDeclaration
  relation?: 'any' | 'ally' | 'enemy'
  includeSelf?: boolean
  hiddenFromPlayers?: boolean
  lighting?: Dnd5ePersistentAreaLighting
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
    spellId: 'darkness',
    label: '黑暗术',
    minimumSlotLevel: 2,
    template: { shape: 'circle', origin: 'point', radiusFeet: 15, placeRangeFeet: 60 },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    lighting: {
      kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2,
      suppressesMagicalLightThroughLevel: 2,
    },
    color: '#312e81',
    visual: { preset: 'darkness', intensity: 'strong' },
    triggers: [],
  },
  {
    spellId: 'daylight',
    label: '昼明术',
    minimumSlotLevel: 3,
    template: { shape: 'circle', origin: 'point', radiusFeet: 120, placeRangeFeet: 60 },
    durationRounds: 600,
    concentration: false,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    lighting: {
      kind: 'light', brightRadiusFeet: 60, dimRadiusFeet: 60, color: '#fef3c7', spellLevel: 3,
      suppressesMagicalDarknessThroughLevel: 3,
    },
    color: '#fde68a',
    visual: { preset: 'daylight', intensity: 'subtle' },
    triggers: [],
  },
  {
    spellId: 'grease',
    label: '油腻术',
    minimumSlotLevel: 1,
    template: { shape: 'rect', origin: 'point', widthFeet: 10, heightFeet: 10, placeRangeFeet: 60 },
    durationRounds: 10,
    concentration: false,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#d6a84b',
    visual: { preset: 'grease', intensity: 'normal' },
    triggers: [
      {
        id: 'grease-create', label: '油腻术·油脂出现', timing: 'on-create',
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
        dmAdjustable: true,
      },
      {
        id: 'grease-enter', label: '油腻术·进入区域', timing: 'on-enter', oncePerRound: false,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
        dmAdjustable: true,
      },
      {
        id: 'grease-turn-end', label: '油腻术·回合结束', timing: 'turn-end', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'entangle',
    label: '纠缠术',
    minimumSlotLevel: 1,
    template: { shape: 'rect', origin: 'point', widthFeet: 20, heightFeet: 20, placeRangeFeet: 90 },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#4d7c0f',
    visual: { preset: 'entangle', intensity: 'normal' },
    triggers: [{
      id: 'entangle-create',
      label: '纠缠术·植物缠绕',
      timing: 'on-create',
      savingThrow: { ability: 'str', onSuccess: 'none' },
      condition: {
        condition: 'restrained',
        duration: { expiresAt: 'permanent' },
        escapeCheck: { ability: 'str', economy: 'action' },
      },
      dmAdjustable: true,
    }],
  },
  {
    spellId: 'black-tentacles',
    label: '黑触手',
    minimumSlotLevel: 4,
    template: { shape: 'rect', origin: 'point', widthFeet: 20, heightFeet: 20, placeRangeFeet: 90 },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#312e81',
    visual: { preset: 'black-tentacles', intensity: 'strong' },
    triggers: [
      {
        id: 'black-tentacles-enter',
        frequencyGroupId: 'black-tentacles-grasp',
        label: '黑触手·首次进入',
        timing: 'on-enter',
        oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        damage: { count: 3, sides: 6, type: 'bludgeoning' },
        condition: {
          condition: 'restrained',
          duration: { expiresAt: 'permanent' },
          escapeCheck: { ability: 'str', alternativeAbility: 'dex', economy: 'action' },
        },
        dmAdjustable: true,
      },
      {
        id: 'black-tentacles-turn-start',
        frequencyGroupId: 'black-tentacles-grasp',
        label: '黑触手·回合开始',
        timing: 'turn-start',
        oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        skipSaveWhenSourceConditionActive: 'restrained',
        damage: { count: 3, sides: 6, type: 'bludgeoning' },
        condition: {
          condition: 'restrained',
          duration: { expiresAt: 'permanent' },
          escapeCheck: { ability: 'str', alternativeAbility: 'dex', economy: 'action' },
        },
        dmAdjustable: true,
      },
    ],
  },
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
    lighting: { kind: 'light', brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fb923c', spellLevel: 2 },
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
    spellId: 'spiritual-weapon',
    label: '灵体武器',
    minimumSlotLevel: 2,
    template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 60 },
    durationRounds: 10,
    concentration: false,
    anchorMode: 'effect-token',
    movement: { economy: 'bonus-action', maximumFeet: 20 },
    relation: 'enemy',
    includeSelf: false,
    color: '#c4b5fd',
    visual: { preset: 'spiritual-weapon', intensity: 'normal' },
    triggers: [],
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
    hiddenFromPlayers: true,
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
        id: 'spirit-guardians-enter', frequencyGroupId: 'spirit-guardians-damage',
        label: '灵体卫士·进入区域', timing: 'on-enter', oncePerTurn: true,
        savingThrow: { ability: 'wis', onSuccess: 'half' },
        damage: { count: 3, sides: 8, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
      {
        id: 'spirit-guardians-turn-start', frequencyGroupId: 'spirit-guardians-damage',
        label: '灵体卫士·回合开始', timing: 'turn-start', oncePerTurn: true,
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
    lighting: { kind: 'light', brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#dbeafe', spellLevel: 2 },
    triggers: [
      {
        id: 'moonbeam-enter', frequencyGroupId: 'moonbeam-damage',
        label: '月华之光·进入光柱', timing: 'on-enter', oncePerTurn: true,
        savingThrow: {
          ability: 'con', onSuccess: 'half',
          shapechangerDisadvantage: true, revertShapechangerOnFailure: true,
        },
        damage: { count: 2, sides: 10, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
      {
        id: 'moonbeam-turn-start', frequencyGroupId: 'moonbeam-damage',
        label: '月华之光·回合开始', timing: 'turn-start', oncePerTurn: true,
        savingThrow: {
          ability: 'con', onSuccess: 'half',
          shapechangerDisadvantage: true, revertShapechangerOnFailure: true,
        },
        damage: { count: 2, sides: 10, perHigherSlot: 1, type: 'radiant' },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'call-lightning',
    label: '召雷术·雷云',
    minimumSlotLevel: 3,
    template: { shape: 'circle', origin: 'point', radiusFeet: 60, placeRangeFeet: 0 },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    color: '#60a5fa',
    visual: { preset: 'call-lightning', intensity: 'strong' },
    triggers: [],
  },
  {
    spellId: 'wall-of-fire',
    label: '火墙术',
    minimumSlotLevel: 4,
    template: {
      shape: 'rect', origin: 'point', widthFeet: 60, heightFeet: 5,
      placeRangeFeet: 120, rotatable: true,
    },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    color: '#ef4444',
    visual: { preset: 'wall-of-fire', intensity: 'strong' },
    triggers: [
      {
        id: 'wall-of-fire-create',
        label: '火墙术·火墙出现',
        timing: 'on-create',
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'fire' },
        dmAdjustable: true,
      },
      {
        id: 'wall-of-fire-enter',
        label: '火墙术·进入火墙',
        timing: 'on-enter',
        oncePerTurn: true,
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'fire' },
        dmAdjustable: true,
      },
      {
        id: 'wall-of-fire-turn-end',
        label: '火墙术·伤害侧回合结束',
        timing: 'turn-end',
        oncePerTurn: true,
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'fire' },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'ice-storm',
    label: '冰风暴·冰雹地面',
    minimumSlotLevel: 4,
    template: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 300 },
    durationRounds: 1,
    expiresAtSourceNextTurnEnd: true,
    concentration: false,
    anchorMode: 'fixed',
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#bfdbfe',
    visual: { preset: 'arcane', intensity: 'subtle' },
    triggers: [],
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
    frequencyGroupId: declaration.frequencyGroupId,
    label: declaration.label,
    timing: declaration.timing,
    oncePerRound: declaration.oncePerTurn === true ? false : declaration.oncePerRound !== false,
    oncePerTurn: declaration.oncePerTurn === true,
    movementIntervalFeet: declaration.movementIntervalFeet,
    savingThrow: declaration.savingThrow
      ? { ...declaration.savingThrow, dc: input.sourceSaveDc }
      : undefined,
    skipSaveWhenSourceConditionActive: declaration.skipSaveWhenSourceConditionActive,
    damage: declaration.damage
      ? {
          count: declaration.damage.count + higherLevels * (declaration.damage.perHigherSlot ?? 0),
          sides: declaration.damage.sides,
          modifier: declaration.damage.modifier ?? 0,
          type: damageType ?? declaration.damage.type,
        }
      : undefined,
    condition: declaration.condition
      ? {
          ...declaration.condition,
          escapeCheck: declaration.condition.escapeCheck
            ? { ...declaration.condition.escapeCheck, dc: input.sourceSaveDc }
            : undefined,
        }
      : undefined,
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
  triggerCellsById?: Readonly<Record<string, readonly GridCell[]>>
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
    expiresAtSourceTurnEndAfterRound: declaration.expiresAtSourceNextTurnEnd
      ? input.round + 1
      : undefined,
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
    hiddenFromPlayers: declaration.hiddenFromPlayers === true,
    lighting: declaration.lighting
      ? { ...declaration.lighting, spellLevel: input.slotLevel }
      : undefined,
    visual: { ...declaration.visual },
    triggers: declaration.triggers.map((trigger) => {
      const resolved = resolvedTrigger(trigger, {
        slotLevel: input.slotLevel,
        minimumSlotLevel: declaration.minimumSlotLevel,
        sourceSaveDc: input.sourceSaveDc,
      }, alignmentDamageType)
      const cells = input.triggerCellsById?.[trigger.id]
      return cells?.length ? { ...resolved, cells: cells.map((cell) => ({ ...cell })) } : resolved
    }),
  }
}

/**
 * 火墙术以 5 尺网格近似 1 尺厚墙体。orientation 决定墙体长轴，
 * 伤害带位于该方向的顺时针垂直侧：0 东、1 南、2 西、3 北。
 */
export function dnd5eWallOfFireDamagingSideCells(input: {
  wallCells: readonly GridCell[]
  orientation: 0 | 1 | 2 | 3
  map: Pick<BattleMap, 'width' | 'height' | 'gridSize' | 'gridOffsetX' | 'gridOffsetY'>
}): GridCell[] {
  const direction = [
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: -1, row: 0 },
    { col: 0, row: -1 },
  ][input.orientation]
  const columns = Math.max(1, Math.floor(
    (input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize),
  ))
  const rows = Math.max(1, Math.floor(
    (input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize),
  ))
  const unique = new Map<string, GridCell>()
  for (const cell of input.wallCells) {
    for (let distance = 0; distance <= 2; distance += 1) {
      const candidate = {
        col: cell.col + direction.col * distance,
        row: cell.row + direction.row * distance,
      }
      if (
        candidate.col < 0 || candidate.row < 0 ||
        candidate.col >= columns || candidate.row >= rows
      ) continue
      unique.set(cellKey(candidate), candidate)
    }
  }
  return [...unique.values()]
}

export interface Dnd5eCoreSpellLightingConflictResult {
  areas: Dnd5ePluginArea[]
  applied: boolean
  removedAreas: Dnd5ePluginArea[]
}

function persistentAreasOverlap(left: Dnd5ePluginArea, right: Dnd5ePluginArea): boolean {
  const leftCells = new Set(left.cells.map(cellKey))
  return right.cells.some((cell) => leftCells.has(cellKey(cell)))
}

/**
 * 处理 SRD Darkness/Daylight 的“重叠即解除来源法术”，而不只在画布上
 * 临时盖住光。调用方仍负责通过 Headless concentration lifecycle 结束
 * 被解除的专注，避免地图和角色状态分叉。
 */
export function resolveDnd5eCoreSpellLightingConflicts(
  existingAreas: readonly Dnd5ePluginArea[],
  incoming: Dnd5ePluginArea,
): Dnd5eCoreSpellLightingConflictResult {
  const incomingLighting = incoming.lighting
  if (!incomingLighting) return { areas: [...existingAreas, incoming], applied: true, removedAreas: [] }
  const overlapping = existingAreas.filter((area) =>
    !!area.lighting && area.lighting.kind !== incomingLighting.kind && persistentAreasOverlap(area, incoming),
  )
  const incomingSuppressed = overlapping.some((area) => {
    const lighting = area.lighting!
    return incomingLighting.kind === 'light'
      ? lighting.kind === 'magical-darkness' &&
          (lighting.suppressesMagicalLightThroughLevel ?? -1) >= incomingLighting.spellLevel
      : lighting.kind === 'light' &&
          (lighting.suppressesMagicalDarknessThroughLevel ?? -1) >= incomingLighting.spellLevel
  })
  if (incomingSuppressed) return { areas: [...existingAreas], applied: false, removedAreas: [] }
  const removedAreas = overlapping.filter((area) => {
    const lighting = area.lighting!
    return incomingLighting.kind === 'light'
      ? lighting.kind === 'magical-darkness' &&
          (incomingLighting.suppressesMagicalDarknessThroughLevel ?? -1) >= lighting.spellLevel
      : lighting.kind === 'light' &&
          (incomingLighting.suppressesMagicalLightThroughLevel ?? -1) >= lighting.spellLevel
  })
  const removedIds = new Set(removedAreas.map((area) => area.id))
  return {
    areas: [...existingAreas.filter((area) => !removedIds.has(area.id)), incoming],
    applied: true,
    removedAreas,
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
  geometry?: MapGeometryState
  areaId: string
  sourceTokenId: string
  targetCell: GridCell
}): {
  ok: true
  map: BattleMap
  area: Dnd5ePluginArea
  distanceFeet: number
  impactTargetId?: string
} | { ok: false; reason: string } {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  if (!area || area.sourceKind !== 'core-spell' || !area.movement) return { ok: false, reason: 'area-not-movable' }
  if (area.sourceTokenId !== input.sourceTokenId) return { ok: false, reason: 'invalid-source' }
  const previous = area.anchorCell ?? area.cells[0]
  const cells = Math.max(Math.abs(input.targetCell.col - previous.col), Math.abs(input.targetCell.row - previous.row))
  const distanceFeet = cells * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  if (distanceFeet > area.movement.maximumFeet) return { ok: false, reason: 'target-out-of-range' }
  const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
  const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
  if (
    !Number.isInteger(input.targetCell.col) ||
    !Number.isInteger(input.targetCell.row) ||
    input.targetCell.col < 0 ||
    input.targetCell.row < 0 ||
    input.targetCell.col >= columns ||
    input.targetCell.row >= rows
  ) return { ok: false, reason: 'invalid-target' }
  let resolvedTargetCell = { ...input.targetCell }
  let impactTargetId: string | undefined
  const anchorToken = area.anchorMode === 'effect-token' && area.anchorTokenId
    ? input.map.tokens.find((token) => token.id === area.anchorTokenId)
    : undefined
  if (area.coreSpellId === 'flaming-sphere' && anchorToken) {
    const path = dnd5eMovementPathCells(previous, input.targetCell)
    let lastCell = previous
    for (const nextCell of path.slice(1)) {
      const from = tokenCenterForAnchorCell(lastCell, anchorToken, input.map)
      const to = tokenCenterForAnchorCell(nextCell, anchorToken, input.map)
      if (mapGeometryMovementBlocked({
        geometry: input.geometry,
        map: input.map,
        token: { ...anchorToken, ...from },
        to,
      }).blocked) {
        if (lastCell.col === previous.col && lastCell.row === previous.row) {
          return { ok: false, reason: 'movement-blocked' }
        }
        resolvedTargetCell = lastCell
        break
      }
      lastCell = nextCell
      resolvedTargetCell = nextCell
      const impactTarget = input.map.tokens.find((token) =>
        token.id !== anchorToken.id && token.type !== 'obstacle' &&
        tokenOccupiedCellsAt(token, input.map, token).some((cell) =>
          cell.col === nextCell.col && cell.row === nextCell.row,
        ),
      )
      if (impactTarget) {
        impactTargetId = impactTarget.id
        break
      }
    }
  } else if (area.coreSpellId === 'spiritual-weapon' && anchorToken) {
    const path = dnd5eMovementPathCells(previous, input.targetCell)
    let lastCell = previous
    for (const nextCell of path.slice(1)) {
      const from = tokenCenterForAnchorCell(lastCell, anchorToken, input.map)
      const to = tokenCenterForAnchorCell(nextCell, anchorToken, input.map)
      if (mapGeometryMovementBlocked({
        geometry: input.geometry,
        map: input.map,
        token: { ...anchorToken, ...from },
        to,
      }).blocked) {
        return { ok: false, reason: 'movement-blocked' }
      }
      lastCell = nextCell
      resolvedTargetCell = nextCell
    }
  }
  const nextArea = {
    ...area,
    cells: shiftedCells(area, resolvedTargetCell, input.map),
    anchorCell: { ...resolvedTargetCell },
  }
  if (nextArea.cells.length < 1) return { ok: false, reason: 'invalid-target' }
  const anchorPosition = anchorToken
    ? tokenCenterForAnchorCell(resolvedTargetCell, anchorToken, input.map)
    : undefined
  const resolvedDistanceFeet = Math.max(
    Math.abs(resolvedTargetCell.col - previous.col),
    Math.abs(resolvedTargetCell.row - previous.row),
  ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
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
    distanceFeet: resolvedDistanceFeet,
    impactTargetId,
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

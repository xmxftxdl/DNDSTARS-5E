import {
  DND_FEET_PER_CELL,
  cellToPixel,
  cellKey,
  mapCellExtent,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import {
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Dnd5eClassId } from './classes'
import type {
  Dnd5ePersistentAreaAnchorMode,
  Dnd5ePersistentAreaMovementDeclaration,
  Dnd5ePersistentAreaLighting,
  Dnd5ePersistentAreaBlocking,
  Dnd5ePersistentAreaObscuration,
  Dnd5ePersistentAreaOccupantModifiers,
  Dnd5ePersistentAreaTriggerDeclaration,
  Dnd5ePersistentAreaTriggerSnapshot,
  Dnd5ePersistentAreaVisual,
} from './persistentAreaTypes'
import type { Dnd5eWallOfFireGeometry } from './wallOfFireGeometry'
import { dnd5eMovementPathCells } from './itemAreas'

/**
 * Chooses the grid point occupied by an interposing spell entity. Keeping one
 * Large-creature footprint between source and target prevents the entity from
 * overlapping the selected target while still following either endpoint.
 */
export function dnd5eInterpositionAnchorCell(
  map: BattleMap,
  source: Pick<Token, 'x' | 'y' | 'size'>,
  target: Pick<Token, 'x' | 'y' | 'size'>,
): GridCell {
  const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, map)
  const targetCell = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  const deltaCol = sourceCell.col - targetCell.col
  const deltaRow = sourceCell.row - targetCell.row
  const separation = Math.max(Math.abs(deltaCol), Math.abs(deltaRow))
  const offset = Math.max(0, Math.min(2, separation - 1))
  const { cols, rows } = mapCellExtent(map)
  return {
    col: Math.max(0, Math.min(cols - 1, targetCell.col + Math.sign(deltaCol) * offset)),
    row: Math.max(0, Math.min(rows - 1, targetCell.row + Math.sign(deltaRow) * offset)),
  }
}

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
  /**
   * Z-axis rules are distinct from the template's two-dimensional width/height.
   * Ground areas use the terrain surface under each affected cell; volumes store
   * an authoritative absolute base when the area is created.
   */
  vertical?:
    | { mode: 'ground' }
    | {
        mode: 'volume'
        heightFeet: number
        anchorOffsetFeet?: number
        /** Slot scaling for a three-dimensional volume, relative to minimumSlotLevel. */
        perHigherSlot?: { heightFeet: number; anchorOffsetFeet?: number }
      }
  movement?: Dnd5ePersistentAreaMovementDeclaration
  relation?: 'any' | 'ally' | 'enemy'
  includeSelf?: boolean
  hiddenFromPlayers?: boolean
  lighting?: Dnd5ePersistentAreaLighting
  obscuration?: Dnd5ePersistentAreaObscuration
  occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
  blocking?: Dnd5ePersistentAreaBlocking
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
    spellId: 'dancing-lights',
    label: '舞光术',
    minimumSlotLevel: 0,
    template: { shape: 'circle', origin: 'point', radiusFeet: 0, placeRangeFeet: 120 },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    movement: {
      economy: 'bonus-action', maximumFeet: 60,
      maximumDistanceFromSourceFeet: 120,
      endWhenExceedingSourceDistance: true,
    },
    relation: 'any',
    includeSelf: true,
    lighting: { kind: 'light', brightRadiusFeet: 0, dimRadiusFeet: 10, color: '#a5f3fc', spellLevel: 0 },
    color: '#67e8f9',
    visual: { preset: 'dancing-lights', intensity: 'strong' },
    triggers: [],
  },
  {
    spellId: 'mage-hand',
    label: '法师之手',
    minimumSlotLevel: 0,
    template: { shape: 'circle', origin: 'point', radiusFeet: 0, placeRangeFeet: 30 },
    durationRounds: 10,
    concentration: false,
    anchorMode: 'fixed',
    movement: {
      economy: 'action', maximumFeet: 30,
      maximumDistanceFromSourceFeet: 30,
      endWhenExceedingSourceDistance: true,
    },
    relation: 'any',
    includeSelf: true,
    color: '#a78bfa',
    visual: { preset: 'mage-hand', intensity: 'subtle' },
    triggers: [],
  },
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
    spellId: 'fog-cloud',
    label: '云雾术',
    minimumSlotLevel: 1,
    template: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 120 },
    durationRounds: 600,
    concentration: true,
    anchorMode: 'fixed',
    vertical: {
      mode: 'volume',
      heightFeet: 40,
      anchorOffsetFeet: -20,
      perHigherSlot: { heightFeet: 40, anchorOffsetFeet: -20 },
    },
    relation: 'any',
    includeSelf: true,
    obscuration: { kind: 'heavy' },
    color: '#94a3b8',
    visual: { preset: 'fog-cloud', intensity: 'normal' },
    triggers: [],
  },
  {
    spellId: 'web',
    label: '蛛网术',
    minimumSlotLevel: 2,
    template: { shape: 'rect', origin: 'point', widthFeet: 20, heightFeet: 20, placeRangeFeet: 60, gridAligned: true },
    durationRounds: 600,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 20 },
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    obscuration: { kind: 'light' },
    color: '#e2e8f0',
    visual: { preset: 'web', intensity: 'normal' },
    triggers: [
      {
        id: 'web-enter', frequencyGroupId: 'web-restraint',
        label: '蛛网术·进入蛛网', timing: 'on-enter', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: {
          condition: 'restrained', duration: { expiresAt: 'permanent' },
          escapeCheck: { ability: 'str', economy: 'action' },
        },
        dmAdjustable: true,
      },
      {
        id: 'web-turn-start', frequencyGroupId: 'web-restraint',
        label: '蛛网术·回合开始', timing: 'turn-start', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: {
          condition: 'restrained', duration: { expiresAt: 'permanent' },
          escapeCheck: { ability: 'str', economy: 'action' },
        },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'silence',
    label: '沉默术',
    minimumSlotLevel: 2,
    template: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 120 },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 40, anchorOffsetFeet: -20 },
    relation: 'any',
    includeSelf: true,
    occupantModifiers: {
      containment: 'fully-contained',
      preventsVerbalComponents: true,
      damageImmunities: ['thunder'],
    },
    color: '#818cf8',
    visual: { preset: 'silence', intensity: 'subtle' },
    triggers: [],
  },
  {
    spellId: 'sleet-storm',
    label: '雪雨暴',
    minimumSlotLevel: 3,
    template: { shape: 'circle', origin: 'point', radiusFeet: 40, placeRangeFeet: 150 },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 20 },
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    obscuration: { kind: 'heavy' },
    color: '#bfdbfe',
    visual: { preset: 'sleet-storm', intensity: 'strong' },
    triggers: [
      {
        id: 'sleet-storm-enter', frequencyGroupId: 'sleet-storm-prone',
        label: '雪雨暴·进入区域', timing: 'on-enter', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
        dmAdjustable: true,
      },
      {
        id: 'sleet-storm-turn-start', frequencyGroupId: 'sleet-storm-prone',
        label: '雪雨暴·回合开始', timing: 'turn-start', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
        dmAdjustable: true,
      },
      {
        id: 'sleet-storm-concentration-turn-start', frequencyGroupId: 'sleet-storm-concentration',
        label: '雪雨暴·专注干扰', timing: 'turn-start', oncePerTurn: true,
        savingThrow: { ability: 'con', onSuccess: 'none' },
        endTargetConcentrationOnFailedSave: true,
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'stinking-cloud',
    label: '臭云术',
    minimumSlotLevel: 3,
    template: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 90 },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 40, anchorOffsetFeet: -20 },
    relation: 'any',
    includeSelf: true,
    obscuration: { kind: 'heavy' },
    color: '#ca8a04',
    visual: { preset: 'stinking-cloud', intensity: 'strong' },
    triggers: [{
      id: 'stinking-cloud-turn-start',
      label: '臭云术·回合开始', timing: 'turn-start', oncePerTurn: true,
      savingThrow: { ability: 'con', onSuccess: 'none', automaticSuccessForDamageImmunity: 'poison' },
      consumeActionOnFailedSave: true,
      dmAdjustable: true,
    }],
  },
  {
    spellId: 'wind-wall',
    label: '风墙术',
    minimumSlotLevel: 3,
    template: {
      shape: 'rect', origin: 'point', widthFeet: 50, minimumWidthFeet: 5,
      heightFeet: 5, placeRangeFeet: 120, rotatable: true,
    },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 15 },
    relation: 'any',
    includeSelf: true,
    // Wind Wall is not a solid wall. Its movement boundary applies only to
    // Small-or-smaller airborne creatures and creatures in Gaseous Form; the
    // geometry adapter enforces those creature predicates.
    blocking: { movement: true, movementMode: 'boundary' },
    color: '#bae6fd',
    visual: { preset: 'wind-wall', intensity: 'strong' },
    triggers: [{
      id: 'wind-wall-create', label: '风墙术·风墙出现', timing: 'on-create',
      savingThrow: { ability: 'str', onSuccess: 'half' },
      damage: { count: 3, sides: 8, type: 'bludgeoning' },
      dmAdjustable: true,
    }],
  },
  {
    spellId: 'wall-of-force',
    label: '力场墙',
    minimumSlotLevel: 5,
    template: {
      shape: 'rect', origin: 'point', widthFeet: 100, minimumWidthFeet: 5,
      heightFeet: 5, placeRangeFeet: 120, rotatable: true,
    },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 10 },
    relation: 'any',
    includeSelf: true,
    // The caster still receives its own hidden area projection so the player
    // can manipulate the known placement; other player-character views must
    // not render an invisible wall.
    hiddenFromPlayers: true,
    blocking: { movement: true, lineOfEffect: true },
    color: '#c4b5fd',
    visual: { preset: 'wall-of-force', intensity: 'normal' },
    triggers: [],
  },
  {
    spellId: 'wall-of-stone',
    label: '石墙术',
    minimumSlotLevel: 5,
    template: {
      shape: 'rect', origin: 'point', widthFeet: 100, minimumWidthFeet: 5,
      heightFeet: 5, placeRangeFeet: 120, rotatable: true,
    },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 10 },
    relation: 'any',
    includeSelf: true,
    blocking: { movement: true, vision: true, lineOfEffect: true },
    color: '#78716c',
    visual: { preset: 'wall-of-stone', intensity: 'normal' },
    triggers: [],
  },
  {
    spellId: 'wall-of-ice',
    label: '冰墙术',
    minimumSlotLevel: 6,
    template: {
      shape: 'rect', origin: 'point', widthFeet: 100, minimumWidthFeet: 5,
      heightFeet: 5, placeRangeFeet: 120, rotatable: true,
    },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 10 },
    relation: 'any',
    includeSelf: true,
    blocking: { movement: true, vision: true, lineOfEffect: true },
    color: '#bae6fd',
    visual: { preset: 'wall-of-ice', intensity: 'strong' },
    triggers: [{
      id: 'wall-of-ice-create', label: '冰墙术·冰墙出现', timing: 'on-create',
      savingThrow: { ability: 'dex', onSuccess: 'half' },
      damage: { count: 10, sides: 6, perHigherSlot: 2, type: 'cold' },
      dmAdjustable: true,
    }],
  },
  {
    spellId: 'wall-of-thorns',
    label: '棘墙术',
    minimumSlotLevel: 6,
    template: {
      shape: 'rect', origin: 'point', widthFeet: 60, minimumWidthFeet: 5,
      heightFeet: 5, placeRangeFeet: 120, rotatable: true,
    },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 10 },
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 4,
    blocking: { vision: true },
    color: '#4d7c0f',
    visual: { preset: 'wall-of-thorns', intensity: 'strong' },
    triggers: [
      {
        id: 'wall-of-thorns-create', label: '棘墙术·棘墙出现', timing: 'on-create',
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 7, sides: 8, perHigherSlot: 1, type: 'piercing' },
      },
      {
        id: 'wall-of-thorns-enter', frequencyGroupId: 'wall-of-thorns-slicing',
        label: '棘墙术·进入棘墙', timing: 'on-enter', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 7, sides: 8, perHigherSlot: 1, type: 'slashing' },
      },
      {
        id: 'wall-of-thorns-turn-end', frequencyGroupId: 'wall-of-thorns-slicing',
        label: '棘墙术·回合结束', timing: 'turn-end', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 7, sides: 8, perHigherSlot: 1, type: 'slashing' },
      },
    ],
  },
  {
    spellId: 'grease',
    label: '油腻术',
    minimumSlotLevel: 1,
    template: { shape: 'rect', origin: 'point', widthFeet: 10, heightFeet: 10, placeRangeFeet: 60, gridAligned: true },
    durationRounds: 10,
    concentration: false,
    anchorMode: 'fixed',
    vertical: { mode: 'ground' },
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
      },
      {
        id: 'grease-enter', label: '油腻术·进入区域', timing: 'on-enter', oncePerRound: false,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
      },
      {
        id: 'grease-turn-end', label: '油腻术·回合结束', timing: 'turn-end', oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
      },
    ],
  },
  {
    spellId: 'entangle',
    label: '纠缠术',
    minimumSlotLevel: 1,
    template: { shape: 'rect', origin: 'point', widthFeet: 20, heightFeet: 20, placeRangeFeet: 90, gridAligned: true },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'ground' },
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
    template: { shape: 'rect', origin: 'point', widthFeet: 20, heightFeet: 20, placeRangeFeet: 90, gridAligned: true },
    durationRounds: 10,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'ground' },
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
    vertical: { mode: 'volume', heightFeet: 10 },
    movement: {
      economy: 'bonus-action', maximumFeet: 30,
      maximumBarrierHeightFeet: 5,
      maximumGapWidthFeet: 10,
    },
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
      },
      {
        id: 'flaming-sphere-turn-end', label: '炽焰法球·回合结束', timing: 'turn-end',
        oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 2, sides: 6, perHigherSlot: 1, type: 'fire' },
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
    vertical: { mode: 'ground' },
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
    vertical: { mode: 'volume', heightFeet: 30, anchorOffsetFeet: -15 },
    relation: 'any',
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
    vertical: { mode: 'volume', heightFeet: 40 },
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
    vertical: { mode: 'volume', heightFeet: 20 },
    relation: 'any',
    includeSelf: true,
    blocking: { vision: true },
    color: '#ef4444',
    visual: { preset: 'wall-of-fire', intensity: 'strong' },
    triggers: [
      {
        id: 'wall-of-fire-create',
        label: '火墙术·火墙出现',
        timing: 'on-create',
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'fire' },
      },
      {
        id: 'wall-of-fire-enter',
        label: '火墙术·进入火墙',
        timing: 'on-enter',
        oncePerTurn: true,
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'fire' },
      },
      {
        id: 'wall-of-fire-turn-end',
        label: '火墙术·伤害侧回合结束',
        timing: 'turn-end',
        oncePerTurn: true,
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'fire' },
      },
    ],
  },
  {
    spellId: 'insect-plague',
    label: '疫病虫群',
    minimumSlotLevel: 5,
    template: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 300 },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 40, anchorOffsetFeet: -20 },
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#a3a341',
    visual: { preset: 'insect-plague', intensity: 'strong' },
    triggers: [
      {
        id: 'insect-plague-create',
        label: '疫病虫群·虫群出现',
        timing: 'on-create',
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 4, sides: 10, perHigherSlot: 1, type: 'piercing' },
        dmAdjustable: true,
      },
      {
        id: 'insect-plague-enter',
        frequencyGroupId: 'insect-plague-damage',
        label: '疫病虫群·进入虫群',
        timing: 'on-enter',
        oncePerTurn: true,
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 4, sides: 10, perHigherSlot: 1, type: 'piercing' },
        dmAdjustable: true,
      },
      {
        id: 'insect-plague-turn-end',
        frequencyGroupId: 'insect-plague-damage',
        label: '疫病虫群·回合结束',
        timing: 'turn-end',
        oncePerTurn: true,
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 4, sides: 10, perHigherSlot: 1, type: 'piercing' },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'cloudkill',
    label: '死云术',
    minimumSlotLevel: 5,
    template: { shape: 'circle', origin: 'point', radiusFeet: 20, placeRangeFeet: 120 },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 40, anchorOffsetFeet: -20 },
    relation: 'any',
    includeSelf: true,
    color: '#65a30d',
    visual: { preset: 'cloudkill', intensity: 'strong' },
    triggers: [
      {
        id: 'cloudkill-enter',
        frequencyGroupId: 'cloudkill-damage',
        label: '死云术·进入毒雾',
        timing: 'on-enter',
        oncePerTurn: true,
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'poison' },
        dmAdjustable: true,
      },
      {
        id: 'cloudkill-turn-start',
        frequencyGroupId: 'cloudkill-damage',
        label: '死云术·回合开始',
        timing: 'turn-start',
        oncePerTurn: true,
        savingThrow: { ability: 'con', onSuccess: 'half' },
        damage: { count: 5, sides: 8, perHigherSlot: 1, type: 'poison' },
        dmAdjustable: true,
      },
    ],
  },
  {
    spellId: 'blade-barrier',
    label: '剑刃护壁',
    minimumSlotLevel: 6,
    template: {
      shape: 'rect', origin: 'point', widthFeet: 100, heightFeet: 5,
      placeRangeFeet: 90, rotatable: true,
    },
    durationRounds: 100,
    concentration: true,
    anchorMode: 'fixed',
    vertical: { mode: 'volume', heightFeet: 20 },
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#cbd5e1',
    visual: { preset: 'blade-barrier', intensity: 'strong' },
    triggers: [
      {
        id: 'blade-barrier-create',
        label: '剑刃护壁·剑墙出现',
        timing: 'on-create',
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 6, sides: 10, type: 'slashing' },
        dmAdjustable: true,
      },
      {
        id: 'blade-barrier-enter',
        frequencyGroupId: 'blade-barrier-damage',
        label: '剑刃护壁·进入剑墙',
        timing: 'on-enter',
        oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 6, sides: 10, type: 'slashing' },
        dmAdjustable: true,
      },
      {
        id: 'blade-barrier-turn-start',
        frequencyGroupId: 'blade-barrier-damage',
        label: '剑刃护壁·回合开始',
        timing: 'turn-start',
        oncePerTurn: true,
        savingThrow: { ability: 'dex', onSuccess: 'half' },
        damage: { count: 6, sides: 10, type: 'slashing' },
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
    vertical: { mode: 'ground' },
    relation: 'any',
    includeSelf: true,
    movementCostMultiplier: 2,
    color: '#bfdbfe',
    visual: { preset: 'ice-storm-ground', intensity: 'subtle' },
    triggers: [],
  },
]

export function getDnd5eCoreSpellAreaDeclaration(
  spellId: string,
): Dnd5eCoreSpellAreaDeclaration | undefined {
  return DND5E_CORE_SPELL_AREA_DECLARATIONS.find((definition) => definition.spellId === spellId)
}

function persistentAreaElevationFeet(value: number): number {
  return Math.max(-1_000, Math.min(10_000, Math.round(value)))
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
    consumeActionOnFailedSave: declaration.consumeActionOnFailedSave === true,
    endTargetConcentrationOnFailedSave: declaration.endTargetConcentrationOnFailedSave === true,
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
  castingClassId?: Dnd5eClassId
  slotLevel: number
  sourceSaveDc: number
  round: number
  cells: readonly GridCell[]
  anchorCell: GridCell
  anchorTokenId?: string
  /** Terrain/token elevation captured by the authoritative caster at creation. */
  baseElevationFeet?: number
  durationRounds?: number
  sourceAlignment?: string
  triggerCellsById?: Readonly<Record<string, readonly GridCell[]>>
  wallOfFireGeometry?: Dnd5eWallOfFireGeometry
  lightingAnchorCells?: readonly GridCell[]
  dancingLightsForm?: 'lights' | 'humanoid'
  excludedTargetIds?: readonly string[]
}): Dnd5ePluginArea {
  const declaration = input.declaration
  const durationRounds = input.durationRounds ?? declaration.durationRounds
  const sourceIsEvil = /邪恶|evil/i.test(input.sourceAlignment ?? '')
  const alignmentDamageType = declaration.damageTypeBySourceAlignment
    ? sourceIsEvil
      ? declaration.damageTypeBySourceAlignment.evil
      : declaration.damageTypeBySourceAlignment.otherwise
    : undefined
  const baseElevationFeet = Number.isFinite(input.baseElevationFeet)
    ? persistentAreaElevationFeet(Number(input.baseElevationFeet))
    : 0
  const higherSlotLevels = Math.max(0, Math.floor(input.slotLevel) - declaration.minimumSlotLevel)
  const vertical = declaration.vertical?.mode === 'ground'
    ? { mode: 'ground' as const }
    : declaration.vertical?.mode === 'volume'
      ? {
          mode: 'volume' as const,
          baseElevationFeet: persistentAreaElevationFeet(
            baseElevationFeet + (declaration.vertical.anchorOffsetFeet ?? 0)
              + higherSlotLevels * (declaration.vertical.perHigherSlot?.anchorOffsetFeet ?? 0),
          ),
          heightFeet: declaration.vertical.heightFeet
            + higherSlotLevels * (declaration.vertical.perHigherSlot?.heightFeet ?? 0),
          ...(declaration.vertical.anchorOffsetFeet != null || declaration.vertical.perHigherSlot?.anchorOffsetFeet != null
            ? {
                anchorOffsetFeet: (declaration.vertical.anchorOffsetFeet ?? 0)
                  + higherSlotLevels * (declaration.vertical.perHigherSlot?.anchorOffsetFeet ?? 0),
              }
            : {}),
        }
      : undefined
  return {
    id: `core-spell-area:${input.actionId}`,
    pluginId: 'srd-5.1',
    featureId: `srd-5.1:spell:${declaration.spellId}`,
    sourceKind: 'core-spell',
    coreSpellId: declaration.spellId,
    castingClassId: input.castingClassId,
    slotLevel: input.slotLevel,
    label: declaration.label,
    color: declaration.color,
    sourceCharacterId: input.sourceCharacterId,
    sourceTokenId: input.sourceTokenId,
    cells: input.cells.map((cell) => ({ ...cell })),
    createdRound: input.round,
    expiresAfterRound: input.round + durationRounds,
    expiresAtSourceTurnEndAfterRound: declaration.expiresAtSourceNextTurnEnd
      ? input.round + 1
      // A duration measured in rounds/minutes ends at the matching point in
      // the caster's initiative cycle. Turn end is the closest stable Host
      // boundary and prevents a 10-round spell from surviving all of round 11.
      : input.round + durationRounds,
    concentrationId: declaration.concentration ? declaration.spellId : undefined,
    anchorMode: declaration.anchorMode,
    anchorTokenId: input.anchorTokenId ?? (
      declaration.anchorMode === 'source-token' ? input.sourceTokenId : undefined
    ),
    anchorCell: { ...input.anchorCell },
    vertical,
    movement: declaration.movement ? { ...declaration.movement } : undefined,
    movementCostMultiplier: declaration.movementCostMultiplier,
    relation: declaration.relation ?? 'any',
    includeSelf: declaration.includeSelf === true,
    excludedTargetIds: input.excludedTargetIds ? [...new Set(input.excludedTargetIds)] : undefined,
    hiddenFromPlayers: declaration.hiddenFromPlayers === true,
    lighting: declaration.lighting
      ? { ...declaration.lighting, spellLevel: input.slotLevel }
      : undefined,
    dancingLightsForm: declaration.spellId === 'dancing-lights'
      ? input.dancingLightsForm ?? 'lights'
      : undefined,
    obscuration: declaration.obscuration ? { ...declaration.obscuration } : undefined,
    occupantModifiers: declaration.occupantModifiers
      ? {
          ...declaration.occupantModifiers,
          damageImmunities: declaration.occupantModifiers.damageImmunities
            ? [...declaration.occupantModifiers.damageImmunities]
            : undefined,
          damageResistances: declaration.occupantModifiers.damageResistances
            ? [...declaration.occupantModifiers.damageResistances]
            : undefined,
          conditionImmunities: declaration.occupantModifiers.conditionImmunities
            ? [...declaration.occupantModifiers.conditionImmunities]
            : undefined,
        }
      : undefined,
    blocking: declaration.blocking ? { ...declaration.blocking } : undefined,
    lightingAnchorCells: input.lightingAnchorCells?.map((cell) => ({ ...cell })),
    visual: { ...declaration.visual },
    wallOfFireGeometry: input.wallOfFireGeometry ? { ...input.wallOfFireGeometry } : undefined,
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

function mappedBarrierCanBeCleared(input: {
  geometry?: MapGeometryState
  entityId?: string
  pathElevationFeet: number
  maximumBarrierHeightFeet?: number
}): boolean {
  if (!input.geometry || !input.entityId || input.maximumBarrierHeightFeet == null) return false
  const entity = [
    ...input.geometry.walls,
    ...input.geometry.doors,
    ...(input.geometry.windows ?? []),
    ...input.geometry.obstacles,
  ].find((candidate) => candidate.id === input.entityId)
  if (!entity || !entity.blocksMovement) return false
  const barrierTopFeet = entity.baseHeightFeet + entity.heightFeet
  return barrierTopFeet - input.pathElevationFeet <= input.maximumBarrierHeightFeet + 1e-6
}

function movementPathCrossesUnsupportedGap(input: {
  geometry?: MapGeometryState
  map: BattleMap
  anchorToken: Token
  path: readonly GridCell[]
  feetPerCell: number
  maximumGapWidthFeet?: number
}): boolean {
  if (!input.geometry || input.maximumGapWidthFeet == null || input.path.length < 2) return false
  const origin = tokenCenterForAnchorCell(input.path[0], input.anchorToken, input.map)
  const pathElevationFeet = mapGeometryTerrainElevationAtPoint(input.geometry, origin)
  let gapWidthFeet = 0
  for (const cell of input.path.slice(1)) {
    const point = tokenCenterForAnchorCell(cell, input.anchorToken, input.map)
    const elevationFeet = mapGeometryTerrainElevationAtPoint(input.geometry, point)
    if (elevationFeet < pathElevationFeet - 1e-6) {
      gapWidthFeet += input.feetPerCell
      if (gapWidthFeet > input.maximumGapWidthFeet + 1e-6) return true
    } else {
      gapWidthFeet = 0
    }
  }
  // The printed rule permits crossing a pit, not ending the command inside it.
  return gapWidthFeet > 0
}

export function moveDnd5eCoreSpellArea(input: {
  map: BattleMap
  geometry?: MapGeometryState
  areaId: string
  sourceTokenId: string
  targetCell: GridCell
  targetCells?: readonly GridCell[]
}): {
  ok: true
  map: BattleMap
  area: Dnd5ePluginArea
  distanceFeet: number
  impactTargetId?: string
} | { ok: false; reason: string } {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  const declaredMovement = area?.coreSpellId
    ? getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)?.movement
    : undefined
  const movement = area?.movement
    ? { ...declaredMovement, ...area.movement }
    : declaredMovement
  if (!area || !movement) return { ok: false, reason: 'area-not-movable' }
  if (area.sourceTokenId !== input.sourceTokenId) return { ok: false, reason: 'invalid-source' }
  const previous = area.anchorCell ?? area.cells[0]
  const previousLightingAnchors = area.lightingAnchorCells?.length
    ? area.lightingAnchorCells
    : area.coreSpellId === 'dancing-lights' ? area.cells : undefined
  const dancingLightTargets = area.coreSpellId === 'dancing-lights' && input.targetCells?.length
    ? input.targetCells.map((cell) => ({ ...cell }))
    : undefined
  if (
    input.targetCells?.length &&
    (area.coreSpellId !== 'dancing-lights' || !previousLightingAnchors?.length ||
      input.targetCells.length !== previousLightingAnchors.length)
  ) return { ok: false, reason: 'invalid-target' }
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  const destinationPairs = dancingLightTargets && previousLightingAnchors
    ? dancingLightTargets.map((target, index) => ({ previous: previousLightingAnchors[index], target }))
    : [{ previous, target: input.targetCell }]
  const distanceFeet = Math.max(...destinationPairs.map(({ previous: origin, target }) =>
    Math.max(Math.abs(target.col - origin.col), Math.abs(target.row - origin.row)) * feetPerCell
  ))
  if (distanceFeet > movement.maximumFeet) return { ok: false, reason: 'target-out-of-range' }
  if (movement.maximumDistanceFromSourceFeet != null && area.coreSpellId !== 'dancing-lights') {
    const sourceToken = input.map.tokens.find((token) => token.id === input.sourceTokenId)
    if (!sourceToken) return { ok: false, reason: 'invalid-source' }
    const sourceCell = tokenAnchorCellFromPixel(sourceToken.x, sourceToken.y, sourceToken, input.map)
    const tetherDistanceFeet = Math.max(
      Math.abs(input.targetCell.col - sourceCell.col),
      Math.abs(input.targetCell.row - sourceCell.row),
    ) * feetPerCell
    if (tetherDistanceFeet > movement.maximumDistanceFromSourceFeet) {
      if (movement.endWhenExceedingSourceDistance) {
        const removedWithToken = area.anchorTokenId
          ? removeDnd5eSpellEffectFromMap(input.map, area.anchorTokenId)
          : undefined
        return {
          ok: true,
          map: removedWithToken?.map ?? {
            ...input.map,
            dnd5ePluginAreas: (input.map.dnd5ePluginAreas ?? []).filter((candidate) =>
              candidate.id !== area.id),
          },
          area,
          distanceFeet,
        }
      }
      return { ok: false, reason: 'target-out-of-range' }
    }
  }
  const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
  const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
  const requestedTargets = dancingLightTargets ?? [input.targetCell]
  if (requestedTargets.some((target) =>
    !Number.isInteger(target.col) ||
    !Number.isInteger(target.row) ||
    target.col < 0 ||
    target.row < 0 ||
    target.col >= columns ||
    target.row >= rows
  )) return { ok: false, reason: 'invalid-target' }
  if (new Set(requestedTargets.map((cell) => `${cell.col}:${cell.row}`)).size !== requestedTargets.length) {
    return { ok: false, reason: 'invalid-target' }
  }
  let resolvedDancingLightTargets = dancingLightTargets
  if (area.coreSpellId === 'dancing-lights' && dancingLightTargets) {
    const sourceToken = input.map.tokens.find((token) => token.id === area.sourceTokenId)
    if (!sourceToken) return { ok: false, reason: 'invalid-source' }
    const sourceCell = tokenAnchorCellFromPixel(
      sourceToken.x,
      sourceToken.y,
      sourceToken,
      input.map,
    )
    const maximumDistance = movement.maximumDistanceFromSourceFeet ?? 120
    resolvedDancingLightTargets = dancingLightTargets.filter((cell) =>
      Math.max(Math.abs(cell.col - sourceCell.col), Math.abs(cell.row - sourceCell.row)) * feetPerCell <= maximumDistance
    )
    if (resolvedDancingLightTargets.length === 0) {
      return {
        ok: true,
        map: {
          ...input.map,
          dnd5ePluginAreas: (input.map.dnd5ePluginAreas ?? []).filter((candidate) => candidate.id !== area.id),
        },
        area,
        distanceFeet,
      }
    }
    if (
      resolvedDancingLightTargets.length > 1 &&
      resolvedDancingLightTargets.some((cell, index, lights) =>
        !lights.some((other, otherIndex) =>
          index !== otherIndex &&
          Math.max(Math.abs(cell.col - other.col), Math.abs(cell.row - other.row)) * feetPerCell <= 20
        )
      )
    ) return { ok: false, reason: 'invalid-target' }
  }
  let resolvedTargetCell = { ...input.targetCell }
  let impactTargetId: string | undefined
  const anchorToken = area.anchorMode === 'effect-token' && area.anchorTokenId
    ? input.map.tokens.find((token) => token.id === area.anchorTokenId)
    : undefined
  if (area.coreSpellId === 'flaming-sphere' && anchorToken) {
    const path = dnd5eMovementPathCells(previous, input.targetCell)
    if (movementPathCrossesUnsupportedGap({
      geometry: input.geometry,
      map: input.map,
      anchorToken,
      path,
      feetPerCell,
      maximumGapWidthFeet: movement.maximumGapWidthFeet,
    })) return { ok: false, reason: 'movement-blocked' }
    const finalPoint = tokenCenterForAnchorCell(input.targetCell, anchorToken, input.map)
    if (mapGeometryPlacementBlocked({
      geometry: input.geometry,
      map: input.map,
      token: anchorToken,
      at: finalPoint,
    }).blocked) return { ok: false, reason: 'movement-blocked' }
    let lastCell = previous
    for (const nextCell of path.slice(1)) {
      const from = tokenCenterForAnchorCell(lastCell, anchorToken, input.map)
      const to = tokenCenterForAnchorCell(nextCell, anchorToken, input.map)
      const movementBlock = mapGeometryMovementBlocked({
        geometry: input.geometry,
        map: input.map,
        token: { ...anchorToken, ...from },
        to,
      })
      if (movementBlock.blocked && !mappedBarrierCanBeCleared({
        geometry: input.geometry,
        entityId: movementBlock.entityId,
        pathElevationFeet: mapGeometryTerrainElevationAtPoint(input.geometry, from),
        maximumBarrierHeightFeet: movement.maximumBarrierHeightFeet,
      })) {
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
  } else if (
    (area.coreSpellId === 'spiritual-weapon' || area.coreSpellId === 'arcane-eye') &&
    anchorToken
  ) {
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
        // Arcane Eye may pass through an opening as small as one inch, but it
        // still cannot cross a solid wall.  Door/window geometry carries its
        // physical gap explicitly, so use that rule without shrinking the
        // map Token or its vision footprint.
        minimumPassageGapInches: area.coreSpellId === 'arcane-eye' ? 1 : undefined,
      }).blocked) {
        return { ok: false, reason: 'movement-blocked' }
      }
      lastCell = nextCell
      resolvedTargetCell = nextCell
    }
  }
  const nextArea: Dnd5ePluginArea = {
    ...area,
    movement: { ...movement },
    cells: resolvedDancingLightTargets
      ? resolvedDancingLightTargets.map((cell) => ({ ...cell }))
      : shiftedCells(area, resolvedTargetCell, input.map),
    anchorCell: resolvedDancingLightTargets ? { ...resolvedDancingLightTargets[0] } : { ...resolvedTargetCell },
    lightingAnchorCells: resolvedDancingLightTargets
      ? resolvedDancingLightTargets.map((cell) => ({ ...cell }))
      : area.lightingAnchorCells?.map((cell) => ({
          col: cell.col + resolvedTargetCell.col - previous.col,
          row: cell.row + resolvedTargetCell.row - previous.row,
        })),
  }
  if (nextArea.cells.length < 1) return { ok: false, reason: 'invalid-target' }
  if (nextArea.lightingAnchorCells?.some((cell) =>
    cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows
  )) return { ok: false, reason: 'invalid-target' }
  if (area.coreSpellId === 'dancing-lights') {
    if (!nextArea.lightingAnchorCells?.length) {
      return { ok: false, reason: 'invalid-source' }
    }
  }
  const anchorPosition = anchorToken
    ? tokenCenterForAnchorCell(resolvedTargetCell, anchorToken, input.map)
    : undefined
  const movedAnchorToken = anchorToken && anchorPosition
    ? { ...anchorToken, ...anchorPosition }
    : anchorToken
  const movementGeometry = input.geometry ?? mapGeometryRuntimeForMap(input.map.id)
  const movedVolumeBaseElevationFeet = nextArea.vertical?.mode === 'volume'
    ? movedAnchorToken
      ? mapGeometryTokenElevation(movementGeometry, movedAnchorToken)
      : mapGeometryTerrainElevationAtPoint(
          movementGeometry,
          tokenCenterForAnchorCell(resolvedTargetCell, { size: 1 }, input.map),
        )
    : undefined
  const resolvedArea = nextArea.vertical?.mode === 'volume' && movedVolumeBaseElevationFeet != null
    ? {
        ...nextArea,
        vertical: {
          ...nextArea.vertical,
          baseElevationFeet: persistentAreaElevationFeet(
            movedVolumeBaseElevationFeet + (nextArea.vertical.anchorOffsetFeet ?? 0),
          ),
        },
      }
    : nextArea
  const resolvedDistanceFeet = dancingLightTargets
    ? distanceFeet
    : Math.max(
        Math.abs(resolvedTargetCell.col - previous.col),
        Math.abs(resolvedTargetCell.row - previous.row),
      ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  return {
    ok: true,
    map: {
      ...input.map,
      dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map((candidate) =>
        candidate.id === area.id ? resolvedArea : candidate,
      ),
      tokens: anchorToken && anchorPosition
        ? input.map.tokens.map((token) => token.id === anchorToken.id ? { ...token, ...anchorPosition } : token)
        : input.map.tokens,
    },
    area: resolvedArea,
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

export interface Dnd5eSpellEffectRemoval {
  map: BattleMap
  token: Token
  removedAreas: Dnd5ePluginArea[]
}

/**
 * Removes a persistent core-spell entity and every area anchored to it as one
 * in-memory relation update. Persisting only the Token would leave an invalid
 * `anchorTokenId` reference and the shared-resource boundary would reject it.
 */
export function removeDnd5eSpellEffectFromMap(
  map: BattleMap,
  tokenId: string,
): Dnd5eSpellEffectRemoval | undefined {
  const token = map.tokens.find((candidate) => candidate.id === tokenId)
  if (!token?.dnd5eSpellEffect) return undefined
  const removedAreas = (map.dnd5ePluginAreas ?? []).filter((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId === token.id,
  )
  const removedAreaIds = new Set(removedAreas.map((area) => area.id))
  return {
    token,
    removedAreas,
    map: {
      ...map,
      tokens: map.tokens.filter((candidate) => candidate.id !== token.id),
      dnd5ePluginAreas: (map.dnd5ePluginAreas ?? []).filter((area) =>
        !removedAreaIds.has(area.id),
      ),
    },
  }
}

export function reconcileDnd5ePersistentAreaAnchors(map: BattleMap): BattleMap {
  let changed = false
  const geometry = mapGeometryRuntimeForMap(map.id)
  let tokens = map.tokens
  const removedAreaIds = new Set<string>()
  const removedTokenIds = new Set<string>()
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  const areasAfterDancingLightsTether = (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (area.coreSpellId !== 'dancing-lights') return [area]
    const source = tokens.find((token) => token.id === area.sourceTokenId)
    if (!source) {
      changed = true
      return []
    }
    const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, map)
    const anchors = area.lightingAnchorCells?.length ? area.lightingAnchorCells : area.cells
    const maximumDistance = area.movement?.maximumDistanceFromSourceFeet ??
      getDnd5eCoreSpellAreaDeclaration('dancing-lights')?.movement?.maximumDistanceFromSourceFeet ?? 120
    const surviving = anchors.filter((cell) =>
      Math.max(Math.abs(cell.col - sourceCell.col), Math.abs(cell.row - sourceCell.row)) * feetPerCell <= maximumDistance
    )
    if (surviving.length === anchors.length) return [area]
    changed = true
    if (surviving.length === 0) return []
    return [{
      ...area,
      cells: surviving.map((cell) => ({ ...cell })),
      lightingAnchorCells: surviving.map((cell) => ({ ...cell })),
      anchorCell: { ...surviving[0] },
    }]
  })
  for (const area of areasAfterDancingLightsTether) {
    const movement = area.movement ?? (area.coreSpellId
      ? getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)?.movement
      : undefined)
    if (
      movement?.endWhenExceedingSourceDistance &&
      movement.maximumDistanceFromSourceFeet != null && area.anchorCell
    ) {
      const source = tokens.find((token) => token.id === area.sourceTokenId)
      if (source) {
        const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, map)
        const separationFeet = Math.max(
          Math.abs(area.anchorCell.col - sourceCell.col),
          Math.abs(area.anchorCell.row - sourceCell.row),
        ) * Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
        if (separationFeet > movement.maximumDistanceFromSourceFeet) {
          removedAreaIds.add(area.id)
          if (area.anchorMode === 'effect-token' && area.anchorTokenId) {
            removedTokenIds.add(area.anchorTokenId)
          }
          changed = true
          continue
        }
      }
    }
    if (area.interposition && area.anchorMode === 'effect-token' && area.anchorTokenId) {
      const source = tokens.find((token) => token.id === area.sourceTokenId)
      const target = tokens.find((token) => token.id === area.interposition?.targetTokenId)
      const entity = tokens.find((token) => token.id === area.anchorTokenId)
      if (source && target && entity) {
        const desired = cellToPixel(dnd5eInterpositionAnchorCell(map, source, target), map)
        if (Math.abs(entity.x - desired.x) > 1e-4 || Math.abs(entity.y - desired.y) > 1e-4) {
          tokens = tokens.map((token) => token.id === entity.id
            ? { ...token, x: desired.x, y: desired.y }
            : token)
          changed = true
        }
      }
    }
    const follower = area.sourceFollower
    if (!follower || area.anchorMode !== 'effect-token' || !area.anchorTokenId) continue
    const source = tokens.find((token) => token.id === area.sourceTokenId)
    const entity = tokens.find((token) => token.id === area.anchorTokenId)
    if (!source || !entity) continue
    const feetPerPixel = Math.max(1, map.feetPerCell ?? 5) / Math.max(1, map.gridSize || 50)
    const separationFeet = Math.hypot(source.x - entity.x, source.y - entity.y) * feetPerPixel
    if (separationFeet > follower.maximumSeparationFeet) {
      removedAreaIds.add(area.id)
      removedTokenIds.add(entity.id)
      changed = true
      continue
    }
    if (separationFeet <= follower.stationaryWithinFeet) continue
    const travelFeet = separationFeet - follower.stationaryWithinFeet
    const ratio = travelFeet / separationFeet
    const to = {
      x: entity.x + (source.x - entity.x) * ratio,
      y: entity.y + (source.y - entity.y) * ratio,
    }
    const fromElevation = mapGeometryTerrainElevationAtPoint(geometry, entity)
    const toElevation = mapGeometryTerrainElevationAtPoint(geometry, to)
    if (
      follower.maximumStepHeightFeet != null &&
      Math.abs(toElevation - fromElevation) >= follower.maximumStepHeightFeet
    ) continue
    const path = findMapGeometryPath({ map: { ...map, tokens }, geometry, token: entity, to })
    if (!path) continue
    tokens = tokens.map((token) => token.id === entity.id ? { ...token, x: to.x, y: to.y } : token)
    changed = true
  }
  const areas = areasAfterDancingLightsTether
    .filter((area) => !removedAreaIds.has(area.id))
    .map((area) => {
    if (area.anchorMode !== 'source-token' && area.anchorMode !== 'target-token' && area.anchorMode !== 'effect-token') return area
    const anchorToken = tokens.find((token) => token.id === (area.anchorTokenId ?? area.sourceTokenId))
    if (!anchorToken) return area
    const anchorCell = tokenAnchorCellFromPixel(anchorToken.x, anchorToken.y, anchorToken, map)
    const anchorCellChanged = anchorCell.col !== area.anchorCell?.col || anchorCell.row !== area.anchorCell?.row
    const anchorElevationFeet = mapGeometryTokenElevation(geometry, anchorToken)
    const vertical = area.vertical?.mode === 'volume'
      ? {
          ...area.vertical,
          baseElevationFeet: persistentAreaElevationFeet(
            anchorElevationFeet + (area.vertical.anchorOffsetFeet ?? 0),
          ),
        }
      : area.vertical
    const verticalChanged = vertical?.mode === 'volume' && (
      area.vertical?.mode !== 'volume' ||
      Math.abs(vertical.baseElevationFeet - area.vertical.baseElevationFeet) > 1e-4
    )
    if (!anchorCellChanged && !verticalChanged) return area
    const cells = anchorCellChanged ? shiftedCells(area, anchorCell, map) : area.cells
    if (cells.length < 1) return area
    changed = true
    return { ...area, cells, anchorCell, vertical }
  })
  return changed ? {
    ...map,
    tokens: tokens.filter((token) => !removedTokenIds.has(token.id)),
    dnd5ePluginAreas: areas,
  } : map
}

export function dnd5eCoreSpellAreasOwnedBy(
  map: BattleMap,
  sourceToken: Pick<Token, 'id'>,
): Dnd5ePluginArea[] {
  return (map.dnd5ePluginAreas ?? []).filter((area) =>
    area.sourceKind === 'core-spell' && area.sourceTokenId === sourceToken.id,
  )
}

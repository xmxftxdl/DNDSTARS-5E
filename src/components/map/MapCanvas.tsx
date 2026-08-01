import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DependencyList } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Group, Circle, Text, Rect, Arrow } from 'react-konva'
import Konva from 'konva'
import { getImage } from '../../lib/imageStore'
import {
  clampGridSize,
  cellKey,
  cellTopLeft,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_OPACITY,
  DND_FEET_PER_CELL,
  gridStrokeRgba,
  measureSegmentCells,
  measureSnapsToGrid,
  snapToCellCenter,
  tokenCenterForAnchorCell,
  tokenDisplayRadius,
  TOKEN_MOVE_DURATION_S,
  type GridCell,
} from '../../lib/gridCombat'
import {
  tokenMovementAnimationPosition,
  type TokenMovementAnimation,
} from '../../lib/tokenMovementAnimation'
import {
  canDragMapToken,
  resolveOptimisticTokenMovePreview,
  shouldValidateMapTokenMoveLocally,
} from '../../lib/mapTokenDragPolicy'
import { planMapTokenDrop } from '../../lib/mapTokenDropPlanner'
import { createLatestTokenMovePreviewTracker } from '../../lib/latestTokenMovePreview'
import {
  setTokenVisualNodesPositionLocked,
  syncTokenVisualNodes,
  type TokenVisualNodeLike,
} from '../../lib/tokenVisualPosition'
import {
  THUNDERWAVE_ANIMATION_DURATION_MS,
  combatPresentationSavingThrowAbilityLabel,
  type CombatPresentationAttackTargetEffect,
  type CombatPresentationSavingThrowAbility,
} from '../../lib/combatPresentation'
import { cachedBrowserImage, preloadBrowserImage } from '../../lib/browserImageCache'
import {
  DND5E_CLASS_ICON_PALETTES,
  dnd5eSpellActionIcon,
  type Dnd5eActionIconSpec,
} from '../../lib/dnd5eActionIcons'
import { dnd5eActionIconBackdropImage } from './dnd5eActionIconBackdropImage'

const TOKEN_MOVE_DURATION = TOKEN_MOVE_DURATION_S
// Treat tiny drags as click jitter; do not submit movement or broadcast.
const TOKEN_DRAG_THRESHOLD_PX = 4

// Cap status effect animation frame rate.
// Poison/burning/stun effects used to run at full RAF; multiple tokens could drop frames.
// These effects are slow pulses/drifts, so 30fps keeps the look while reducing repaint cost.
const STATUS_ANIM_FPS = 30

type MapSpellStatusId =
  | 'guidance'
  | 'resistance'
  | 'sanctuary'
  | 'bless'
  | 'bane'
  | 'shield-of-faith'
  | 'mage-armor'
  | 'jump'
  | 'darkvision'
  | 'see-invisibility'
  | 'warding-bond'
  | 'fly'
  | 'heroism'
  | 'enlarge-reduce'
  | 'enhance-ability'
  | 'divine-favor'
  | 'hunters-mark'
  | 'magic-weapon'
  | 'flame-blade'
  | 'invisibility'
  | 'blur'
  | 'barkskin'
  | 'protection-from-poison'
  | 'longstrider'
  | 'protection-from-energy'
  | 'death-ward'
  | 'greater-invisibility'
  | 'charm-person'
  | 'hideous-laughter'
  | 'hold-person'
  | 'blindness-deafness'

const MAP_SPELL_STATUS_ICONS: Readonly<Record<MapSpellStatusId, Dnd5eActionIconSpec>> = {
  guidance: dnd5eSpellActionIcon({
    id: 'guidance',
    name: '神导术',
    englishName: 'Guidance',
    school: '预言',
    effect: '神圣增益',
  }),
  resistance: dnd5eSpellActionIcon({
    id: 'resistance',
    name: '提升抗性',
    englishName: 'Resistance',
    school: '防护',
    effect: '防护增益',
  }),
  sanctuary: dnd5eSpellActionIcon({
    id: 'sanctuary',
    name: '庇护术',
    englishName: 'Sanctuary',
    school: '防护',
    effect: '神圣防护',
  }),
  bless: dnd5eSpellActionIcon({
    id: 'bless',
    name: '祝福术',
    englishName: 'Bless',
    school: '附魔',
    effect: '神圣增益',
  }),
  bane: dnd5eSpellActionIcon({
    id: 'bane',
    name: '灾祸术',
    englishName: 'Bane',
    school: '附魔',
    effect: '诅咒减益',
  }),
  'shield-of-faith': dnd5eSpellActionIcon({
    id: 'shield-of-faith',
    name: '虔诚护盾',
    englishName: 'Shield of Faith',
    school: '防护',
    effect: '神圣防护',
  }),
  'mage-armor': dnd5eSpellActionIcon({
    id: 'mage-armor',
    name: '法师护甲',
    englishName: 'Mage Armor',
    school: '防护',
    effect: '奥术防护',
  }),
  jump: dnd5eSpellActionIcon({
    id: 'jump',
    name: '跳跃术',
    englishName: 'Jump',
    school: '变化',
    effect: '跃动强化',
  }),
  darkvision: dnd5eSpellActionIcon({
    id: 'darkvision',
    name: '黑暗视觉',
    englishName: 'Darkvision',
    school: '变化',
    effect: '夜视感知',
  }),
  'see-invisibility': dnd5eSpellActionIcon({
    id: 'see-invisibility',
    name: '识破隐形',
    englishName: 'See Invisibility',
    school: '预言',
    effect: '真实视野',
  }),
  'warding-bond': dnd5eSpellActionIcon({
    id: 'warding-bond',
    name: '守护之链',
    englishName: 'Warding Bond',
    school: '防护',
    effect: '守护联结',
  }),
  fly: dnd5eSpellActionIcon({
    id: 'fly',
    name: '飞行术',
    englishName: 'Fly',
    school: '变化',
    effect: '飞行强化',
  }),
  heroism: dnd5eSpellActionIcon({
    id: 'heroism',
    name: '英雄气概',
    englishName: 'Heroism',
    school: '附魔',
    effect: '勇气增益',
  }),
  'enlarge-reduce': dnd5eSpellActionIcon({
    id: 'enlarge-reduce',
    name: '变巨/缩小术',
    englishName: 'Enlarge/Reduce',
    school: '变化',
    effect: '体型变化',
  }),
  'enhance-ability': dnd5eSpellActionIcon({
    id: 'enhance-ability',
    name: '强化属性',
    englishName: 'Enhance Ability',
    school: '变化',
    effect: '属性强化',
  }),
  'divine-favor': dnd5eSpellActionIcon({
    id: 'divine-favor',
    name: '神恩',
    englishName: 'Divine Favor',
    school: '塑能',
    effect: '神圣武器强化',
  }),
  'hunters-mark': dnd5eSpellActionIcon({
    id: 'hunters-mark',
    name: '猎人印记',
    englishName: "Hunter's Mark",
    school: '预言',
    effect: '猎杀标记',
  }),
  'magic-weapon': dnd5eSpellActionIcon({
    id: 'magic-weapon',
    name: '魔化武器',
    englishName: 'Magic Weapon',
    school: '变化',
    effect: '魔法武器强化',
  }),
  'flame-blade': dnd5eSpellActionIcon({
    id: 'flame-blade',
    name: '火焰刀',
    englishName: 'Flame Blade',
    school: '塑能',
    effect: '燃烧刀刃',
  }),
  invisibility: dnd5eSpellActionIcon({
    id: 'invisibility',
    name: '隐形术',
    englishName: 'Invisibility',
    school: '幻术',
    effect: '隐匿身形',
  }),
  blur: dnd5eSpellActionIcon({
    id: 'blur',
    name: '朦胧术',
    englishName: 'Blur',
    school: '幻术',
    effect: '扭曲身影',
  }),
  barkskin: dnd5eSpellActionIcon({
    id: 'barkskin',
    name: '树肤术',
    englishName: 'Barkskin',
    school: '变化',
    effect: '树皮护甲',
  }),
  'protection-from-poison': dnd5eSpellActionIcon({
    id: 'protection-from-poison',
    name: '防护毒素',
    englishName: 'Protection from Poison',
    school: '防护',
    effect: '毒素防护',
  }),
  longstrider: dnd5eSpellActionIcon({
    id: 'longstrider',
    name: '大步奔行',
    englishName: 'Longstrider',
    school: '变化',
    effect: '移动强化',
  }),
  'protection-from-energy': dnd5eSpellActionIcon({
    id: 'protection-from-energy',
    name: '防护能量伤害',
    englishName: 'Protection from Energy',
    school: '防护',
    effect: '能量抗性',
  }),
  'death-ward': dnd5eSpellActionIcon({
    id: 'death-ward',
    name: '防死结界',
    englishName: 'Death Ward',
    school: '防护',
    effect: '死亡防护',
  }),
  'greater-invisibility': dnd5eSpellActionIcon({
    id: 'greater-invisibility',
    name: '高等隐形术',
    englishName: 'Greater Invisibility',
    school: '幻术',
    effect: '高等隐匿',
  }),
  'charm-person': dnd5eSpellActionIcon({
    id: 'charm-person',
    name: '魅惑人类',
    englishName: 'Charm Person',
    school: '附魔',
    effect: '魅惑控制',
  }),
  'hideous-laughter': dnd5eSpellActionIcon({
    id: 'hideous-laughter',
    name: '狂笑术',
    englishName: 'Hideous Laughter',
    school: '附魔',
    effect: '失能狂笑',
  }),
  'hold-person': dnd5eSpellActionIcon({
    id: 'hold-person',
    name: '定身术',
    englishName: 'Hold Person',
    school: '附魔',
    effect: '麻痹定身',
  }),
  'blindness-deafness': dnd5eSpellActionIcon({
    id: 'blindness-deafness',
    name: '目盲/耳聋术',
    englishName: 'Blindness/Deafness',
    school: '死灵',
    effect: '感官剥夺',
  }),
}

/**
 * Controlled Konva status effect animation hook.
 * - active=false stops the animation immediately.
 * - Status components are already conditionally rendered; this adds an explicit runtime gate.
 * - Mounted components only animate while active, and clear stops the animation.
 * - Frame-rate limiting skips redraws until the frame budget is reached.
 * - frame.time is still real elapsed time, so throttling does not freeze effects.
 * - The effect simply renders less often.
 *
 * getLayer reads from refs after mount.
 */
function useStatusAnimation(
  getLayer: () => Konva.Layer | null,
  callback: (frame: { time: number } | null) => void,
  deps: DependencyList,
  options?: { active?: boolean; fps?: number },
) {
  const active = options?.active ?? true
  const fps = options?.fps ?? STATUS_ANIM_FPS
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!active) return
    const minDelta = fps > 0 ? 1000 / fps : 0
    let lastRender = -Infinity
    let anim: Konva.Animation | null = null
    let raf = 0

    const start = () => {
      const layer = getLayer()
      if (!layer) {
        // Layer may not be mounted on the first frame; retry next frame.
        raf = requestAnimationFrame(start)
        return
      }
      anim = new Konva.Animation((frame) => {
        const time = frame?.time ?? 0
        // Skip redraws until the frame budget is reached.
        if (minDelta > 0 && time - lastRender < minDelta) return
        lastRender = time
        callbackRef.current(frame ? { time: frame.time } : null)
      }, layer)
      anim.start()
    }

    start()
    return () => {
      cancelAnimationFrame(raf)
      anim?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fps, ...deps])
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Dnd5eStandardConditionId } from '../../rulesets/dnd5e/conditions'
import type { Dnd5eTraversalMode } from '../../rulesets/dnd5e/traversal'
import { DND5E_CONDITION_MARKERS } from './dnd5eConditionMarkers'
import {
  fogOperationForTool,
  fogShapeKindForTool,
  type FogShape,
  type FogTool,
  type MapFogState,
} from '../../lib/fogOfWar'
import {
  DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  mapGeometryAbsoluteElevationAtPoint,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryDoorPhysicalState,
  mapGeometryMagicalDarknessObstacleIsSuppressed,
  mapGeometryObstacleAffectsElevation,
  mapGeometryAttachOpeningToWall,
  mapGeometryOpeningOverlaps,
  mapGeometryGridSelectionBoundary,
  mapGeometryLightPolygon,
  mapGeometrySpellLightingSources,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  mapGeometryWallRenderSegments,
  mapGeometryVisibilityPolygon,
  mapGeometryVisibleTargets,
  type MapGeometryEntity,
  type MapGeometryGridCell,
  type MapGeometryState,
  type MapGeometryTool,
  type MapGeometryPoint,
  type MapGeometryWallMaterial,
} from '../../lib/mapGeometry'
import type { MapGeometryDiagnostics } from '../../lib/mapGeometryDiagnostics'
import type { WallDetectionCandidate } from '../../lib/mapImageGeometryDetection'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { campaignLightIsActive } from '../../lib/campaignTime'
import { useCampaignTimeStore } from '../../store/campaignTime'
import type {
  MapTabletopAnnotation,
  MapTabletopFocus,
  MapTabletopPing,
  MapTabletopPoint,
  MapTabletopTool,
} from '../../lib/mapTabletop'
import type { SceneInteractionPointIcon, SceneRegion } from '../../lib/sceneOrchestration'
import {
  mapLightingAmbientOpacity,
  mapLightingDarkvisionCutoutOpacity,
  mapLightingGlowOpacity,
  mapLightingRadiusFromDrag,
  mapLightingShouldRender,
} from './mapLightingPresentation'
import { compileDnd5eEffectiveVisionProfile } from '../../../shared/dnd5e-vision-profile.mjs'
import {
  mapCanvasAoeGridCell,
  mapCanvasGeometryDrawShouldStart,
  mapCanvasStageCanPan,
  mapCanvasTokenClickAction,
} from './mapCanvasInteraction'

export interface MoveCircle {
  centerX: number
  centerY: number
  radiusPx: number
}

export interface AoeHighlight {
  cells: GridCell[]
  rangeCells?: GridCell[]
  valid: boolean
  /** Dark red original area outline (circle). */
  areaCircle?: {
    centerX: number
    centerY: number
    radiusPx: number
  }
  /** Dark red original area outline (polygon/line). */
  areaPolygon?: number[]
  /** range：蓝色可选区；attack：黄色受击区 */
  variant?: 'attack' | 'range'
}

export interface MapProjectile {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  kind?: 'arrow' | 'focus' | 'fire-bolt' | 'fireball' | 'shocking-grasp' | 'chill-touch' | 'ray-of-frost' | 'eldritch-blast' | 'produce-flame' | 'guidance' | 'resistance' | 'sanctuary' | 'sacred-flame' | 'spare-the-dying' | 'acid-splash' | 'poison-spray' | 'vicious-mockery' | 'magic-missile' | 'scorching-ray' | 'guiding-bolt' | 'acid-arrow' | 'cure-wounds' | 'healing-word' | 'inflict-wounds' | 'hellish-rebuke' | 'burning-hands' | 'thunderwave' | 'shatter' | 'lightning-bolt' | 'bless' | 'bane' | 'shield-of-faith' | 'mage-armor' | 'jump' | 'darkvision' | 'see-invisibility' | 'warding-bond' | 'fly' | 'heroism' | 'enlarge-reduce' | 'enhance-ability' | 'divine-favor' | 'hunters-mark' | 'magic-weapon' | 'flame-blade' | 'invisibility' | 'blur' | 'barkskin' | 'protection-from-poison' | 'longstrider' | 'protection-from-energy' | 'death-ward' | 'greater-invisibility' | 'charm-person' | 'hideous-laughter' | 'hold-person' | 'blindness-deafness'
  hit?: boolean
  issuedAt?: number
  durationMs?: number
  radiusPx?: number
  areaWidthPx?: number
  accentColor?: string
  glowColor?: string
}

export interface SpellStatusTokenMark {
  tokenId: string
  statusId: MapSpellStatusId
  backgroundHighlightColor: string
  backgroundColor: string
  borderColor: string
  glowColor: string
  classId?: string
}

export interface StandardConditionTokenMark {
  tokenId: string
  condition: Dnd5eStandardConditionId
  backgroundColor: string
  borderColor: string
  glowColor: string
}

export interface DeleteSelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SceneTriggerZoneOverlay {
  sceneId: string
  triggerId: string
  name: string
  enabled: boolean
  region: SceneRegion
}

export interface SceneInteractionPointOverlay {
  id: string
  name: string
  enabled: boolean
  visibleToPlayers: boolean
  icon: SceneInteractionPointIcon
  x: number
  y: number
  prompt: string
}

interface MapCanvasProps {
  map: BattleMap
  /** Explicit combat phase; enemy Tokens switch from placement drag to turn movement. */
  combatActive?: boolean
  selectedTokenId: string | null
  onSelectToken: (id: string | null) => void
  targetSelectTokenIds?: string[]
  measureMode?: boolean
  /** 每个 token 的生命值（用于显示血条） */
  hpByToken?: Record<string, { hp: number; max: number; temp?: number }>
  /** 玩家移动：以 token 为圆心、半径为尺数的圆 */
  moveSelectMode?: boolean
  moveCircle?: MoveCircle
  onMoveSelect?: (point: { x: number; y: number }) => void
  moveTraversalMode?: Dnd5eTraversalMode
  moveTargetElevationFeet?: number
  difficultTerrainMultiplierAtPosition?: (token: Token, position: { x: number; y: number }) => number
  speedCostMultiplierAtPosition?: (token: Token, position: { x: number; y: number }) => number
  /** Circular AOE selection: highlighted cells plus click confirm. */
  aoeSelectMode?: boolean
  aoeHighlight?: AoeHighlight
  rangedRangeCells?: GridCell[]
  onAoePreviewCell?: (cell: GridCell | null) => void
  onAoeConfirm?: (cell: GridCell) => void
  onAoeCancel?: () => void
  /** 由 5e Headless 快照得出的标准状态，显示在 Token 右上角。 */
  dnd5eConditionsByToken?: Record<string, readonly Dnd5eStandardConditionId[]>
  standardConditionTokenMarks?: StandardConditionTokenMark[]
  onDnd5eConditionClick?: (tokenId: string, condition?: Dnd5eStandardConditionId) => void
  onDnd5ePluginAreaVisibilityToggle?: (areaId: string) => void
  tokenHoverLabels?: Record<string, string>
  projectiles?: MapProjectile[]
  /** Short-lived marks for explicit single-target weapon and natural attacks. */
  attackTargetEffects?: CombatPresentationAttackTargetEffect[]
  /** Targets carrying the authoritative Chill Touch no-healing effect. */
  chillTouchTokenIds?: string[]
  /** Targets protected by the authoritative Sanctuary spell. */
  sanctuaryTokenIds?: string[]
  /** Persistent spell statuses colored by the class of the actor who granted them. */
  spellStatusTokenMarks?: SpellStatusTokenMark[]
  /** Characters currently wielding a club or quarterstaff empowered by Shillelagh. */
  shillelaghTokenIds?: string[]
  /** Defeated tokens are dimmed. */
  defeatedTokenIds?: string[]
  /** Token currently resolving a saving throw. */
  savingThrowTokenId?: string
  savingThrowAbility?: CombatPresentationSavingThrowAbility
  /** 当前先攻回合的 Token；仅用于绘制呼吸闪烁光环，不改变占地和交互范围。 */
  currentTurnTokenId?: string
  /** 战斗中禁止拖动的 token */
  lockDragTokenIds?: string[]
  /**
   * Token whose drag is settled by an upper authoritative movement
   * transaction. The canvas must not reject its straight line before the
   * Headless pathfinder gets a chance to route around walls or open a door.
   */
  authoritativeMovementTokenIds?: readonly string[]
  /** 底图自带网格，token 尺寸贴合格子 */
  builtinGrid?: boolean
  /** DM grid offset drag mode. */
  gridAdjustMode?: boolean
  onGridOffsetChange?: (offsetX: number, offsetY: number) => void
  /** Temporarily show grid while changing grid size. */
  gridSizePreview?: boolean
  onGridSizeChange?: (gridSize: number) => void
  onBlankContextMenu?: () => void
  deleteSelectMode?: boolean
  onDeleteBoxConfirm?: (rect: DeleteSelectionRect) => void
  onDeleteCancel?: () => void
  sceneTriggerZones?: readonly SceneTriggerZoneOverlay[]
  sceneInteractionPoints?: readonly SceneInteractionPointOverlay[]
  onSceneInteractionPointClick?: (interactionPointId: string) => void
  sceneEditMode?: boolean
  sceneRegionKind?: SceneRegion['kind']
  onSceneRegionCommit?: (region: SceneRegion) => void
  onSceneEditCancel?: () => void
  scenePointPlacementMode?: boolean
  onScenePointPlacementCommit?: (point: { x: number; y: number }) => void
  fog?: MapFogState
  fogEditMode?: boolean
  fogTool?: FogTool
  fogPreviewAsPlayer?: boolean
  onFogShapeCommit?: (shape: FogShape) => void
  onFogEditCancel?: () => void
  geometry?: MapGeometryState
  geometryEditMode?: boolean
  geometryTool?: MapGeometryTool
  geometryWallMaterial?: MapGeometryWallMaterial
  selectedGeometryEntityId?: string | null
  geometryPreviewAsPlayer?: boolean
  geometrySnapToGrid?: boolean
  geometryTerrainEditingLocked?: boolean
  geometryDiagnostics?: MapGeometryDiagnostics | null
  geometryDetectionCandidates?: readonly WallDetectionCandidate[]
  onGeometryDetectionCandidateRemove?: (index: number) => void
  visionSourceTokenIds?: string[]
  exploredVisionPolygons?: MapGeometryPoint[][]
  onGeometryEntityCommit?: (entity: MapGeometryEntity) => void
  onGeometryEntitySelect?: (entityId: string | null) => void
  onGeometryEntityDelete?: (entityId: string) => void
  onGeometryEntityPointsChange?: (entityId: string, points: MapGeometryPoint[]) => void
  onGeometryDoorInteract?: (doorId: string) => void
  geometrySearchMode?: boolean
  onGeometrySearch?: (point: { x: number; y: number }) => void
  onGeometryEditCancel?: () => void
  onTokenMoveBlocked?: (entityId?: string) => void
  /**
   * 返回 true 表示由上层权威事务接管本次拖动，MapCanvas 不直接写坐标；
   * 返回 pending 时保留目标位置预览，直至权威坐标同步或请求结束。
   * 用于战斗中的怪物移动力、借机攻击和危险区域结算。
   */
  onTokenMoveRequest?: (
    token: Token,
    position: { x: number; y: number },
    targetElevationFeet: number,
  ) => boolean | 'pending' | Promise<void>
  /** Commits an already validated direct move through the room command layer. */
  onTokenMoveCommit?: (
    token: Token,
    position: { x: number; y: number },
    targetElevationFeet: number,
  ) => void | Promise<void>
  /** Token IDs whose authority requests are still waiting for DM settlement. */
  optimisticTokenMoveIds?: readonly string[]
  /** Player Tokens that the current non-DM client may request to move. */
  playerMovableTokenIds?: readonly string[]
  tabletopTool?: MapTabletopTool
  tabletopPings?: readonly MapTabletopPing[]
  tabletopAnnotations?: readonly MapTabletopAnnotation[]
  tabletopFocus?: MapTabletopFocus | null
  pingEnabled?: boolean
  onMapPing?: (point: MapTabletopPoint) => void
  onTabletopPoint?: (point: MapTabletopPoint) => void
  onTabletopAnnotation?: (shape: 'arrow' | 'circle', from: MapTabletopPoint, to: MapTabletopPoint) => void
  /** DM 视角：始终显示敌人血量条；玩家视角受 token.showHpOnToken 控制 */
  isDM?: boolean
}

interface Point {
  x: number
  y: number
}

function rectFromPoints(a: Point, b: Point): DeleteSelectionRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

function measurePointsEqual(a: Point, b: Point): boolean {
  return Math.hypot(b.x - a.x, b.y - a.y) < 1.5
}

function fogShapeNode(shape: FogShape, color: string, opacity: number, key = shape.id) {
  const common = {
    opacity: shape.operation === 'reveal' ? 1 : opacity,
    globalCompositeOperation: shape.operation === 'reveal' ? 'destination-out' : 'source-over',
    listening: false,
  } as const
  if (shape.kind === 'rect') {
    return <Rect key={key} {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={color} />
  }
  if (shape.kind === 'circle') {
    return <Circle key={key} {...common} x={shape.x} y={shape.y} radius={shape.radius} fill={color} />
  }
  if (shape.kind === 'polygon') {
    return <Line key={key} {...common} points={shape.points} closed fill={color} />
  }
  return (
    <Line
      key={key}
      {...common}
      points={shape.points}
      stroke={color}
      strokeWidth={shape.width}
      lineCap="round"
      lineJoin="round"
    />
  )
}

function FogOfWarLayer({
  map,
  fog,
  isDM,
  previewAsPlayer,
  draft,
  polygonPoints,
  inv,
}: {
  map: BattleMap
  fog?: MapFogState
  isDM: boolean
  previewAsPlayer: boolean
  draft: FogShape | null
  polygonPoints: number[]
  inv: number
}) {
  if (!fog || (!fog.filled && fog.shapes.length === 0 && !draft && polygonPoints.length === 0)) return null
  // 玩家实际看到的迷雾始终完全不透明（见 PlayerVisibilityLayer）；
  // fog.opacity 只调节 DM 编辑视图下这层半透明预览的浓度。
  const opacity = isDM && !previewAsPlayer ? Math.max(0.15, Math.min(0.8, fog.opacity * 0.55)) : 1
  return (
    <Layer listening={false}>
      {fog.filled && (
        <Rect x={0} y={0} width={map.width} height={map.height} fill={fog.color} opacity={opacity} listening={false} />
      )}
      {fog.shapes.map((shape) => fogShapeNode(shape, fog.color, opacity))}
      {draft && fogShapeNode(draft, draft.operation === 'reveal' ? '#67e8f9' : '#f59e0b', 0.5, 'fog-draft')}
      {polygonPoints.length >= 2 && (
        <Line
          points={polygonPoints}
          stroke="#fbbf24"
          strokeWidth={2 * inv}
          dash={[8 * inv, 5 * inv]}
          fill="rgba(251,191,36,0.12)"
          closed={polygonPoints.length >= 6}
          listening={false}
        />
      )}
    </Layer>
  )
}

function PlayerVisibilityLayer({
  map,
  geometry,
  fog,
  sourceTokenIds,
  exploredPolygons,
  worldMinute,
}: {
  map: BattleMap
  geometry?: MapGeometryState
  fog?: MapFogState
  sourceTokenIds: readonly string[]
  exploredPolygons: readonly MapGeometryPoint[][]
  worldMinute: number
}) {
  const manualFogEnabled = !!fog && (fog.filled || fog.shapes.length > 0)
  // Owlbear 语义：玩家端的黑幕完全由战争迷雾层决定（全图填充或画出的
  // cover 形状）。动态视野只影响视野多边形形状（墙体挡视线）和服务端
  // Token 过滤，不再单独把整张图罩黑。
  if (!manualFogEnabled) return null
  const sourceIds = new Set(sourceTokenIds)
  const viewers = map.tokens.filter((token) => sourceIds.has(token.id))
  const visibleTargets = mapGeometryVisibleTargets({
    geometry,
    map,
    viewers,
    forceEnabled: true,
    fallbackRangeFeet: DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
    worldMinute,
  })
  const fullCover = fog?.filled === true
  const coverColor = fog?.color ?? '#05070f'
  return (
    <Layer listening={false}>
      {fullCover && <Rect
        x={0}
        y={0}
        width={map.width}
        height={map.height}
        fill={coverColor}
        opacity={1}
        listening={false}
      />}
      {/* 玩家端迷雾始终完全不透明（Owlbear 语义）；按绘制顺序合成，
          后画的 cover 会重新盖住先前 reveal 过的区域，与服务端
          fogPointState 的判定一致。fog.opacity 只影响 DM 自己的预览。 */}
      {fullCover && exploredPolygons.map((polygon, index) => polygon.length >= 3 ? (
        <Line
          key={`explored:${index}`}
          points={polygon.flatMap((point) => [point.x, point.y])}
          closed
          fill="#000"
          globalCompositeOperation="destination-out"
          listening={false}
        />
      ) : null)}
      {fog?.shapes.map((shape) => fogShapeNode(shape, fog.color, 1))}
      {viewers.map((viewer) => {
        const polygon = mapGeometryVisibilityPolygon({
          geometry,
          map,
          viewer,
          forceEnabled: manualFogEnabled,
          worldMinute,
        })
        return polygon.length >= 3 ? (
          <Line
            key={`vision:${viewer.id}`}
            points={polygon.flatMap((point) => [point.x, point.y])}
            closed
            fill="#000"
            globalCompositeOperation="destination-out"
            listening={false}
          />
        ) : null
      })}
      {/* 二维地面遮罩无法表达不同目标海拔；对权威判定可见的 Token 单独开孔。 */}
      {visibleTargets.map((target) => (
        <Circle
          key={`visible-token:${target.id}`}
          x={target.x}
          y={target.y}
          radius={Math.max(6, map.gridSize * Math.max(1, target.size) * 0.54)}
          fill="#000"
          globalCompositeOperation="destination-out"
          listening={false}
        />
      ))}
    </Layer>
  )
}

function LightingLayer({
  map,
  geometry,
  worldMinute,
  isDM,
  visionSourceTokenIds,
}: {
  map: BattleMap
  geometry?: MapGeometryState
  worldMinute: number
  isDM: boolean
  visionSourceTokenIds: readonly string[]
}) {
  const visionSourceIds = new Set(visionSourceTokenIds)
  const viewers = map.tokens.filter((token) => visionSourceIds.has(token.id))
  const spellLighting = mapGeometrySpellLightingSources(map, geometry)
  const spellDarkness = spellLighting.filter((source) => source.kind === 'magical-darkness')
  const magicalDarkness = (geometry?.obstacles ?? []).filter((obstacle) =>
    obstacle.magicalDarkness === true &&
    !mapGeometryMagicalDarknessObstacleIsSuppressed({ obstacle, map, geometry, spellLighting }) && (
      viewers.length === 0 || viewers.some((viewer) => mapGeometryObstacleAffectsElevation(
        obstacle,
        mapGeometryTokenElevation(geometry, viewer),
        Math.max(5, Math.max(1, viewer.size) * 5),
      ))
    ),
  )
  const ambientLight = geometry?.vision.ambientLight ?? 'bright'
  if (!mapLightingShouldRender(
    ambientLight,
    magicalDarkness.length > 0 || spellDarkness.length > 0,
  )) return null
  const opacity = mapLightingAmbientOpacity(ambientLight, isDM)
  const viewerProfiles = viewers.map((viewer) => ({
    viewer,
    profile: compileDnd5eEffectiveVisionProfile({
      token: viewer,
      fallbackRangeFeet: geometry?.vision.defaultRangeFeet ??
        DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
    }),
  }))
  const sensePolygon = (viewer: Token, rangeFeet: number) => rangeFeet > 0
    ? mapGeometryVisibilityPolygon({
        geometry,
        map,
        viewer,
        forceEnabled: true,
        fallbackRangeFeet: geometry?.vision.defaultRangeFeet ??
          DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
        rangeOverrideFeet: rangeFeet,
        worldMinute,
      })
    : []
  const darknessSightPolygons = isDM ? [] : viewerProfiles.flatMap(({ viewer, profile }) => {
    const rangeFeet = Math.max(profile.darknessSightRangeFeet, profile.truesightRangeFeet)
    const polygon = sensePolygon(viewer, rangeFeet)
    return polygon.length >= 3 ? [{ id: viewer.id, polygon }] : []
  })
  const darkvisionPolygons = isDM ? [] : viewerProfiles.flatMap(({ viewer, profile }) => {
    const polygon = sensePolygon(viewer, profile.darkvisionRangeFeet)
    return polygon.length >= 3 ? [{ id: viewer.id, polygon }] : []
  })
  const magicalDarknessSightPolygons = isDM ? [] : viewerProfiles.flatMap(({ viewer, profile }) => {
    const rangeFeet = Math.max(
      profile.magicalDarknessSightRangeFeet,
      profile.truesightRangeFeet,
    )
    const polygon = sensePolygon(viewer, rangeFeet)
    return polygon.length >= 3 ? [{ id: viewer.id, polygon }] : []
  })
  const visibleTargets = isDM
    ? map.tokens
    : mapGeometryVisibleTargets({
        geometry,
        map,
        viewers,
        forceEnabled: true,
        worldMinute,
      })
  const sources = [
    ...map.tokens.filter((token) => campaignLightIsActive(token.lightSource, worldMinute)).map((token) => ({
      id: `token:${token.id}`,
      point: { x: token.x, y: token.y },
      elevationFeet: mapGeometryTokenElevation(geometry, token),
      brightRadiusFeet: token.lightSource!.brightRadiusFeet,
      dimRadiusFeet: token.lightSource!.dimRadiusFeet,
      color: token.lightSource!.color,
    })),
    ...(geometry?.lights ?? []).filter((light) => campaignLightIsActive(light, worldMinute)).map((light) => ({
      id: `scene:${light.id}`,
      point: light.points[0],
      elevationFeet: mapGeometryAbsoluteElevationAtPoint(geometry, light.points[0], light.elevationFeet),
      brightRadiusFeet: light.brightRadiusFeet,
      dimRadiusFeet: light.dimRadiusFeet,
      color: light.color,
    })),
    ...spellLighting.filter((source) => source.kind === 'light').map((source) => ({
      id: source.id,
      point: source.point,
      elevationFeet: source.elevationFeet,
      brightRadiusFeet: source.brightRadiusFeet,
      dimRadiusFeet: source.dimRadiusFeet,
      color: source.color,
    })),
  ]
  const sourcePolygons = sources.map((source) => ({
    ...source,
    brightPolygon: mapGeometryLightPolygon({
      geometry, map, source: source.point, radiusFeet: source.brightRadiusFeet,
      elevationFeet: source.elevationFeet,
    }),
    dimPolygon: mapGeometryLightPolygon({
      geometry, map, source: source.point,
      radiusFeet: source.brightRadiusFeet + source.dimRadiusFeet,
      elevationFeet: source.elevationFeet,
    }),
  }))
  return (
    <>
      <Layer listening={false}>
        {ambientLight !== 'bright' && <Rect x={0} y={0} width={map.width} height={map.height} fill="#02030a" opacity={opacity} listening={false} />}
        {ambientLight !== 'bright' && sourcePolygons.flatMap((source) => [
          source.dimPolygon.length >= 3 ? <Line key={`light-dim:${source.id}`} points={source.dimPolygon.flatMap((point) => [point.x, point.y])} closed fill="#000" opacity={0.52} globalCompositeOperation="destination-out" listening={false} /> : null,
          source.brightPolygon.length >= 3 ? <Line key={`light-bright:${source.id}`} points={source.brightPolygon.flatMap((point) => [point.x, point.y])} closed fill="#000" globalCompositeOperation="destination-out" listening={false} /> : null,
        ])}
        {ambientLight !== 'bright' && darkvisionPolygons.map(({ id, polygon }) => (
          <Line
            key={`darkvision:${id}`}
            points={polygon.flatMap((point) => [point.x, point.y])}
            closed
            fill="#000"
            opacity={mapLightingDarkvisionCutoutOpacity(ambientLight, isDM)}
            globalCompositeOperation="destination-out"
            listening={false}
          />
        ))}
        {ambientLight !== 'bright' && darknessSightPolygons.map(({ id, polygon }) => (
          <Line
            key={`darkness-sight:${id}`}
            points={polygon.flatMap((point) => [point.x, point.y])}
            closed
            fill="#000"
            globalCompositeOperation="destination-out"
            listening={false}
          />
        ))}
        {visibleTargets.map((target) => (
          <Circle
            key={`lighting-visible-token:${target.id}`}
            x={target.x}
            y={target.y}
            radius={Math.max(6, map.gridSize * Math.max(1, target.size) * 0.54)}
            fill="#000"
            globalCompositeOperation="destination-out"
            listening={false}
          />
        ))}
      </Layer>
      <Layer listening={false}>
        {sourcePolygons.flatMap((source) => [
          source.dimPolygon.length >= 3 ? <Line
            key={`light-glow-dim:${source.id}`}
            points={source.dimPolygon.flatMap((point) => [point.x, point.y])}
            closed
            fill={source.color}
            opacity={mapLightingGlowOpacity('dim', ambientLight, isDM)}
            globalCompositeOperation="screen"
            listening={false}
          /> : null,
          source.brightPolygon.length >= 3 ? <Line
            key={`light-glow-bright:${source.id}`}
            points={source.brightPolygon.flatMap((point) => [point.x, point.y])}
            closed
            fill={source.color}
            opacity={mapLightingGlowOpacity('bright', ambientLight, isDM)}
            globalCompositeOperation="screen"
            listening={false}
          /> : null,
        ])}
      </Layer>
      {(magicalDarkness.length > 0 || spellDarkness.length > 0) && <Layer listening={false}>
        {magicalDarkness.map((zone) => (
          <Line
            key={`magical-darkness-top:${zone.id}`}
            points={zone.points.flatMap((point) => [point.x, point.y])}
            closed
            fill="#010108"
            stroke="rgba(139,92,246,0.7)"
            strokeWidth={isDM ? 2 : 0}
            opacity={isDM ? 0.22 : 0.97}
            listening={false}
          />
        ))}
        {spellDarkness.map((source) => (
          <Circle
            key={`magical-darkness-top:${source.id}`}
            x={source.point.x}
            y={source.point.y}
            radius={source.radiusFeet / Math.max(1, map.feetPerCell ?? 5) * Math.max(1, map.gridSize)}
            fill="#010108"
            stroke="rgba(139,92,246,0.7)"
            strokeWidth={isDM ? 2 : 0}
            opacity={isDM ? 0.22 : 0.97}
            listening={false}
          />
        ))}
        {magicalDarknessSightPolygons.map(({ id, polygon }) => (
          <Line
            key={`magical-darkness-sight:${id}`}
            points={polygon.flatMap((point) => [point.x, point.y])}
            closed
            fill="#000"
            globalCompositeOperation="destination-out"
            listening={false}
          />
        ))}
        {visibleTargets.map((target) => (
          <Circle
            key={`magical-darkness-visible-token:${target.id}`}
            x={target.x}
            y={target.y}
            radius={Math.max(6, map.gridSize * Math.max(1, target.size) * 0.54)}
            fill="#000"
            globalCompositeOperation="destination-out"
            listening={false}
          />
        ))}
      </Layer>}
    </>
  )
}

function geometryEntityPoints(entity: MapGeometryEntity): number[] {
  return entity.points.flatMap((point) => [point.x, point.y])
}

const WALL_MATERIAL_STYLE: Record<MapGeometryWallMaterial, { color: string; dash?: number[] }> = {
  stone: { color: '#94a3b8' },
  brick: { color: '#c2410c', dash: [12, 2] },
  wood: { color: '#a16207', dash: [18, 4] },
  metal: { color: '#cbd5e1', dash: [4, 2] },
  natural: { color: '#22c55e', dash: [9, 5] },
}

function geometryWallMaterial(
  geometry: MapGeometryState | undefined,
  entity: MapGeometryEntity,
): MapGeometryWallMaterial {
  if (entity.kind === 'wall') return entity.material ?? 'stone'
  if (entity.kind === 'door' || entity.kind === 'window') {
    return geometry?.walls.find((wall) => wall.id === entity.parentWallId)?.material ?? 'stone'
  }
  return 'stone'
}

function GeometryEditHandles({
  entity,
  inv,
  onPointsChange,
}: {
  entity: MapGeometryEntity
  inv: number
  onPointsChange?: (entityId: string, points: MapGeometryPoint[]) => void
}) {
  if (!['wall', 'door', 'window'].includes(entity.kind)) return null
  const editablePoints = entity.points
  const commitPoint = (index: number, point: MapGeometryPoint) => {
    const points = editablePoints.map((current, currentIndex) => currentIndex === index ? point : current)
    onPointsChange?.(entity.id, points)
  }
  const stop = (event: Konva.KonvaEventObject<MouseEvent | DragEvent>) => { event.cancelBubble = true }
  const midpoint = entity.kind === 'door' || entity.kind === 'window'
    ? { x: (entity.points[0].x + entity.points[1].x) / 2, y: (entity.points[0].y + entity.points[1].y) / 2 }
    : undefined
  const handlePoints = editablePoints.map((point, index) => ({ point, index }))
  return (
    <Group>
      {handlePoints.map(({ point, index }) => (
        <Circle
          key={`${entity.id}:handle:${index}`}
          x={point.x}
          y={point.y}
          radius={6 * inv}
          fill="#f8fafc"
          stroke="#7c3aed"
          strokeWidth={2 * inv}
          draggable
          hitStrokeWidth={12 * inv}
          onMouseDown={stop}
          onDragStart={stop}
          onDragEnd={(event) => {
            stop(event)
            commitPoint(index, { x: event.target.x(), y: event.target.y() })
          }}
        />
      ))}
      {midpoint && (
        <Rect
          x={midpoint.x - 5 * inv}
          y={midpoint.y - 5 * inv}
          width={10 * inv}
          height={10 * inv}
          cornerRadius={2 * inv}
          fill="#a78bfa"
          stroke="#ffffff"
          strokeWidth={1.5 * inv}
          draggable
          hitStrokeWidth={12 * inv}
          onMouseDown={stop}
          onDragStart={stop}
          onDragEnd={(event) => {
            stop(event)
            const nextMidpoint = { x: event.target.x() + 5 * inv, y: event.target.y() + 5 * inv }
            const dx = nextMidpoint.x - midpoint.x
            const dy = nextMidpoint.y - midpoint.y
            onPointsChange?.(entity.id, entity.points.map((point) => ({ x: point.x + dx, y: point.y + dy })))
          }}
        />
      )}
    </Group>
  )
}

function MapGeometryLayer({
  map,
  geometry,
  draft,
  editMode,
  doorInteractionMode,
  tool,
  selectedEntityId,
  inv,
  terrainEditingLocked,
  onSelect,
  onDelete,
  onPointsChange,
}: {
  map: BattleMap
  geometry?: MapGeometryState
  draft: MapGeometryEntity | null
  editMode: boolean
  doorInteractionMode?: boolean
  tool: MapGeometryTool
  selectedEntityId: string | null
  inv: number
  terrainEditingLocked: boolean
  onSelect?: (entityId: string | null) => void
  onDelete?: (entityId: string) => void
  onPointsChange?: (entityId: string, points: MapGeometryPoint[]) => void
}) {
  if (!geometry && !draft) return null
  const allEntities: MapGeometryEntity[] = [
    ...(geometry?.walls ?? []),
    ...(geometry?.doors ?? []),
    ...(geometry?.windows ?? []),
    ...(geometry?.obstacles ?? []),
    ...(geometry?.lights ?? []),
    ...(draft ? [draft] : []),
  ]
  const entities = doorInteractionMode && !editMode
    ? allEntities.filter((entity) =>
        entity.kind === 'wall' || entity.kind === 'door' || entity.kind === 'window',
      )
    : allEntities
  const entityEditListening = editMode && (tool === 'select' || tool === 'delete')
  const matchingToolEditListening = editMode && tool !== 'delete'
  return (
    <Layer listening={entityEditListening || matchingToolEditListening || doorInteractionMode}>
      {entities.map((entity) => {
        const selected = entity.id === selectedEntityId
        const isDraft = entity === draft
        const material = WALL_MATERIAL_STYLE[geometryWallMaterial(geometry, entity)]
        const color = entity.kind === 'door'
          ? mapGeometryDoorPhysicalState(entity) !== 'intact'
            ? '#fb7185'
            : mapGeometryDoorOpenState(entity) === 'open'
            ? '#34d399'
            : mapGeometryDoorLockState(entity) !== 'unlocked'
              ? '#f87171'
              : '#fbbf24'
          : entity.kind === 'obstacle'
            ? entity.terrainRegion ? '#fbbf24' : entity.magicalDarkness ? '#8b5cf6' : '#fb923c'
            : entity.kind === 'light'
              ? entity.color
              : entity.kind === 'window'
                ? entity.windowState === 'broken'
                  ? '#fb7185'
                  : entity.windowState === 'open'
                    ? '#34d399'
                    : '#38bdf8'
                : material.color
        const selectEntity = (event: Konva.KonvaEventObject<MouseEvent>) => {
          event.cancelBubble = true
          if (editMode && tool === 'delete') {
            if (terrainEditingLocked && entity.kind === 'obstacle' && (
              entity.terrainRegion || (entity.terrainElevationFeet ?? 0) !== 0
            )) return
            onDelete?.(entity.id)
          }
          else onSelect?.(entity.id)
        }
        if (entity.kind === 'light') {
          const point = entity.points[0]
          const outerRadius = (entity.brightRadiusFeet + entity.dimRadiusFeet) /
            Math.max(1, map.feetPerCell ?? 5) * Math.max(1, map.gridSize)
          const brightRadius = entity.brightRadiusFeet /
            Math.max(1, map.feetPerCell ?? 5) * Math.max(1, map.gridSize)
          const lightEditListening = !isDraft && (
            entityEditListening || (editMode && tool === 'light')
          )
          return (
            <Group key={entity.id} listening={lightEditListening} onMouseDown={selectEntity}>
              <Circle x={point.x} y={point.y} radius={Math.max(outerRadius, 8 * inv)} stroke={color} strokeWidth={(selected ? 3 : 1.5) * inv} opacity={isDraft ? 0.45 : 0.3} dash={[6 * inv, 4 * inv]} />
              <Circle x={point.x} y={point.y} radius={Math.max(brightRadius, 5 * inv)} stroke={color} strokeWidth={(selected ? 3 : 1.5) * inv} opacity={isDraft ? 0.6 : 0.5} />
              <Circle
                x={point.x}
                y={point.y}
                radius={6 * inv}
                fill={entity.enabled ? color : '#64748b'}
                stroke={selected ? '#fff' : '#111827'}
                strokeWidth={2 * inv}
                draggable={editMode && (tool === 'select' || tool === 'light') && selected && !isDraft}
                hitStrokeWidth={14 * inv}
                onDragStart={(event) => { event.cancelBubble = true }}
                onDragEnd={(event) => {
                  event.cancelBubble = true
                  onPointsChange?.(entity.id, [{ x: event.target.x(), y: event.target.y() }])
                }}
              />
            </Group>
          )
        }
        if (entity.kind === 'wall') {
          const segments = mapGeometryWallRenderSegments(geometry, entity)
          return (
            <Group
              key={entity.id}
              listening={(entityEditListening || (editMode && tool === 'wall')) && !isDraft}
              onMouseDown={selectEntity}
            >
              {segments.map((segment, index) => (
                <Group key={`${entity.id}:${segment.wallSegmentIndex}:${index}`}>
                  {selected && <Line
                    points={[segment.a.x, segment.a.y, segment.b.x, segment.b.y]}
                    stroke="#ffffff"
                    strokeWidth={8 * inv}
                    lineCap="round"
                    hitStrokeWidth={16 * inv}
                  />}
                  <Line
                    points={[segment.a.x, segment.a.y, segment.b.x, segment.b.y]}
                    stroke={material.color}
                    strokeWidth={5 * inv}
                    dash={material.dash?.map((value) => value * inv)}
                    lineCap="round"
                    opacity={isDraft ? 0.68 : 0.94}
                    hitStrokeWidth={16 * inv}
                  />
                </Group>
              ))}
              {selected && editMode && (tool === 'select' || tool === 'wall') && !isDraft && (
                <GeometryEditHandles entity={entity} inv={inv} onPointsChange={onPointsChange} />
              )}
            </Group>
          )
        }
        if (entity.kind === 'door') {
          const hingeIndex = entity.hinge === 'end' ? 1 : 0
          const hinge = entity.points[hingeIndex]
          const closedEnd = entity.points[hingeIndex === 0 ? 1 : 0]
          const swingSign = entity.swing === 'counterclockwise' ? -1 : 1
          const leafEnd = mapGeometryDoorOpenState(entity) === 'open'
            ? {
                x: hinge.x - (closedEnd.y - hinge.y) * swingSign,
                y: hinge.y + (closedEnd.x - hinge.x) * swingSign,
              }
            : closedEnd
          const leafPoints = [hinge.x, hinge.y, leafEnd.x, leafEnd.y]
          return (
            <Group
              key={entity.id}
              listening={(entityEditListening || doorInteractionMode || (editMode && tool === 'door')) && !isDraft}
              onMouseDown={selectEntity}
            >
              <Line
                points={geometryEntityPoints(entity)}
                stroke="rgba(0,0,0,0.01)"
                strokeWidth={2 * inv}
                hitStrokeWidth={18 * inv}
              />
              {selected && <Line points={leafPoints} stroke="#ffffff" strokeWidth={10 * inv} lineCap="round" />}
              <Line
                points={leafPoints}
                stroke={material.color}
                strokeWidth={8 * inv}
                dash={material.dash?.map((value) => value * inv)}
                lineCap="round"
                opacity={isDraft ? 0.68 : 0.96}
              />
              <Line
                points={leafPoints}
                stroke={color}
                strokeWidth={3 * inv}
                dash={entity.secret ? [7 * inv, 5 * inv] : undefined}
                lineCap="round"
              />
              <Circle x={hinge.x} y={hinge.y} radius={3.5 * inv} fill={color} stroke={material.color} strokeWidth={1.5 * inv} />
              {selected && editMode && (tool === 'select' || tool === 'door') && !isDraft && (
                <GeometryEditHandles entity={entity} inv={inv} onPointsChange={onPointsChange} />
              )}
            </Group>
          )
        }
        if (entity.kind === 'window') {
          const [a, b] = entity.points
          const dx = b.x - a.x
          const dy = b.y - a.y
          const length = Math.max(1, Math.hypot(dx, dy))
          const nx = -dy / length * 5 * inv
          const ny = dx / length * 5 * inv
          const ticks = [0.33, 0.67].map((t) => ({ x: a.x + dx * t, y: a.y + dy * t }))
          return (
            <Group
              key={entity.id}
              listening={(entityEditListening || (editMode && tool === 'window')) && !isDraft}
              onMouseDown={selectEntity}
            >
              {selected && <Line points={geometryEntityPoints(entity)} stroke="#ffffff" strokeWidth={10 * inv} lineCap="round" />}
              <Line points={geometryEntityPoints(entity)} stroke={material.color} strokeWidth={8 * inv} lineCap="round" />
              <Line
                points={geometryEntityPoints(entity)}
                stroke={color}
                strokeWidth={3 * inv}
                dash={entity.windowType === 'bars' ? [4 * inv, 3 * inv] : undefined}
                lineCap="round"
                opacity={isDraft ? 0.68 : 0.96}
                hitStrokeWidth={18 * inv}
              />
              {ticks.map((tick, index) => (
                <Line
                  key={`${entity.id}:tick:${index}`}
                  points={[tick.x - nx, tick.y - ny, tick.x + nx, tick.y + ny]}
                  stroke={color}
                  strokeWidth={1.5 * inv}
                />
              ))}
              {selected && editMode && (tool === 'select' || tool === 'window') && !isDraft && (
                <GeometryEditHandles entity={entity} inv={inv} onPointsChange={onPointsChange} />
              )}
            </Group>
          )
        }
        if (entity.kind === 'obstacle' && entity.terrainRegion) {
          const outlinePoints = [...entity.points, entity.points[0]]
            .filter((point): point is MapGeometryPoint => !!point)
            .flatMap((point) => [point.x, point.y])
          if (isDraft) {
            return (
              <Line
                key={entity.id}
                points={geometryEntityPoints(entity)}
                closed
                stroke="#fbbf24"
                strokeWidth={3 * inv}
                dash={[6 * inv, 4 * inv]}
                lineJoin="round"
                opacity={0.95}
                listening={false}
              />
            )
          }
          return (
            <Group
              key={entity.id}
              listening={entityEditListening || (editMode && tool === 'elevation')}
              onMouseDown={selectEntity}
            >
              <Line
                points={outlinePoints}
                stroke={selected ? '#f8fafc' : 'rgba(0,0,0,0.001)'}
                strokeWidth={(selected ? 3 : 1) * inv}
                lineJoin="round"
                hitStrokeWidth={18 * inv}
              />
            </Group>
          )
        }
        const common = {
          points: geometryEntityPoints(entity),
          stroke: selected ? '#fff' : color,
          strokeWidth: (selected ? 5 : 3) * inv,
          opacity: isDraft ? 0.68 : 0.92,
          hitStrokeWidth: 14 * inv,
          listening: (entityEditListening || (editMode && tool === 'obstacle')) && !isDraft,
          onMouseDown: selectEntity,
        }
        return (
          <Line
            key={entity.id}
            {...common}
            closed
            fill={entity.kind === 'obstacle' && entity.magicalDarkness
              ? selected ? 'rgba(76,29,149,0.38)' : 'rgba(15,7,32,0.32)'
              : entity.kind === 'obstacle' && entity.terrainRegion
                ? selected ? 'rgba(251,191,36,0.22)' : 'rgba(251,191,36,0.1)'
                : selected ? 'rgba(251,146,60,0.28)' : 'rgba(251,146,60,0.16)'}
          />
        )
      })}
    </Layer>
  )
}

function isMapTokenNode(node: Konva.Node | null): boolean {
  let n: Konva.Node | null = node
  while (n) {
    if (n.name() === 'map-token') return true
    n = n.parent
  }
  return false
}

/** Grid line positions: offset + n * step, covering [0, length]. */
function gridLinePositions(length: number, offset: number, step: number): number[] {
  if (step <= 0) return []
  const positions: number[] = []
  const nMin = Math.ceil((0 - offset) / step)
  const nMax = Math.floor((length - offset) / step)
  for (let n = nMin; n <= nMax; n++) {
    const p = offset + n * step
    if (p >= 0 && p <= length) positions.push(p)
  }
  return positions
}

/** Token upper-right badges: anchored near 1-2 o'clock, flowing right, max 3 per row. */
const DOUBLE_ARROW_BADGE_RATIO = 0.4
const RIGHT_BADGE_MAX_COLS = 3
/** First badge center sits near the token upper-right border. */
const RIGHT_BADGE_ANCHOR_X_RATIO = 0.56
const RIGHT_BADGE_ANCHOR_Y_RATIO = -0.84

function tokenScale(radius: number): number {
  return Math.max(0.35, Math.min(1, radius / 24))
}

function tokenLineWidth(radius: number, px: number): number {
  return Math.max(0.5, px * tokenScale(radius))
}

function tokenDash(radius: number, dash: number[]): number[] {
  const scale = tokenScale(radius)
  return dash.map((value) => Math.max(1, value * scale))
}

function rightBadgeSize(radius: number): number {
  return Math.max(8, radius * 2 * DOUBLE_ARROW_BADGE_RATIO)
}

function rightBadgeGridPos(radius: number, size: number, gridIndex: number): { x: number; y: number } {
  const col = gridIndex % RIGHT_BADGE_MAX_COLS
  const row = Math.floor(gridIndex / RIGHT_BADGE_MAX_COLS)
  const gap = Math.max(1, size * 0.02)
  const anchorX = radius * RIGHT_BADGE_ANCHOR_X_RATIO
  const anchorY = radius * RIGHT_BADGE_ANCHOR_Y_RATIO
  return {
    x: anchorX + col * (size + gap),
    y: anchorY + row * (size + gap),
  }
}

function useTokenBadgeImage(asset: string | undefined): HTMLImageElement | undefined {
  const [loaded, setLoaded] = useState<{ asset: string; image?: HTMLImageElement } | undefined>(() => {
    if (!asset) return undefined
    return { asset, image: cachedBrowserImage(asset) }
  })

  useEffect(() => {
    if (!asset) return
    let disposed = false
    const cached = cachedBrowserImage(asset)
    if (cached) {
      queueMicrotask(() => {
        if (!disposed) setLoaded({ asset, image: cached })
      })
      return () => {
        disposed = true
      }
    }
    void preloadBrowserImage(asset).then((image) => {
      if (!disposed) setLoaded({ asset, image })
    })
    return () => {
      disposed = true
    }
  }, [asset])

  return loaded && loaded.asset === asset ? loaded.image : undefined
}

function AoeCellHighlights({
  map,
  cells,
  valid,
  variant = 'attack',
}: {
  map: BattleMap
  cells: GridCell[]
  valid: boolean
  variant?: 'attack' | 'range'
}) {
  const g = Math.max(1, map.gridSize)
  const fill =
    variant === 'range'
      ? valid
        ? 'rgba(59, 130, 246, 0.42)'
        : 'rgba(100, 116, 139, 0.28)'
      : valid
        ? 'rgba(245, 158, 11, 0.42)'
        : 'rgba(100, 116, 139, 0.28)'
  const stroke =
    variant === 'range'
      ? valid
        ? 'rgba(96, 165, 250, 0.75)'
        : 'rgba(148, 163, 184, 0.55)'
      : valid
        ? 'rgba(251, 191, 36, 0.9)'
        : 'rgba(148, 163, 184, 0.55)'
  return (
    <>
      {cells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        return (
          <Rect
            key={cellKey(cell)}
            x={x}
            y={y}
            width={g}
            height={g}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
            listening={false}
          />
        )
      })}
    </>
  )
}

function Dnd5eStandardConditionBadge({
  radius,
  gridIndex,
  condition,
  mark,
  overflowCount,
  onClick,
}: {
  radius: number
  gridIndex: number
  condition?: Dnd5eStandardConditionId
  mark?: StandardConditionTokenMark
  overflowCount?: number
  onClick?: () => void
}) {
  const size = rightBadgeSize(radius)
  const { x, y } = rightBadgeGridPos(radius, size, gridIndex)
  const style = condition ? DND5E_CONDITION_MARKERS[condition] : undefined
  const proneImage = useTokenBadgeImage(
    condition === 'prone' ? '/assets/icons/prone-condition-status.png' : undefined,
  )
  return (
    <Group
      x={x}
      y={y}
      listening={!!onClick}
      onClick={(event) => { event.cancelBubble = true; onClick?.() }}
      onTap={(event) => { event.cancelBubble = true; onClick?.() }}
    >
      <Circle
        radius={size / 2}
        fill={mark?.backgroundColor ?? style?.fill ?? '#312e81'}
        stroke={mark?.borderColor ?? style?.stroke ?? '#c4b5fd'}
        strokeWidth={tokenLineWidth(radius, 1.5)}
        shadowBlur={4 * tokenScale(radius)}
        shadowColor={mark?.glowColor ?? style?.stroke ?? '#a78bfa'}
        listening={!!onClick}
      />
      <Text
        text={overflowCount ? `+${overflowCount}` : style?.glyph ?? '•'}
        width={size}
        height={size}
        offsetX={size / 2}
        offsetY={size / 2}
        fontSize={Math.max(7, size * (overflowCount ? 0.34 : 0.52))}
        fontStyle="bold"
        opacity={condition === 'prone' && proneImage && !overflowCount ? 0 : 1}
        fill={style?.text ?? '#f5f3ff'}
        align="center"
        verticalAlign="middle"
        listening={!!onClick}
      />
      {proneImage && !overflowCount && (
        <KonvaImage
          image={proneImage}
          crop={{ x: 48, y: 165, width: 424, height: 208 }}
          x={-size * 0.5}
          y={-size * 0.36}
          width={size}
          height={size * 0.72}
          listening={!!onClick}
        />
      )}
    </Group>
  )
}

function ShillelaghTokenBadge({ radius, gridIndex }: { radius: number; gridIndex: number }) {
  const size = rightBadgeSize(radius)
  const { x, y } = rightBadgeGridPos(radius, size, gridIndex)
  const scale = tokenScale(radius)
  return (
    <Group x={x} y={y} listening={false}>
      <Circle
        radius={size / 2}
        fill="#173b2a"
        stroke="#86efac"
        strokeWidth={tokenLineWidth(radius, 1.5)}
        shadowBlur={5 * scale}
        shadowColor="#4ade80"
      />
      <Line
        points={[-size * 0.18, size * 0.28, size * 0.15, -size * 0.25]}
        stroke="#f5d0a5"
        strokeWidth={Math.max(1.5, size * 0.13)}
        lineCap="round"
      />
      <Line
        points={[size * 0.02, -size * 0.05, -size * 0.2, -size * 0.15, -size * 0.08, size * 0.02]}
        closed
        fill="#4ade80"
        stroke="#bbf7d0"
        strokeWidth={Math.max(0.7, size * 0.04)}
      />
    </Group>
  )
}

function SpellStatusTokenBadge(input: {
  radius: number
  gridIndex: number
  mark: SpellStatusTokenMark
}) {
  const size = rightBadgeSize(input.radius)
  const { x, y } = rightBadgeGridPos(input.radius, size, input.gridIndex)
  const scale = tokenScale(input.radius)
  const spec = MAP_SPELL_STATUS_ICONS[input.mark.statusId]
  const image = useTokenBadgeImage(spec.asset)
  const backdropAsset = useMemo(
    () => input.mark.classId
      ? dnd5eActionIconBackdropImage({
          classId: input.mark.classId,
          background: input.mark.backgroundHighlightColor,
          backgroundDeep: input.mark.backgroundColor,
          accent: input.mark.borderColor,
          glow: input.mark.glowColor,
        })
      : undefined,
    [
      input.mark.backgroundColor,
      input.mark.backgroundHighlightColor,
      input.mark.borderColor,
      input.mark.classId,
      input.mark.glowColor,
    ],
  )
  const backdropImage = useTokenBadgeImage(backdropAsset)

  return (
    <Group
      x={x}
      y={y}
      listening={false}
      name={`spell-status-token spell-status-${input.mark.statusId}`}
    >
      <Circle
        radius={size / 2}
        fillRadialGradientStartPoint={{ x: -size * 0.12, y: -size * 0.16 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndPoint={{ x: 0, y: 0 }}
        fillRadialGradientEndRadius={size * 0.55}
        fillRadialGradientColorStops={[
          0,
          input.mark.backgroundHighlightColor,
          0.48,
          input.mark.backgroundHighlightColor,
          1,
          input.mark.backgroundColor,
        ]}
        stroke={input.mark.borderColor}
        strokeWidth={tokenLineWidth(input.radius, 1.5)}
        shadowBlur={6 * scale}
        shadowColor={input.mark.glowColor}
      />
      {backdropImage ? (
        <Group
          clipFunc={(context) => {
            context.beginPath()
            context.arc(0, 0, size * 0.47, 0, Math.PI * 2)
            context.closePath()
          }}
          listening={false}
        >
          <KonvaImage
            image={backdropImage}
            x={-size * 0.5}
            y={-size * 0.5}
            width={size}
            height={size}
            listening={false}
          />
        </Group>
      ) : null}
      {image ? (
        <Group
          clipFunc={(context) => {
            context.beginPath()
            context.arc(0, 0, size * 0.46, 0, Math.PI * 2)
            context.closePath()
          }}
          listening={false}
        >
          <KonvaImage
            image={image}
            x={-size * 0.48}
            y={-size * 0.48}
            width={size * 0.96}
            height={size * 0.96}
            globalCompositeOperation="screen"
            opacity={0.94}
            listening={false}
          />
        </Group>
      ) : (
        <Text
          text={input.mark.statusId === 'guidance' ? '✦' : input.mark.statusId === 'resistance' ? '盾' : '◇'}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          fontSize={Math.max(8, size * 0.5)}
          fontStyle="bold"
          fill={input.mark.borderColor}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      )}
      <Circle
        radius={size / 2}
        stroke={input.mark.borderColor}
        opacity={0.58}
        strokeWidth={tokenLineWidth(input.radius, 0.7)}
        listening={false}
      />
    </Group>
  )
}

function MapGeometryDiagnosticsLayer({
  diagnostics,
  candidates = [],
  inv,
  onCandidateRemove,
}: {
  diagnostics?: MapGeometryDiagnostics | null
  candidates?: readonly WallDetectionCandidate[]
  inv: number
  onCandidateRemove?: (index: number) => void
}) {
  if (!diagnostics && candidates.length === 0) return null
  return (
    <Layer listening={!!onCandidateRemove}>
      {diagnostics?.rooms.flatMap((room, roomIndex) =>
        room.cells.map((cell, cellIndex) => (
          <Rect
            key={`diagnostic-room:${room.id}:${cellIndex}`}
            {...cell}
            fill={room.touchesMapBoundary
              ? 'rgba(14,165,233,0.06)'
              : room.sealed
                ? 'rgba(168,85,247,0.16)'
                : 'rgba(16,185,129,0.13)'}
            stroke={roomIndex % 2 === 0 ? 'rgba(196,181,253,0.18)' : 'rgba(103,232,249,0.18)'}
            strokeWidth={0.4 * inv}
          />
        )),
      )}
      {diagnostics?.rooms.filter((room) => !room.touchesMapBoundary).map((room) => (
        <Text
          key={`diagnostic-room-label:${room.id}`}
          x={room.center.x - 42 * inv}
          y={room.center.y - 8 * inv}
          width={84 * inv}
          align="center"
          text={`${room.id.replace('room:', 'R')} · ${room.sealed ? '密闭' : '连通'}`}
          fill={room.sealed ? '#e9d5ff' : '#a7f3d0'}
          fontSize={11 * inv}
          stroke="rgba(2,6,23,0.9)"
          strokeWidth={2 * inv}
        />
      ))}
      {diagnostics?.edges.map((edge) => (
        <Text
          key={`diagnostic-edge:${edge.wallEdgeId}`}
          x={edge.midpoint.x + 4 * inv}
          y={edge.midpoint.y + 4 * inv}
          text={edge.wallEdgeId.length > 20 ? `${edge.wallEdgeId.slice(0, 17)}…` : edge.wallEdgeId}
          fill="#fde68a"
          fontSize={9 * inv}
          stroke="rgba(2,6,23,0.95)"
          strokeWidth={2 * inv}
        />
      ))}
      {diagnostics?.portals.map((portal) => (
        <Group key={`diagnostic-portal:${portal.id}`}>
          <Circle
            x={portal.midpoint.x}
            y={portal.midpoint.y}
            radius={6 * inv}
            fill={portal.open ? '#34d399' : '#f97316'}
            stroke="#fff"
            strokeWidth={1.5 * inv}
          />
          <Text
            x={portal.midpoint.x + 8 * inv}
            y={portal.midpoint.y - 6 * inv}
            text={`${portal.fromRoomId ?? '外'} ↔ ${portal.toRoomId ?? '外'}`}
            fill="#fff"
            fontSize={9 * inv}
            stroke="rgba(2,6,23,0.95)"
            strokeWidth={2 * inv}
          />
        </Group>
      ))}
      {candidates.map((candidate, index) => (
        <Line
          key={`detected-wall-preview:${index}`}
          points={[candidate.a.x, candidate.a.y, candidate.b.x, candidate.b.y]}
          stroke="#22d3ee"
          strokeWidth={3 * inv}
          dash={[8 * inv, 5 * inv]}
          opacity={0.9}
          hitStrokeWidth={12 * inv}
          onClick={() => onCandidateRemove?.(index)}
          onTap={() => onCandidateRemove?.(index)}
        />
      ))}
    </Layer>
  )
}

function Dnd5eFlightBadge({
  radius,
  onClick,
}: {
  radius: number
  onClick?: () => void
}) {
  const size = rightBadgeSize(radius)
  const { x, y } = rightBadgeGridPos(radius, size, 0)
  return (
    <Group
      x={x}
      y={y}
      listening={!!onClick}
      onClick={(event) => { event.cancelBubble = true; onClick?.() }}
      onTap={(event) => { event.cancelBubble = true; onClick?.() }}
    >
      <Circle
        radius={size / 2}
        fill="#083344"
        stroke="#67e8f9"
        strokeWidth={tokenLineWidth(radius, 1.5)}
        shadowBlur={5 * tokenScale(radius)}
        shadowColor="#22d3ee"
        listening={!!onClick}
      />
      <Text
        text="飞"
        width={size}
        height={size}
        offsetX={size / 2}
        offsetY={size / 2}
        fontSize={Math.max(7, size * 0.48)}
        fontStyle="bold"
        fill="#ecfeff"
        align="center"
        verticalAlign="middle"
        listening={!!onClick}
      />
    </Group>
  )
}

function Dnd5eItemAreaOverlays({ map }: { map: BattleMap }) {
  const grid = Math.max(1, map.gridSize)
  const meta = {
    'ball-bearings': { icon: '●', fill: 'rgba(148, 163, 184, 0.24)', stroke: 'rgba(203, 213, 225, 0.72)' },
    caltrops: { icon: '▲', fill: 'rgba(245, 158, 11, 0.22)', stroke: 'rgba(251, 191, 36, 0.78)' },
    'hunting-trap': { icon: '⌁', fill: 'rgba(239, 68, 68, 0.22)', stroke: 'rgba(248, 113, 113, 0.82)' },
  } as const
  return (
    <>
      {(map.dnd5eItemAreas ?? []).flatMap((area) => {
        const style = meta[area.kind]
        return area.cells.map((cell, index) => {
          const { x, y } = cellTopLeft(cell, map)
          return (
            <Group key={`${area.id}:${cellKey(cell)}`} listening={false} opacity={area.armed ? 1 : 0.48}>
              <Rect
                x={x}
                y={y}
                width={grid}
                height={grid}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={2}
                dash={area.armed ? [7, 5] : [3, 6]}
              />
              {index === 0 && (
                <Text
                  x={x}
                  y={y + grid * 0.18}
                  width={grid}
                  text={style.icon}
                  align="center"
                  fontSize={Math.max(12, grid * 0.42)}
                  fill={style.stroke}
                  shadowBlur={4}
                  shadowColor="rgba(0,0,0,0.8)"
                />
              )}
            </Group>
          )
        })
      })}
    </>
  )
}

interface ToxicCloudPuff {
  x: number
  y: number
  radius: number
  phase: number
  speed: number
  drift: number
  color: string
}

function areaSeed(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function nextAreaRandom(seed: number) {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return [next, next / 4294967296] as const
}

function toxicCloudPuffs(area: Dnd5ePluginArea, map: BattleMap): ToxicCloudPuff[] {
  const grid = Math.max(1, map.gridSize)
  const intensity = area.visual?.intensity ?? 'normal'
  const multiplier = intensity === 'subtle' ? 1.4 : intensity === 'strong' ? 3.2 : 2.2
  const count = Math.min(84, Math.max(8, Math.ceil(area.cells.length * multiplier)))
  const colors = [area.color, '#84cc16', '#4d7c0f', '#bef264', '#365314']
  let seed = areaSeed(`${area.id}:${area.cells.map(cellKey).join('|')}`)
  return Array.from({ length: count }, (_, index) => {
    let random
    ;[seed, random] = nextAreaRandom(seed)
    const cell = area.cells[Math.floor(random * area.cells.length)]
    const topLeft = cellTopLeft(cell, map)
    ;[seed, random] = nextAreaRandom(seed)
    const x = topLeft.x + grid * (0.16 + random * 0.68)
    ;[seed, random] = nextAreaRandom(seed)
    const y = topLeft.y + grid * (0.18 + random * 0.64)
    ;[seed, random] = nextAreaRandom(seed)
    const radius = grid * (0.13 + random * 0.17)
    ;[seed, random] = nextAreaRandom(seed)
    const phase = random * Math.PI * 2
    ;[seed, random] = nextAreaRandom(seed)
    const speed = 0.42 + random * 0.48
    ;[seed, random] = nextAreaRandom(seed)
    const drift = grid * (0.025 + random * 0.065)
    return { x, y, radius, phase, speed, drift, color: colors[index % colors.length] }
  })
}

function Dnd5eToxicCloudAreaOverlay({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
  const grid = Math.max(1, map.gridSize)
  const groupRef = useRef<Konva.Group>(null)
  const boundaryRef = useRef<Konva.Group>(null)
  const puffRefs = useRef<Array<Konva.Circle | null>>([])
  const reducedMotion = usePrefersReducedMotion()
  const puffs = useMemo(() => toxicCloudPuffs(area, map), [area, map])
  const bounds = useMemo(() => {
    const points = area.cells.map((cell) => cellTopLeft(cell, map))
    const minX = Math.min(...points.map((point) => point.x))
    const minY = Math.min(...points.map((point) => point.y))
    const maxX = Math.max(...points.map((point) => point.x)) + grid
    return { minX, minY, maxX }
  }, [area.cells, grid, map])
  const opacityScale = area.visual?.intensity === 'subtle' ? 0.7 : area.visual?.intensity === 'strong' ? 1.18 : 1

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    (frame) => {
      const seconds = (frame?.time ?? 0) / 1000
      puffRefs.current.forEach((node, index) => {
        const puff = puffs[index]
        if (!node || !puff) return
        const wave = seconds * puff.speed + puff.phase
        node.x(puff.x + Math.sin(wave) * puff.drift)
        node.y(puff.y + Math.cos(wave * 0.73) * puff.drift * 0.62)
        node.scale({ x: 0.88 + Math.sin(wave * 1.19) * 0.12, y: 0.9 + Math.cos(wave) * 0.1 })
        node.opacity(Math.max(0.1, (0.2 + Math.sin(wave * 0.91) * 0.07) * opacityScale))
      })
      boundaryRef.current?.opacity(0.56 + Math.sin(seconds * 1.35) * 0.18)
      boundaryRef.current?.getChildren().forEach((node) => {
        if (node instanceof Konva.Rect) node.dashOffset(-seconds * 8)
      })
    },
    [area.id, puffs, opacityScale],
    { active: !reducedMotion, fps: 24 },
  )

  const labelWidth = Math.min(Math.max(grid * 1.6, area.label.length * Math.max(7, grid * 0.14) + 34), Math.max(grid * 1.6, bounds.maxX - bounds.minX))
  return (
    <Group ref={groupRef} listening={false}>
      {area.cells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        return <Rect key={`cloud-fill:${cellKey(cell)}`} x={x} y={y} width={grid} height={grid} fill={area.color} opacity={0.16 * opacityScale} listening={false} />
      })}
      {puffs.map((puff, index) => (
        <Circle
          key={`cloud-puff:${index}`}
          ref={(node) => { puffRefs.current[index] = node }}
          x={puff.x}
          y={puff.y}
          radius={puff.radius}
          fill={puff.color}
          opacity={0.2 * opacityScale}
          shadowColor="#1a2e05"
          shadowBlur={puff.radius * 0.7}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
      <Group ref={boundaryRef} listening={false}>
        {area.cells.map((cell) => {
          const { x, y } = cellTopLeft(cell, map)
          return <Rect key={`cloud-boundary:${cellKey(cell)}`} x={x} y={y} width={grid} height={grid} stroke="#bef264" strokeWidth={2.5} dash={[10, 6]} listening={false} />
        })}
      </Group>
      <Group x={bounds.minX + 6} y={Math.max(4, bounds.minY + 6)} listening={false}>
        <Rect width={labelWidth} height={Math.max(24, grid * 0.34)} fill="rgba(8,15,4,0.82)" stroke="rgba(190,242,100,0.7)" strokeWidth={1} cornerRadius={7} />
        <Text
          x={8}
          y={Math.max(5, grid * 0.08)}
          width={labelWidth - 16}
          text={`☁ ${area.label}`}
          fontSize={Math.max(11, Math.min(15, grid * 0.18))}
          fontStyle="bold"
          fill="#ecfccb"
          ellipsis
          wrap="none"
        />
      </Group>
    </Group>
  )
}

function Dnd5eStaticPluginAreaOverlay({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
  const grid = Math.max(1, map.gridSize)
  return <>{area.cells.map((cell, index) => {
    const { x, y } = cellTopLeft(cell, map)
    return (
      <Group key={`${area.id}:${cellKey(cell)}`} listening={false}>
        <Rect x={x} y={y} width={grid} height={grid} fill={area.color} opacity={0.18} stroke={area.color} strokeWidth={2} dash={[9, 5]} />
        {index === 0 && <Text x={x} y={y + grid * 0.18} width={grid} text="✦" align="center" fontSize={Math.max(12, grid * 0.4)} fill={area.color} shadowBlur={5} shadowColor="rgba(0,0,0,0.9)" />}
      </Group>
    )
  })}</>
}

const CORE_AREA_VISUALS: Readonly<Record<string, { icon: string; glow: string }>> = {
  grease: { icon: '≋', glow: '#fde68a' },
  daylight: { icon: '☀', glow: '#fef3c7' },
  darkness: { icon: '●', glow: '#8b5cf6' },
  moonbeam: { icon: '☾', glow: '#eff6ff' },
  'call-lightning': { icon: '⚡', glow: '#93c5fd' },
  'spirit-guardians': { icon: '✦', glow: '#fef3c7' },
  'spike-growth': { icon: '✣', glow: '#bef264' },
  'flaming-sphere': { icon: '🔥', glow: '#fdba74' },
  'spiritual-weapon': { icon: '⚔', glow: '#c4b5fd' },
  entangle: { icon: '🌿', glow: '#a3e635' },
  'black-tentacles': { icon: '⌁', glow: '#a78bfa' },
  'wall-of-fire': { icon: '🔥', glow: '#fb7185' },
}

function Dnd5eCoreSpellAreaOverlay({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
  const grid = Math.max(1, map.gridSize)
  const groupRef = useRef<Konva.Group>(null)
  const boundaryRef = useRef<Konva.Group>(null)
  const iconRef = useRef<Konva.Text>(null)
  const reducedMotion = usePrefersReducedMotion()
  const preset = area.visual?.preset ?? ''
  const visual = CORE_AREA_VISUALS[preset] ?? { icon: '✦', glow: area.color }
  const areaCellKeys = new Set(area.cells.map(cellKey))
  const triggerOnlyCells = [...new Map(
    (area.triggers ?? []).flatMap((trigger) => trigger.cells ?? [])
      .filter((cell) => !areaCellKeys.has(cellKey(cell)))
      .map((cell) => [cellKey(cell), cell]),
  ).values()]
  const firstCell = area.anchorCell ?? area.cells[0]
  const iconPoint = firstCell ? cellTopLeft(firstCell, map) : { x: 0, y: 0 }
  const intensity = area.visual?.intensity === 'strong' ? 1.18 : area.visual?.intensity === 'subtle' ? 0.72 : 1

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    (frame) => {
      const seconds = (frame?.time ?? 0) / 1000
      groupRef.current?.opacity((0.84 + Math.sin(seconds * 2.1) * 0.12) * intensity)
      boundaryRef.current?.getChildren().forEach((node) => {
        if (node instanceof Konva.Rect) node.dashOffset(-seconds * (preset === 'flaming-sphere' ? 18 : 10))
      })
      const iconScale = 1 + Math.sin(seconds * (preset === 'flaming-sphere' ? 4.4 : 2.4)) * 0.08
      iconRef.current?.scale({ x: iconScale, y: iconScale })
      if (preset === 'spirit-guardians') iconRef.current?.rotation(Math.sin(seconds * 1.4) * 8)
    },
    [area.id, intensity, preset],
    { active: !reducedMotion, fps: 24 },
  )

  return (
    <Group ref={groupRef} listening={false}>
      {triggerOnlyCells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        return (
          <Rect
            key={`core-trigger-fill:${area.id}:${cellKey(cell)}`}
            x={x}
            y={y}
            width={grid}
            height={grid}
            fill={area.color}
            opacity={0.09}
            stroke={visual.glow}
            strokeWidth={1}
            dash={[2, 5]}
            listening={false}
          />
        )
      })}
      {area.cells.map((cell) => {
        const { x, y } = cellTopLeft(cell, map)
        return (
          <Rect
            key={`core-fill:${area.id}:${cellKey(cell)}`}
            x={x}
            y={y}
            width={grid}
            height={grid}
            fill={area.color}
            opacity={
              preset === 'spike-growth' || preset === 'entangle' || preset === 'black-tentacles'
                ? 0.22
                : preset === 'wall-of-fire' ? 0.28 : 0.16
            }
            shadowColor={visual.glow}
            shadowBlur={preset === 'flaming-sphere' || preset === 'moonbeam' ? grid * 0.18 : grid * 0.08}
            listening={false}
          />
        )
      })}
      <Group ref={boundaryRef} listening={false}>
        {area.cells.map((cell) => {
          const { x, y } = cellTopLeft(cell, map)
          return (
            <Rect
              key={`core-boundary:${area.id}:${cellKey(cell)}`}
              x={x}
              y={y}
              width={grid}
              height={grid}
              stroke={visual.glow}
              strokeWidth={2.5}
              dash={
                preset === 'spike-growth' || preset === 'entangle' || preset === 'black-tentacles'
                  ? [4, 4]
                  : preset === 'wall-of-fire' ? [3, 2] : [10, 6]
              }
              listening={false}
            />
          )
        })}
      </Group>
      {firstCell && (
        <Text
          ref={iconRef}
          x={iconPoint.x}
          y={iconPoint.y + grid * 0.13}
          width={grid}
          height={grid}
          text={visual.icon}
          align="center"
          fontSize={Math.max(14, grid * 0.48)}
          fill={visual.glow}
          shadowColor={visual.glow}
          shadowBlur={8}
          offsetX={0}
          offsetY={0}
          listening={false}
        />
      )}
    </Group>
  )
}

function Dnd5ePluginAreaOverlays({
  map,
  isDM,
  onVisibilityToggle,
}: {
  map: BattleMap
  isDM: boolean
  onVisibilityToggle?: (areaId: string) => void
}) {
  return <>{(map.dnd5ePluginAreas ?? []).map((area) => {
    const preset = area.visual?.preset ?? ''
    const overlay = preset === 'toxic-cloud'
      ? <Dnd5eToxicCloudAreaOverlay area={area} map={map} />
      : CORE_AREA_VISUALS[preset]
        ? <Dnd5eCoreSpellAreaOverlay area={area} map={map} />
        : <Dnd5eStaticPluginAreaOverlay area={area} map={map} />
    const anchor = area.anchorCell ?? area.cells[0]
    const center = anchor ? tokenCenterForAnchorCell(anchor, { size: 1 } as Token, map) : undefined
    return <Group key={area.id}>
      {overlay}
      {isDM && area.coreSpellId === 'spike-growth' && center && onVisibilityToggle && <Group
        x={center.x}
        y={center.y}
        onClick={(event) => { event.cancelBubble = true; onVisibilityToggle(area.id) }}
        onTap={(event) => { event.cancelBubble = true; onVisibilityToggle(area.id) }}
      >
        <Rect x={-34} y={-13} width={68} height={26} cornerRadius={8} fill="rgba(2,6,23,0.88)" stroke={area.hiddenFromPlayers ? '#f59e0b' : '#22c55e'} strokeWidth={1.5} />
        <Text x={-31} y={-5} width={62} align="center" text={area.hiddenFromPlayers ? '仅 DM' : '已揭示'} fill="#f8fafc" fontSize={11} />
      </Group>}
    </Group>
  })}</>
}

function TerrainElevationContours({
  geometry,
  inv,
}: {
  geometry?: MapGeometryState
  inv: number
}) {
  const regions = (geometry?.obstacles ?? []).filter((obstacle) =>
    obstacle.terrainRegion === true || (obstacle.terrainElevationFeet ?? 0) !== 0,
  )
  return <Group listening={false}>{regions.map((region) => {
    const elevationFeet = region.terrainElevationFeet ?? 0
    const labelAnchor = region.points.reduce<{
      point: MapGeometryPoint
      lengthSquared: number
    }>((longest, point, index) => {
      const next = region.points[(index + 1) % region.points.length]
      const lengthSquared = (next.x - point.x) ** 2 + (next.y - point.y) ** 2
      return lengthSquared > longest.lengthSquared
        ? {
            point: { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 },
            lengthSquared,
          }
        : longest
    }, { point: region.points[0] ?? { x: 0, y: 0 }, lengthSquared: -1 }).point
    const color = elevationFeet < 0 ? '#38bdf8' : '#fbbf24'
    const label = `${elevationFeet > 0 ? '+' : ''}${elevationFeet} 尺`
    return (
      <Group key={`terrain-contour:${region.id}`}>
        <Line
          points={geometryEntityPoints(region)}
          closed
          stroke="rgba(2,6,23,0.92)"
          strokeWidth={5 * inv}
          lineJoin="round"
        />
        <Line
          points={geometryEntityPoints(region)}
          closed
          stroke={color}
          strokeWidth={2 * inv}
          lineJoin="round"
          opacity={0.95}
        />
        <Group x={labelAnchor.x} y={labelAnchor.y}>
          <Rect
            x={-25 * inv}
            y={-9 * inv}
            width={50 * inv}
            height={18 * inv}
            cornerRadius={6 * inv}
            fill="rgba(2,6,23,0.82)"
            stroke={color}
            strokeWidth={inv}
          />
          <Text
            x={-25 * inv}
            y={-5.5 * inv}
            width={50 * inv}
            text={label}
            align="center"
            fontSize={10 * inv}
            fontStyle="bold"
            fill="#f8fafc"
          />
        </Group>
      </Group>
    )
  })}</Group>
}

export default function MapCanvas({
  map,
  combatActive = false,
  selectedTokenId,
  onSelectToken,
  targetSelectTokenIds = [],
  measureMode = false,
  hpByToken,
  moveSelectMode = false,
  moveCircle,
  onMoveSelect,
  moveTraversalMode = 'walk',
  moveTargetElevationFeet,
  difficultTerrainMultiplierAtPosition,
  speedCostMultiplierAtPosition,
  aoeSelectMode = false,
  aoeHighlight,
  rangedRangeCells = [],
  onAoePreviewCell,
  onAoeConfirm,
  onAoeCancel,
  dnd5eConditionsByToken = {},
  standardConditionTokenMarks = [],
  onDnd5eConditionClick,
  onDnd5ePluginAreaVisibilityToggle,
  tokenHoverLabels = {},
  projectiles = [],
  attackTargetEffects = [],
  chillTouchTokenIds = [],
  sanctuaryTokenIds = [],
  spellStatusTokenMarks = [],
  shillelaghTokenIds = [],
  defeatedTokenIds = [],
  savingThrowTokenId,
  savingThrowAbility,
  currentTurnTokenId,
  lockDragTokenIds = [],
  authoritativeMovementTokenIds = [],
  builtinGrid = false,
  gridAdjustMode = false,
  onGridOffsetChange,
  gridSizePreview = false,
  onGridSizeChange,
  onBlankContextMenu,
  deleteSelectMode = false,
  onDeleteBoxConfirm,
  onDeleteCancel,
  sceneTriggerZones = [],
  sceneInteractionPoints = [],
  onSceneInteractionPointClick,
  sceneEditMode = false,
  sceneRegionKind = 'circle',
  onSceneRegionCommit,
  onSceneEditCancel,
  scenePointPlacementMode = false,
  onScenePointPlacementCommit,
  fog,
  fogEditMode = false,
  fogTool = 'reveal-rect',
  fogPreviewAsPlayer = false,
  onFogShapeCommit,
  onFogEditCancel,
  geometry,
  geometryEditMode = false,
  geometryTool = 'select',
  geometryWallMaterial = 'stone',
  selectedGeometryEntityId = null,
  geometryPreviewAsPlayer = false,
  geometrySnapToGrid = true,
  geometryTerrainEditingLocked = false,
  geometryDiagnostics = null,
  geometryDetectionCandidates = [],
  onGeometryDetectionCandidateRemove,
  visionSourceTokenIds = [],
  exploredVisionPolygons = [],
  onGeometryEntityCommit,
  onGeometryEntitySelect,
  onGeometryEntityDelete,
  onGeometryEntityPointsChange,
  onGeometryDoorInteract,
  geometrySearchMode = false,
  onGeometrySearch,
  onGeometryEditCancel,
  onTokenMoveBlocked,
  onTokenMoveRequest,
  onTokenMoveCommit,
  optimisticTokenMoveIds = [],
  playerMovableTokenIds = [],
  tabletopTool = 'none',
  tabletopPings = [],
  tabletopAnnotations = [],
  tabletopFocus = null,
  pingEnabled = false,
  onMapPing,
  onTabletopPoint,
  onTabletopAnnotation,
  isDM = false,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const gridDragRef = useRef<{
    startX: number
    startY: number
    origOx: number
    origOy: number
  } | null>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [loadedMapImage, setLoadedMapImage] = useState<{
    mapId: string
    state: 'loaded' | 'missing' | 'error'
    image?: HTMLImageElement
  } | null>(null)
  const image = loadedMapImage?.mapId === map.id ? loadedMapImage.image : undefined
  const imageLoadState = loadedMapImage?.mapId === map.id ? loadedMapImage.state : 'loading'
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null)
  const suppressTokenSelectUntilRef = useRef(0)
  const [tokenDragVisualState, setTokenDragVisualState] = useState<{
    previews: Record<string, Point>
    suppressedMovementAnimationIds: Record<string, string>
  }>({
    previews: {},
    suppressedMovementAnimationIds: {},
  })
  const dragPreviewPositions = tokenDragVisualState.previews
  const tokenVisualNodesRef = useRef(new Map<string, Set<TokenVisualNodeLike>>())
  const activeDraggingTokenIdsRef = useRef(new Set<string>())
  const [directMovePreviewTracker] = useState(createLatestTokenMovePreviewTracker)
  const [deleteDrag, setDeleteDrag] = useState<{ start: Point; current: Point } | null>(null)
  const sceneDragStartRef = useRef<Point | null>(null)
  const [sceneDraft, setSceneDraft] = useState<SceneRegion | null>(null)
  const fogDragStartRef = useRef<Point | null>(null)
  const [fogDraft, setFogDraft] = useState<FogShape | null>(null)
  const [fogPolygonPoints, setFogPolygonPoints] = useState<number[]>([])
  const geometryDragStartRef = useRef<{
    point: Point
    points: Point[]
    id: string
    createdAt: number
    gridCells?: Map<string, MapGeometryGridCell>
    lastGridCell?: MapGeometryGridCell
  } | null>(null)
  const [geometryDraft, setGeometryDraft] = useState<MapGeometryEntity | null>(null)
  const [geometryDragActive, setGeometryDragActive] = useState(false)
  const geometryViewportPanStartRef = useRef<{
    clientX: number
    clientY: number
    viewX: number
    viewY: number
  } | null>(null)
  const [geometryViewportPanActive, setGeometryViewportPanActive] = useState(false)
  const tabletopDragStartRef = useRef<MapTabletopPoint | null>(null)
  const [tabletopDraft, setTabletopDraft] = useState<{
    shape: 'arrow' | 'circle'
    from: MapTabletopPoint
    to: MapTabletopPoint
  } | null>(null)
  const [tabletopNow, setTabletopNow] = useState(() => Date.now())
  const appliedFocusIdRef = useRef<string | null>(null)
  const fittedRef = useRef(false)

  useEffect(() => {
    // Thunderwave lasts only about one second. Warm this single lightweight
    // texture on every map client so a cold player cache cannot spend the
    // whole presentation window downloading and decoding it.
    void preloadBrowserImage('/assets/vfx/thunderwave-fluid.webp')
  }, [])

  // Measurement state in image coordinates: fixed segments plus pending/cursor points.
  const [segments, setSegments] = useState<{ a: Point; b: Point }[]>([])
  const [pending, setPending] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)

  const worldMinute = useCampaignTimeStore((state) => state.state.worldMinute)

  useEffect(() => {
    if (!tabletopPings.some((ping) => ping.expiresAt > Date.now())) return
    let frame = 0
    let lastFrame = 0
    const tick = (time: number) => {
      if (time - lastFrame >= 1000 / 30) {
        lastFrame = time
        setTabletopNow(Date.now())
      }
      if (tabletopPings.some((ping) => ping.expiresAt > Date.now())) {
        frame = window.requestAnimationFrame(tick)
      }
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [tabletopPings])

  const registerTokenVisualNode = useCallback((
    tokenId: string,
    node: Konva.Group | null,
    cancelPositionAnimation: () => void,
    setPositionLocked: (locked: boolean) => void,
  ) => {
    if (!node) return
    const visualNode: TokenVisualNodeLike = {
      cancelPositionAnimation,
      setPositionLocked,
      position: (point) => node.position(point),
      getLayer: () => node.getLayer(),
    }
    const nodes = tokenVisualNodesRef.current.get(tokenId) ?? new Set<TokenVisualNodeLike>()
    nodes.add(visualNode)
    tokenVisualNodesRef.current.set(tokenId, nodes)
    return () => {
      const current = tokenVisualNodesRef.current.get(tokenId)
      current?.delete(visualNode)
      if (current?.size === 0) tokenVisualNodesRef.current.delete(tokenId)
    }
  }, [])

  const syncTokenVisualPosition = useCallback((tokenId: string, x: number, y: number) => {
    const nodes = tokenVisualNodesRef.current.get(tokenId)
    if (!nodes?.size) return
    syncTokenVisualNodes(nodes, { x, y })
  }, [])

  const setTokenVisualPositionLocked = useCallback((tokenId: string, locked: boolean) => {
    const nodes = tokenVisualNodesRef.current.get(tokenId)
    if (!nodes?.size) return
    setTokenVisualNodesPositionLocked(nodes, locked)
  }, [])

  const displayToken = (token: Token): Token => {
    const preview = dragPreviewPositions[token.id]
    const suppressMovementAnimation = !!token.movementAnimation && (
      !!preview ||
      tokenDragVisualState.suppressedMovementAnimationIds[token.id] === token.movementAnimation.id
    )
    if (preview || suppressMovementAnimation) {
      return {
        ...token,
        ...(preview ? { x: preview.x, y: preview.y } : {}),
        movementAnimation: undefined,
      }
    }
    return token
  }

  const canDragToken = (token: Token): boolean =>
    canDragMapToken({
      isDm: isDM,
      // Enemy movement during combat is handled by click-to-move, never by
      // Konva placement drag (including the manually controlled monster).
      combatActive,
      token,
      playerMovableTokenIds,
      measureMode,
      deleteSelectMode,
      gridAdjustMode,
      fogEditMode,
      geometryEditMode,
      lockDragTokenIds,
    })

  const previewTokenDrag = (token: Token, x: number, y: number) => {
    syncTokenVisualPosition(token.id, x, y)
    setTokenDragVisualState((current) => ({
      ...current,
      previews: {
        ...current.previews,
        [token.id]: { x, y },
      },
    }))
  }

  const beginTokenDrag = (token: Token, x: number, y: number) => {
    activeDraggingTokenIdsRef.current.add(token.id)
    setTokenVisualPositionLocked(token.id, true)
    previewTokenDrag(token, x, y)
  }

  const previewTokenDragFrame = (token: Token, x: number, y: number) => {
    // Keep body, name and vitals in one imperative frame without re-rendering
    // the entire map for every pointer event.
    syncTokenVisualPosition(token.id, x, y)
  }

  const releaseTokenDragPreview = (tokenId: string) => {
    setTokenVisualPositionLocked(tokenId, false)
    setTokenDragVisualState((current) => {
      if (!current.previews[tokenId]) return current
      const previews = { ...current.previews }
      delete previews[tokenId]
      return { ...current, previews }
    })
  }

  const rollbackTokenDragPreview = (tokenId: string) => {
    const authoritative = map.tokens.find((token) => token.id === tokenId)
    if (authoritative) {
      syncTokenVisualPosition(tokenId, authoritative.x, authoritative.y)
    }
    releaseTokenDragPreview(tokenId)
  }

  const cancelTokenDrag = (tokenId: string) => {
    activeDraggingTokenIdsRef.current.delete(tokenId)
    rollbackTokenDragPreview(tokenId)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTokenDragVisualState((current) => {
        let previewsChanged = false
        let suppressionsChanged = false
        const previews = { ...current.previews }
        const suppressedMovementAnimationIds = {
          ...current.suppressedMovementAnimationIds,
        }
        for (const [tokenId, animationId] of Object.entries(suppressedMovementAnimationIds)) {
          const animation = map.tokens.find((token) => token.id === tokenId)?.movementAnimation
          if (animation?.id !== animationId) {
            delete suppressedMovementAnimationIds[tokenId]
            suppressionsChanged = true
          }
        }
        for (const [tokenId, preview] of Object.entries(current.previews)) {
          const authoritative = map.tokens.find((token) => token.id === tokenId)
          const resolution = resolveOptimisticTokenMovePreview({
            // Parent renders and map invalidations can arrive while the pointer
            // is still down. They must not release the preview before submit.
            dragActive: activeDraggingTokenIdsRef.current.has(tokenId),
            requestPending:
              optimisticTokenMoveIds.includes(tokenId) ||
              directMovePreviewTracker.isPending(tokenId),
            authoritative,
            preview,
          })
          if (resolution.release) {
            if (resolution.suppressMovementAnimationId) {
              if (
                suppressedMovementAnimationIds[tokenId] !==
                resolution.suppressMovementAnimationId
              ) {
                suppressedMovementAnimationIds[tokenId] = resolution.suppressMovementAnimationId
                suppressionsChanged = true
              }
            }
            delete previews[tokenId]
            previewsChanged = true
          }
        }
        if (!previewsChanged && !suppressionsChanged) return current
        return { previews, suppressedMovementAnimationIds }
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [directMovePreviewTracker, map.tokens, optimisticTokenMoveIds])

  const monitorDirectTokenMove = (
    tokenId: string,
    generation: number,
    completion: Promise<void>,
  ) => {
    void completion.then(
      () => {
        if (directMovePreviewTracker.complete(tokenId, generation)) {
          releaseTokenDragPreview(tokenId)
        }
      },
      (error) => {
        if (directMovePreviewTracker.complete(tokenId, generation)) {
          // A rejected authoritative transaction owns no final position. Snap
          // every visual layer back immediately and release its drag lock.
          rollbackTokenDragPreview(tokenId)
        }
        console.error('[map-token-move] direct commit failed', error)
      },
    )
  }

  const commitTokenDrag = (token: Token, x: number, y: number) => {
    activeDraggingTokenIdsRef.current.delete(token.id)
    const plan = planMapTokenDrop({
      token,
      map,
      geometry,
      x,
      y,
      validateMovementLocally: shouldValidateMapTokenMoveLocally({
        isDm: isDM,
        token,
        authoritativeMovementTokenIds,
      }),
    })
    if (plan.status === 'blocked') {
      rollbackTokenDragPreview(token.id)
      onTokenMoveBlocked?.(plan.entityId)
      return
    }
    const { position, elevationFeet } = plan
    let requestResult: ReturnType<NonNullable<MapCanvasProps['onTokenMoveRequest']>> | undefined
    try {
      requestResult = onTokenMoveRequest?.(token, position, elevationFeet)
    } catch (error) {
      rollbackTokenDragPreview(token.id)
      console.error('[map-token-move] authoritative request failed', error)
      return
    }
    if (requestResult) {
      if (requestResult === 'pending') {
        previewTokenDrag(token, position.x, position.y)
      } else if (requestResult instanceof Promise) {
        const generation = directMovePreviewTracker.begin(token.id)
        previewTokenDrag(token, position.x, position.y)
        monitorDirectTokenMove(token.id, generation, requestResult)
      } else {
        rollbackTokenDragPreview(token.id)
      }
      return
    }
    const generation = directMovePreviewTracker.begin(token.id)
    previewTokenDrag(token, position.x, position.y)
    let completion: void | Promise<void>
    try {
      completion = onTokenMoveCommit?.(token, position, elevationFeet)
    } catch (error) {
      if (directMovePreviewTracker.complete(token.id, generation)) {
        rollbackTokenDragPreview(token.id)
      }
      console.error('[map-token-move] direct commit failed', error)
      return
    }
    if (!completion) {
      window.requestAnimationFrame(() => {
        if (directMovePreviewTracker.complete(token.id, generation)) {
          releaseTokenDragPreview(token.id)
        }
      })
      return
    }
    monitorDirectTokenMove(token.id, generation, completion)
  }

  // Clear measurement lines when leaving measurement mode.
  useEffect(() => {
    if (measureMode) return
    const timer = window.setTimeout(() => {
      setSegments([])
      setPending(null)
      setCursor(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [measureMode])

  useEffect(() => {
    if (deleteSelectMode) return
    const timer = window.setTimeout(() => setDeleteDrag(null), 0)
    return () => window.clearTimeout(timer)
  }, [deleteSelectMode])

  useEffect(() => {
    if (fogEditMode) return
    const timer = window.setTimeout(() => {
      fogDragStartRef.current = null
      setFogDraft(null)
      setFogPolygonPoints([])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fogEditMode])

  // 网格对齐：方向键微调
  useEffect(() => {
    if (!gridAdjustMode || !onGridOffsetChange) return
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1
      let ox = map.gridOffsetX
      let oy = map.gridOffsetY
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        ox -= step
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        ox += step
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        oy -= step
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        oy += step
      } else if (e.key === 'Escape') {
        return
      } else {
        return
      }
      onGridOffsetChange(ox, oy)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gridAdjustMode, map.gridOffsetX, map.gridOffsetY, onGridOffsetChange])

  // Grid alignment: drag offset with global mouse-up listener.
  useEffect(() => {
    if (!gridAdjustMode) {
      gridDragRef.current = null
      return
    }
    const endDrag = () => {
      gridDragRef.current = null
    }
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('touchend', endDrag)
    return () => {
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('touchend', endDrag)
    }
  }, [gridAdjustMode])

  // 键盘：Backspace 删除（优先取消正在放置的，否则删最后一段）
  useEffect(() => {
    if (!measureMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        if (pending) {
          setPending(null)
          setCursor(null)
        } else {
          setSegments((segs) => segs.slice(0, -1))
        }
      } else if (e.key === 'Escape') {
        setPending(null)
        setCursor(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [measureMode, pending])

  const relativePoint = (stage: Konva.Stage | null): Point | null => {
    if (!stage) return null
    const p = stage.getRelativePointerPosition()
    return p ? { x: p.x, y: p.y } : null
  }

  const gridPoint = (p: Point): GridCell => mapCanvasAoeGridCell(p, map)

  const newFogShapeBase = () => ({
    id: `fog:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
    operation: fogOperationForTool(fogTool),
    createdAt: Date.now(),
  })

  const commitFogPolygon = useCallback(() => {
    if (fogPolygonPoints.length < 6) return
    onFogShapeCommit?.({
      id: `fog:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
      operation: fogOperationForTool(fogTool),
      createdAt: Date.now(),
      kind: 'polygon',
      points: [...fogPolygonPoints],
    })
    setFogPolygonPoints([])
  }, [fogPolygonPoints, fogTool, onFogShapeCommit])

  const handleFogMouseDown = (stage: Konva.Stage | null): boolean => {
    if (!fogEditMode) return false
    const point = relativePoint(stage)
    if (!point) return true
    const kind = fogShapeKindForTool(fogTool)
    if (kind === 'polygon') {
      if (
        fogPolygonPoints.length >= 6 &&
        Math.hypot(point.x - fogPolygonPoints[0], point.y - fogPolygonPoints[1]) <= 12 / Math.max(view.scale, 0.01)
      ) {
        commitFogPolygon()
      } else {
        setFogPolygonPoints((points) => [...points, point.x, point.y])
      }
      return true
    }
    fogDragStartRef.current = point
    if (kind === 'brush') {
      setFogDraft({
        ...newFogShapeBase(), kind: 'brush', points: [point.x, point.y, point.x, point.y],
        width: Math.max(10, map.gridSize * 1.25),
      })
    }
    return true
  }
  const movePreviewPath = useMemo(() => {
    if (!moveSelectMode || !moveCircle || !cursor) return undefined
    const movingToken = map.tokens.find((token) => token.id === selectedTokenId) ??
      map.tokens.find((token) => Math.hypot(token.x - moveCircle.centerX, token.y - moveCircle.centerY) < 1)
    if (!movingToken) return undefined
    return findMapGeometryPath({
      map, geometry, token: movingToken, to: cursor, maximumVisited: 5_000,
      canClimb: moveTraversalMode === 'climb' || moveTraversalMode === 'fly',
      canSwim: moveTraversalMode === 'swim',
      canFly: moveTraversalMode === 'fly',
      targetElevationFeet: moveTraversalMode === 'fly'
        ? moveTargetElevationFeet ?? mapGeometryTokenElevation(geometry, movingToken)
        : undefined,
      maximumTerrainStepFeet: moveTraversalMode === 'fall' ? 10_000 : 10,
      additionalDifficultTerrainMultiplier: difficultTerrainMultiplierAtPosition,
      additionalSpeedCostMultiplier: speedCostMultiplierAtPosition,
    })
  }, [cursor, difficultTerrainMultiplierAtPosition, geometry, map, moveCircle, moveSelectMode, moveTargetElevationFeet, moveTraversalMode, selectedTokenId, speedCostMultiplierAtPosition])

  const handleFogMouseMove = (stage: Konva.Stage | null): boolean => {
    if (!fogEditMode || !fogDragStartRef.current) return false
    const point = relativePoint(stage)
    if (!point) return true
    const start = fogDragStartRef.current
    const kind = fogShapeKindForTool(fogTool)
    if (kind === 'rect') {
      const rect = rectFromPoints(start, point)
      setFogDraft({ ...newFogShapeBase(), kind: 'rect', ...rect })
    } else if (kind === 'circle') {
      setFogDraft({
        ...newFogShapeBase(), kind: 'circle', x: start.x, y: start.y,
        radius: Math.max(1, Math.hypot(point.x - start.x, point.y - start.y)),
      })
    } else if (kind === 'brush') {
      setFogDraft((draft) => draft?.kind === 'brush'
        ? {
            ...draft,
            points: draft.points.length < 16_384
              ? [...draft.points, point.x, point.y]
              : draft.points,
          }
        : draft)
    }
    return true
  }

  const handleFogMouseUp = (): boolean => {
    if (!fogEditMode || !fogDragStartRef.current) return false
    fogDragStartRef.current = null
    const draft = fogDraft
    setFogDraft(null)
    if (!draft) return true
    const valid = draft.kind === 'rect'
      ? draft.width >= 4 && draft.height >= 4
      : draft.kind === 'circle'
        ? draft.radius >= 4
        : draft.kind === 'brush'
          ? draft.points.length >= 4
          : false
    if (valid) onFogShapeCommit?.(draft)
    return true
  }

  useEffect(() => {
    if (!fogEditMode) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        fogDragStartRef.current = null
        setFogDraft(null)
        setFogPolygonPoints([])
        onFogEditCancel?.()
      } else if (event.key === 'Enter' && fogPolygonPoints.length >= 6) {
        event.preventDefault()
        commitFogPolygon()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commitFogPolygon, fogEditMode, fogPolygonPoints, onFogEditCancel])

  useEffect(() => {
    if (geometryEditMode) return
    geometryDragStartRef.current = null
    geometryViewportPanStartRef.current = null
    const timer = window.setTimeout(() => {
      setGeometryDraft(null)
      setGeometryDragActive(false)
      setGeometryViewportPanActive(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [geometryEditMode])

  const geometryEntityFromDrag = (start: Point, current: Point): MapGeometryEntity | null => {
    const drag = geometryDragStartRef.current
    if (!drag || geometryTool === 'select' || geometryTool === 'delete') return null
    const common = {
      id: drag.id,
      label: geometryTool === 'wall' ? '墙' : geometryTool === 'door' ? '门' : geometryTool === 'window' ? '窗户' : geometryTool === 'light' ? '场景光源' : geometryTool === 'elevation' ? '高地区域' : '区域地形',
      createdAt: drag.createdAt,
      baseHeightFeet: 0,
      heightFeet: geometryTool === 'elevation' ? 0 : geometryTool === 'obstacle' ? 5 : 10,
      blocksVision: geometryTool !== 'obstacle' && geometryTool !== 'elevation',
      blocksMovement: geometryTool !== 'elevation',
      blocksLineOfEffect: geometryTool !== 'obstacle' && geometryTool !== 'elevation',
    }
    if (geometryTool === 'wall') return { ...common, kind: 'wall', material: geometryWallMaterial, points: [start, current] }
    if (geometryTool === 'door' || geometryTool === 'window') {
      const attachment = mapGeometryAttachOpeningToWall(
        geometry,
        start,
        current,
        Math.max(10, map.gridSize * 0.4),
      )
      if (!attachment) return null
      const parentWall = geometry?.walls.find((wall) => wall.id === attachment.parentWallId)
      const embeddedCommon = {
        ...common,
        baseHeightFeet: parentWall?.baseHeightFeet ?? common.baseHeightFeet,
        heightFeet: parentWall?.heightFeet ?? common.heightFeet,
        parentWallId: attachment.parentWallId,
        parentWallSegmentIndex: attachment.parentWallSegmentIndex,
        points: attachment.points,
      }
      if (geometryTool === 'door') {
        const door = {
          ...embeddedCommon,
          kind: 'door',
          state: 'closed',
          openState: 'closed',
          lockState: 'unlocked',
          physicalState: 'intact',
          secret: false,
          hinge: 'start',
          swing: 'clockwise',
        } as const
        return mapGeometryOpeningOverlaps(geometry, door) ? null : door
      }
      const window = {
        ...embeddedCommon,
        kind: 'window',
        windowType: 'glass',
        windowState: 'closed',
        cover: 'total',
        blocksVision: false,
        blocksMovement: true,
        blocksLineOfEffect: true,
      } as const
      return mapGeometryOpeningOverlaps(geometry, window) ? null : window
    }
    if (geometryTool === 'light') {
      const radiusFeet = mapLightingRadiusFromDrag({
        distancePixels: Math.hypot(current.x - start.x, current.y - start.y),
        gridSize: map.gridSize,
        feetPerCell: map.feetPerCell ?? 5,
      })
      return {
        id: drag.id, kind: 'light', label: '场景光源', points: [start], enabled: true,
        brightRadiusFeet: radiusFeet, dimRadiusFeet: radiusFeet,
        color: '#fbbf24',
        elevationFeet: mapGeometryTerrainElevationAtPoint(geometry, start) + 5,
        createdAt: drag.createdAt,
      }
    }
    if (geometryTool === 'elevation') {
      return {
        ...common,
        kind: 'obstacle',
        cover: 'none',
        terrainElevationFeet: 10,
        terrainRegion: true,
        points: drag.points,
      }
    }
    const rect = rectFromPoints(start, current)
    return {
      ...common,
      kind: 'obstacle',
      cover: 'half',
      terrainElevationFeet: 0,
      points: [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height },
      ],
    }
  }

  const snapGeometryPoint = (point: Point): Point => {
    if (!geometrySnapToGrid) return point
    const gridSize = Math.max(1, map.gridSize)
    const offsetX = map.gridOffsetX ?? 0
    const offsetY = map.gridOffsetY ?? 0
    return {
      x: offsetX + Math.round((point.x - offsetX) / gridSize) * gridSize,
      y: offsetY + Math.round((point.y - offsetY) / gridSize) * gridSize,
    }
  }

  const geometryGridCellAtPoint = (point: Point): MapGeometryGridCell | null => {
    if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) return null
    const gridSize = Math.max(1, map.gridSize)
    return {
      col: Math.floor((point.x - (map.gridOffsetX ?? 0)) / gridSize),
      row: Math.floor((point.y - (map.gridOffsetY ?? 0)) / gridSize),
    }
  }

  const addGeometryGridPath = (
    cells: Map<string, MapGeometryGridCell>,
    from: MapGeometryGridCell,
    to: MapGeometryGridCell,
  ) => {
    let current = { ...from }
    const add = (cell: MapGeometryGridCell) => {
      if (cells.size >= 4_096) return
      cells.set(`${cell.col},${cell.row}`, { ...cell })
    }
    add(current)
    while (current.col !== to.col || current.row !== to.row) {
      if (current.col !== to.col) {
        current = { ...current, col: current.col + Math.sign(to.col - current.col) }
        add(current)
      }
      if (current.row !== to.row) {
        current = { ...current, row: current.row + Math.sign(to.row - current.row) }
        add(current)
      }
    }
  }

  const geometryGridBoundary = (cells: Map<string, MapGeometryGridCell>) =>
    mapGeometryGridSelectionBoundary(
      [...cells.values()],
      map.gridSize,
      map.gridOffsetX ?? 0,
      map.gridOffsetY ?? 0,
    )

  const handleGeometryMouseDown = (stage: Konva.Stage | null): boolean => {
    if (!geometryEditMode) return false
    if (geometryTool === 'select' || geometryTool === 'delete') {
      if (geometryTool === 'select') onGeometryEntitySelect?.(null)
      return true
    }
    const rawPoint = relativePoint(stage)
    if (geometryTool === 'elevation' && geometryTerrainEditingLocked) return true
    const point = rawPoint
      ? geometryTool === 'door' || geometryTool === 'window' || geometryTool === 'elevation' ? rawPoint : snapGeometryPoint(rawPoint)
      : null
    if (!point) return true
    const openingAttachedToWall = geometryTool === 'door' || geometryTool === 'window'
      ? !!mapGeometryAttachOpeningToWall(
          geometry,
          point,
          point,
          Math.max(10, map.gridSize * 0.4),
        )
      : false
    if (!mapCanvasGeometryDrawShouldStart(geometryTool, openingAttachedToWall)) {
      return false
    }
    // 门窗工具允许从空白地图平移；只有贴近墙段起笔时才同步关闭 Stage 拖拽并开始绘制。
    // 这里使用 Konva 的命令式开关，确保同一次 pointerdown 不会先启动视口拖拽。
    stage?.stopDrag()
    stage?.draggable(false)
    setGeometryDragActive(true)
    const elevationCell = geometryTool === 'elevation' ? geometryGridCellAtPoint(point) : null
    if (geometryTool === 'elevation' && !elevationCell) {
      setGeometryDragActive(false)
      return true
    }
    const gridCells = elevationCell
      ? new Map([[`${elevationCell.col},${elevationCell.row}`, elevationCell]])
      : undefined
    geometryDragStartRef.current = {
      point,
      points: gridCells ? geometryGridBoundary(gridCells) : [point],
      id: `geometry:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      gridCells,
      lastGridCell: elevationCell ?? undefined,
    }
    setGeometryDraft(geometryEntityFromDrag(point, point))
    return true
  }

  const handleGeometryMouseMove = (stage: Konva.Stage | null): boolean => {
    const drag = geometryDragStartRef.current
    if (!geometryEditMode || !drag) return false
    const rawPoint = relativePoint(stage)
    const point = rawPoint
      ? geometryTool === 'door' || geometryTool === 'window' || geometryTool === 'elevation' ? rawPoint : snapGeometryPoint(rawPoint)
      : null
    if (point && geometryTool === 'elevation') {
      const cell = geometryGridCellAtPoint(point)
      if (cell && drag.gridCells && drag.lastGridCell) {
        addGeometryGridPath(drag.gridCells, drag.lastGridCell, cell)
        drag.lastGridCell = cell
        drag.points = geometryGridBoundary(drag.gridCells)
      }
      setGeometryDraft(geometryEntityFromDrag(drag.point, point))
    } else if (point) {
      setGeometryDraft(geometryEntityFromDrag(drag.point, point))
    }
    return true
  }

  const handleGeometryMouseUp = (stage: Konva.Stage | null): boolean => {
    const drag = geometryDragStartRef.current
    if (!geometryEditMode || !drag) return false
    const draft = geometryDraft ?? geometryEntityFromDrag(drag.point, drag.point)
    geometryDragStartRef.current = null
    setGeometryDragActive(false)
    if (geometryTool === 'door' || geometryTool === 'window') stage?.draggable(true)
    setGeometryDraft(null)
    if (!draft) return true
    const terrainRegionArea = draft.kind === 'obstacle' && draft.terrainRegion
      ? Math.abs(draft.points.reduce((area, point, index) => {
          const next = draft.points[(index + 1) % draft.points.length]
          return area + point.x * next.y - next.x * point.y
        }, 0)) / 2
      : 0
    const valid = draft.kind === 'light' || (draft.kind === 'obstacle'
      ? draft.terrainRegion
        ? draft.points.length >= 3 && terrainRegionArea >= Math.max(16, map.gridSize ** 2 * 0.04)
        : Math.abs(draft.points[1].x - draft.points[0].x) >= 4 && Math.abs(draft.points[2].y - draft.points[1].y) >= 4
      : Math.hypot(draft.points[1].x - draft.points[0].x, draft.points[1].y - draft.points[0].y) >= 4)
    if (valid) onGeometryEntityCommit?.(draft)
    return true
  }

  useEffect(() => {
    if (!geometryEditMode) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      geometryDragStartRef.current = null
      geometryViewportPanStartRef.current = null
      setGeometryDragActive(false)
      setGeometryViewportPanActive(false)
      setGeometryDraft(null)
      onGeometryEditCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [geometryEditMode, onGeometryEditCancel])

  useEffect(() => {
    if (!geometryEditMode || !selectedGeometryEntityId || !onGeometryEntityDelete) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target
      if (target instanceof HTMLElement && (
        target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      )) return
      const selectedEntity = [
        ...(geometry?.walls ?? []),
        ...(geometry?.doors ?? []),
        ...(geometry?.windows ?? []),
        ...(geometry?.obstacles ?? []),
        ...(geometry?.lights ?? []),
      ].find((entity) => entity.id === selectedGeometryEntityId)
      if (geometryTerrainEditingLocked && selectedEntity?.kind === 'obstacle' && (
        selectedEntity.terrainRegion || (selectedEntity.terrainElevationFeet ?? 0) !== 0
      )) return
      event.preventDefault()
      onGeometryEntityDelete(selectedGeometryEntityId)
      onGeometryEntitySelect?.(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [geometry, geometryEditMode, geometryTerrainEditingLocked, onGeometryEntityDelete, onGeometryEntitySelect, selectedGeometryEntityId])

  const snapMeasure = measureSnapsToGrid(map)
  const segmentCells = (a: Point, b: Point): number =>
    measureSegmentCells(a, b, map, snapMeasure)

  const measurePoint = (raw: Point): Point =>
    snapMeasure ? snapToCellCenter(raw.x, raw.y, map) : raw

  // Shared images may arrive after the map snapshot (for example when a DM
  // restores a locally cached map into a newly created room). Keep retrying a
  // missing image instead of permanently rendering a black grid until reload.
  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    let img: HTMLImageElement | null = null
    let retryTimer: number | undefined
    let retryCount = 0

    const revokeObjectUrl = () => {
      if (!objectUrl) return
      URL.revokeObjectURL(objectUrl)
      objectUrl = ''
    }
    const scheduleRetry = (state: 'missing' | 'error') => {
      if (cancelled) return
      setLoadedMapImage({ mapId: map.id, state })
      const delay = Math.min(10_000, 750 * (2 ** Math.min(retryCount, 4)))
      retryCount += 1
      retryTimer = window.setTimeout(() => void loadImage(), delay)
    }
    const loadImage = async () => {
      try {
        const blob = await getImage(map.id)
        if (cancelled) return
        if (!blob) {
          scheduleRetry('missing')
          return
        }
        objectUrl = URL.createObjectURL(blob)
        img = new window.Image()
        img.onload = () => {
          if (cancelled) return
          setLoadedMapImage({ mapId: map.id, state: 'loaded', image: img ?? undefined })
          revokeObjectUrl()
        }
        img.onerror = () => {
          revokeObjectUrl()
          scheduleRetry('error')
        }
        img.src = objectUrl
      } catch {
        scheduleRetry('error')
      }
    }

    void loadImage()
    return () => {
      cancelled = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      if (img) {
        img.onload = null
        img.onerror = null
      }
      revokeObjectUrl()
    }
  }, [map.id])

  // 监听容器尺寸
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Reset fitted flag when switching maps so each map auto-fits once.
  // Avoid remounting the stage, which would tear animations and transient interaction state.
  useEffect(() => {
    fittedRef.current = false
  }, [map.id])

  // Auto-fit once after loading each map image.
  useEffect(() => {
    if (!image || fittedRef.current || size.width === 0) return
    const scale = Math.min(size.width / map.width, size.height / map.height) * 0.95
    setView({
      scale,
      x: (size.width - map.width * scale) / 2,
      y: (size.height - map.height * scale) / 2,
    })
    fittedRef.current = true
  }, [image, size, map.width, map.height])

  useEffect(() => {
    if (!tabletopFocus || tabletopFocus.mapId !== map.id || appliedFocusIdRef.current === tabletopFocus.id) return
    appliedFocusIdRef.current = tabletopFocus.id
    const scale = Math.max(0.1, Math.min(4, tabletopFocus.scale ?? view.scale))
    setView({
      scale,
      x: size.width / 2 - tabletopFocus.point.x * scale,
      y: size.height / 2 - tabletopFocus.point.y * scale,
    })
  }, [map.id, size.height, size.width, tabletopFocus, view.scale])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (gridAdjustMode && onGridSizeChange) {
      e.evt.preventDefault()
      const step = e.evt.shiftKey ? 3 : 1
      const delta = e.evt.deltaY > 0 ? -step : step
      onGridSizeChange(clampGridSize(map.gridSize + delta, map))
      return
    }
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const oldScale = view.scale
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePointTo = {
      x: (pointer.x - view.x) / oldScale,
      y: (pointer.y - view.y) / oldScale,
    }
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = Math.max(0.1, Math.min(4, direction > 0 ? oldScale * 1.08 : oldScale / 1.08))
    setView({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  const showGridOverlay = (map.showGrid || gridAdjustMode || gridSizePreview) && map.gridSize > 0
  const gridHex = map.gridColor ?? DEFAULT_GRID_COLOR
  const gridAlpha = map.gridOpacity ?? DEFAULT_GRID_OPACITY
  const gridStroke = gridAdjustMode
    ? 'rgba(251,191,36,0.62)'
    : gridSizePreview
      ? gridStrokeRgba(gridHex, Math.min(0.85, gridAlpha + 0.22))
      : gridStrokeRgba(gridHex, gridAlpha)
  const gridLines: React.ReactNode[] = []
  const coordinateLabels: React.ReactNode[] = []
  if (showGridOverlay) {
    const g = map.gridSize
    for (const x of gridLinePositions(map.width, map.gridOffsetX, g)) {
      gridLines.push(
        <Line
          key={`v${x}`}
          points={[x, 0, x, map.height]}
          stroke={gridStroke}
          strokeWidth={gridAdjustMode ? 1.5 : 1}
          listening={false}
        />,
      )
    }
    for (const y of gridLinePositions(map.height, map.gridOffsetY, g)) {
      gridLines.push(
        <Line
          key={`h${y}`}
          points={[0, y, map.width, y]}
          stroke={gridStroke}
          strokeWidth={gridAdjustMode ? 1.5 : 1}
          listening={false}
        />,
      )
    }
    if (map.showCoordinates !== false) {
      const labelStep = g >= 36 ? 1 : g >= 18 ? 2 : 5
      const minCol = Math.ceil((0 - map.gridOffsetX) / g)
      const maxCol = Math.floor((map.width - map.gridOffsetX) / g)
      const minRow = Math.ceil((0 - map.gridOffsetY) / g)
      const maxRow = Math.floor((map.height - map.gridOffsetY) / g)
      const fontSize = Math.max(10, Math.min(14, g * 0.2))
      const labelFill = 'rgba(226, 232, 240, 0.88)'
      const labelBg = 'rgba(15, 23, 42, 0.68)'
      for (let col = minCol; col < maxCol; col++) {
        if (Math.abs(col) % labelStep !== 0) continue
        const x = map.gridOffsetX + (col + 0.5) * g
        if (x < 0 || x > map.width) continue
        coordinateLabels.push(
          <Group key={`x-label-${col}`} x={x} y={Math.max(2, map.gridOffsetY + 2)} listening={false}>
            <Rect x={-12} y={0} width={24} height={fontSize + 6} cornerRadius={4} fill={labelBg} />
            <Text
              x={-12}
              y={3}
              width={24}
              text={`${col}`}
              align="center"
              fontSize={fontSize}
              fontStyle="bold"
              fill={labelFill}
            />
          </Group>,
        )
      }
      for (let row = minRow; row < maxRow; row++) {
        if (Math.abs(row) % labelStep !== 0) continue
        const y = map.gridOffsetY + (row + 0.5) * g
        if (y < 0 || y > map.height) continue
        coordinateLabels.push(
          <Group key={`y-label-${row}`} x={Math.max(2, map.gridOffsetX + 2)} y={y} listening={false}>
            <Rect x={0} y={-10} width={26} height={20} cornerRadius={4} fill={labelBg} />
            <Text
              x={0}
              y={-fontSize / 2}
              width={26}
              text={`${row}`}
              align="center"
              fontSize={fontSize}
              fontStyle="bold"
              fill={labelFill}
            />
          </Group>,
        )
      }
    }
    if (gridAdjustMode) {
      gridLines.push(
        <Circle
          key="grid-origin"
          x={map.gridOffsetX}
          y={map.gridOffsetY}
          radius={5}
          fill="rgba(251,191,36,0.9)"
          stroke="#fff"
          strokeWidth={1}
          listening={false}
        />,
      )
    }
  }

  const inv = 1 / view.scale // Keep strokes/text size stable while zooming.

  const updateSceneDraft = (start: Point, current: Point): SceneRegion => sceneRegionKind === 'circle'
    ? { kind: 'circle', x: start.x, y: start.y, radius: Math.max(4, Math.hypot(current.x - start.x, current.y - start.y)) }
    : {
        kind: 'rect',
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.max(4, Math.abs(current.x - start.x)),
        height: Math.max(4, Math.abs(current.y - start.y)),
      }

  const sceneRegionNode = (region: SceneRegion, key: string, label: string, enabled: boolean, draft = false) => {
    const fill = draft ? 'rgba(251,191,36,0.18)' : enabled ? 'rgba(34,211,238,0.12)' : 'rgba(148,163,184,0.08)'
    const stroke = draft ? '#fbbf24' : enabled ? '#22d3ee' : '#64748b'
    const shape = region.kind === 'circle'
      ? <Circle x={region.x} y={region.y} radius={region.radius} fill={fill} stroke={stroke} strokeWidth={2 * inv} dash={[8 * inv, 5 * inv]} listening={false} />
      : <Rect x={region.x} y={region.y} width={region.width} height={region.height} fill={fill} stroke={stroke} strokeWidth={2 * inv} dash={[8 * inv, 5 * inv]} listening={false} />
    const labelX = region.kind === 'circle' ? region.x - region.radius : region.x
    const labelY = region.kind === 'circle' ? region.y - region.radius : region.y
    return <Group key={key} listening={false}>{shape}<Text x={labelX} y={labelY - 18 * inv} text={label} fill={draft ? '#fde68a' : '#a5f3fc'} fontSize={12 * inv} listening={false} /></Group>
  }

  const stageCanPan = !geometryDragActive && !geometryViewportPanActive && mapCanvasStageCanPan({
    tabletopTool,
    measureMode,
    moveSelectMode,
    aoeSelectMode,
    gridAdjustMode,
    deleteSelectMode,
    fogEditMode,
    fogTool,
    geometryEditMode,
    geometryTool,
    geometrySearchMode,
    sceneEditMode: sceneEditMode || scenePointPlacementMode,
  })
  const savingThrowToken = savingThrowTokenId
    ? map.tokens.find((candidate) => candidate.id === savingThrowTokenId)
    : undefined
  const savingThrowMarkerDiameter = savingThrowToken
    ? Math.max(
        52,
        map.gridSize * Math.max(1, savingThrowToken.size ?? 1) * view.scale * 1.24,
      )
    : 0
  const geometryOverlayVisible = isDM || (!isDM && !!onGeometryDoorInteract)
  const geometryStructureCount = geometryOverlayVisible
    ? (geometry?.walls.length ?? 0) +
      (geometry?.doors.length ?? 0) +
      (geometry?.windows?.length ?? 0)
    : 0

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={(event) => {
        if (
          event.button !== 0 ||
          !geometryEditMode ||
          (geometryTool !== 'door' && geometryTool !== 'window')
        ) return
        const rect = event.currentTarget.getBoundingClientRect()
        const point = {
          x: (event.clientX - rect.left - view.x) / view.scale,
          y: (event.clientY - rect.top - view.y) / view.scale,
        }
        const attachedToWall = !!mapGeometryAttachOpeningToWall(
          geometry,
          point,
          point,
          Math.max(10, map.gridSize * 0.4),
        )
        if (attachedToWall) return
        stageRef.current?.stopDrag()
        stageRef.current?.draggable(false)
        geometryViewportPanStartRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          viewX: view.x,
          viewY: view.y,
        }
        setGeometryViewportPanActive(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMoveCapture={(event) => {
        const start = geometryViewportPanStartRef.current
        if (!start) return
        setView((current) => ({
          ...current,
          x: start.viewX + event.clientX - start.clientX,
          y: start.viewY + event.clientY - start.clientY,
        }))
      }}
      onPointerUpCapture={(event) => {
        if (!geometryViewportPanStartRef.current) return
        geometryViewportPanStartRef.current = null
        setGeometryViewportPanActive(false)
        stageRef.current?.draggable(true)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancelCapture={() => {
        if (!geometryViewportPanStartRef.current) return
        geometryViewportPanStartRef.current = null
        setGeometryViewportPanActive(false)
        stageRef.current?.draggable(true)
      }}
      data-testid="map-canvas"
      data-vision-source-count={visionSourceTokenIds.length}
      data-vision-enabled={geometry?.vision.enabled === true ? 'true' : 'false'}
      data-ambient-light={geometry?.vision.ambientLight ?? 'bright'}
      data-scene-light-count={(geometry?.lights ?? []).filter((light) => campaignLightIsActive(light, worldMinute)).length}
      data-fog-filled={fog?.filled === true ? 'true' : 'false'}
      data-visibility-mask="combined"
      data-map-image-state={imageLoadState}
      data-combat-projectile-count={projectiles.length}
      data-combat-projectile-ids={projectiles.map((projectile) => projectile.id).join(',')}
      data-combat-projectile-kinds={projectiles.map((projectile) => projectile.kind ?? 'arrow').join(',')}
      data-attack-target-effect-count={attackTargetEffects.length}
      data-attack-target-effect-kinds={attackTargetEffects.map((effect) => effect.attackKind).join(',')}
      data-attack-target-effect-targets={attackTargetEffects.map((effect) => effect.targetTokenId).join(',')}
      data-attack-target-effect-classes={attackTargetEffects.map((effect) => effect.classId).join(',')}
      data-sanctuary-token-count={sanctuaryTokenIds.length}
      data-spell-status-token-count={spellStatusTokenMarks.length}
      data-spell-status-token-colors={spellStatusTokenMarks
        .map((mark) =>
          `${mark.statusId}:${mark.backgroundColor}:${mark.borderColor}`)
        .join(',')}
      data-spell-status-token-backgrounds={spellStatusTokenMarks
        .map((mark) =>
          `${mark.statusId}:${mark.backgroundHighlightColor}:${mark.backgroundColor}`)
        .join(',')}
      data-standard-condition-token-colors={standardConditionTokenMarks
        .map((mark) =>
          `${mark.condition}:${mark.backgroundColor}:${mark.borderColor}`)
        .join(',')}
      data-saving-throw-token-id={savingThrowTokenId ?? ''}
      data-scene-interaction-count={sceneInteractionPoints.length}
      data-viewport-x={view.x}
      data-viewport-y={view.y}
      data-viewport-scale={view.scale}
      data-geometry-tool={geometryEditMode ? geometryTool : 'off'}
      data-geometry-overlay-visible={geometryOverlayVisible ? 'true' : 'false'}
      data-dm-geometry-wall-count={isDM ? geometry?.walls.length ?? 0 : 0}
      data-geometry-structure-count={geometryStructureCount}
      data-stage-can-pan={stageCanPan ? 'true' : 'false'}
      className={`relative h-full w-full overflow-hidden rounded-2xl bg-void-900/60 ${
        tabletopTool !== 'none'
          ? 'cursor-crosshair'
        : gridAdjustMode
          ? 'cursor-move'
        : geometryEditMode
            ? ['select', 'door', 'window'].includes(geometryTool) ? 'cursor-grab' : 'cursor-crosshair'
          : fogEditMode
            ? fogTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
          : sceneEditMode || scenePointPlacementMode
            ? 'cursor-crosshair'
          : measureMode
            ? 'cursor-crosshair'
            : geometrySearchMode
              ? 'cursor-crosshair'
            : aoeSelectMode
              ? 'cursor-crosshair'
              : deleteSelectMode
                ? 'cursor-crosshair'
                : moveSelectMode
                  ? 'cursor-cell'
                  : ''
      }`}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        draggable={stageCanPan}
        onWheel={handleWheel}
        onDragEnd={(e) => {
          // Only update viewport when dragging the stage itself.
          if (e.target === e.target.getStage()) {
            setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))
          }
        }}
        onContextMenu={(e) => {
          // 屏蔽浏览器右键菜单；测距时右键取消正在放置的起点
          e.evt.preventDefault()
          if (sceneEditMode || scenePointPlacementMode) {
            sceneDragStartRef.current = null
            setSceneDraft(null)
            onSceneEditCancel?.()
            return
          }
          if (tabletopTool !== 'none') {
            tabletopDragStartRef.current = null
            setTabletopDraft(null)
            return
          }
          if (geometryEditMode) {
            geometryDragStartRef.current = null
            geometryViewportPanStartRef.current = null
            setGeometryDragActive(false)
            setGeometryViewportPanActive(false)
            setGeometryDraft(null)
            return
          }
          if (fogEditMode) {
            fogDragStartRef.current = null
            setFogDraft(null)
            setFogPolygonPoints([])
            return
          }
          if (deleteSelectMode) {
            setDeleteDrag(null)
            onDeleteCancel?.()
            return
          }
          if (aoeSelectMode) {
            onAoeCancel?.()
            return
          }
          if (measureMode && pending) {
            setPending(null)
            setCursor(null)
            return
          }
          if (!isMapTokenNode(e.target)) {
            onBlankContextMenu?.()
          }
        }}
        onMouseDown={(e) => {
          const stage = e.target.getStage()
          if (scenePointPlacementMode && e.evt.button === 0) {
            e.cancelBubble = true
            const point = relativePoint(stage)
            if (point) onScenePointPlacementCommit?.(point)
            return
          }
          if (sceneEditMode && e.evt.button === 0) {
            e.cancelBubble = true
            const point = relativePoint(stage)
            if (!point) return
            sceneDragStartRef.current = point
            setSceneDraft(updateSceneDraft(point, point))
            return
          }
          if (tabletopTool !== 'none' && e.evt.button === 0) {
            e.cancelBubble = true
            const point = relativePoint(stage)
            if (!point) return
            if (tabletopTool === 'focus') {
              onTabletopPoint?.(point)
              return
            }
            tabletopDragStartRef.current = point
            setTabletopDraft({ shape: tabletopTool, from: point, to: point })
            return
          }
          if (geometrySearchMode && e.evt.button === 0 && !isMapTokenNode(e.target)) {
            e.cancelBubble = true
            const point = relativePoint(stage)
            if (point) onGeometrySearch?.(point)
            return
          }
          if (geometryEditMode && e.evt.button === 0) {
            if (!isMapTokenNode(e.target)) {
              const handled = handleGeometryMouseDown(stage)
              if (handled) e.cancelBubble = true
            }
            return
          }
          if (fogEditMode && fogTool !== 'pan' && e.evt.button === 0) {
            e.cancelBubble = true
            handleFogMouseDown(stage)
            return
          }
          if (deleteSelectMode && e.evt.button === 0) {
            e.cancelBubble = true
            const p = relativePoint(stage)
            if (p) setDeleteDrag({ start: p, current: p })
            return
          }
          if (aoeSelectMode && e.evt.button === 0) {
            e.cancelBubble = true
            // pointer-down 确认范围后，React 可能在随后的 click 前关闭选点模式；
            // 保留一个短暂抑制窗口，避免同一次点击继续选中 Token。
            suppressTokenSelectUntilRef.current = Date.now() + 500
            const p = relativePoint(stage)
            if (p) {
              onAoeConfirm?.(gridPoint(p))
            }
            return
          }
          if (moveSelectMode && moveCircle && e.evt.button === 0 && !isMapTokenNode(e.target)) {
            const p = relativePoint(stage)
            if (p) onMoveSelect?.(p)
            return
          }
          if (measureMode) {
            if (e.evt.button !== 0) return // Left button only.
            const raw = relativePoint(stage)
            if (!raw) return
            const p = measurePoint(raw)
            if (!pending) {
              setPending(p)
              setCursor(p)
            } else {
              if (!measurePointsEqual(pending, p)) {
                setSegments((segs) => [...segs, { a: pending, b: p }])
              }
              setPending(null)
              setCursor(null)
            }
            return
          }
          if (gridAdjustMode && onGridOffsetChange && e.evt.button === 0 && !isMapTokenNode(e.target)) {
            const p = relativePoint(stage)
            if (!p) return
            gridDragRef.current = {
              startX: p.x,
              startY: p.y,
              origOx: map.gridOffsetX,
              origOy: map.gridOffsetY,
            }
            return
          }
          if (!isMapTokenNode(e.target)) onSelectToken(null)
        }}
        onMouseMove={(e) => {
          if (sceneEditMode && sceneDragStartRef.current) {
            const point = relativePoint(e.target.getStage())
            if (point) setSceneDraft(updateSceneDraft(sceneDragStartRef.current, point))
            return
          }
          if (tabletopTool !== 'none' && tabletopDragStartRef.current) {
            const point = relativePoint(e.target.getStage())
            if (point) setTabletopDraft((draft) => draft ? { ...draft, to: point } : draft)
            return
          }
          if (geometryEditMode && handleGeometryMouseMove(e.target.getStage())) return
          if (fogEditMode && handleFogMouseMove(e.target.getStage())) return
          if (deleteSelectMode && deleteDrag) {
            const p = relativePoint(e.target.getStage())
            if (p) setDeleteDrag((drag) => (drag ? { ...drag, current: p } : drag))
            return
          }
          if (aoeSelectMode && onAoePreviewCell) {
            const p = relativePoint(e.target.getStage())
            if (p) onAoePreviewCell(gridPoint(p))
            return
          }
          if (gridAdjustMode && gridDragRef.current && onGridOffsetChange) {
            const p = relativePoint(e.target.getStage())
            if (!p) return
            const d = gridDragRef.current
            onGridOffsetChange(
              Math.round(d.origOx + (p.x - d.startX)),
              Math.round(d.origOy + (p.y - d.startY)),
            )
            return
          }
          if (measureMode && pending) {
            const raw = relativePoint(e.target.getStage())
            if (raw) setCursor(measurePoint(raw))
          }
        }}
        onMouseUp={(e) => {
          if (sceneEditMode && sceneDragStartRef.current) {
            e.cancelBubble = true
            const start = sceneDragStartRef.current
            const point = relativePoint(e.target.getStage()) ?? start
            const region = updateSceneDraft(start, point)
            sceneDragStartRef.current = null
            setSceneDraft(null)
            onSceneRegionCommit?.(region)
            return
          }
          if (tabletopTool !== 'none' && tabletopDragStartRef.current) {
            e.cancelBubble = true
            const from = tabletopDragStartRef.current
            const to = relativePoint(e.target.getStage()) ?? tabletopDraft?.to ?? from
            tabletopDragStartRef.current = null
            const shape = tabletopDraft?.shape
            setTabletopDraft(null)
            if (shape && Math.hypot(to.x - from.x, to.y - from.y) >= 4) {
              onTabletopAnnotation?.(shape, from, to)
            }
            return
          }
          if (geometryEditMode && handleGeometryMouseUp(e.target.getStage())) {
            e.cancelBubble = true
            return
          }
          if (moveSelectMode && moveCircle) {
            const p = relativePoint(e.target.getStage())
            if (p) setCursor(p)
            return
          }
          if (fogEditMode && handleFogMouseUp()) {
            e.cancelBubble = true
            return
          }
          if (!deleteSelectMode || !deleteDrag) return
          e.cancelBubble = true
          const p = relativePoint(e.target.getStage()) ?? deleteDrag.current
          const rect = rectFromPoints(deleteDrag.start, p)
          setDeleteDrag(null)
          if (rect.width >= 4 && rect.height >= 4) onDeleteBoxConfirm?.(rect)
        }}
        onDblClick={(e) => {
          if (fogEditMode && fogShapeKindForTool(fogTool) === 'polygon') {
            e.cancelBubble = true
            commitFogPolygon()
            return
          }
          if (!pingEnabled || tabletopTool !== 'none') return
          const point = relativePoint(e.target.getStage())
          if (!point) return
          e.cancelBubble = true
          onMapPing?.(point)
        }}
      >
        <Layer>
          {image && <KonvaImage image={image} width={map.width} height={map.height} />}
          {gridLines}
          {coordinateLabels}
          <TerrainElevationContours geometry={geometry} inv={inv} />
          <Dnd5eItemAreaOverlays map={map} />
          <Dnd5ePluginAreaOverlays map={map} isDM={isDM} onVisibilityToggle={onDnd5ePluginAreaVisibilityToggle} />
          {isDM && sceneTriggerZones.map((zone) =>
            sceneRegionNode(zone.region, `scene-zone:${zone.sceneId}:${zone.triggerId}`, zone.name, zone.enabled))}
          {isDM && sceneEditMode && sceneDraft && sceneRegionNode(sceneDraft, 'scene-zone:draft', '绘制触发区', true, true)}
          {sceneInteractionPoints.map((point) => {
            const glyph: Record<SceneInteractionPointIcon, string> = {
              bookshelf: '📚',
              chest: '🎁',
              search: '🔎',
              altar: '✦',
              switch: '⚙',
              custom: '◆',
            }
            return (
              <Group
                key={`scene-interaction:${point.id}`}
                x={point.x}
                y={point.y}
                listening={!!onSceneInteractionPointClick}
                onMouseDown={(event) => {
                  event.cancelBubble = true
                }}
                onTap={(event) => {
                  event.cancelBubble = true
                  onSceneInteractionPointClick?.(point.id)
                }}
                onClick={(event) => {
                  event.cancelBubble = true
                  onSceneInteractionPointClick?.(point.id)
                }}
              >
                <Circle
                  radius={20 * inv}
                  fill={point.enabled ? 'rgba(15, 23, 42, 0.94)' : 'rgba(30, 41, 59, 0.75)'}
                  stroke={point.enabled ? '#fbbf24' : '#64748b'}
                  strokeWidth={2 * inv}
                  shadowColor="#000"
                  shadowBlur={8 * inv}
                  shadowOpacity={0.7}
                />
                <Text
                  x={-16 * inv}
                  y={-13 * inv}
                  width={32 * inv}
                  height={26 * inv}
                  text={glyph[point.icon]}
                  align="center"
                  verticalAlign="middle"
                  fontSize={19 * inv}
                  listening={false}
                />
                <Text
                  x={-60 * inv}
                  y={24 * inv}
                  width={120 * inv}
                  text={point.name}
                  align="center"
                  fontSize={11 * inv}
                  fontStyle="bold"
                  fill="#fef3c7"
                  stroke="#020617"
                  strokeWidth={3 * inv}
                  listening={false}
                />
              </Group>
            )
          })}
          {aoeSelectMode && aoeHighlight?.areaCircle && (
            <Circle
              x={aoeHighlight.areaCircle.centerX}
              y={aoeHighlight.areaCircle.centerY}
              radius={aoeHighlight.areaCircle.radiusPx}
              fill="rgba(127, 29, 29, 0.12)"
              stroke="rgba(185, 28, 28, 0.9)"
              strokeWidth={3}
              dash={[12, 7]}
              listening={false}
            />
          )}
          {aoeSelectMode && aoeHighlight?.areaPolygon && (
            <Line
              points={aoeHighlight.areaPolygon}
              closed
              fill="rgba(127, 29, 29, 0.12)"
              stroke="rgba(185, 28, 28, 0.9)"
              strokeWidth={3}
              dash={[12, 7]}
              listening={false}
            />
          )}
          {aoeSelectMode && aoeHighlight?.rangeCells && aoeHighlight.rangeCells.length > 0 && (
            <AoeCellHighlights
              map={map}
              cells={aoeHighlight.rangeCells}
              valid={aoeHighlight.valid}
              variant="range"
            />
          )}
          {aoeSelectMode && aoeHighlight && aoeHighlight.cells.length > 0 && (
            <AoeCellHighlights
              map={map}
              cells={aoeHighlight.cells}
              valid={aoeHighlight.valid}
              variant="attack"
            />
          )}
          {!aoeSelectMode && rangedRangeCells.length > 0 && (
            <AoeCellHighlights
              map={map}
              cells={rangedRangeCells}
              valid
              variant="range"
            />
          )}
          {map.tokens.map((token) => {
            const movementAnimation = displayToken(token).movementAnimation
            return movementAnimation ? (
              <TokenMovementPathLine
                key={`movement-path-${token.id}-${movementAnimation.id}`}
                animation={movementAnimation}
                viewScale={view.scale}
              />
            ) : null
          })}
          {moveSelectMode && moveCircle && (
            <Circle
              x={moveCircle.centerX}
              y={moveCircle.centerY}
              radius={moveCircle.radiusPx}
              fill="rgba(56, 189, 248, 0.1)"
              stroke="rgba(125, 211, 252, 0.45)"
              strokeWidth={2}
              dash={[10, 8]}
              listening
              onMouseDown={(e) => {
                e.cancelBubble = true
                const st = e.target.getStage()
                const p = relativePoint(st)
                if (p) onMoveSelect?.(p)
              }}
            />
          )}
          {map.tokens.map((t) => {
            const hp = hpByToken?.[t.id]
            const defeated = hp != null ? hp.hp <= 0 : defeatedTokenIds.includes(t.id)
            return (
            <TokenNode
              key={`body-${t.id}`}
              renderMode="body"
              token={displayToken(t)}
              gridSize={map.gridSize}
              builtinGrid={builtinGrid}
              selected={t.id === selectedTokenId}
              targetSelected={targetSelectTokenIds.includes(t.id)}
              defeated={defeated}
              currentTurn={t.id === currentTurnTokenId}
              draggable={canDragToken(t)}
              hp={hpByToken?.[t.id]}
              showHpBar={
                !!hpByToken?.[t.id] &&
                (isDM || !!t.characterId || t.showHpOnToken !== false)
              }
              hoverLabel={hoveredTokenId === t.id ? tokenHoverLabels[t.id] : undefined}
              showName={hoveredTokenId === t.id}
              onHoverChange={(hovered) =>
                // Use functional updates to avoid hover flicker races.
                setHoveredTokenId((id) => (hovered ? t.id : id === t.id ? null : id))
              }
              onSelect={() => {
                if (deleteSelectMode) return
                // Stage 的 pointer-down 已经按实际指针格确认范围；这里仅消费后续
                // token click，避免同一点击重复提交并打开怪物详情。
                if (mapCanvasTokenClickAction(
                  aoeSelectMode || Date.now() < suppressTokenSelectUntilRef.current,
                ) === 'consume-area-click') return
                onSelectToken(t.id)
              }}
              instantPosition={!!dragPreviewPositions[t.id]}
              registerPositionNode={registerTokenVisualNode}
              onDragStart={(x, y) => beginTokenDrag(t, x, y)}
              onDragEnd={(x, y) => commitTokenDrag(t, x, y)}
              onDragMove={(x, y) => previewTokenDragFrame(t, x, y)}
              onDragCancel={() => {
                // Sub-threshold drag: clear preview without writing or broadcasting.
                cancelTokenDrag(t.id)
              }}
            />
            )
          })}

          {chillTouchTokenIds.flatMap((tokenId) => {
            const token = map.tokens.find((candidate) => candidate.id === tokenId)
            if (!token) return []
            return [(
              <ChillTouchPersistentMark
                key={`chill-touch:${token.id}`}
                x={token.x}
                y={token.y}
                radius={map.gridSize * Math.max(1, token.size ?? 1) * 0.58}
              />
            )]
          })}
          {tabletopAnnotations.map((annotation) => annotation.shape === 'arrow' ? (
            <Arrow
              key={annotation.id}
              points={[annotation.from.x, annotation.from.y, annotation.to.x, annotation.to.y]}
              stroke={annotation.color}
              fill={annotation.color}
              strokeWidth={4 * inv}
              pointerLength={13 * inv}
              pointerWidth={12 * inv}
              lineCap="round"
              lineJoin="round"
              shadowColor="rgba(15,23,42,0.8)"
              shadowBlur={4 * inv}
              listening={false}
            />
          ) : (
            <Circle
              key={annotation.id}
              x={annotation.from.x}
              y={annotation.from.y}
              radius={Math.hypot(annotation.to.x - annotation.from.x, annotation.to.y - annotation.from.y)}
              stroke={annotation.color}
              strokeWidth={4 * inv}
              fill={`${annotation.color}18`}
              dash={[10 * inv, 6 * inv]}
              listening={false}
            />
          ))}
          {tabletopDraft && (tabletopDraft.shape === 'arrow' ? (
            <Arrow
              points={[tabletopDraft.from.x, tabletopDraft.from.y, tabletopDraft.to.x, tabletopDraft.to.y]}
              stroke="#fde68a"
              fill="#fde68a"
              strokeWidth={4 * inv}
              pointerLength={13 * inv}
              pointerWidth={12 * inv}
              opacity={0.78}
              listening={false}
            />
          ) : (
            <Circle
              x={tabletopDraft.from.x}
              y={tabletopDraft.from.y}
              radius={Math.hypot(tabletopDraft.to.x - tabletopDraft.from.x, tabletopDraft.to.y - tabletopDraft.from.y)}
              stroke="#fde68a"
              strokeWidth={4 * inv}
              fill="rgba(251,191,36,0.08)"
              dash={[10 * inv, 6 * inv]}
              listening={false}
            />
          ))}
          {tabletopPings.filter((ping) => ping.expiresAt > tabletopNow).map((ping) => {
            const duration = Math.max(1, ping.expiresAt - ping.createdAt)
            const progress = Math.max(0, Math.min(1, (tabletopNow - ping.createdAt) / duration))
            return (
              <Group key={ping.id} x={ping.point.x} y={ping.point.y} listening={false}>
                <Circle
                  radius={(10 + progress * 42) * inv}
                  stroke={ping.role === 'dm' ? '#fbbf24' : '#38bdf8'}
                  strokeWidth={3 * inv}
                  opacity={1 - progress}
                />
                <Circle
                  radius={(7 + ((progress + 0.38) % 1) * 32) * inv}
                  stroke={ping.role === 'dm' ? '#fde68a' : '#bae6fd'}
                  strokeWidth={2 * inv}
                  opacity={(1 - ((progress + 0.38) % 1)) * 0.8}
                />
                <Circle radius={5 * inv} fill={ping.role === 'dm' ? '#fbbf24' : '#38bdf8'} opacity={0.9} />
              </Group>
            )
          })}

          {map.tokens.map((t) => {
            const hp = hpByToken?.[t.id]
            const defeated = hp != null ? hp.hp <= 0 : defeatedTokenIds.includes(t.id)
            return (
              <TokenNode
                key={`label-${t.id}`}
                renderMode="label"
                token={displayToken(t)}
                gridSize={map.gridSize}
                builtinGrid={builtinGrid}
                selected={t.id === selectedTokenId}
                targetSelected={targetSelectTokenIds.includes(t.id)}
                defeated={defeated}
                draggable={canDragToken(t)}
                hp={hpByToken?.[t.id]}
                showHpBar={
                  !!hpByToken?.[t.id] &&
                  (isDM || !!t.characterId || t.showHpOnToken !== false)
                }
                hoverLabel={hoveredTokenId === t.id ? tokenHoverLabels[t.id] : undefined}
                showName={hoveredTokenId === t.id}
                onHoverChange={() => undefined}
                onSelect={() => {
                  if (deleteSelectMode) return
                  onSelectToken(t.id)
                }}
                instantPosition={!!dragPreviewPositions[t.id]}
                registerPositionNode={registerTokenVisualNode}
                onDragEnd={(x, y) => commitTokenDrag(t, x, y)}
                onDragCancel={() => cancelTokenDrag(t.id)}
              />
            )
          })}

          {map.tokens.map((t) => {
            const hp = hpByToken?.[t.id]
            const defeated = hp != null ? hp.hp <= 0 : defeatedTokenIds.includes(t.id)
            return (
              <TokenNode
                key={`vitals-${t.id}`}
                renderMode="vitals"
                token={displayToken(t)}
                gridSize={map.gridSize}
                builtinGrid={builtinGrid}
                selected={t.id === selectedTokenId}
                targetSelected={targetSelectTokenIds.includes(t.id)}
                defeated={defeated}
                draggable={canDragToken(t)}
                hp={hpByToken?.[t.id]}
                showHpBar={
                  !!hpByToken?.[t.id] &&
                  (isDM || !!t.characterId || t.showHpOnToken !== false)
                }
                standardConditions={dnd5eConditionsByToken[t.id]}
                standardConditionMarks={standardConditionTokenMarks.filter((mark) => mark.tokenId === t.id)}
                shillelaghActive={shillelaghTokenIds.includes(t.id)}
                spellStatusMarks={spellStatusTokenMarks.filter((mark) => mark.tokenId === t.id)}
                airborne={mapGeometryTokenElevation(geometry, t) >
                  mapGeometryTerrainElevationAtPoint(geometry, t)}
                onStandardConditionClick={(condition) => onDnd5eConditionClick?.(t.id, condition)}
                hoverLabel={hoveredTokenId === t.id ? tokenHoverLabels[t.id] : undefined}
                showName={hoveredTokenId === t.id}
                onHoverChange={() => undefined}
                onSelect={() => {
                  if (deleteSelectMode) return
                  onSelectToken(t.id)
                }}
                instantPosition={!!dragPreviewPositions[t.id]}
                registerPositionNode={registerTokenVisualNode}
                onDragEnd={(x, y) => commitTokenDrag(t, x, y)}
                onDragCancel={() => cancelTokenDrag(t.id)}
              />
            )
          })}

          {deleteDrag && (
            <Rect
              {...rectFromPoints(deleteDrag.start, deleteDrag.current)}
              fill="rgba(239,68,68,0.14)"
              stroke="rgba(248,113,113,0.95)"
              strokeWidth={2 * inv}
              dash={[10 * inv, 6 * inv]}
              listening={false}
            />
          )}

          {/* 已确定的测距线段（右键删除） */}
          {segments.map((seg, i) => (
            <MeasureLine
              key={i}
              a={seg.a}
              b={seg.b}
              cells={segmentCells(seg.a, seg.b)}
              snapMeasure={snapMeasure}
              inv={inv}
              onDelete={() => setSegments((segs) => segs.filter((_, idx) => idx !== i))}
            />
          ))}

          {/* 正在放置的预览线 */}
          {measureMode && pending && cursor && (
            <MeasureLine
              a={pending}
              b={cursor}
              cells={segmentCells(pending, cursor)}
              snapMeasure={snapMeasure}
              inv={inv}
              preview
            />
          )}
          {moveSelectMode && movePreviewPath && (
            <Line
              points={movePreviewPath.points.flatMap((point) => [point.x, point.y])}
              stroke={movePreviewPath.movementCostFeet <= (moveCircle?.radiusPx ?? 0) / Math.max(1, map.gridSize) * Math.max(1, map.feetPerCell ?? 5)
                ? 'rgba(56,189,248,0.95)'
                : 'rgba(248,113,113,0.95)'}
              strokeWidth={4 / Math.max(view.scale, 0.01)}
              lineCap="round"
              lineJoin="round"
              dash={[10 / Math.max(view.scale, 0.01), 6 / Math.max(view.scale, 0.01)]}
              listening={false}
            />
          )}
        </Layer>
        <LightingLayer map={map} geometry={geometry} worldMinute={worldMinute} isDM={isDM} visionSourceTokenIds={visionSourceTokenIds} />
        {isDM && (
          <MapGeometryDiagnosticsLayer
            diagnostics={geometryDiagnostics}
            candidates={geometryDetectionCandidates}
            inv={inv}
            onCandidateRemove={onGeometryDetectionCandidateRemove}
          />
        )}
        {geometryOverlayVisible && (
          <MapGeometryLayer
            map={map}
            geometry={geometry}
            draft={geometryDraft}
            editMode={geometryEditMode}
            doorInteractionMode={!isDM && !geometrySearchMode}
            tool={geometryTool}
            selectedEntityId={selectedGeometryEntityId}
            inv={inv}
            terrainEditingLocked={geometryTerrainEditingLocked}
            onSelect={isDM ? onGeometryEntitySelect : geometrySearchMode ? undefined : (entityId) => {
              if (entityId) onGeometryDoorInteract?.(entityId)
            }}
            onDelete={isDM ? onGeometryEntityDelete : undefined}
            onPointsChange={isDM ? onGeometryEntityPointsChange : undefined}
          />
        )}
        {(!isDM || geometryPreviewAsPlayer || fogPreviewAsPlayer) && <PlayerVisibilityLayer
          map={map}
          geometry={geometry}
          fog={fog}
          sourceTokenIds={visionSourceTokenIds}
          exploredPolygons={exploredVisionPolygons}
          worldMinute={worldMinute}
        />}
        {isDM && !geometryPreviewAsPlayer && !fogPreviewAsPlayer && <FogOfWarLayer
          map={map}
          fog={fog}
          isDM
          previewAsPlayer={false}
          draft={fogDraft}
          polygonPoints={fogPolygonPoints}
          inv={inv}
        />}
        <Layer listening={false}>
          {projectiles.map((projectile) => (
            <CombatProjectileEffect
              key={projectile.id}
              projectile={projectile}
            />
          ))}
          {attackTargetEffects.map((effect) => (
            <AttackTargetEffect
              key={effect.id}
              effect={effect}
            />
          ))}
        </Layer>
      </Stage>
      {savingThrowToken ? (
        <div
          data-testid="saving-throw-marker"
          data-saving-throw-ability={savingThrowAbility ?? ''}
          className="pointer-events-none absolute z-[70] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: view.x + savingThrowToken.x * view.scale,
            top: view.y + savingThrowToken.y * view.scale,
            width: savingThrowMarkerDiameter,
            height: savingThrowMarkerDiameter,
          }}
        >
          <div className="absolute inset-0 animate-ping rounded-full border-[3px] border-sky-300 bg-sky-400/15 shadow-[0_0_22px_rgba(56,189,248,0.95)]" />
          <div className="absolute inset-0 rounded-full border-[3px] border-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.9)]" />
          <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-300 bg-sky-800/95 px-3 py-1 text-xs font-bold text-sky-50 shadow-[0_0_14px_rgba(14,165,233,0.8)]">
            {savingThrowAbility
              ? combatPresentationSavingThrowAbilityLabel(savingThrowAbility)
              : '豁免检定'}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MeasureLine({
  a,
  b,
  cells,
  snapMeasure,
  inv,
  preview = false,
  onDelete,
}: {
  a: Point
  b: Point
  cells: number
  snapMeasure: boolean
  inv: number
  preview?: boolean
  onDelete?: () => void
}) {
  const feet = cells * DND_FEET_PER_CELL
  const label = snapMeasure
    ? `${cells} \u683c / ${feet} \u5c3a`
    : `${cells.toFixed(1)} \u683c / ${feet.toFixed(1)} \u5c3a`
  const degenerate = measurePointsEqual(a, b)
  const handleDelete = onDelete
    ? (e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault()
        e.cancelBubble = true
        onDelete()
      }
    : undefined

  return (
    <Group>
      {!degenerate && (
        <Line
          points={[a.x, a.y, b.x, b.y]}
          stroke="#fbbf24"
          strokeWidth={3.5 * inv}
          dash={[10 * inv, 7 * inv]}
          hitStrokeWidth={22 * inv}
          opacity={preview ? 0.7 : 1}
          onContextMenu={handleDelete}
        />
      )}
      <Circle
        x={a.x}
        y={a.y}
        radius={6 * inv}
        fill="#fbbf24"
        hitStrokeWidth={18 * inv}
        onContextMenu={handleDelete}
      />
      {!degenerate && (
        <Circle
          x={b.x}
          y={b.y}
          radius={6 * inv}
          fill="#fbbf24"
          hitStrokeWidth={18 * inv}
          onContextMenu={handleDelete}
        />
      )}
      <Group x={b.x} y={b.y}>
        <Rect
          x={12 * inv}
          y={-15 * inv}
          width={150 * inv}
          height={30 * inv}
          fill="rgba(10,11,22,0.9)"
          stroke="#fbbf24"
          strokeWidth={inv}
          cornerRadius={6 * inv}
          onContextMenu={handleDelete}
        />
        <Text
          x={12 * inv}
          y={-15 * inv}
          width={150 * inv}
          height={30 * inv}
          text={label}
          fontSize={14 * inv}
          fontStyle="bold"
          fill="#fde68a"
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      </Group>
    </Group>
  )
}

function ProjectileArrow({ projectile }: { projectile: MapProjectile }) {
  const groupRef = useRef<Konva.Group>(null)
  const arrowRef = useRef<Konva.Arrow>(null)
  const glowRef = useRef<Konva.Arrow>(null)
  const pathRef = useRef<Konva.Line>(null)
  const chargeRef = useRef<Konva.Circle>(null)

  useEffect(() => {
    const group = groupRef.current
    const arrow = arrowRef.current
    const glow = glowRef.current
    const path = pathRef.current
    const charge = chargeRef.current
    const layer = group?.getLayer()
    if (!group || !arrow || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const focus = projectile.kind === 'focus'
    const trail = focus ? Math.min(68, Math.max(28, dist * 0.22)) : Math.min(42, Math.max(18, dist * 0.16))
    group.position(projectile.from)
    group.rotation(angle)
    arrow.points([-trail, 0, 0, 0])
    glow?.points([-trail * 1.05, 0, 0, 0])
    path?.points([0, 0, dist, 0])
    const duration = focus ? 780 : 460
    const anim = new Konva.Animation((frame) => {
      const elapsed = frame?.time ?? 0
      const raw = Math.min(1, elapsed / duration)
      const chargePhase = focus ? 0.28 : 0
      const travelRaw = chargePhase > 0 ? Math.max(0, (raw - chargePhase) / (1 - chargePhase)) : raw
      const p = 1 - Math.pow(1 - travelRaw, 2.4)
      const fade = raw < 0.78 ? 1 : Math.max(0, (1 - raw) / 0.22)
      if (focus && charge) {
        const pulse = raw < chargePhase ? 0.65 + Math.sin(raw * 44) * 0.2 : Math.max(0, 1 - travelRaw)
        charge.radius(10 + pulse * 12)
        charge.opacity(Math.max(0, pulse))
      }
      if (focus && path) {
        const pulse = raw < chargePhase ? 0.72 + Math.sin(raw * 38) * 0.18 : Math.max(0.18, 1 - travelRaw * 0.7)
        path.opacity(pulse)
      }
      group.x(projectile.from.x + dx * p)
      group.y(projectile.from.y + dy * p)
      group.opacity(fade)
    }, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [projectile])

  return (
    <>
      {projectile.kind === 'focus' && (
        <Group
          x={projectile.from.x}
          y={projectile.from.y}
          rotation={(Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x) * 180) / Math.PI}
          listening={false}
        >
          <Circle
            ref={chargeRef}
            radius={12}
            fill="rgba(168,85,247,0.22)"
            stroke="rgba(216,180,254,0.95)"
            strokeWidth={2}
            shadowBlur={18}
            shadowColor="#a855f7"
          />
          <Line
            ref={pathRef}
            points={[0, 0, 60, 0]}
            stroke="rgba(167,139,250,0.95)"
            strokeWidth={18}
            lineCap="round"
            shadowBlur={28}
            shadowColor="#a855f7"
          />
          <Line
            points={[0, 0, Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y), 0]}
            stroke="rgba(56,189,248,0.62)"
            strokeWidth={8}
            lineCap="round"
            shadowBlur={18}
            shadowColor="#38bdf8"
          />
        </Group>
      )}
    <Group ref={groupRef} listening={false}>
      <Arrow
        ref={glowRef}
        points={[-24, 0, 0, 0]}
        stroke={projectile.kind === 'focus' ? 'rgba(168,85,247,0.55)' : 'rgba(250, 204, 21, 0.36)'}
        strokeWidth={projectile.kind === 'focus' ? 10 : 7}
        pointerLength={projectile.kind === 'focus' ? 14 : 10}
        pointerWidth={projectile.kind === 'focus' ? 14 : 10}
        lineCap="round"
        lineJoin="round"
        shadowBlur={10}
        shadowColor={projectile.kind === 'focus' ? '#a855f7' : '#facc15'}
      />
      <Arrow
        ref={arrowRef}
        points={[-24, 0, 0, 0]}
        stroke={projectile.kind === 'focus' ? '#ddd6fe' : '#f8fafc'}
        fill={projectile.kind === 'focus' ? '#c084fc' : '#f8fafc'}
        strokeWidth={projectile.kind === 'focus' ? 3.4 : 2.2}
        pointerLength={projectile.kind === 'focus' ? 13 : 9}
        pointerWidth={projectile.kind === 'focus' ? 12 : 8}
        lineCap="round"
        lineJoin="round"
        shadowBlur={4}
        shadowColor={projectile.kind === 'focus' ? '#7c3aed' : 'rgba(15,23,42,0.65)'}
      />
    </Group>
    </>
  )
}

function SpareTheDyingEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const haloRef = useRef<Konva.Circle>(null)
  const pulseRef = useRef<Konva.Circle>(null)
  const moteRefs = useRef<Array<Konva.Circle | null>>([])
  const radius = Math.max(20, projectile.radiusPx ?? 32)
  const accent = projectile.accentColor ?? '#22c55e'
  const glow = projectile.glowColor ?? '#86efac'

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_100)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const fade = raw < 0.12 ? raw / 0.12 : raw > 0.78 ? (1 - raw) / 0.22 : 1
      effect.position(projectile.to)
      effect.opacity(Math.max(0, fade))
      haloRef.current?.radius(radius * (0.82 + raw * 0.28))
      haloRef.current?.opacity(0.3 + Math.sin(elapsed * 0.018) * 0.12)
      pulseRef.current?.radius(radius * (0.28 + (raw % 0.52) * 0.72))
      pulseRef.current?.opacity(Math.max(0, 0.52 - (raw % 0.52)))
      moteRefs.current.forEach((mote, index) => {
        if (!mote) return
        const phase = (raw * 1.2 + index * 0.17) % 1
        const angle = index * 1.73 + elapsed * 0.0015
        mote.position({
          x: Math.cos(angle) * radius * (0.18 + phase * 0.62),
          y: radius * 0.45 - phase * radius * 1.55 + Math.sin(angle) * radius * 0.12,
        })
        mote.opacity(Math.sin(phase * Math.PI) * 0.82)
        mote.radius(1.5 + (index % 3) * 0.7)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        radius={radius * 0.88}
        fill="#22c55e"
        opacity={0.1}
        shadowColor="#4ade80"
        shadowBlur={radius * 0.9}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={haloRef}
        radius={radius * 0.9}
        stroke={accent}
        strokeWidth={2.4}
        dash={[radius * 0.18, radius * 0.12]}
        shadowColor={glow}
        shadowBlur={14}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={pulseRef}
        radius={radius * 0.3}
        stroke="#86efac"
        strokeWidth={2}
        shadowColor={glow}
        shadowBlur={12}
        perfectDrawEnabled={false}
      />
      {Array.from({ length: 9 }, (_, index) => (
        <Circle
          key={index}
          ref={(node) => { moteRefs.current[index] = node }}
          radius={2}
          fill={index % 3 === 0 ? accent : index % 2 === 0 ? '#bbf7d0' : '#4ade80'}
          shadowColor={index % 3 === 0 ? glow : '#22c55e'}
          shadowBlur={8}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

function AcidSplashEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const trailRef = useRef<Konva.Group>(null)
  const frontRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const dropletRefs = useRef<Array<Konva.Circle | null>>([])
  const fluidImage = useTokenBadgeImage('/assets/vfx/acid-splash-fluid.png')
  const glow = projectile.glowColor ?? '#bef264'
  const accent = projectile.accentColor ?? '#84cc16'
  const distance = Math.max(
    1,
    Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y),
  )
  const fluidWidth = distance * 1.16
  const fluidHeight = Math.min(160, Math.max(82, distance * 0.36))
  const fluidX = -distance * 0.055
  const impactSize = Math.min(132, Math.max(72, fluidHeight * 0.92))

  useEffect(() => {
    const effect = effectRef.current
    const trail = trailRef.current
    const front = frontRef.current
    const impact = impactRef.current
    const impactRing = impactRingRef.current
    const layer = effect?.getLayer()
    if (!effect || !trail || !front || !impact || !impactRing || !fluidImage || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_050)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    effect.position(projectile.from)
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const travelRaw = Math.min(1, raw / 0.64)
      const travel = 1 - Math.pow(1 - travelRaw, 2.7)
      const frontX = distance * travel
      const impactRaw = Math.max(0, Math.min(1, (raw - 0.48) / 0.24))
      const fade = raw < 0.82 ? 1 : Math.max(0, (1 - raw) / 0.18)
      const pulse = Math.sin(elapsed * 0.021)

      trail.clipWidth(Math.max(fluidHeight * 0.14, frontX + fluidHeight * 0.22))
      trail.opacity(Math.min(1, raw / 0.075) * fade * 0.9)
      trail.scaleY(0.94 + pulse * 0.065)
      trail.y(Math.sin(elapsed * 0.013) * fluidHeight * 0.035)

      front.x(frontX)
      front.y(Math.sin(elapsed * 0.016) * fluidHeight * 0.075)
      front.scale({
        x: 0.7 + travelRaw * 0.32 + pulse * 0.045,
        y: 0.82 + travelRaw * 0.22 - pulse * 0.06,
      })
      front.opacity((raw < 0.06 ? raw / 0.06 : 1) * (1 - impactRaw * 0.72) * fade)

      impact.opacity(Math.sin(impactRaw * Math.PI * 0.82) * fade)
      impact.scale({
        x: 0.36 + impactRaw * 0.88,
        y: 0.46 + impactRaw * 0.78,
      })
      impactRing.radius(impactSize * (0.18 + impactRaw * 0.62))
      impactRing.opacity((1 - impactRaw) * 0.78)
      dropletRefs.current.forEach((droplet, index) => {
        if (!droplet) return
        const angle = -1.35 + index * 0.47
        const spread = impactSize * (0.16 + impactRaw * (0.35 + (index % 4) * 0.11))
        droplet.position({
          x: Math.cos(angle) * spread - impactSize * 0.08,
          y: Math.sin(angle) * spread,
        })
        droplet.scaleY(1.2 + impactRaw * 1.1)
        droplet.rotation(angle * 180 / Math.PI)
        droplet.opacity(Math.sin(impactRaw * Math.PI) * (0.72 + (index % 3) * 0.08))
      })
      effect.y(projectile.from.y + Math.sin(elapsed * 0.011) * 1.8)
      if (raw >= 1) animation.stop()
    }, layer)
    effect.opacity(1)
    trail.opacity(0.01)
    front.opacity(0.01)
    impact.opacity(0)
    layer.batchDraw()
    animation.start()
    return () => {
      animation.stop()
    }
  }, [distance, fluidHeight, fluidImage, fluidWidth, impactSize, projectile])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Group
        ref={trailRef}
        clipX={fluidX}
        clipY={-fluidHeight * 0.58}
        clipWidth={0}
        clipHeight={fluidHeight * 1.16}
        listening={false}
      >
        {fluidImage && (
          <KonvaImage
            image={fluidImage}
            x={fluidX}
            y={-fluidHeight / 2}
            width={fluidWidth}
            height={fluidHeight}
            shadowColor={glow}
            shadowBlur={24}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
      {fluidImage ? (
        <Group ref={frontRef} listening={false}>
          <KonvaImage
            image={fluidImage}
            crop={{ x: 760, y: 80, width: 760, height: 870 }}
            x={-impactSize * 0.6}
            y={-impactSize * 0.52}
            width={impactSize * 1.05}
            height={impactSize * 1.04}
            shadowColor={glow}
            shadowBlur={22}
            perfectDrawEnabled={false}
          />
          <Circle
            x={-impactSize * 0.08}
            radius={impactSize * 0.11}
            fill="#d9f99d"
            opacity={0.46}
            shadowColor={accent}
            shadowBlur={14}
            perfectDrawEnabled={false}
          />
        </Group>
      ) : null}
      <Group
        ref={impactRef}
        x={distance}
        listening={false}
      >
        {fluidImage ? (
          <KonvaImage
            image={fluidImage}
            crop={{ x: 690, y: 20, width: 830, height: 970 }}
            x={-impactSize * 0.64}
            y={-impactSize * 0.57}
            width={impactSize * 1.22}
            height={impactSize * 1.14}
            shadowColor={glow}
            shadowBlur={28}
            perfectDrawEnabled={false}
          />
        ) : null}
        <Circle
          ref={impactRingRef}
          radius={impactSize * 0.18}
          stroke="#d9f99d"
          strokeWidth={Math.max(1.5, impactSize * 0.028)}
          shadowColor={glow}
          shadowBlur={15}
          perfectDrawEnabled={false}
        />
        {Array.from({ length: 12 }, (_, index) => (
          <Circle
            key={`acid-impact-droplet:${index}`}
            ref={(node) => { dropletRefs.current[index] = node }}
            radius={Math.max(1.4, impactSize * (0.024 + (index % 3) * 0.008))}
            fill={index % 4 === 0 ? glow : index % 2 === 0 ? '#d9f99d' : '#84cc16'}
            shadowColor={index % 4 === 0 ? glow : accent}
            shadowBlur={7}
            opacity={0}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

function PoisonSprayEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const fluidRef = useRef<Konva.Group>(null)
  const fluidImage = useTokenBadgeImage('/assets/vfx/poison-spray-fluid.png')
  const glow = projectile.glowColor ?? '#86efac'
  const distance = Math.max(
    1,
    Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y),
  )
  const fluidWidth = distance * 1.15
  const fluidHeight = Math.min(190, Math.max(104, distance * 0.5))
  const fluidX = -distance * 0.06

  useEffect(() => {
    const effect = effectRef.current
    const fluid = fluidRef.current
    const layer = effect?.getLayer()
    if (!effect || !fluid || !fluidImage || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_150)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    effect.position(projectile.from)
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const revealRaw = Math.min(1, raw / 0.66)
      const reveal = 1 - Math.pow(1 - revealRaw, 2)
      const fade = raw < 0.8 ? 1 : Math.max(0, (1 - raw) / 0.2)
      fluid.clipWidth(fluidWidth * reveal)
      fluid.opacity(Math.min(1, raw / 0.1) * fade)
      fluid.scaleY(0.94 + Math.sin(elapsed * 0.009) * 0.075)
      fluid.x(Math.sin(elapsed * 0.006) * 2.5)
      effect.y(projectile.from.y + Math.cos(elapsed * 0.008) * 2)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [fluidImage, fluidWidth, projectile])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Group
        ref={fluidRef}
        clipX={fluidX}
        clipY={-fluidHeight * 0.58}
        clipWidth={0}
        clipHeight={fluidHeight * 1.16}
      >
        {fluidImage && (
          <KonvaImage
            image={fluidImage}
            x={fluidX}
            y={-fluidHeight / 2}
            width={fluidWidth}
            height={fluidHeight}
            shadowColor={glow}
            shadowBlur={28}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
    </Group>
  )
}

function ViciousMockeryEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const mouthRef = useRef<Konva.Group>(null)
  const soundRefs = useRef<Array<Konva.Line | null>>([])
  const accent = projectile.accentColor ?? '#d946ef'
  const glow = projectile.glowColor ?? '#e879f9'

  useEffect(() => {
    const effect = effectRef.current
    const mouth = mouthRef.current
    const layer = effect?.getLayer()
    if (!effect || !mouth || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_100)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const appear = Math.min(1, raw / 0.16)
      const fade = raw > 0.8 ? Math.max(0, (1 - raw) / 0.2) : 1
      effect.position({ x: projectile.to.x, y: projectile.to.y - 20 })
      effect.opacity(appear * fade)
      effect.scale({ x: 0.72 + appear * 0.28, y: 0.72 + appear * 0.28 })
      const opening = 0.55 + Math.abs(Math.sin(elapsed * 0.026)) * 0.72
      mouth.scaleY(opening)
      mouth.rotation(Math.sin(elapsed * 0.008) * 5)
      soundRefs.current.forEach((line, index) => {
        if (!line) return
        const wave = (raw * 1.7 + index * 0.24) % 1
        line.x(26 + wave * 24)
        line.scaleX(0.65 + wave * 0.7)
        line.opacity(Math.sin(wave * Math.PI) * 0.8)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y - 20} listening={false}>
      <Circle
        radius={30}
        fill={accent}
        opacity={0.12}
        shadowColor={glow}
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <Group ref={mouthRef}>
        <Line
          points={[-24, 0, -12, -12, 0, -15, 12, -12, 24, 0, 12, 13, 0, 17, -12, 13]}
          closed
          fill="#19051f"
          stroke={accent}
          strokeWidth={3}
          lineJoin="round"
          shadowColor={glow}
          shadowBlur={14}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-16, -2, -8, -7, 0, -8, 8, -7, 16, -2]}
          stroke="#fff1ff"
          strokeWidth={3}
          lineCap="round"
          tension={0.3}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-15, 5, -7, 10, 0, 11, 7, 10, 15, 5]}
          stroke={glow}
          strokeWidth={2.4}
          lineCap="round"
          tension={0.35}
          perfectDrawEnabled={false}
        />
      </Group>
      {Array.from({ length: 3 }, (_, index) => (
        <Line
          key={index}
          ref={(node) => { soundRefs.current[index] = node }}
          x={28 + index * 8}
          y={-9 + index * 9}
          points={[0, 0, 6, -4, 12, 0]}
          stroke={index % 2 === 0 ? accent : glow}
          strokeWidth={2.2}
          lineCap="round"
          lineJoin="round"
          shadowColor={glow}
          shadowBlur={7}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

function AttackTargetEffect({
  effect,
}: {
  effect: CombatPresentationAttackTargetEffect
}) {
  const effectRef = useRef<Konva.Group>(null)
  const symbolRef = useRef<Konva.Group>(null)
  const lockRingRef = useRef<Konva.Circle>(null)
  const palette = DND5E_CLASS_ICON_PALETTES[effect.classId] ??
    DND5E_CLASS_ICON_PALETTES.monster
  const accent = palette?.[0] ?? '#7f1d1d'
  const highlight = palette?.[2] ?? '#fecaca'
  const glow = palette?.[3] ?? '#ef4444'
  const radius = Math.max(18, effect.radiusPx * 0.86)

  useEffect(() => {
    const root = effectRef.current
    const symbol = symbolRef.current
    const layer = root?.getLayer()
    if (!root || !symbol || !layer) return
    const duration = Math.max(1, effect.durationMs)
    const initialElapsed = Math.max(0, Date.now() - effect.issuedAt)
    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const enterRaw = Math.min(1, raw / 0.18)
      const enter = 1 - Math.pow(1 - enterRaw, 3)
      const fade = raw < 0.7 ? 1 : Math.max(0, (1 - raw) / 0.3)
      const impactPulse = Math.sin(Math.min(1, raw / 0.34) * Math.PI)
      root.position({ x: effect.x, y: effect.y })
      root.opacity(Math.min(1, enterRaw * 1.6) * fade)

      if (effect.attackKind === 'melee') {
        const scale = 0.72 + enter * 0.28 + impactPulse * 0.1
        root.scale({ x: scale, y: scale })
        root.rotation(0)
        symbol.position({ x: 0, y: 0 })
      } else {
        const scale = 1.58 - enter * 0.58 + Math.sin(elapsed * 0.024) * 0.025
        root.scale({ x: scale, y: scale })
        root.rotation(0)
        symbol.position({ x: 0, y: 0 })
        lockRingRef.current?.rotation((1 - enter) * 24 + raw * 18)
      }
      return raw
    }

    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      const raw = drawFrame(initialElapsed + (frame?.time ?? 0))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [
    effect.attackKind,
    effect.durationMs,
    effect.issuedAt,
    effect.x,
    effect.y,
  ])

  return (
    <Group
      ref={effectRef}
      x={effect.x}
      y={effect.y}
      listening={false}
    >
      {effect.attackKind === 'melee' ? (
        <Group ref={symbolRef}>
          <Line
            points={[
              -radius * 0.46, radius * 0.62,
              -radius * 0.3, radius * 0.28,
              -radius * 0.36, radius * 0.13,
              -radius * 0.1, -radius * 0.04,
              -radius * 0.14, -radius * 0.19,
              radius * 0.17, -radius * 0.42,
              radius * 0.23, -radius * 0.68,
              radius * 0.37, -radius * 0.8,
              radius * 0.32, -radius * 0.48,
              radius * 0.11, -radius * 0.27,
              radius * 0.15, -radius * 0.13,
              -radius * 0.1, radius * 0.04,
              -radius * 0.06, radius * 0.18,
              -radius * 0.3, radius * 0.36,
              -radius * 0.28, radius * 0.62,
              -radius * 0.4, radius * 0.79,
            ]}
            closed
            fill="#991b1b"
            stroke="#1f0507"
            strokeWidth={Math.max(3.2, radius * 0.13)}
            lineCap="round"
            lineJoin="round"
            shadowColor="#ef4444"
            shadowBlur={radius * 0.42}
            shadowOpacity={0.9}
            perfectDrawEnabled={false}
          />
          <Line
            points={[
              -radius * 0.38, radius * 0.64,
              -radius * 0.25, radius * 0.31,
              -radius * 0.29, radius * 0.17,
              -radius * 0.04, 0,
              -radius * 0.08, -radius * 0.15,
              radius * 0.21, -radius * 0.38,
              radius * 0.3, -radius * 0.7,
            ]}
            stroke="#160305"
            strokeWidth={Math.max(4.8, radius * 0.19)}
            lineCap="round"
            lineJoin="round"
            perfectDrawEnabled={false}
          />
          <Line
            points={[
              -radius * 0.39, radius * 0.61,
              -radius * 0.26, radius * 0.3,
              -radius * 0.3, radius * 0.16,
              -radius * 0.05, -radius * 0.01,
              -radius * 0.09, -radius * 0.16,
              radius * 0.2, -radius * 0.39,
              radius * 0.29, -radius * 0.69,
            ]}
            stroke="#ef4444"
            strokeWidth={Math.max(1.8, radius * 0.065)}
            lineCap="round"
            lineJoin="round"
            opacity={0.9}
            perfectDrawEnabled={false}
          />
          <Line
            x={radius * 0.18}
            y={radius * 0.16}
            points={[
              0, -radius * 0.11,
              radius * 0.1, radius * 0.08,
              radius * 0.03, radius * 0.25,
              -radius * 0.08, radius * 0.09,
            ]}
            closed
            fill="#dc2626"
            stroke="#3f070b"
            strokeWidth={Math.max(1.2, radius * 0.045)}
            lineJoin="round"
            shadowColor="#ef4444"
            shadowBlur={7}
            perfectDrawEnabled={false}
          />
          <Line
            x={-radius * 0.16}
            y={radius * 0.51}
            points={[
              0, -radius * 0.08,
              radius * 0.08, radius * 0.07,
              radius * 0.01, radius * 0.2,
              -radius * 0.07, radius * 0.06,
            ]}
            closed
            fill="#b91c1c"
            stroke="#3f070b"
            strokeWidth={Math.max(1.1, radius * 0.04)}
            lineJoin="round"
            perfectDrawEnabled={false}
          />
          <Circle
            x={radius * 0.4}
            y={radius * 0.38}
            radius={Math.max(1.8, radius * 0.07)}
            fill="#ef4444"
            shadowColor="#ef4444"
            shadowBlur={6}
            perfectDrawEnabled={false}
          />
        </Group>
      ) : (
        <Group ref={symbolRef}>
          <Circle
            radius={radius * 0.96}
            fill={accent}
            opacity={0.11}
            shadowColor={glow}
            shadowBlur={radius * 0.75}
            perfectDrawEnabled={false}
          />
          <Circle
            ref={lockRingRef}
            radius={radius * 0.72}
            stroke={glow}
            strokeWidth={Math.max(2.2, radius * 0.09)}
            dash={[radius * 0.34, radius * 0.18]}
            shadowColor={glow}
            shadowBlur={13}
            perfectDrawEnabled={false}
          />
          <Circle
            radius={radius * 0.48}
            stroke={highlight}
            strokeWidth={Math.max(1.4, radius * 0.055)}
            opacity={0.9}
            perfectDrawEnabled={false}
          />
          {[0, 90, 180, 270].map((rotation) => (
            <Line
              key={rotation}
              rotation={rotation}
              points={[radius * 0.48, 0, radius * 0.91, 0]}
              stroke={glow}
              strokeWidth={Math.max(2.2, radius * 0.085)}
              lineCap="round"
              shadowColor={accent}
              shadowBlur={9}
              perfectDrawEnabled={false}
            />
          ))}
          <Circle
            radius={Math.max(2.8, radius * 0.1)}
            fill={highlight}
            stroke={accent}
            strokeWidth={1.5}
            shadowColor={glow}
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        </Group>
      )}
    </Group>
  )
}

function CombatProjectileEffect({
  projectile,
}: {
  projectile: MapProjectile
}) {
  return projectile.kind === 'fireball'
    ? <FireballProjectile projectile={projectile} />
    : projectile.kind === 'fire-bolt'
      ? <FireBoltProjectile projectile={projectile} />
      : projectile.kind === 'ray-of-frost'
        ? <RayOfFrostProjectile projectile={projectile} />
        : projectile.kind === 'eldritch-blast'
          ? <EldritchBlastProjectile projectile={projectile} />
          : projectile.kind === 'produce-flame'
            ? <ProduceFlameProjectile projectile={projectile} />
            : projectile.kind === 'shocking-grasp'
              ? <ShockingGraspEffect projectile={projectile} />
              : projectile.kind === 'guidance'
                ? <GuidanceManifestation projectile={projectile} />
                : projectile.kind === 'resistance'
                  ? <ResistanceManifestation projectile={projectile} />
                  : projectile.kind === 'sanctuary'
                    ? <SanctuaryManifestation projectile={projectile} />
                    : projectile.kind === 'bless' ||
                        projectile.kind === 'bane' ||
                        projectile.kind === 'shield-of-faith' ||
                        projectile.kind === 'mage-armor' ||
                        projectile.kind === 'jump' ||
                        projectile.kind === 'darkvision' ||
                        projectile.kind === 'see-invisibility' ||
                        projectile.kind === 'warding-bond' ||
                        projectile.kind === 'fly' ||
                        projectile.kind === 'heroism' ||
                        projectile.kind === 'enlarge-reduce' ||
                        projectile.kind === 'enhance-ability' ||
                        projectile.kind === 'divine-favor' ||
                        projectile.kind === 'hunters-mark' ||
                        projectile.kind === 'magic-weapon' ||
                        projectile.kind === 'flame-blade' ||
                        projectile.kind === 'invisibility' ||
                        projectile.kind === 'blur' ||
                        projectile.kind === 'barkskin' ||
                        projectile.kind === 'protection-from-poison' ||
                        projectile.kind === 'longstrider' ||
                        projectile.kind === 'protection-from-energy' ||
                        projectile.kind === 'death-ward' ||
                        projectile.kind === 'greater-invisibility' ||
                        projectile.kind === 'charm-person' ||
                        projectile.kind === 'hideous-laughter' ||
                        projectile.kind === 'hold-person' ||
                        projectile.kind === 'blindness-deafness'
                      ? <StatusSpellManifestation projectile={projectile} />
                      : projectile.kind === 'sacred-flame'
                        ? <SacredFlameEffect projectile={projectile} />
                        : projectile.kind === 'spare-the-dying'
                          ? <SpareTheDyingEffect projectile={projectile} />
                          : projectile.kind === 'acid-splash'
                            ? <AcidSplashEffect projectile={projectile} />
                            : projectile.kind === 'poison-spray'
                              ? <PoisonSprayEffect projectile={projectile} />
                              : projectile.kind === 'vicious-mockery'
                                ? <ViciousMockeryEffect projectile={projectile} />
                                : projectile.kind === 'magic-missile'
                                  ? <MagicMissileProjectile projectile={projectile} />
                                  : projectile.kind === 'scorching-ray' ||
                                    projectile.kind === 'guiding-bolt' ||
                                    projectile.kind === 'acid-arrow' ||
                                    projectile.kind === 'healing-word' ||
                                    projectile.kind === 'inflict-wounds'
                                  ? <MaterialSpellProjectile projectile={projectile} />
                                  : projectile.kind === 'cure-wounds' ||
                                      projectile.kind === 'hellish-rebuke'
                                    ? <MaterialTargetSpellEffect projectile={projectile} />
                                    : projectile.kind === 'burning-hands' ||
                                        projectile.kind === 'thunderwave' ||
                                        projectile.kind === 'shatter' ||
                                        projectile.kind === 'lightning-bolt'
                                      ? <MaterialAreaSpellEffect
                                          projectile={projectile}
                                        />
                                      : projectile.kind === 'chill-touch'
                                        ? <ChillTouchManifestation projectile={projectile} />
                                        : <ProjectileArrow projectile={projectile} />
}

function DirectionalTextureEffect({
  projectile,
  image,
  heightRatio,
  minHeight,
  maxHeight,
  revealEnd = 0.58,
  fadeStart = 0.72,
  shadowColor,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  heightRatio: number
  minHeight: number
  maxHeight: number
  revealEnd?: number
  fadeStart?: number
  shadowColor: string
}) {
  const effectRef = useRef<Konva.Group>(null)
  const fluidRef = useRef<Konva.Group>(null)
  const dx = projectile.to.x - projectile.from.x
  const dy = projectile.to.y - projectile.from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const width = distance * 1.14
  const height = Math.min(maxHeight, Math.max(minHeight, distance * heightRatio))
  const imageX = -distance * 0.055

  useEffect(() => {
    const effect = effectRef.current
    const fluid = fluidRef.current
    const layer = effect?.getLayer()
    if (!effect || !fluid || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const revealRaw = Math.min(1, raw / revealEnd)
      const reveal = 1 - Math.pow(1 - revealRaw, 2.35)
      const fade = raw < fadeStart ? 1 : Math.max(0, (1 - raw) / (1 - fadeStart))
      fluid.clipWidth(width * reveal)
      fluid.opacity(Math.min(1, raw / 0.07) * fade)
      fluid.scaleY(0.96 + Math.sin(elapsed * 0.018) * 0.05)
      return raw
    }
    // Draw the event's current frame synchronously. Remote events can arrive
    // partway through their lifetime, and waiting for the first RAF would
    // otherwise leave a blank frame (or the whole effect blank during rapid
    // presentation-state refreshes).
    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      const raw = drawFrame(initialElapsed + (frame?.time ?? 0))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [
    dx,
    dy,
    fadeStart,
    projectile.durationMs,
    projectile.issuedAt,
    revealEnd,
    width,
  ])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Group
        ref={fluidRef}
        clipX={imageX}
        clipY={-height * 0.58}
        clipHeight={height * 1.16}
      >
        <KonvaImage
          image={image}
          x={imageX}
          y={-height / 2}
          width={width}
          height={height}
          shadowColor={shadowColor}
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
      </Group>
    </Group>
  )
}

function MagicMissileProjectile({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const missileRef = useRef<Konva.Group>(null)
  const trailGlowRef = useRef<Konva.Line>(null)
  const trailRef = useRef<Konva.Line>(null)
  const spiralTrailRefs = useRef<Array<Konva.Line | null>>([])
  const launchRef = useRef<Konva.Circle>(null)
  const launchSigilRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const impactSigilRef = useRef<Konva.Group>(null)
  const ribbonRefs = useRef<Array<Konva.Line | null>>([])
  const auraRefs = useRef<Array<Konva.Circle | null>>([])
  const wispRefs = useRef<Array<Konva.Circle | null>>([])
  const sparkRefs = useRef<Array<Konva.Circle | null>>([])
  const image = useTokenBadgeImage('/assets/vfx/magic-missile-fluid.png')
  const dx = projectile.to.x - projectile.from.x
  const dy = projectile.to.y - projectile.from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const sequenceMatch = projectile.id.match(/:(\d+)$/)
  const sequenceIndex = sequenceMatch ? Number(sequenceMatch[1]) : 0
  const curveDirection = sequenceIndex % 2 === 0 ? -1 : 1
  const curveStrength = Math.min(
    54,
    Math.max(18, distance * (0.09 + (sequenceIndex % 3) * 0.022)),
  ) * curveDirection
  const normalX = -dy / distance
  const normalY = dx / distance
  const control = {
    x: (projectile.from.x + projectile.to.x) / 2 + normalX * curveStrength,
    y: (projectile.from.y + projectile.to.y) / 2 + normalY * curveStrength,
  }
  const missileWidth = Math.min(44, Math.max(30, distance * 0.105))
  const missileHeight = missileWidth * 0.56

  useEffect(() => {
    const effect = effectRef.current
    const missile = missileRef.current
    const trailGlow = trailGlowRef.current
    const trail = trailRef.current
    const launch = launchRef.current
    const launchSigil = launchSigilRef.current
    const impact = impactRef.current
    const impactRing = impactRingRef.current
    const impactSigil = impactSigilRef.current
    const layer = effect?.getLayer()
    if (
      !effect || !missile || !trailGlow || !trail || !launch || !launchSigil ||
      !impact || !impactRing || !impactSigil || !image || !layer
    ) return
    const duration = Math.max(1, projectile.durationMs ?? 300)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const pointAt = (time: number) => {
      const inverse = 1 - time
      return {
        x: inverse * inverse * projectile.from.x +
          2 * inverse * time * control.x +
          time * time * projectile.to.x,
        y: inverse * inverse * projectile.from.y +
          2 * inverse * time * control.y +
          time * time * projectile.to.y,
      }
    }
    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const travelRaw = Math.min(1, raw / 0.72)
      const travel = 1 - Math.pow(1 - travelRaw, 2.15)
      const impactRaw = Math.max(0, Math.min(1, (raw - 0.66) / 0.24))
      const point = pointAt(travel)
      const tangentTime = Math.min(1, travel + 0.018)
      const tangent = pointAt(tangentTime)
      missile.position(point)
      missile.rotation(Math.atan2(tangent.y - point.y, tangent.x - point.x) * 180 / Math.PI)
      missile.scale({
        x: 0.82 + Math.sin(elapsed * 0.035) * 0.08,
        y: 0.88 + Math.cos(elapsed * 0.031) * 0.07,
      })
      missile.opacity((raw < 0.045 ? raw / 0.045 : 1) * (1 - impactRaw))

      const trailStart = Math.max(0, travel - 0.115)
      const trailPoints: number[] = []
      for (let index = 0; index < 9; index += 1) {
        const sample = pointAt(trailStart + (travel - trailStart) * index / 8)
        trailPoints.push(sample.x, sample.y)
      }
      trailGlow.points(trailPoints)
      trailGlow.opacity(Math.min(0.5, travelRaw * 2.4) * (1 - impactRaw))
      trail.points(trailPoints)
      trail.opacity(Math.min(0.9, travelRaw * 3.5) * (1 - impactRaw * 0.72))
      trail.dashOffset(-elapsed * 0.17)
      spiralTrailRefs.current.forEach((spiral, spiralIndex) => {
        if (!spiral) return
        const spiralPoints: number[] = []
        for (let index = 0; index < 13; index += 1) {
          const sampleTime = trailStart + (travel - trailStart) * index / 12
          const sample = pointAt(sampleTime)
          const next = pointAt(Math.min(1, sampleTime + 0.012))
          const tangentLength = Math.max(0.001, Math.hypot(next.x - sample.x, next.y - sample.y))
          const sampleNormal = {
            x: -(next.y - sample.y) / tangentLength,
            y: (next.x - sample.x) / tangentLength,
          }
          const phase = elapsed * 0.055 + index * 0.92 + spiralIndex * Math.PI
          const orbit = Math.sin(phase) * missileHeight * 0.34
          spiralPoints.push(
            sample.x + sampleNormal.x * orbit,
            sample.y + sampleNormal.y * orbit,
          )
        }
        spiral.points(spiralPoints)
        spiral.opacity(Math.min(0.76, travelRaw * 2.8) * (1 - impactRaw))
        spiral.dashOffset((spiralIndex === 0 ? -1 : 1) * elapsed * 0.09)
      })
      launch.radius(missileWidth * (0.14 + travelRaw * 0.36))
      launch.opacity(Math.max(0, 1 - travelRaw * 1.5) * 0.88)
      launchSigil.rotation(sequenceIndex * 29 + elapsed * 0.32)
      launchSigil.scale({
        x: 0.72 + travelRaw * 0.5,
        y: 0.72 + travelRaw * 0.5,
      })
      launchSigil.opacity(Math.max(0, 1 - travelRaw * 1.7) * 0.82)

      ribbonRefs.current.forEach((ribbon, index) => {
        if (!ribbon) return
        const phase = elapsed * (0.058 + index * 0.004) + index * Math.PI / 2
        const spread = 0.24 + index * 0.035
        ribbon.points([
          -missileWidth * 0.42, Math.sin(phase) * missileHeight * spread,
          -missileWidth * 0.18, Math.sin(phase + 1.25) * missileHeight * (spread + 0.13),
          missileWidth * 0.08, Math.sin(phase + 2.5) * missileHeight * (spread + 0.08),
          missileWidth * 0.34, Math.sin(phase + 3.75) * missileHeight * 0.18,
        ])
        ribbon.opacity((0.7 - index * 0.065) * (1 - impactRaw))
      })
      auraRefs.current.forEach((aura, index) => {
        if (!aura) return
        const phase = elapsed * (0.045 + index * 0.002) + index * 1.47
        aura.position({
          x: -missileWidth * 0.05 + Math.cos(phase) * missileWidth * (0.24 + (index % 2) * 0.06),
          y: Math.sin(phase) * missileHeight * (0.4 + (index % 3) * 0.08),
        })
        aura.radius(Math.max(0.8, missileHeight * (0.045 + (index % 2) * 0.02)))
        aura.opacity((0.48 + Math.sin(phase) * 0.28) * (1 - impactRaw))
      })
      wispRefs.current.forEach((wisp, index) => {
        if (!wisp) return
        const lag = 0.012 + index * 0.009
        const sampleTime = Math.max(0, travel - lag)
        const sample = pointAt(sampleTime)
        const next = pointAt(Math.min(1, sampleTime + 0.012))
        const tangentLength = Math.max(0.001, Math.hypot(next.x - sample.x, next.y - sample.y))
        const sampleNormal = {
          x: -(next.y - sample.y) / tangentLength,
          y: (next.x - sample.x) / tangentLength,
        }
        const phase = elapsed * 0.052 + index * 1.26
        const orbit = Math.sin(phase) * missileHeight * (0.44 + (index % 3) * 0.15)
        wisp.position({
          x: sample.x + sampleNormal.x * orbit,
          y: sample.y + sampleNormal.y * orbit,
        })
        wisp.radius(Math.max(0.75, missileHeight * (0.035 + (index % 3) * 0.014)))
        wisp.opacity(
          Math.max(0, Math.min(1, travelRaw * 5 - index * 0.08)) *
          (0.42 + Math.cos(phase) * 0.28) *
          (1 - impactRaw),
        )
      })

      impact.opacity(Math.sin(impactRaw * Math.PI) * 0.95)
      impactRing.radius(missileWidth * (0.15 + impactRaw * 0.68))
      impactRing.opacity((1 - impactRaw) * 0.86)
      impactSigil.rotation(elapsed * -0.38 + sequenceIndex * 17)
      impactSigil.scale({
        x: 0.42 + impactRaw * 0.76,
        y: 0.42 + impactRaw * 0.76,
      })
      impactSigil.opacity(Math.sin(impactRaw * Math.PI) * 0.78)
      sparkRefs.current.forEach((spark, index) => {
        if (!spark) return
        const angle = index * Math.PI / 3 + sequenceIndex * 0.31
        const spread = missileWidth * impactRaw * (0.46 + (index % 2) * 0.22)
        spark.position({
          x: Math.cos(angle) * spread,
          y: Math.sin(angle) * spread,
        })
        spark.opacity(Math.sin(impactRaw * Math.PI) * 0.9)
      })
      effect.opacity(raw < 0.94 ? 1 : Math.max(0, (1 - raw) / 0.06))
      return raw
    }
    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      if (drawFrame(initialElapsed + (frame?.time ?? 0)) >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [
    control.x,
    control.y,
    image,
    missileHeight,
    missileWidth,
    projectile.durationMs,
    projectile.from.x,
    projectile.from.y,
    projectile.issuedAt,
    projectile.to.x,
    projectile.to.y,
    sequenceIndex,
  ])

  return (
    <Group ref={effectRef} listening={false}>
      <Circle
        ref={launchRef}
        x={projectile.from.x}
        y={projectile.from.y}
        radius={missileWidth * 0.14}
        stroke="#ede9fe"
        strokeWidth={Math.max(1.2, missileHeight * 0.08)}
        shadowColor="#8b5cf6"
        shadowBlur={15}
        perfectDrawEnabled={false}
        listening={false}
      />
      <Group
        ref={launchSigilRef}
        x={projectile.from.x}
        y={projectile.from.y}
        listening={false}
      >
        <Circle
          radius={missileWidth * 0.42}
          stroke="#67e8f9"
          strokeWidth={Math.max(0.8, missileHeight * 0.045)}
          dash={[missileWidth * 0.12, missileWidth * 0.08]}
          shadowColor="#8b5cf6"
          shadowBlur={10}
          perfectDrawEnabled={false}
        />
        <Line
          points={[
            0, -missileWidth * 0.32,
            missileWidth * 0.25, 0,
            0, missileWidth * 0.32,
            -missileWidth * 0.25, 0,
          ]}
          closed
          stroke="#c4b5fd"
          strokeWidth={Math.max(0.7, missileHeight * 0.04)}
          perfectDrawEnabled={false}
        />
      </Group>
      <Line
        ref={trailGlowRef}
        points={[projectile.from.x, projectile.from.y]}
        stroke="#38bdf8"
        strokeWidth={Math.max(5, missileHeight * 0.38)}
        lineCap="round"
        lineJoin="round"
        tension={0.46}
        shadowColor="#c084fc"
        shadowBlur={20}
        opacity={0}
        perfectDrawEnabled={false}
        listening={false}
      />
      <Line
        ref={trailRef}
        points={[projectile.from.x, projectile.from.y]}
        stroke="#f0abfc"
        strokeWidth={Math.max(2.2, missileHeight * 0.15)}
        lineCap="round"
        lineJoin="round"
        tension={0.46}
        dash={[missileWidth * 0.28, missileWidth * 0.12]}
        shadowColor="#8b5cf6"
        shadowBlur={13}
        perfectDrawEnabled={false}
        listening={false}
      />
      {[0, 1].map((index) => (
        <Line
          key={`magic-missile-spiral-trail:${index}`}
          ref={(node) => { spiralTrailRefs.current[index] = node }}
          points={[projectile.from.x, projectile.from.y]}
          stroke={index === 0 ? '#67e8f9' : '#f0abfc'}
          strokeWidth={Math.max(0.9, missileHeight * 0.065)}
          lineCap="round"
          lineJoin="round"
          tension={0.5}
          dash={[missileWidth * 0.14, missileWidth * 0.09]}
          shadowColor={index === 0 ? '#22d3ee' : '#8b5cf6'}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <Circle
          key={`magic-missile-wisp:${index}`}
          ref={(node) => { wispRefs.current[index] = node }}
          radius={1}
          fill={index % 3 === 0 ? '#ffffff' : index % 3 === 1 ? '#67e8f9' : '#c4b5fd'}
          shadowColor={index % 2 === 0 ? '#8b5cf6' : '#22d3ee'}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      <Group ref={missileRef} listening={false}>
      {[0, 1, 2, 3].map((index) => (
        <Line
            key={`magic-missile-ribbon:${index}`}
            ref={(node) => { ribbonRefs.current[index] = node }}
            points={[-missileWidth * 0.42, 0, missileWidth * 0.34, 0]}
            stroke={['#67e8f9', '#f0abfc', '#fde68a', '#a5b4fc'][index]}
            strokeWidth={Math.max(0.8, missileHeight * (0.048 + (index % 2) * 0.012))}
            lineCap="round"
            lineJoin="round"
            tension={0.58}
            shadowColor={['#22d3ee', '#ec4899', '#f59e0b', '#8b5cf6'][index]}
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        ))}
        {image ? (
          <KonvaImage
            image={image}
            x={-missileWidth * 0.58}
            y={-missileHeight / 2}
            width={missileWidth}
            height={missileHeight}
            shadowColor="#a78bfa"
            shadowBlur={16}
            perfectDrawEnabled={false}
          />
        ) : null}
        <Line
          points={[
            missileWidth * 0.05, -missileHeight * 0.18,
            missileWidth * 0.48, 0,
            missileWidth * 0.05, missileHeight * 0.18,
            -missileWidth * 0.08, 0,
          ]}
          closed
          tension={0.18}
          fill="#ffffff"
          stroke="#ede9fe"
          strokeWidth={Math.max(0.8, missileHeight * 0.055)}
          lineJoin="round"
          shadowColor="#ddd6fe"
          shadowBlur={12}
          perfectDrawEnabled={false}
        />
        {Array.from({ length: 10 }, (_, index) => (
          <Circle
            key={`magic-missile-aura:${index}`}
            ref={(node) => { auraRefs.current[index] = node }}
            radius={1}
            fill={['#ffffff', '#67e8f9', '#f0abfc', '#fde68a', '#a5b4fc'][index % 5]}
            shadowColor={['#22d3ee', '#ec4899', '#f59e0b', '#8b5cf6'][index % 4]}
            shadowBlur={9}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
      <Group ref={impactRef} x={projectile.to.x} y={projectile.to.y} opacity={0} listening={false}>
        <Circle
          ref={impactRingRef}
          radius={missileWidth * 0.15}
          stroke="#ede9fe"
          strokeWidth={Math.max(1.4, missileHeight * 0.09)}
          shadowColor="#8b5cf6"
          shadowBlur={14}
          perfectDrawEnabled={false}
        />
        <Group ref={impactSigilRef} listening={false}>
          <Circle
            radius={missileWidth * 0.43}
            stroke="#67e8f9"
            strokeWidth={Math.max(0.8, missileHeight * 0.045)}
            dash={[missileWidth * 0.09, missileWidth * 0.07]}
            perfectDrawEnabled={false}
          />
          <Line
            points={[
              0, -missileWidth * 0.34,
              missileWidth * 0.24, 0,
              0, missileWidth * 0.34,
              -missileWidth * 0.24, 0,
            ]}
            closed
            stroke="#c4b5fd"
            strokeWidth={Math.max(0.8, missileHeight * 0.05)}
            shadowColor="#8b5cf6"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
        </Group>
        {Array.from({ length: 6 }, (_, index) => (
          <Circle
            key={`magic-missile-impact:${index}`}
            ref={(node) => { sparkRefs.current[index] = node }}
            radius={Math.max(1.1, missileHeight * (0.07 + (index % 2) * 0.025))}
            fill={index % 2 === 0 ? '#ffffff' : '#c4b5fd'}
            shadowColor="#8b5cf6"
            shadowBlur={7}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

function MaterialSpellProjectile({ projectile }: { projectile: MapProjectile }) {
  const config = projectile.kind === 'scorching-ray'
      ? {
          asset: '/assets/vfx/scorching-ray-fluid.png',
          heightRatio: 0.3,
          minHeight: 70,
          maxHeight: 132,
          revealEnd: 0.4,
          fadeStart: 0.7,
          shadowColor: '#f97316',
        }
      : projectile.kind === 'guiding-bolt'
        ? {
            asset: '/assets/vfx/guiding-bolt-fluid.png',
            heightRatio: 0.31,
            minHeight: 72,
            maxHeight: 136,
            revealEnd: 0.44,
            fadeStart: 0.72,
            shadowColor: '#facc15',
          }
        : projectile.kind === 'healing-word'
          ? {
              asset: '/assets/vfx/healing-word-fluid.png',
              heightRatio: 0.26,
              minHeight: 62,
              maxHeight: 116,
              revealEnd: 0.46,
              fadeStart: 0.72,
              shadowColor: '#fde68a',
            }
          : projectile.kind === 'inflict-wounds'
            ? {
                asset: '/assets/vfx/inflict-wounds-fluid.png',
                heightRatio: 0.34,
                minHeight: 76,
                maxHeight: 144,
                revealEnd: 0.42,
                fadeStart: 0.7,
                shadowColor: '#7c3aed',
              }
        : {
            asset: '/assets/vfx/acid-arrow-fluid.png',
            heightRatio: 0.3,
            minHeight: 70,
            maxHeight: 134,
            revealEnd: 0.45,
            fadeStart: 0.7,
            shadowColor: '#84cc16',
          }
  const image = useTokenBadgeImage(config.asset)
  if (!image) return null
  return (
    <DirectionalTextureEffect
      projectile={projectile}
      image={image}
      heightRatio={config.heightRatio}
      minHeight={config.minHeight}
      maxHeight={config.maxHeight}
      revealEnd={config.revealEnd}
      fadeStart={config.fadeStart}
      shadowColor={config.shadowColor}
    />
  )
}

function MovingFireTextureEffect({
  projectile,
  fireImage,
  explosionImage,
  spriteSize,
  impactDiameter,
  arcHeight = 0,
}: {
  projectile: MapProjectile
  fireImage: HTMLImageElement
  explosionImage?: HTMLImageElement
  spriteSize: number
  impactDiameter: number
  arcHeight?: number
}) {
  const projectileRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)

  useEffect(() => {
    const sprite = projectileRef.current
    const impact = impactRef.current
    const layer = sprite?.getLayer()
    if (!sprite || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    sprite.rotation(Math.atan2(dy, dx) * 180 / Math.PI)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const travelEnd = 0.7
      const travelRaw = Math.min(1, raw / travelEnd)
      const travel = 1 - Math.pow(1 - travelRaw, 2.1)
      sprite.position({
        x: projectile.from.x + dx * travel,
        y: projectile.from.y + dy * travel - Math.sin(travel * Math.PI) * arcHeight,
      })
      sprite.opacity(raw < 0.05 ? raw / 0.05 : raw < travelEnd ? 1 : 0)
      sprite.scale({
        x: 0.86 + Math.sin(elapsed * 0.045) * 0.08,
        y: 0.9 + Math.cos(elapsed * 0.052) * 0.09,
      })
      const impactRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
      if (impact) {
        impact.visible(impactRaw > 0 && !!explosionImage)
        impact.opacity(Math.sin(impactRaw * Math.PI))
        impact.scale({
          x: 0.22 + impactRaw * 0.95,
          y: 0.22 + impactRaw * 0.95,
        })
        impact.rotation(impactRaw * 28)
      }
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [arcHeight, explosionImage, projectile])

  return (
    <>
      <Group ref={projectileRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
        <KonvaImage
          image={fireImage}
          x={-spriteSize * 0.86}
          y={-spriteSize * 0.32}
          width={spriteSize}
          height={spriteSize * 0.64}
          shadowColor="#f97316"
          shadowBlur={20}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        {explosionImage && (
          <KonvaImage
            image={explosionImage}
            x={-impactDiameter / 2}
            y={-impactDiameter / 2}
            width={impactDiameter}
            height={impactDiameter}
            shadowColor="#ef4444"
            shadowBlur={28}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
    </>
  )
}

function TargetTextureManifestation({
  projectile,
  image,
  width,
  height,
  y,
  shadowColor,
  descend = 0,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  width: number
  height: number
  y: number
  shadowColor: string
  descend?: number
}) {
  const effectRef = useRef<Konva.Group>(null)
  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrive = 1 - Math.pow(1 - Math.min(1, raw / 0.38), 3)
      const fade = raw < 0.76 ? 1 : Math.max(0, (1 - raw) / 0.24)
      effect.y(projectile.to.y + y - descend * (1 - arrive))
      effect.opacity(Math.min(1, raw / 0.08) * fade)
      effect.scale({
        x: 0.55 + arrive * 0.45,
        y: 0.55 + arrive * 0.45,
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [descend, projectile, y])
  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y + y - descend} listening={false}>
      <KonvaImage
        image={image}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        shadowColor={shadowColor}
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

function MaterialTargetSpellEffect({ projectile }: { projectile: MapProjectile }) {
  const isCureWounds = projectile.kind === 'cure-wounds'
  const image = useTokenBadgeImage(isCureWounds
    ? '/assets/vfx/cure-wounds-fluid.png'
    : '/assets/vfx/hellish-rebuke-fluid.png')
  if (!image) return null
  const radius = Math.max(24, projectile.radiusPx ?? 42)
  return (
    <TargetTextureManifestation
      projectile={projectile}
      image={image}
      width={radius * (isCureWounds ? 3.15 : 3.5)}
      height={radius * (isCureWounds ? 3.15 : 3.5)}
      y={0}
      descend={isCureWounds ? radius * 0.45 : radius * 0.8}
      shadowColor={isCureWounds ? '#4ade80' : '#ef4444'}
    />
  )
}

function ThunderwaveMaterialEffect({
  projectile,
  image,
  distance,
  areaWidth,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
  distance: number
  areaWidth: number
}) {
  const effectRef = useRef<Konva.Group>(null)
  const trailRef = useRef<Konva.Group>(null)
  const frontRef = useRef<Konva.Group>(null)
  const bandRefs = useRef<Array<Konva.Group | null>>([])
  const debrisRefs = useRef<Array<Konva.Line | null>>([])

  useEffect(() => {
    const effect = effectRef.current
    const trail = trailRef.current
    const front = frontRef.current
    const layer = effect?.getLayer()
    if (!effect || !trail || !front || !layer) return
    const duration = Math.max(
      1,
      projectile.durationMs ?? THUNDERWAVE_ANIMATION_DURATION_MS,
    )
    const initialElapsed = Math.max(
      0,
      Date.now() - (projectile.issuedAt ?? Date.now()),
    )
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const travelRaw = Math.min(1, raw / 0.76)
      const travel = 1 - Math.pow(1 - travelRaw, 3)
      const frontX = distance * travel
      const fade = raw < 0.82 ? 1 : Math.max(0, (1 - raw) / 0.18)
      effect.opacity(fade)
      trail.clipWidth(Math.max(areaWidth * 0.08, frontX + areaWidth * 0.18))
      trail.opacity(0.26 + Math.sin(elapsed * 0.021) * 0.06)
      front.x(frontX)
      front.scaleX(0.78 + Math.sin(elapsed * 0.025) * 0.08)
      front.scaleY(0.94 + Math.sin(elapsed * 0.019) * 0.07)
      front.opacity(raw < 0.08 ? raw / 0.08 : fade)
      bandRefs.current.forEach((band, index) => {
        if (!band) return
        const delay = index * 0.075
        const bandRaw = Math.max(0, Math.min(1, (travelRaw - delay) / Math.max(0.01, 1 - delay)))
        band.x(distance * (1 - Math.pow(1 - bandRaw, 2.6)))
        band.opacity(Math.sin(bandRaw * Math.PI) * (0.58 - index * 0.09))
        band.scaleX(0.7 + bandRaw * 0.45)
      })
      debrisRefs.current.forEach((debris, index) => {
        if (!debris) return
        const lag = areaWidth * (0.2 + (index % 4) * 0.12)
        debris.x(Math.max(0, frontX - lag))
        debris.y(Math.sin(elapsed * (0.009 + index * 0.0017) + index) * areaWidth * 0.34)
        debris.rotation(-22 + index * 17 + raw * 160)
        debris.opacity(Math.min(0.9, travelRaw * 2.5) * fade)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    // Remote events can arrive halfway through their lifetime. Keep the
    // material fully visible before the first animation frame is requested.
    effect.opacity(1)
    layer.batchDraw()
    animation.start()
    return () => {
      animation.stop()
    }
  }, [areaWidth, distance, projectile.durationMs, projectile.issuedAt])

  return (
    <Group
      ref={effectRef}
      x={projectile.from.x}
      y={projectile.from.y}
      rotation={Math.atan2(
        projectile.to.y - projectile.from.y,
        projectile.to.x - projectile.from.x,
      ) * 180 / Math.PI}
      listening={false}
    >
      <Group
        ref={trailRef}
        clip={{ x: -areaWidth * 0.08, y: -areaWidth * 0.55, width: areaWidth * 0.08, height: areaWidth * 1.1 }}
        listening={false}
      >
        <KonvaImage
          image={image}
          x={-distance * 0.055}
          y={-areaWidth * 0.5}
          width={distance * 1.14}
          height={areaWidth}
          opacity={0.82}
          shadowColor="#38bdf8"
          shadowBlur={20}
          perfectDrawEnabled={false}
        />
      </Group>
      {[0, 1, 2].map((index) => (
        <Group
          key={`thunderwave-band:${index}`}
          ref={(node) => { bandRefs.current[index] = node }}
          opacity={0}
          listening={false}
        >
          <Line
            points={[
              0, -areaWidth * (0.48 - index * 0.04),
              areaWidth * (0.1 + index * 0.025), -areaWidth * 0.24,
              -areaWidth * (0.045 + index * 0.015), 0,
              areaWidth * (0.1 + index * 0.025), areaWidth * 0.24,
              0, areaWidth * (0.48 - index * 0.04),
            ]}
            stroke={index === 0 ? '#e0f2fe' : '#7dd3fc'}
            strokeWidth={Math.max(2, areaWidth * (0.045 - index * 0.008))}
            lineCap="round"
            lineJoin="round"
            shadowColor="#38bdf8"
            shadowBlur={14 - index * 2}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <Line
          key={`thunderwave-air-streak:${index}`}
          ref={(node) => { debrisRefs.current[index] = node }}
          points={[
            -areaWidth * (0.11 + (index % 3) * 0.018), areaWidth * 0.025,
            -areaWidth * 0.035, -areaWidth * (0.035 + (index % 2) * 0.018),
            areaWidth * 0.045, areaWidth * 0.018,
            areaWidth * (0.1 + (index % 2) * 0.025), -areaWidth * 0.012,
          ]}
          tension={0.58}
          stroke={index % 3 === 0 ? '#ffffff' : index % 3 === 1 ? '#bae6fd' : '#7dd3fc'}
          strokeWidth={Math.max(1, areaWidth * (0.014 + (index % 2) * 0.006))}
          lineCap="round"
          lineJoin="round"
          dash={index % 2 === 0 ? [areaWidth * 0.055, areaWidth * 0.04] : undefined}
          shadowColor="#38bdf8"
          shadowBlur={5}
          opacity={0}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      <Group ref={frontRef} listening={false}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => (
          <Circle
            key={`thunderwave-dust:${index}`}
            x={-areaWidth * (0.08 + (index % 4) * 0.075)}
            y={areaWidth * (-0.42 + (index % 6) * 0.16)}
            radius={Math.max(0.8, areaWidth * (0.012 + (index % 3) * 0.005))}
            fill={index % 2 === 0 ? '#e0f2fe' : '#7dd3fc'}
            opacity={0.42 + (index % 3) * 0.14}
            shadowColor="#38bdf8"
            shadowBlur={4}
            perfectDrawEnabled={false}
          />
        ))}
        {[0, 1, 2].map((index) => {
          const offset = -areaWidth * index * 0.075
          return (
          <Line
            key={`thunderwave-front:${index}`}
            points={[
              offset - areaWidth * 0.02, -areaWidth * 0.5,
              offset + areaWidth * 0.09, -areaWidth * 0.36,
              offset - areaWidth * 0.045, -areaWidth * 0.2,
              offset + areaWidth * 0.1, 0,
              offset - areaWidth * 0.045, areaWidth * 0.2,
              offset + areaWidth * 0.09, areaWidth * 0.36,
              offset - areaWidth * 0.02, areaWidth * 0.5,
            ]}
            stroke={index === 0 ? '#ffffff' : index === 1 ? '#bae6fd' : '#38bdf8'}
            strokeWidth={Math.max(1.6, areaWidth * (0.04 - index * 0.008))}
            lineCap="round"
            lineJoin="round"
            tension={0.34}
            opacity={0.96 - index * 0.18}
            shadowColor={index === 0 ? '#e0f2fe' : '#38bdf8'}
            shadowBlur={18 - index * 3}
            perfectDrawEnabled={false}
          />
          )
        })}
      </Group>
    </Group>
  )
}

interface BurningHandsSparkSpec {
  start: number
  speed: number
  vertical: number
  drift: number
  radius: number
  warm: boolean
}

interface BurningHandsSmokeSpec {
  start: number
  x: number
  y: number
  drift: number
  radius: number
}

function BurningHandsSpriteEffect({
  projectile,
  image,
}: {
  projectile: MapProjectile
  image: HTMLImageElement
}) {
  const effectRef = useRef<Konva.Group>(null)
  const spriteRef = useRef<Konva.Image>(null)
  const launchGlowRef = useRef<Konva.Circle>(null)
  const frontGlowRef = useRef<Konva.Circle>(null)
  const sparkRefs = useRef<Array<Konva.Circle | null>>([])
  const smokeRefs = useRef<Array<Konva.Circle | null>>([])
  const dx = projectile.to.x - projectile.from.x
  const dy = projectile.to.y - projectile.from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const width = distance * 1.14
  const areaWidth = Math.max(28, projectile.areaWidthPx ?? 70)
  const height = areaWidth * 1.04
  const imageX = -distance * 0.055
  const columns = 4
  const rows = 4
  const frameCount = columns * rows
  const frameWidth = (image.naturalWidth || image.width) / columns
  const frameHeight = (image.naturalHeight || image.height) / rows

  const sparkSpecs = useMemo(() => {
    return Array.from({ length: 20 }, (_, index): BurningHandsSparkSpec => {
      const random = (field: string) => nextAreaRandom(
        areaSeed(`${projectile.id}:burning-hands:sparks:${index}:${field}`),
      )[1]
      const start = 0.08 + random('start') * 0.34
      const speed = 0.76 + random('speed') * 0.42
      const vertical = (random('vertical') - 0.5) * height * 0.72
      const drift = (random('drift') - 0.5) * height * 0.22
      const radius = Math.max(1.1, height * (0.014 + random('radius') * 0.016))
      return { start, speed, vertical, drift, radius, warm: index % 3 !== 0 }
    })
  }, [height, projectile.id])

  const smokeSpecs = useMemo(() => {
    return Array.from({ length: 5 }, (_, index): BurningHandsSmokeSpec => {
      const random = (field: string) => nextAreaRandom(
        areaSeed(`${projectile.id}:burning-hands:smoke:${index}:${field}`),
      )[1]
      const start = 0.48 + random('start') * 0.18
      const x = width * (0.48 + random('x') * 0.48)
      const y = (random('y') - 0.5) * height * 0.52
      const drift = (random('drift') - 0.5) * height * 0.2
      const radius = height * (0.055 + random('radius') * 0.045)
      return { start, x, y, drift, radius }
    })
  }, [height, projectile.id, width])

  useEffect(() => {
    const effect = effectRef.current
    const sprite = spriteRef.current
    const launchGlow = launchGlowRef.current
    const frontGlow = frontGlowRef.current
    const layer = effect?.getLayer()
    if (!effect || !sprite || !launchGlow || !frontGlow || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_150)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    effect.rotation(Math.atan2(dy, dx) * 180 / Math.PI)

    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const spriteRaw = Math.min(1, raw / 0.82)
      const frameIndex = Math.min(frameCount - 1, Math.floor(spriteRaw * frameCount))
      const column = frameIndex % columns
      const row = Math.floor(frameIndex / columns)
      const fade = raw < 0.78 ? 1 : Math.max(0, (1 - raw) / 0.22)
      const ignition = Math.min(1, raw / 0.055)

      sprite.crop({
        x: column * frameWidth,
        y: row * frameHeight,
        width: frameWidth,
        height: frameHeight,
      })
      sprite.opacity(ignition * fade)
      sprite.scaleY(0.985 + Math.sin(elapsed * 0.022) * 0.025)

      launchGlow.radius(height * (0.1 + Math.min(1, raw * 7) * 0.16))
      launchGlow.opacity(Math.sin(Math.min(1, raw * 6) * Math.PI) * 0.8)
      const frontRaw = Math.max(0, Math.min(1, (raw - 0.24) / 0.42))
      frontGlow.position({ x: width * (0.64 + frontRaw * 0.27), y: 0 })
      frontGlow.scale({ x: 1.5 + frontRaw * 1.2, y: 0.7 + frontRaw * 0.5 })
      frontGlow.opacity(Math.sin(frontRaw * Math.PI) * 0.3 * fade)

      sparkRefs.current.forEach((spark, index) => {
        if (!spark) return
        const spec = sparkSpecs[index]
        const local = Math.max(0, Math.min(1, (raw - spec.start) / (0.58 - spec.start * 0.25)))
        const eased = 1 - Math.pow(1 - local, 1.7)
        spark.position({
          x: imageX + width * Math.min(1.04, eased * spec.speed),
          y: spec.vertical * (0.15 + eased * 0.85) + spec.drift * Math.sin(local * Math.PI),
        })
        spark.radius(spec.radius * (1 - local * 0.48))
        spark.opacity(Math.sin(local * Math.PI) * 0.92 * fade)
      })

      smokeRefs.current.forEach((smoke, index) => {
        if (!smoke) return
        const spec = smokeSpecs[index]
        const local = Math.max(0, Math.min(1, (raw - spec.start) / (1 - spec.start)))
        smoke.position({
          x: imageX + spec.x + local * height * 0.14,
          y: spec.y + spec.drift * local - height * local * 0.08,
        })
        smoke.radius(spec.radius * (0.7 + local * 0.8))
        smoke.opacity(Math.sin(local * Math.PI) * 0.14)
      })

      effect.opacity(raw < 0.98 ? 1 : Math.max(0, (1 - raw) / 0.02))
      return raw
    }

    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      if (drawFrame(initialElapsed + (frame?.time ?? 0)) >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [
    columns,
    dx,
    dy,
    frameCount,
    frameHeight,
    frameWidth,
    height,
    imageX,
    projectile.durationMs,
    projectile.issuedAt,
    smokeSpecs,
    sparkSpecs,
    width,
  ])

  return (
    <Group ref={effectRef} x={projectile.from.x} y={projectile.from.y} listening={false}>
      <Circle
        ref={launchGlowRef}
        x={0}
        y={0}
        fill="#fff7c2"
        shadowColor="#fb923c"
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <KonvaImage
        ref={spriteRef}
        image={image}
        x={imageX}
        y={-height / 2}
        width={width}
        height={height}
        shadowColor="#f97316"
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={frontGlowRef}
        radius={height * 0.12}
        fill="#fff7c2"
        shadowColor="#fb923c"
        shadowBlur={20}
        perfectDrawEnabled={false}
      />
      {sparkSpecs.map((spec, index) => (
        <Circle
          key={`burning-hands-spark:${index}`}
          ref={(node) => { sparkRefs.current[index] = node }}
          radius={spec.radius}
          fill={spec.warm ? '#fde68a' : '#fb923c'}
          shadowColor={spec.warm ? '#facc15' : '#ef4444'}
          shadowBlur={8}
          opacity={0}
          perfectDrawEnabled={false}
        />
      ))}
      {smokeSpecs.map((spec, index) => (
        <Circle
          key={`burning-hands-smoke:${index}`}
          ref={(node) => { smokeRefs.current[index] = node }}
          radius={spec.radius}
          fill="#4b2b25"
          shadowColor="#7c2d12"
          shadowBlur={16}
          opacity={0}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

function MaterialAreaSpellEffect({
  projectile,
}: {
  projectile: MapProjectile
}) {
  const isShatter = projectile.kind === 'shatter'
  const asset = projectile.kind === 'burning-hands'
    ? '/assets/vfx/burning-hands-sprite-v2.png'
    : projectile.kind === 'thunderwave'
      ? '/assets/vfx/thunderwave-fluid.webp'
      : isShatter
        ? '/assets/vfx/shatter-fluid.png'
        : '/assets/vfx/lightning-bolt-fluid.png'
  const loadedImage = useTokenBadgeImage(asset)
  const image = loadedImage
  if (!image) return null
  if (projectile.kind === 'burning-hands') {
    return <BurningHandsSpriteEffect projectile={projectile} image={image} />
  }
  if (isShatter) {
    const radius = Math.max(30, projectile.radiusPx ?? 70)
    return (
      <TargetTextureManifestation
        projectile={projectile}
        image={image}
        width={radius * 2.45}
        height={radius * 2.45}
        y={0}
        shadowColor="#8b5cf6"
      />
    )
  }
  const distance = Math.max(
    1,
    Math.hypot(projectile.to.x - projectile.from.x, projectile.to.y - projectile.from.y),
  )
  const areaWidth = Math.max(28, projectile.areaWidthPx ?? 70)
  if (projectile.kind === 'thunderwave') {
    return <ThunderwaveMaterialEffect
      projectile={projectile}
      image={image}
      distance={distance}
      areaWidth={areaWidth}
    />
  }
  return (
    <DirectionalTextureEffect
      projectile={projectile}
      image={image}
      heightRatio={areaWidth / distance}
      minHeight={areaWidth * 0.98}
      maxHeight={areaWidth * 1.02}
      revealEnd={projectile.kind === 'lightning-bolt' ? 0.32 : 0.46}
      fadeStart={0.72}
      shadowColor="#22d3ee"
    />
  )
}

function SacredFlameEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const columnRef = useRef<Konva.Group>(null)
  const descendingRef = useRef<Konva.Group>(null)
  const impactRef = useRef<Konva.Group>(null)
  const ringRef = useRef<Konva.Circle>(null)
  const flameRefs = useRef<Array<Konva.Line | null>>([])
  const sacredFlameImage = useTokenBadgeImage('/assets/vfx/sacred-flame-fluid.png')
  const radius = Math.max(20, projectile.radiusPx ?? 32)

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_200)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const strength = 1
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const descent = 1 - Math.pow(1 - Math.min(1, raw / 0.38), 3)
      const fade = raw > 0.72 ? Math.max(0, (1 - raw) / 0.28) : 1
      effect.position(projectile.to)
      columnRef.current?.opacity(
        (raw < 0.08 ? raw / 0.08 : fade) * (0.6 + strength * 0.4),
      )
      descendingRef.current?.position({
        x: 0,
        y: -radius * 2.8 * (1 - descent),
      })
      descendingRef.current?.scale({
        x: 0.58 + descent * 0.42,
        y: 0.58 + descent * 0.42,
      })
      descendingRef.current?.opacity(fade * (0.62 + strength * 0.38))
      flameRefs.current.forEach((flame, index) => {
        if (!flame) return
        const sway = Math.sin(elapsed * 0.035 + index * 1.7) * radius * 0.08
        flame.x(sway)
        flame.scaleY(0.9 + Math.sin(elapsed * 0.042 + index) * 0.14)
      })

      const impactRaw = Math.max(0, Math.min(1, (raw - 0.3) / 0.7))
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, fade * strength))
        impactRef.current.scale({
          x: 0.25 + impactRaw * (0.95 + strength * 0.35),
          y: 0.25 + impactRaw * (0.95 + strength * 0.35),
        })
      }
      ringRef.current?.radius(radius * (0.28 + impactRaw * 0.92))
      ringRef.current?.opacity(Math.max(0, (1 - impactRaw * 0.72) * strength))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  const flameShapes = [
    [-0.42, 0.34, -0.3, -0.42, -0.08, -1.08, 0.02, -0.36, 0.18, -0.86, 0.39, -0.18, 0.34, 0.38],
    [-0.26, 0.38, -0.18, -0.22, 0.02, -0.72, 0.12, -0.16, 0.28, 0.12, 0.22, 0.4],
    [-0.16, 0.36, -0.08, -0.08, 0.03, -0.45, 0.18, 0.02, 0.16, 0.36],
  ]
  if (sacredFlameImage) {
    return (
      <TargetTextureManifestation
        projectile={projectile}
        image={sacredFlameImage}
        width={radius * 2.35}
        height={radius * 5.1}
        y={-radius * 1.65}
        descend={radius * 1.25}
        shadowColor="#facc15"
      />
    )
  }
  return (
    <Group
      ref={effectRef}
      x={projectile.to.x}
      y={projectile.to.y}
      listening={false}
    >
      <Group ref={columnRef}>
        <Rect
          x={-radius * 0.48}
          y={-radius * 3.2}
          width={radius * 0.96}
          height={radius * 3.25}
          cornerRadius={radius * 0.42}
          fillLinearGradientStartPoint={{ x: 0, y: -radius * 3.2 }}
          fillLinearGradientEndPoint={{ x: 0, y: 0 }}
          fillLinearGradientColorStops={[
            0, 'rgba(255,255,255,0)',
            0.24, 'rgba(254,249,195,0.34)',
            0.72, 'rgba(253,224,71,0.6)',
            1, 'rgba(255,255,255,0.82)',
          ]}
          shadowColor="#facc15"
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-radius * 0.13, -radius * 3.1, -radius * 0.08, -radius * 0.3]}
          stroke="#ffffff"
          strokeWidth={radius * 0.15}
          lineCap="round"
          opacity={0.78}
          shadowColor="#fde047"
          shadowBlur={12}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group ref={descendingRef} y={-radius * 2.8}>
        <Circle
          radius={radius * 0.52}
          fill="rgba(254,249,195,0.7)"
          stroke="#fef08a"
          strokeWidth={2.5}
          shadowColor="#facc15"
          shadowBlur={24}
          perfectDrawEnabled={false}
        />
        {flameShapes.map((shape, index) => (
          <Line
            key={index}
            ref={(node) => { flameRefs.current[index] = node }}
            points={shape.map((value) => value * radius)}
            closed
            fill={index === 0 ? '#fde047' : index === 1 ? '#fef08a' : '#ffffff'}
            stroke="#fff7d6"
            strokeWidth={1.4}
            opacity={0.88}
            shadowColor="#eab308"
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
      <Group ref={impactRef} visible={false}>
        <Circle
          ref={ringRef}
          radius={radius * 0.28}
          stroke="#fef08a"
          strokeWidth={3}
          dash={[5, 6]}
          shadowColor="#facc15"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={radius * 0.42}
          fill="rgba(254,240,138,0.48)"
          shadowColor="#fde047"
          shadowBlur={radius}
          perfectDrawEnabled={false}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation, index) => (
          <Line
            key={rotation}
            points={[
              radius * 0.34, 0,
              radius * (0.72 + (index % 2) * 0.18), 0,
            ]}
            rotation={rotation}
            stroke={index % 2 === 0 ? '#ffffff' : '#fde047'}
            strokeWidth={2.5}
            lineCap="round"
            shadowColor="#eab308"
            shadowBlur={9}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

function SacredGuidanceSigil({ radius }: { radius: number }) {
  return (
    <>
      <Circle
        radius={radius}
        stroke="rgba(253,230,138,0.92)"
        strokeWidth={2.4}
        dash={[radius * 0.18, radius * 0.1]}
        shadowColor="#facc15"
        shadowBlur={12}
        perfectDrawEnabled={false}
      />
      <Circle
        radius={radius * 0.72}
        stroke="rgba(254,249,195,0.68)"
        strokeWidth={1.4}
        dash={[3, 6]}
        shadowColor="#fde047"
        shadowBlur={7}
        perfectDrawEnabled={false}
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation, index) => (
        <Group key={rotation} rotation={rotation}>
          <Line
            points={[
              radius * 0.78, 0,
              radius * 0.9, -radius * 0.09,
              radius * 1.08, 0,
              radius * 0.9, radius * 0.09,
            ]}
            closed
            fill={index % 2 === 0 ? 'rgba(254,240,138,0.88)' : 'rgba(255,255,255,0.78)'}
            stroke="#fef9c3"
            strokeWidth={1.2}
            shadowColor="#eab308"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
      {[0, 90, 180, 270].map((rotation) => (
        <Group key={`cross:${rotation}`} rotation={rotation}>
          <Line
            points={[radius * 0.48, 0, radius * 0.64, 0]}
            stroke="#fff7d6"
            strokeWidth={3}
            lineCap="round"
            shadowColor="#facc15"
            shadowBlur={6}
            perfectDrawEnabled={false}
          />
          <Circle
            x={radius * 0.56}
            radius={2.4}
            fill="#ffffff"
            shadowColor="#fde047"
            shadowBlur={7}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
    </>
  )
}

function ResistanceShieldGlyph(input: {
  size: number
  accentColor: string
  glowColor: string
}) {
  const size = input.size
  return (
    <Group listening={false}>
      <Line
        points={[
          0, -size,
          size * 0.82, -size * 0.62,
          size * 0.68, size * 0.35,
          0, size,
          -size * 0.68, size * 0.35,
          -size * 0.82, -size * 0.62,
        ]}
        closed
        fill={input.accentColor}
        stroke={input.glowColor}
        strokeWidth={Math.max(1.5, size * 0.14)}
        lineJoin="round"
        shadowColor={input.glowColor}
        shadowBlur={size * 0.9}
        shadowOpacity={0.9}
        perfectDrawEnabled={false}
      />
      <Line
        points={[0, -size * 0.66, 0, size * 0.56]}
        stroke="rgba(255,255,255,0.82)"
        strokeWidth={Math.max(1, size * 0.11)}
        lineCap="round"
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

function SanctuaryWardGlyph({ size }: { size: number }) {
  return (
    <Group listening={false}>
      <Circle
        radius={size}
        fill="rgba(224,242,254,0.9)"
        stroke="#f8fafc"
        strokeWidth={Math.max(1.2, size * 0.13)}
        shadowColor="#7dd3fc"
        shadowBlur={size * 1.15}
        shadowOpacity={0.95}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          0, -size * 0.72,
          size * 0.58, -size * 0.18,
          size * 0.4, size * 0.58,
          0, size * 0.82,
          -size * 0.4, size * 0.58,
          -size * 0.58, -size * 0.18,
        ]}
        closed
        fill="rgba(59,130,246,0.38)"
        stroke="#ffffff"
        strokeWidth={Math.max(1, size * 0.1)}
        lineJoin="round"
        perfectDrawEnabled={false}
      />
      <Line
        points={[-size * 0.3, 0, size * 0.3, 0, 0, -size * 0.45, 0, size * 0.5]}
        stroke="#ffffff"
        strokeWidth={Math.max(1, size * 0.09)}
        lineCap="round"
        lineJoin="round"
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

function SanctuaryManifestation({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const orbitRef = useRef<Konva.Group>(null)
  const radius = Math.max(34, projectile.radiusPx ?? 58)

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.42), 3)
      effect.position(projectile.to)
      effect.opacity(raw < 0.14
        ? raw / 0.14
        : raw > 0.82
          ? Math.max(0, (1 - raw) / 0.18)
          : 1)
      effect.scale({
        x: 0.38 + arrival * 0.62,
        y: 0.38 + arrival * 0.62,
      })
      orbitRef.current?.rotation(52 + raw * 320)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        radius={radius * 0.96}
        fill="rgba(125,211,252,0.08)"
        stroke="rgba(224,242,254,0.9)"
        strokeWidth={2.4}
        dash={[3, 8]}
        shadowColor="#38bdf8"
        shadowBlur={18}
        perfectDrawEnabled={false}
      />
      <Circle
        radius={radius * 1.08}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.4}
        dash={[11, 13]}
        perfectDrawEnabled={false}
      />
      <Group ref={orbitRef}>
        {[0, 120, 240].map((rotation) => (
          <Group key={rotation} rotation={rotation}>
            <Group x={radius}>
              <SanctuaryWardGlyph size={Math.max(8, radius * 0.13)} />
            </Group>
          </Group>
        ))}
      </Group>
    </Group>
  )
}

function ResistanceManifestation({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const orbitRef = useRef<Konva.Group>(null)
  const shieldRef = useRef<Konva.Group>(null)
  const radius = Math.max(22, projectile.radiusPx ?? 34)
  const accentColor = projectile.accentColor ?? '#94a3b8'
  const glowColor = projectile.glowColor ?? '#e2e8f0'

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.38), 3)
      const rotation = 22.5 + raw * 400
      effect.position(projectile.to)
      effect.opacity(raw < 0.12
        ? raw / 0.12
        : raw > 0.78
          ? Math.max(0, (1 - raw) / 0.22)
          : 1)
      effect.scale({ x: 0.35 + arrival * 0.65, y: 0.35 + arrival * 0.65 })
      orbitRef.current?.rotation(rotation)
      shieldRef.current?.rotation(-rotation)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        radius={radius}
        stroke={accentColor}
        strokeWidth={2}
        dash={[4, 7]}
        opacity={0.38}
        shadowColor={glowColor}
        shadowBlur={14}
        perfectDrawEnabled={false}
      />
      <Group ref={orbitRef}>
        <Group ref={shieldRef} x={radius}>
          <ResistanceShieldGlyph
            size={Math.max(8, radius * 0.17)}
            accentColor={accentColor}
            glowColor={glowColor}
          />
        </Group>
      </Group>
    </Group>
  )
}

function GuidanceManifestation({ projectile }: { projectile: MapProjectile }) {
  const manifestationRef = useRef<Konva.Group>(null)
  const burstRef = useRef<Konva.Circle>(null)
  const radius = Math.max(20, projectile.radiusPx ?? 32)

  useEffect(() => {
    const manifestation = manifestationRef.current
    const layer = manifestation?.getLayer()
    if (!manifestation || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.62), 3)
      manifestation.position(projectile.to)
      manifestation.rotation(-35 + arrival * 80)
      manifestation.scale({
        x: 0.25 + arrival * 0.9,
        y: 0.25 + arrival * 0.9,
      })
      manifestation.opacity(raw < 0.12
        ? raw / 0.12
        : raw > 0.72
          ? Math.max(0, (1 - raw) / 0.28)
          : 1)
      burstRef.current?.radius(radius * (0.28 + arrival * 0.95))
      burstRef.current?.opacity(Math.max(0, 0.76 - raw * 0.7))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group
      ref={manifestationRef}
      x={projectile.to.x}
      y={projectile.to.y}
      listening={false}
    >
      <Circle
        ref={burstRef}
        radius={radius * 0.28}
        fill="rgba(254,249,195,0.3)"
        stroke="#fef08a"
        strokeWidth={3}
        shadowColor="#facc15"
        shadowBlur={26}
        perfectDrawEnabled={false}
      />
      <SacredGuidanceSigil radius={radius} />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((rotation) => (
        <Line
          key={rotation}
          points={[radius * 0.32, 0, radius * 0.55, 0]}
          rotation={rotation}
          stroke="#fff7d6"
          strokeWidth={2}
          lineCap="round"
          shadowColor="#fde047"
          shadowBlur={7}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

function StatusSpellManifestation({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const pulseRef = useRef<Konva.Circle>(null)
  const statusId = projectile.kind as Extract<
    MapSpellStatusId,
    | 'bless'
    | 'bane'
    | 'shield-of-faith'
    | 'mage-armor'
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'divine-favor'
    | 'hunters-mark'
    | 'magic-weapon'
    | 'flame-blade'
    | 'invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'longstrider'
    | 'protection-from-energy'
    | 'death-ward'
    | 'greater-invisibility'
    | 'charm-person'
    | 'hideous-laughter'
    | 'hold-person'
    | 'blindness-deafness'
  >
  const image = useTokenBadgeImage(MAP_SPELL_STATUS_ICONS[statusId].asset)
  const radius = Math.max(22, projectile.radiusPx ?? 38)
  const accentColor = projectile.accentColor ?? '#a78bfa'
  const glowColor = projectile.glowColor ?? '#ddd6fe'

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.42), 3)
      const fade = raw < 0.1
        ? raw / 0.1
        : raw > 0.76
          ? Math.max(0, (1 - raw) / 0.24)
          : 1
      effect.position(projectile.to)
      effect.opacity(fade)
      effect.scale({ x: 0.28 + arrival * 0.82, y: 0.28 + arrival * 0.82 })
      effect.rotation((statusId === 'bane' ? -1 : 1) * (1 - arrival) * 28)
      pulseRef.current?.radius(radius * (0.72 + arrival * 0.7))
      pulseRef.current?.opacity(Math.max(0, 0.68 - raw * 0.58))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius, statusId])

  return (
    <Group ref={effectRef} x={projectile.to.x} y={projectile.to.y} listening={false}>
      <Circle
        ref={pulseRef}
        radius={radius * 0.72}
        fill={accentColor}
        opacity={0.18}
        stroke={glowColor}
        strokeWidth={2.4}
        shadowColor={glowColor}
        shadowBlur={24}
      />
      <Circle
        radius={radius * 0.72}
        fill={accentColor}
        stroke={glowColor}
        strokeWidth={2.2}
        shadowColor={glowColor}
        shadowBlur={18}
      />
      {image ? (
        <Group
          clipFunc={(context) => {
            context.beginPath()
            context.arc(0, 0, radius * 0.67, 0, Math.PI * 2)
            context.closePath()
          }}
        >
          <KonvaImage
            image={image}
            x={-radius * 0.69}
            y={-radius * 0.69}
            width={radius * 1.38}
            height={radius * 1.38}
          />
        </Group>
      ) : null}
    </Group>
  )
}

function ShockingGraspEffect({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const haloRef = useRef<Konva.Circle>(null)
  const flashRef = useRef<Konva.Circle>(null)
  const boltRefs = useRef<Array<Konva.Line | null>>([])
  const radius = Math.max(18, projectile.radiusPx ?? 31)

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const fade = raw < 0.12
        ? raw / 0.12
        : raw > 0.78
          ? Math.max(0, (1 - raw) / 0.22)
          : 1
      const crackle = 0.78 + Math.sin(elapsed * 0.075) * 0.16
      effect.position(projectile.to)
      effect.rotation(elapsed * 0.16)
      effect.opacity(fade)
      haloRef.current?.radius(radius * (0.98 + Math.sin(elapsed * 0.035) * 0.08))
      haloRef.current?.opacity(0.42 + crackle * 0.25)
      flashRef.current?.radius(radius * (0.34 + (1 - raw) * 0.16))
      flashRef.current?.opacity(Math.max(0, (1 - raw * 1.7) * 0.72))
      boltRefs.current.forEach((bolt, index) => {
        if (!bolt) return
        const phase = elapsed * (0.01 + index * 0.0007) + index * 1.9
        const inner = radius * (0.72 + Math.sin(phase * 1.7) * 0.08)
        const outer = radius * (1.22 + Math.cos(phase) * 0.12)
        const sweep = Math.sin(phase * 2.3) * radius * 0.22
        bolt.points([
          inner, 0,
          radius * 0.92, sweep,
          radius * 1.04, -sweep * 0.55,
          outer, 0,
        ])
        bolt.opacity(index % 2 === 0
          ? 0.68 + Math.sin(phase * 6) * 0.28
          : 0.54 + Math.cos(phase * 5) * 0.3)
      })
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  return (
    <Group
      ref={effectRef}
      x={projectile.to.x}
      y={projectile.to.y}
      listening={false}
    >
      <Circle
        ref={flashRef}
        radius={radius * 0.5}
        fill="rgba(224,242,254,0.72)"
        shadowColor="#38bdf8"
        shadowBlur={radius * 0.9}
        perfectDrawEnabled={false}
      />
      <Circle
        ref={haloRef}
        radius={radius}
        stroke="rgba(125,211,252,0.9)"
        strokeWidth={3}
        dash={[radius * 0.26, radius * 0.12]}
        shadowColor="#0ea5e9"
        shadowBlur={14}
        perfectDrawEnabled={false}
      />
      {Array.from({ length: 11 }, (_, index) => (
        <Line
          key={index}
          ref={(node) => { boltRefs.current[index] = node }}
          points={[radius * 0.72, 0, radius * 0.92, 5, radius * 1.04, -3, radius * 1.22, 0]}
          rotation={index * (360 / 11)}
          stroke={index % 3 === 0 ? '#f0f9ff' : index % 2 === 0 ? '#7dd3fc' : '#38bdf8'}
          strokeWidth={index % 3 === 0 ? 3.2 : 2.3}
          lineCap="round"
          lineJoin="round"
          shadowColor="#0284c7"
          shadowBlur={9}
          perfectDrawEnabled={false}
        />
      ))}
      <Circle
        radius={radius * 0.78}
        stroke="rgba(186,230,253,0.62)"
        strokeWidth={1.5}
        dash={[3, 7]}
        shadowColor="#38bdf8"
        shadowBlur={8}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

function SpectralSkeletalHand({ radius }: { radius: number }) {
  const scale = Math.max(0.55, radius / 31)
  const fingers = [
    { rotation: -47, points: [-6, -8, -14, -20, -16, -31] },
    { rotation: -23, points: [-3, -10, -7, -27, -6, -40] },
    { rotation: 0, points: [0, -11, 0, -30, 2, -44] },
    { rotation: 22, points: [4, -9, 8, -26, 11, -37] },
    { rotation: 49, points: [7, -5, 16, -16, 20, -26] },
  ]
  return (
    <Group scaleX={scale} scaleY={scale} rotation={-18}>
      <Circle
        radius={19}
        fill="rgba(15,23,42,0.44)"
        shadowColor="#67e8f9"
        shadowBlur={18}
        perfectDrawEnabled={false}
      />
      <Line
        points={[-12, 8, -10, -8, -5, -15, 5, -15, 11, -7, 12, 9, 6, 18, -5, 18]}
        closed
        fill="rgba(207,250,254,0.34)"
        stroke="#a5f3fc"
        strokeWidth={2.6}
        lineJoin="round"
        shadowColor="#22d3ee"
        shadowBlur={10}
        perfectDrawEnabled={false}
      />
      <Line
        points={[-7, 8, -3, 14, 0, 23, 4, 14, 8, 8]}
        stroke="#cffafe"
        strokeWidth={3.2}
        lineCap="round"
        lineJoin="round"
        shadowColor="#06b6d4"
        shadowBlur={7}
        perfectDrawEnabled={false}
      />
      {fingers.map((finger, index) => (
        <Group key={index} rotation={finger.rotation * 0.12}>
          <Line
            points={finger.points}
            stroke={index % 2 === 0 ? '#ecfeff' : '#a5f3fc'}
            strokeWidth={index === 2 ? 3.2 : 2.7}
            lineCap="round"
            lineJoin="round"
            shadowColor="#22d3ee"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
          <Circle
            x={finger.points[2]}
            y={finger.points[3]}
            radius={2.3}
            fill="#cffafe"
            shadowColor="#06b6d4"
            shadowBlur={5}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}
      <Circle
        radius={5}
        fill="rgba(8,47,73,0.7)"
        stroke="#67e8f9"
        strokeWidth={1.5}
        shadowColor="#22d3ee"
        shadowBlur={9}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

function ChillTouchPersistentMark(input: { x: number; y: number; radius: number }) {
  const handImage = useTokenBadgeImage('/assets/vfx/chill-touch-hand.png')
  return (
    <Group
      x={input.x + input.radius * 0.18}
      y={input.y + input.radius * 0.12}
      opacity={0.88}
      listening={false}
    >
      <Circle
        radius={input.radius * 0.94}
        stroke="rgba(103,232,249,0.36)"
        strokeWidth={2}
        dash={[4, 8]}
        shadowColor="#0891b2"
        shadowBlur={10}
        perfectDrawEnabled={false}
      />
      {handImage ? (
        <KonvaImage
          image={handImage}
          x={-input.radius}
          y={-input.radius * 1.12}
          width={input.radius * 2}
          height={input.radius * 2}
          shadowColor="#22d3ee"
          shadowBlur={12}
          perfectDrawEnabled={false}
        />
      ) : <SpectralSkeletalHand radius={input.radius} />}
    </Group>
  )
}

function ChillTouchManifestation({ projectile }: { projectile: MapProjectile }) {
  const manifestationRef = useRef<Konva.Group>(null)
  const ringRef = useRef<Konva.Circle>(null)
  const handImage = useTokenBadgeImage('/assets/vfx/chill-touch-hand.png')
  const radius = Math.max(18, projectile.radiusPx ?? 29)

  useEffect(() => {
    const manifestation = manifestationRef.current
    const layer = manifestation?.getLayer()
    if (!manifestation || !layer) return
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const arrival = 1 - Math.pow(1 - Math.min(1, raw / 0.7), 3)
      manifestation.position({
        x: projectile.to.x + radius * 0.18,
        y: projectile.to.y - radius * (0.9 - arrival * 1.02),
      })
      manifestation.scale({
        x: 0.28 + arrival * 0.72,
        y: 0.28 + arrival * 0.72,
      })
      manifestation.opacity(raw < 0.14 ? raw / 0.14 : Math.max(0, (1 - raw) / 0.18))
      manifestation.rotation(-12 + Math.sin(elapsed * 0.025) * 7 * (1 - arrival))
      ringRef.current?.radius(radius * (0.3 + arrival * 0.82))
      ringRef.current?.opacity(Math.max(0, 0.85 - raw * 0.7))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile, radius])

  if (handImage) {
    return (
      <TargetTextureManifestation
        projectile={projectile}
        image={handImage}
        width={radius * 2.45}
        height={radius * 2.45}
        y={-radius * 0.28}
        descend={radius * 1.2}
        shadowColor="#22d3ee"
      />
    )
  }
  return (
    <Group
      ref={manifestationRef}
      x={projectile.to.x}
      y={projectile.to.y - radius * 0.9}
      listening={false}
    >
      <Circle
        ref={ringRef}
        radius={radius * 0.3}
        stroke="#67e8f9"
        strokeWidth={3}
        dash={[5, 7]}
        shadowColor="#06b6d4"
        shadowBlur={20}
        perfectDrawEnabled={false}
      />
      <Circle
        radius={radius * 0.66}
        fill="rgba(8,47,73,0.28)"
        shadowColor="#22d3ee"
        shadowBlur={radius}
        perfectDrawEnabled={false}
      />
      <SpectralSkeletalHand radius={radius} />
      {[-72, -25, 18, 63, 112, 158, 205].map((rotation, index) => (
        <Line
          key={rotation}
          points={[radius * 0.54, 0, radius * (0.78 + (index % 2) * 0.18), 0]}
          rotation={rotation}
          stroke={index % 2 === 0 ? '#cffafe' : '#22d3ee'}
          strokeWidth={2}
          lineCap="round"
          shadowColor="#06b6d4"
          shadowBlur={7}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  )
}

function ProduceFlameProjectile({ projectile }: { projectile: MapProjectile }) {
  const orbRef = useRef<Konva.Group>(null)
  const shellRef = useRef<Konva.Circle>(null)
  const coreRef = useRef<Konva.Circle>(null)
  const blobRefs = useRef<Array<Konva.Circle | null>>([])
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const fireImage = useTokenBadgeImage('/assets/vfx/fire-projectile-fluid.png')
  const explosionImage = useTokenBadgeImage('/assets/vfx/fireball-explosion-fluid.png')

  useEffect(() => {
    const orb = orbRef.current
    const layer = orb?.getLayer()
    if (!orb || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const duration = Math.max(1, projectile.durationMs ?? 1_100)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const arcHeight = Math.max(18, Math.min(42, distance * 0.16))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const chargeEnd = 0.22
      const travelEnd = 0.72
      const travelRaw = Math.max(0, Math.min(1, (raw - chargeEnd) / (travelEnd - chargeEnd)))
      const travel = 1 - Math.pow(1 - travelRaw, 2.05)
      const arc = -Math.sin(travel * Math.PI) * arcHeight
      orb.position({
        x: projectile.from.x + dx * travel,
        y: projectile.from.y + dy * travel + arc,
      })
      const chargeScale = raw < chargeEnd
        ? 0.3 + (raw / chargeEnd) * 0.7
        : 1
      orb.scale({
        x: chargeScale * (1 + Math.sin(elapsed * 0.065) * 0.08),
        y: chargeScale * (1 + Math.cos(elapsed * 0.058) * 0.07),
      })
      orb.opacity(raw < 0.06 ? raw / 0.06 : raw < travelEnd ? 1 : 0)
      shellRef.current?.radius(13 + Math.sin(elapsed * 0.052) * 1.4)
      coreRef.current?.radius(6.5 + Math.cos(elapsed * 0.071) * 0.8)
      blobRefs.current.forEach((blob, index) => {
        if (!blob) return
        const angle = elapsed * (0.0028 + index * 0.00025) + index * 1.26
        const orbit = 7.5 + (index % 2) * 2.2
        blob.position({
          x: Math.cos(angle) * orbit,
          y: Math.sin(angle) * orbit,
        })
        blob.radius(4.8 + Math.sin(elapsed * 0.045 + index) * 1.1)
      })

      const impactRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
      const strength = 1
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, (1 - impactRaw) * strength))
        impactRef.current.scale({
          x: 0.28 + impactRaw * 1.8,
          y: 0.28 + impactRaw * 1.8,
        })
        impactRef.current.rotation(impactRaw * 35)
      }
      impactRingRef.current?.radius(9 + impactRaw * 22)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  if (fireImage) {
    return (
      <MovingFireTextureEffect
        projectile={projectile}
        fireImage={fireImage}
        explosionImage={explosionImage}
        spriteSize={78}
        impactDiameter={82}
        arcHeight={28}
      />
    )
  }
  return (
    <>
      <Group
        ref={orbRef}
        x={projectile.from.x}
        y={projectile.from.y}
        listening={false}
      >
        <Circle
          ref={shellRef}
          radius={13}
          fill="rgba(249,115,22,0.92)"
          stroke="#fdba74"
          strokeWidth={1.8}
          shadowColor="#ea580c"
          shadowBlur={24}
          perfectDrawEnabled={false}
        />
        {[0, 1, 2, 3, 4].map((index) => (
          <Circle
            key={index}
            ref={(node) => { blobRefs.current[index] = node }}
            x={Math.cos(index * 1.26) * 8}
            y={Math.sin(index * 1.26) * 8}
            radius={5}
            fill={index % 2 === 0 ? '#fb923c' : '#facc15'}
            opacity={0.78}
            shadowColor="#f97316"
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        ))}
        <Circle
          ref={coreRef}
          radius={6.5}
          fill="#fef3c7"
          stroke="#fde68a"
          strokeWidth={1.2}
          shadowColor="#facc15"
          shadowBlur={13}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={impactRingRef}
          radius={9}
          stroke="#fde68a"
          strokeWidth={3.2}
          shadowColor="#f97316"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={12}
          fill="rgba(254,215,170,0.84)"
          shadowColor="#ea580c"
          shadowBlur={26}
          perfectDrawEnabled={false}
        />
        {[-70, -28, 14, 52, 93, 137, 181, 226].map((rotation, index) => (
          <Circle
            key={rotation}
            x={Math.cos(rotation * Math.PI / 180) * (19 + (index % 2) * 7)}
            y={Math.sin(rotation * Math.PI / 180) * (19 + (index % 2) * 7)}
            radius={3.5 + (index % 3)}
            fill={index % 2 === 0 ? '#fbbf24' : '#f97316'}
            shadowColor="#ef4444"
            shadowBlur={9}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </>
  )
}

function EldritchBlastProjectile({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const auraRef = useRef<Konva.Line>(null)
  const beamRef = useRef<Konva.Line>(null)
  const coreRef = useRef<Konva.Line>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactCoreRef = useRef<Konva.Circle>(null)
  const fluidImage = useTokenBadgeImage('/assets/vfx/eldritch-blast-fluid.png')

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const perpendicularX = -dy / distance
    const perpendicularY = dx / distance
    const duration = Math.max(1, projectile.durationMs ?? 900)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const hash = [...projectile.id].reduce(
      (value, character) => ((value * 31) + character.charCodeAt(0)) | 0,
      0,
    )
    const arcDirection = (hash & 1) === 0 ? 1 : -1
    const arcStrength = 4 + Math.abs(hash % 5)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const extension = 1 - Math.pow(1 - Math.min(1, raw / 0.3), 3.2)
      const opacity = raw < 0.07
        ? raw / 0.07
        : raw > 0.62
          ? Math.max(0, (1 - raw) / 0.38)
          : 1
      const points: number[] = [projectile.from.x, projectile.from.y]
      for (let step = 1; step <= 9; step += 1) {
        const fraction = extension * step / 9
        const envelope = Math.sin(fraction * Math.PI)
        const arc = envelope * arcStrength * arcDirection
        const crackle = Math.sin(elapsed * 0.055 + step * 2.65 + hash) * 3.8
        points.push(
          projectile.from.x + dx * fraction + perpendicularX * (arc + crackle),
          projectile.from.y + dy * fraction + perpendicularY * (arc + crackle),
        )
      }
      auraRef.current?.points(points)
      auraRef.current?.opacity(opacity * 0.72)
      beamRef.current?.points(points)
      beamRef.current?.opacity(opacity)
      coreRef.current?.points(points)
      coreRef.current?.opacity(opacity * (0.76 + Math.sin(elapsed * 0.09) * 0.2))

      const impactRaw = Math.max(0, Math.min(1, (raw - 0.22) / 0.78))
      const impactStrength = 1
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, (1 - impactRaw * 0.82) * impactStrength))
        impactRef.current.scale({
          x: 0.2 + impactRaw * 1.45,
          y: 0.2 + impactRaw * 1.45,
        })
        impactRef.current.rotation(hash % 90 + impactRaw * 105 * arcDirection)
      }
      impactCoreRef.current?.radius(11 + Math.sin(elapsed * 0.08) * 3)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  if (fluidImage) {
    return (
      <DirectionalTextureEffect
        projectile={projectile}
        image={fluidImage}
        heightRatio={0.31}
        minHeight={72}
        maxHeight={142}
        revealEnd={0.42}
        fadeStart={0.66}
        shadowColor="#a855f7"
      />
    )
  }
  return (
    <Group ref={effectRef} listening={false}>
      <Line
        ref={auraRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="rgba(126,34,206,0.68)"
        strokeWidth={18}
        lineCap="round"
        lineJoin="round"
        shadowColor="#7e22ce"
        shadowBlur={24}
        perfectDrawEnabled={false}
      />
      <Line
        ref={beamRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#a855f7"
        strokeWidth={7}
        lineCap="round"
        lineJoin="round"
        shadowColor="#c026d3"
        shadowBlur={13}
        perfectDrawEnabled={false}
      />
      <Line
        ref={coreRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#f3e8ff"
        strokeWidth={2.4}
        lineCap="round"
        lineJoin="round"
        shadowColor="#e879f9"
        shadowBlur={7}
        perfectDrawEnabled={false}
      />
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={impactCoreRef}
          radius={11}
          fill="rgba(216,180,254,0.82)"
          shadowColor="#9333ea"
          shadowBlur={26}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={18}
          stroke="#c084fc"
          strokeWidth={3}
          dash={[3, 5]}
          shadowColor="#7e22ce"
          shadowBlur={14}
          perfectDrawEnabled={false}
        />
        {[-78, -37, 5, 43, 81, 126, 171, 218].map((rotation, index) => (
          <Line
            key={rotation}
            points={[8, 0, 18 + (index % 3) * 5, index % 2 === 0 ? -3 : 3, 27 + (index % 2) * 5, 0]}
            rotation={rotation}
            stroke={index % 2 === 0 ? '#e9d5ff' : '#a855f7'}
            strokeWidth={2.6}
            lineCap="round"
            lineJoin="round"
            shadowColor="#9333ea"
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Group>
  )
}

function RayOfFrostProjectile({ projectile }: { projectile: MapProjectile }) {
  const effectRef = useRef<Konva.Group>(null)
  const glowRef = useRef<Konva.Line>(null)
  const coreRef = useRef<Konva.Line>(null)
  const filamentRef = useRef<Konva.Line>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const fluidImage = useTokenBadgeImage('/assets/vfx/ray-of-frost-fluid.png')

  useEffect(() => {
    const effect = effectRef.current
    const layer = effect?.getLayer()
    if (!effect || !layer) return
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const perpendicularX = -dy / distance
    const perpendicularY = dx / distance
    const duration = Math.max(1, projectile.durationMs ?? 1_000)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const extension = 1 - Math.pow(1 - Math.min(1, raw / 0.34), 3)
      const beamOpacity = raw < 0.1
        ? raw / 0.1
        : raw > 0.68
          ? Math.max(0, (1 - raw) / 0.32)
          : 1
      const endX = projectile.from.x + dx * extension
      const endY = projectile.from.y + dy * extension
      const straightPoints = [projectile.from.x, projectile.from.y, endX, endY]
      glowRef.current?.points(straightPoints)
      glowRef.current?.opacity(beamOpacity * 0.72)
      coreRef.current?.points(straightPoints)
      coreRef.current?.opacity(beamOpacity)

      const filamentPoints: number[] = [projectile.from.x, projectile.from.y]
      for (let step = 1; step <= 7; step += 1) {
        const fraction = extension * step / 7
        const wave = Math.sin(elapsed * 0.045 + step * 1.8) * 3.2
        filamentPoints.push(
          projectile.from.x + dx * fraction + perpendicularX * wave,
          projectile.from.y + dy * fraction + perpendicularY * wave,
        )
      }
      filamentRef.current?.points(filamentPoints)
      filamentRef.current?.opacity(beamOpacity * 0.86)

      const impactRaw = Math.max(0, Math.min(1, (raw - 0.26) / 0.74))
      const impactStrength = 1
      if (impactRef.current) {
        impactRef.current.visible(impactRaw > 0)
        impactRef.current.opacity(Math.max(0, (1 - impactRaw * 0.78) * impactStrength))
        impactRef.current.scale({
          x: 0.35 + impactRaw * 1.05,
          y: 0.35 + impactRaw * 1.05,
        })
        impactRef.current.rotation(impactRaw * 55)
      }
      impactRingRef.current?.radius(7 + impactRaw * 19)
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  if (fluidImage) {
    return (
      <DirectionalTextureEffect
        projectile={projectile}
        image={fluidImage}
        heightRatio={0.3}
        minHeight={70}
        maxHeight={138}
        revealEnd={0.5}
        fadeStart={0.7}
        shadowColor="#38bdf8"
      />
    )
  }
  return (
    <Group ref={effectRef} listening={false}>
      <Line
        ref={glowRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="rgba(56,189,248,0.72)"
        strokeWidth={15}
        lineCap="round"
        lineJoin="round"
        shadowColor="#0ea5e9"
        shadowBlur={22}
        perfectDrawEnabled={false}
      />
      <Line
        ref={coreRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#e0f2fe"
        strokeWidth={5.5}
        lineCap="round"
        lineJoin="round"
        shadowColor="#7dd3fc"
        shadowBlur={10}
        perfectDrawEnabled={false}
      />
      <Line
        ref={filamentRef}
        points={[projectile.from.x, projectile.from.y, projectile.from.x, projectile.from.y]}
        stroke="#ffffff"
        strokeWidth={1.8}
        lineCap="round"
        lineJoin="round"
        shadowColor="#bae6fd"
        shadowBlur={6}
        perfectDrawEnabled={false}
      />
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={impactRingRef}
          radius={7}
          stroke="#e0f2fe"
          strokeWidth={3}
          dash={[4, 5]}
          shadowColor="#0ea5e9"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          radius={10}
          fill="rgba(224,242,254,0.56)"
          shadowColor="#38bdf8"
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
        {[0, 60, 120, 180, 240, 300].map((rotation) => (
          <Group key={rotation} rotation={rotation}>
            <Line
              points={[7, 0, 25, 0]}
              stroke="#bae6fd"
              strokeWidth={2.6}
              lineCap="round"
              shadowColor="#38bdf8"
              shadowBlur={7}
              perfectDrawEnabled={false}
            />
            <Line
              points={[17, 0, 12, -5, 17, 0, 12, 5]}
              stroke="#e0f2fe"
              strokeWidth={1.7}
              lineCap="round"
              lineJoin="round"
              perfectDrawEnabled={false}
            />
          </Group>
        ))}
      </Group>
    </Group>
  )
}

function FireBoltProjectile({ projectile }: { projectile: MapProjectile }) {
  const projectileRef = useRef<Konva.Group>(null)
  const outerFlameRef = useRef<Konva.Circle>(null)
  const innerFlameRef = useRef<Konva.Circle>(null)
  const tailRef = useRef<Konva.Line>(null)
  const impactRef = useRef<Konva.Group>(null)
  const impactRingRef = useRef<Konva.Circle>(null)
  const impactCoreRef = useRef<Konva.Circle>(null)
  const fireImage = useTokenBadgeImage('/assets/vfx/fire-projectile-fluid.png')
  const explosionImage = useTokenBadgeImage('/assets/vfx/fireball-explosion-fluid.png')

  useEffect(() => {
    const group = projectileRef.current
    const layer = group?.getLayer()
    if (!group || !layer) return
    const outerFlame = outerFlameRef.current
    const innerFlame = innerFlameRef.current
    const tail = tailRef.current
    const impact = impactRef.current
    const impactRing = impactRingRef.current
    const impactCore = impactCoreRef.current
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const duration = Math.max(400, projectile.durationMs ?? 980)
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    group.rotation((Math.atan2(dy, dx) * 180) / Math.PI)
    impact?.position(projectile.to)
    const anim = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const chargeEnd = 0.13
      const travelEnd = 0.76
      const travelRaw = Math.max(0, Math.min(1, (raw - chargeEnd) / (travelEnd - chargeEnd)))
      const travel = 1 - Math.pow(1 - travelRaw, 2.15)
      const pulse = 1 + Math.sin(elapsed * 0.045) * 0.14
      const wobble = Math.sin(travelRaw * Math.PI * 5) * 2.2 * (1 - travelRaw)
      group.x(projectile.from.x + dx * travel - (dy / distance) * wobble)
      group.y(projectile.from.y + dy * travel + (dx / distance) * wobble)
      group.scale({ x: pulse, y: pulse })
      group.opacity(raw < chargeEnd ? Math.max(0.25, raw / chargeEnd) : raw < travelEnd ? 1 : 0)
      outerFlame?.radius(8.5 + Math.sin(elapsed * 0.06) * 1.5)
      innerFlame?.radius(4.2 + Math.sin(elapsed * 0.075 + 1) * 0.8)
      if (tail) {
        const tailLength = 26 + Math.sin(elapsed * 0.055) * 5
        tail.points([-tailLength, 0, -7, 0])
        tail.opacity(0.65 + Math.sin(elapsed * 0.04) * 0.16)
      }

      if (impact) {
        const impactRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
        const strength = 1
        impact.visible(impactRaw > 0)
        impact.opacity(Math.max(0, (1 - impactRaw) * strength))
        impact.scale({ x: 0.35 + impactRaw * 1.8, y: 0.35 + impactRaw * 1.8 })
        impactRing?.radius(8 + impactRaw * 17)
        impactCore?.radius(10 - impactRaw * 4)
      }
      if (raw >= 1) anim.stop()
    }, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [projectile])

  if (fireImage) {
    return (
      <MovingFireTextureEffect
        projectile={projectile}
        fireImage={fireImage}
        explosionImage={explosionImage}
        spriteSize={70}
        impactDiameter={72}
      />
    )
  }
  return (
    <>
      <Group
        ref={projectileRef}
        x={projectile.from.x}
        y={projectile.from.y}
        listening={false}
      >
        <Line
          ref={tailRef}
          points={[-30, 0, -7, 0]}
          stroke="rgba(239,68,68,0.64)"
          strokeWidth={13}
          lineCap="round"
          shadowColor="#dc2626"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-22, 0, -4, 0]}
          stroke="rgba(251,146,60,0.92)"
          strokeWidth={7}
          lineCap="round"
          shadowColor="#f97316"
          shadowBlur={10}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={outerFlameRef}
          radius={9}
          fill="#f97316"
          stroke="rgba(254,215,170,0.9)"
          strokeWidth={1.2}
          shadowColor="#ef4444"
          shadowBlur={22}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={innerFlameRef}
          radius={4.5}
          fill="#fef3c7"
          shadowColor="#facc15"
          shadowBlur={12}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group
        ref={impactRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={impactRingRef}
          radius={8}
          stroke="#fde68a"
          strokeWidth={3}
          shadowColor="#ef4444"
          shadowBlur={18}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={impactCoreRef}
          radius={10}
          fill="rgba(254,215,170,0.88)"
          shadowColor="#f97316"
          shadowBlur={24}
          perfectDrawEnabled={false}
        />
        {[-42, -12, 18, 48, 78, 132, 168, 210].map((rotation, index) => (
          <Line
            key={rotation}
            points={[7, 0, 18 + (index % 3) * 4, 0]}
            rotation={rotation}
            stroke={index % 2 === 0 ? '#fbbf24' : '#fb7185'}
            strokeWidth={2.5}
            lineCap="round"
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </>
  )
}

function FireballProjectile({ projectile }: { projectile: MapProjectile }) {
  const projectileRef = useRef<Konva.Group>(null)
  const tailRef = useRef<Konva.Line>(null)
  const outerOrbRef = useRef<Konva.Circle>(null)
  const innerOrbRef = useRef<Konva.Circle>(null)
  const blastRef = useRef<Konva.Group>(null)
  const blastCoreRef = useRef<Konva.Circle>(null)
  const blastRingRef = useRef<Konva.Circle>(null)
  const shockwaveRef = useRef<Konva.Circle>(null)
  const fireImage = useTokenBadgeImage('/assets/vfx/fire-projectile-fluid.png')
  const explosionImage = useTokenBadgeImage('/assets/vfx/fireball-explosion-fluid.png')

  useEffect(() => {
    const projectileNode = projectileRef.current
    const layer = projectileNode?.getLayer()
    if (!projectileNode || !layer) return
    const tail = tailRef.current
    const outerOrb = outerOrbRef.current
    const innerOrb = innerOrbRef.current
    const blast = blastRef.current
    const blastCore = blastCoreRef.current
    const blastRing = blastRingRef.current
    const shockwave = shockwaveRef.current
    const dx = projectile.to.x - projectile.from.x
    const dy = projectile.to.y - projectile.from.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const duration = Math.max(900, projectile.durationMs ?? 1_750)
    const radius = Math.max(24, projectile.radiusPx ?? 120)
    const orbRadius = Math.max(7, Math.min(14, radius * 0.065))
    const initialElapsed = Math.max(0, Date.now() - (projectile.issuedAt ?? Date.now()))
    projectileNode.rotation((Math.atan2(dy, dx) * 180) / Math.PI)
    blast?.position(projectile.to)
    const animation = new Konva.Animation((frame) => {
      const elapsed = initialElapsed + (frame?.time ?? 0)
      const raw = Math.min(1, elapsed / duration)
      const chargeEnd = 0.08
      const travelEnd = 0.48
      const travelRaw = Math.max(0, Math.min(1, (raw - chargeEnd) / (travelEnd - chargeEnd)))
      const travel = 1 - Math.pow(1 - travelRaw, 2.4)
      const perpendicularX = -dy / distance
      const perpendicularY = dx / distance
      const wobble = Math.sin(travelRaw * Math.PI * 6) * orbRadius * 0.22 * (1 - travelRaw)
      projectileNode.x(projectile.from.x + dx * travel + perpendicularX * wobble)
      projectileNode.y(projectile.from.y + dy * travel + perpendicularY * wobble)
      projectileNode.visible(raw < travelEnd)
      projectileNode.opacity(raw < chargeEnd ? Math.max(0.2, raw / chargeEnd) : 1)
      const pulse = 1 + Math.sin(elapsed * 0.055) * 0.18
      outerOrb?.radius(orbRadius * pulse)
      innerOrb?.radius(orbRadius * 0.46 * (2 - pulse))
      if (tail) {
        const tailLength = orbRadius * (2.8 + Math.sin(elapsed * 0.045) * 0.35)
        tail.points([-tailLength, 0, -orbRadius * 0.5, 0])
      }

      if (blast) {
        const explosionRaw = Math.max(0, Math.min(1, (raw - travelEnd) / (1 - travelEnd)))
        const expansion = 1 - Math.pow(1 - explosionRaw, 3)
        const fade = explosionRaw < 0.62 ? 1 : Math.max(0, (1 - explosionRaw) / 0.38)
        blast.visible(explosionRaw > 0)
        blast.opacity(fade)
        blast.scale({ x: 0.08 + expansion * 0.94, y: 0.08 + expansion * 0.94 })
        blastCore?.radius(radius * (0.72 + Math.sin(elapsed * 0.038) * 0.055))
        blastRing?.radius(radius * (0.55 + expansion * 0.48))
        blastRing?.opacity(Math.max(0, 0.9 - explosionRaw * 0.75))
        shockwave?.radius(radius * (0.35 + expansion * 0.95))
        shockwave?.opacity(Math.max(0, 0.82 - explosionRaw * 0.82))
      }
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [projectile])

  const radius = Math.max(24, projectile.radiusPx ?? 120)
  const orbRadius = Math.max(7, Math.min(14, radius * 0.065))
  const flameClouds = Array.from({ length: 14 }, (_, index) => {
    const angle = index / 14 * Math.PI * 2
    const ring = index % 2 === 0 ? 0.48 : 0.68
    return {
      x: Math.cos(angle) * radius * ring,
      y: Math.sin(angle) * radius * ring,
      radius: radius * (index % 3 === 0 ? 0.29 : 0.23),
      fill: index % 3 === 0
        ? 'rgba(239,68,68,0.58)'
        : index % 2 === 0
          ? 'rgba(249,115,22,0.66)'
          : 'rgba(251,191,36,0.56)',
    }
  })

  if (fireImage) {
    return (
      <MovingFireTextureEffect
        projectile={projectile}
        fireImage={fireImage}
        explosionImage={explosionImage}
        spriteSize={92}
        impactDiameter={radius * 2.15}
      />
    )
  }
  return (
    <>
      <Group
        ref={projectileRef}
        x={projectile.from.x}
        y={projectile.from.y}
        listening={false}
      >
        <Line
          ref={tailRef}
          points={[-orbRadius * 3, 0, -orbRadius * 0.5, 0]}
          stroke="rgba(220,38,38,0.72)"
          strokeWidth={orbRadius * 1.65}
          lineCap="round"
          shadowColor="#ef4444"
          shadowBlur={orbRadius * 1.8}
          perfectDrawEnabled={false}
        />
        <Line
          points={[-orbRadius * 2.2, 0, -orbRadius * 0.35, 0]}
          stroke="rgba(251,146,60,0.95)"
          strokeWidth={orbRadius * 0.88}
          lineCap="round"
          shadowColor="#f97316"
          shadowBlur={orbRadius}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={outerOrbRef}
          radius={orbRadius}
          fill="#f97316"
          stroke="#fed7aa"
          strokeWidth={1.4}
          shadowColor="#ef4444"
          shadowBlur={orbRadius * 2}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={innerOrbRef}
          radius={orbRadius * 0.46}
          fill="#fff7c2"
          shadowColor="#fde047"
          shadowBlur={orbRadius}
          perfectDrawEnabled={false}
        />
      </Group>
      <Group
        ref={blastRef}
        x={projectile.to.x}
        y={projectile.to.y}
        visible={false}
        listening={false}
      >
        <Circle
          ref={shockwaveRef}
          radius={radius * 0.35}
          stroke="rgba(254,240,138,0.92)"
          strokeWidth={Math.max(3, radius * 0.035)}
          shadowColor="#f97316"
          shadowBlur={Math.max(12, radius * 0.16)}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={blastCoreRef}
          radius={radius * 0.72}
          fill="rgba(220,38,38,0.32)"
          shadowColor="#ef4444"
          shadowBlur={Math.max(20, radius * 0.24)}
          perfectDrawEnabled={false}
        />
        {flameClouds.map((cloud, index) => (
          <Circle
            key={index}
            x={cloud.x}
            y={cloud.y}
            radius={cloud.radius}
            fill={cloud.fill}
            shadowColor={index % 2 === 0 ? '#ef4444' : '#f59e0b'}
            shadowBlur={Math.max(8, radius * 0.1)}
            perfectDrawEnabled={false}
          />
        ))}
        <Circle
          radius={radius * 0.42}
          fill="rgba(254,215,170,0.82)"
          shadowColor="#facc15"
          shadowBlur={Math.max(14, radius * 0.18)}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={blastRingRef}
          radius={radius * 0.55}
          stroke="rgba(254,215,170,0.96)"
          strokeWidth={Math.max(3, radius * 0.045)}
          shadowColor="#f97316"
          shadowBlur={Math.max(12, radius * 0.13)}
          perfectDrawEnabled={false}
        />
        {Array.from({ length: 20 }, (_, index) => {
          const rotation = index * 18
          const inner = radius * (0.5 + (index % 3) * 0.05)
          const outer = radius * (0.82 + (index % 4) * 0.05)
          return (
            <Line
              key={rotation}
              points={[inner, 0, outer, 0]}
              rotation={rotation}
              stroke={index % 2 === 0 ? '#fde68a' : '#fb923c'}
              strokeWidth={Math.max(2, radius * 0.022)}
              lineCap="round"
              shadowColor="#ef4444"
              shadowBlur={Math.max(4, radius * 0.045)}
              perfectDrawEnabled={false}
            />
          )
        })}
      </Group>
    </>
  )
}

function ActiveTurnHalo({ radius }: { radius: number }) {
  const groupRef = useRef<Konva.Group>(null)
  const innerRef = useRef<Konva.Circle>(null)
  const outerRef = useRef<Konva.Circle>(null)
  const reducedMotion = usePrefersReducedMotion()

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    (frame) => {
      const seconds = (frame?.time ?? 0) / 1000
      const wave = (Math.sin(seconds * Math.PI * 3) + 1) / 2
      const travel = (seconds % 1.2) / 1.2
      innerRef.current?.radius(radius * (1.18 + wave * 0.1))
      innerRef.current?.opacity(0.52 + wave * 0.4)
      innerRef.current?.shadowBlur(radius * (0.35 + wave * 0.3))
      outerRef.current?.radius(radius * (1.3 + travel * 0.36))
      outerRef.current?.opacity(0.68 * (1 - travel))
    },
    [radius],
    { active: !reducedMotion, fps: 30 },
  )

  const strokeWidth = Math.max(2, radius * 0.09)
  return (
    <Group ref={groupRef} listening={false}>
      <Circle
        ref={outerRef}
        radius={radius * 1.3}
        stroke="#fbbf24"
        strokeWidth={Math.max(1.5, strokeWidth * 0.72)}
        opacity={0.52}
        shadowColor="#f59e0b"
        shadowBlur={radius * 0.4}
      />
      <Circle
        ref={innerRef}
        radius={radius * 1.23}
        stroke="#c4b5fd"
        strokeWidth={strokeWidth}
        opacity={0.88}
        shadowColor="#8b5cf6"
        shadowBlur={radius * 0.58}
      />
    </Group>
  )
}

function TokenMovementPathLine({
  animation,
  viewScale,
}: {
  animation: TokenMovementAnimation
  viewScale: number
}) {
  const [expired, setExpired] = useState(
    () => Date.now() >= animation.issuedAt + animation.durationMs,
  )

  useEffect(() => {
    const remainingMs = animation.issuedAt + animation.durationMs - Date.now()
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remainingMs))
    return () => window.clearTimeout(timer)
  }, [animation.durationMs, animation.id, animation.issuedAt])

  if (expired) return null
  const inv = 1 / Math.max(viewScale, 0.01)
  return (
    <Line
      points={animation.points.flatMap((point) => [point.x, point.y])}
      stroke="rgba(125,211,252,0.68)"
      strokeWidth={3 * inv}
      lineCap="round"
      lineJoin="round"
      dash={[8 * inv, 6 * inv]}
      listening={false}
    />
  )
}

function TokenNode({
  renderMode = 'full',
  token,
  gridSize,
  builtinGrid = false,
  selected,
  targetSelected = false,
  defeated = false,
  currentTurn = false,
  draggable = true,
  hp,
  showHpBar = true,
  standardConditions = [],
  standardConditionMarks = [],
  shillelaghActive = false,
  spellStatusMarks = [],
  airborne = false,
  onStandardConditionClick,
  hoverLabel,
  showName = true,
  onHoverChange,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  registerPositionNode,
  instantPosition = false,
}: {
  renderMode?: 'full' | 'body' | 'overlay' | 'label' | 'vitals'
  token: Token
  gridSize: number
  builtinGrid?: boolean
  selected: boolean
  targetSelected?: boolean
  defeated?: boolean
  currentTurn?: boolean
  draggable?: boolean
  hp?: { hp: number; max: number; temp?: number }
  showHpBar?: boolean
  standardConditions?: readonly Dnd5eStandardConditionId[]
  standardConditionMarks?: readonly StandardConditionTokenMark[]
  shillelaghActive?: boolean
  spellStatusMarks?: readonly SpellStatusTokenMark[]
  airborne?: boolean
  onStandardConditionClick?: (condition?: Dnd5eStandardConditionId) => void
  hoverLabel?: string
  showName?: boolean
  onHoverChange?: (hovered: boolean) => void
  onSelect: () => void
  onDragStart?: (x: number, y: number) => void
  onDragMove?: (x: number, y: number) => void
  onDragEnd: (x: number, y: number) => void
  /** Cancel sub-threshold drags: clear preview without movement/broadcast. */
  onDragCancel?: () => void
  registerPositionNode?: (
    tokenId: string,
    node: Konva.Group,
    cancelPositionAnimation: () => void,
    setPositionLocked: (locked: boolean) => void,
  ) => void | (() => void)
  instantPosition?: boolean
}) {
  const groupRef = useRef<Konva.Group>(null)
  const tokenImageKey = token.tokenPortrait
    ? `inline:${token.tokenPortrait}`
    : token.portraitImageId
      ? `shared:${token.portraitImageId}`
      : ''
  const [loadedTokenImage, setLoadedTokenImage] = useState<{ key: string; image?: HTMLImageElement }>()
  const tokenImage = loadedTokenImage?.key === tokenImageKey ? loadedTokenImage.image : undefined
  const movementAnimation = token.movementAnimation
  const latestPositionRef = useRef({ x: token.x, y: token.y })
  const draggingRef = useRef(false)
  const externalPositionLockedRef = useRef(false)
  const suppressClickUntilRef = useRef(0)
  const prevGridSizeRef = useRef(gridSize)
  // 拖拽起点（用于判断是否超过移动阈值）
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  // 当前在途的位置补间，启动新补间前先销毁它
  const reconcileTweenRef = useRef<Konva.Tween | null>(null)
  const movementFrameRef = useRef(0)
  const cancelPositionAnimation = useCallback(() => {
    reconcileTweenRef.current?.destroy()
    reconcileTweenRef.current = null
    if (movementFrameRef.current) {
      window.cancelAnimationFrame(movementFrameRef.current)
      movementFrameRef.current = 0
    }
  }, [])
  const setPositionLocked = useCallback((locked: boolean) => {
    externalPositionLockedRef.current = locked
  }, [])

  useLayoutEffect(() => {
    const node = groupRef.current
    if (!node || !registerPositionNode) return
    return registerPositionNode(token.id, node, cancelPositionAnimation, setPositionLocked)
  }, [cancelPositionAnimation, registerPositionNode, setPositionLocked, token.id])

  useEffect(() => () => cancelPositionAnimation(), [cancelPositionAnimation])
  const radius = tokenDisplayRadius(gridSize, token.size, builtinGrid)
  const labelSize = Math.max(9, radius * 0.42)
  const labelBarH = Math.max(14, radius * 0.55)
  const scale = tokenScale(radius)
  const selectedStrokeW = tokenLineWidth(radius, 3)
  const selectedGap = 5 * scale
  const statusStrokeW = tokenLineWidth(radius, 4)
  const baseStrokeW = tokenLineWidth(radius, 3)
  const tempHp = Math.max(0, hp?.temp ?? 0)
  const hpDenominator = hp ? Math.max(1, hp.max + tempHp) : 1
  const hpPct = hp ? Math.max(0, Math.min(1, hp.hp / hpDenominator)) : null
  const tempHpPct = hp ? Math.max(0, Math.min(1 - (hpPct ?? 0), tempHp / hpDenominator)) : 0
  const realHpPct = hp && hp.max > 0 ? Math.max(0, Math.min(1, hp.hp / hp.max)) : null
  const hpColor = defeated
    ? '#64748b'
    : realHpPct === null
      ? '#888'
      : realHpPct > 0.5
        ? '#34d399'
        : realHpPct > 0.25
          ? '#fbbf24'
          : '#f87171'
  const isStunned = standardConditions.includes('stunned')
  const isPoisoned = standardConditions.includes('poisoned')
  const strokeColor = defeated ? '#94a3b8' : isStunned ? '#facc15' : isPoisoned ? '#4ade80' : token.color
  const barW = radius * 2
  const hoverFontSize = Math.max(8, radius * 0.32)
  const hoverLabelWidth = hoverLabel
    ? Math.min(radius * 9, Math.max(radius * 2.4, hoverLabel.length * hoverFontSize * 0.92))
    : radius * 2.4
  const isDragonEmoji = token.emoji === '\u{1f409}' || token.emoji === '\u{1f432}'
  const isDetectedUnseen = token.perceptionVisibility === 'detected-unseen'
  const emojiFontScale = isDragonEmoji ? 0.94 : 1
  const emojiOffsetY = isDragonEmoji ? radius * 0.07 : 0

  useLayoutEffect(() => {
    latestPositionRef.current = { x: token.x, y: token.y }
  }, [token.x, token.y])

  useEffect(() => {
    if (renderMode !== 'full' && renderMode !== 'body') return
    let disposed = false
    let objectUrl: string | undefined

    const load = (source: string) => {
      const image = new Image()
      image.onload = () => {
        if (!disposed) setLoadedTokenImage({ key: tokenImageKey, image })
      }
      image.onerror = () => {
        if (!disposed) setLoadedTokenImage({ key: tokenImageKey })
      }
      image.src = source
    }

    if (token.tokenPortrait) {
      load(token.tokenPortrait)
    } else if (token.portraitImageId) {
      void getImage(token.portraitImageId).then((blob) => {
        if (!blob || disposed) return
        objectUrl = URL.createObjectURL(blob)
        load(objectUrl)
      })
    }

    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [renderMode, token.tokenPortrait, token.portraitImageId, tokenImageKey])

  const tokenImageCrop = useMemo(() => {
    if (!tokenImage) return undefined
    const width = Math.max(1, tokenImage.naturalWidth)
    const height = Math.max(1, tokenImage.naturalHeight)
    const side = Math.min(width, height)
    return {
      x: (width - side) / 2,
      y: (height - side) / 2,
      width: side,
      height: side,
    }
  }, [tokenImage])

  useLayoutEffect(() => {
    const node = groupRef.current
    if (!node) return
    const animated = movementAnimation
      ? tokenMovementAnimationPosition(
          movementAnimation,
          Date.now() - movementAnimation.issuedAt,
        )
      : undefined
    node.position(animated ?? latestPositionRef.current)
  }, [movementAnimation])

  useEffect(() => {
    const node = groupRef.current
    if (!node) return

    if (prevGridSizeRef.current !== gridSize) {
      prevGridSizeRef.current = gridSize
      cancelPositionAnimation()
      node.position({ x: token.x, y: token.y })
      return
    }

    if (draggingRef.current || externalPositionLockedRef.current || instantPosition) {
      cancelPositionAnimation()
      node.position({ x: token.x, y: token.y })
      return
    }

    if (
      movementAnimation &&
      Date.now() < movementAnimation.issuedAt + movementAnimation.durationMs
    ) {
      reconcileTweenRef.current?.destroy()
      reconcileTweenRef.current = null
      return
    }

    const dist = Math.hypot(node.x() - token.x, node.y() - token.y)
    if (dist < 1) {
      // Stop any in-flight tween before repositioning immediately.
      cancelPositionAnimation()
      node.position({ x: token.x, y: token.y })
      return
    }

    // Cancel and destroy previous tween before starting a new one.
    cancelPositionAnimation()
    const tween = new Konva.Tween({
      node,
      x: token.x,
      y: token.y,
      duration: TOKEN_MOVE_DURATION,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        if (reconcileTweenRef.current === tween) reconcileTweenRef.current = null
      },
    })
    reconcileTweenRef.current = tween
    tween.play()
  }, [cancelPositionAnimation, token.x, token.y, gridSize, instantPosition, movementAnimation])

  useEffect(() => {
    const node = groupRef.current
    if (
      !node ||
      !movementAnimation ||
      instantPosition ||
      externalPositionLockedRef.current
    ) return

    cancelPositionAnimation()
    let disposed = false
    const tick = () => {
      if (disposed || draggingRef.current || externalPositionLockedRef.current) {
        movementFrameRef.current = 0
        return
      }
      const animated = tokenMovementAnimationPosition(
        movementAnimation,
        Date.now() - movementAnimation.issuedAt,
      )
      if (!animated) {
        movementFrameRef.current = 0
        node.position({ x: token.x, y: token.y })
        node.getLayer()?.batchDraw()
        return
      }
      node.position(animated)
      node.getLayer()?.batchDraw()
      movementFrameRef.current = window.requestAnimationFrame(tick)
    }
    tick()
    return () => {
      disposed = true
      if (movementFrameRef.current) {
        window.cancelAnimationFrame(movementFrameRef.current)
        movementFrameRef.current = 0
      }
    }
  }, [cancelPositionAnimation, instantPosition, movementAnimation, token.x, token.y])

  const nameLayer = showName ? (
    <Group y={radius + 4}>
      <Rect
        x={-radius - 6}
        width={(radius + 6) * 2}
        height={labelBarH}
        fill="rgba(10,11,22,0.8)"
        cornerRadius={Math.max(4, radius * 0.12)}
      />
      <Text
        text={token.label}
        fontSize={labelSize}
        fill={defeated ? '#94a3b8' : '#e2e8f0'}
        width={(radius + 6) * 2}
        offsetX={radius + 6}
        height={labelBarH}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  ) : null

  const vitalsLayer = (
    <>
      {showHpBar && hpPct !== null && (
        <Group y={-radius - 12}>
          <Rect x={-barW / 2} width={barW} height={6} cornerRadius={3} fill="rgba(10,11,22,0.85)" />
          {tempHp > 0 ? (
            <>
              <Rect
                x={-barW / 2}
                width={barW * (hpPct + tempHpPct)}
                height={6}
                cornerRadius={3}
                fill="#facc15"
                opacity={0.95}
              />
              <Rect x={-barW / 2} width={barW * hpPct} height={6} cornerRadius={3} fill={hpColor} />
              {hpPct > 0 && tempHpPct > 0 && (
                <>
                  <Rect
                    x={-barW / 2 + Math.max(0, barW * hpPct - 3)}
                    width={3}
                    height={6}
                    fill={hpColor}
                  />
                  <Rect
                    x={-barW / 2 + Math.max(0, barW * hpPct - 0.5)}
                    width={1}
                    height={6}
                    fill="rgba(15,23,42,0.75)"
                  />
                </>
              )}
            </>
          ) : (
            <Rect x={-barW / 2} width={barW * hpPct} height={6} cornerRadius={3} fill={hpColor} />
          )}
          <Text
            text={tempHp > 0 ? `${hp!.hp}/${hp!.max} (+${tempHp})` : `${hp!.hp}/${hp!.max}`}
            y={-labelSize - 2}
            width={barW * 1.8}
            x={-barW * 0.9}
            fontSize={labelSize}
            fill="#e2e8f0"
            align="center"
          />
        </Group>
      )}

      {(() => {
        let grid = (airborne ? 1 : 0) + (shillelaghActive ? 1 : 0)
        return (
          <>
            {airborne && (
              <Dnd5eFlightBadge
                radius={radius}
                onClick={() => onStandardConditionClick?.()}
              />
            )}
            {shillelaghActive && (
              <ShillelaghTokenBadge
                radius={radius}
                gridIndex={airborne ? 1 : 0}
              />
            )}
            {spellStatusMarks.map((mark) => (
              <SpellStatusTokenBadge
                key={`spell-status:${mark.statusId}`}
                radius={radius}
                gridIndex={grid++}
                mark={mark}
              />
            ))}
            {(standardConditions.length > 4 ? standardConditions.slice(0, 3) : standardConditions)
              .map((condition) => (
                <Dnd5eStandardConditionBadge
                  key={`dnd5e-condition:${condition}`}
                  radius={radius}
                  gridIndex={grid++}
                  condition={condition}
                  mark={standardConditionMarks.find((mark) => mark.condition === condition)}
                  onClick={() => onStandardConditionClick?.(condition)}
                />
              ))}
            {standardConditions.length > 4 && (
              <Dnd5eStandardConditionBadge
                radius={radius}
                gridIndex={grid++}
                overflowCount={standardConditions.length - 3}
                onClick={() => onStandardConditionClick?.()}
              />
            )}
          </>
        )
      })()}

      {renderMode !== 'body' && hoverLabel && (
        <Group y={-radius - 34 * scale} listening={false}>
          <Rect
            x={-hoverLabelWidth / 2}
            y={-10 * scale}
            width={hoverLabelWidth}
            height={20 * scale}
            cornerRadius={5 * scale}
            fill="rgba(10,11,22,0.92)"
            stroke="rgba(125,211,252,0.65)"
            strokeWidth={tokenLineWidth(radius, 1)}
            shadowBlur={6 * scale}
            shadowColor="rgba(0,0,0,0.55)"
          />
          <Text
            text={hoverLabel}
            x={-hoverLabelWidth / 2}
            y={-8 * scale}
            width={hoverLabelWidth}
            height={16 * scale}
            fontSize={hoverFontSize}
            fontStyle="bold"
            fill="#bae6fd"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
    </>
  )

  const infoLayer = (
    <>
      {nameLayer}
      {vitalsLayer}
    </>
  )

  if (renderMode === 'overlay' || renderMode === 'label' || renderMode === 'vitals') {
    return (
      <Group
        ref={groupRef}
        listening={false}
        opacity={defeated ? 0.75 : 1}
      >
        {renderMode === 'label' ? nameLayer : renderMode === 'vitals' ? vitalsLayer : infoLayer}
      </Group>
    )
  }

  const handleTokenSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true
    if (draggingRef.current || Date.now() < suppressClickUntilRef.current) return
    suppressClickUntilRef.current = Date.now() + 300
    onSelect()
  }

  return (
    <Group
      ref={groupRef}
      name="map-token"
      draggable={draggable}
      opacity={defeated ? 0.55 : 1}
      onClick={handleTokenSelect}
      onTap={handleTokenSelect}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onDragStart={(e) => {
        cancelPositionAnimation()
        draggingRef.current = true
        dragStartRef.current = { x: e.target.x(), y: e.target.y() }
        onDragStart?.(e.target.x(), e.target.y())
      }}
      onDragMove={(e) => {
        onDragMove?.(e.target.x(), e.target.y())
      }}
      onDragEnd={(e) => {
        suppressClickUntilRef.current = Date.now() + 250
        draggingRef.current = false
        const x = e.target.x()
        const y = e.target.y()
        const start = dragStartRef.current
        dragStartRef.current = null
        // Sub-threshold drag: do not submit movement or broadcast; snap back and clear preview.
        if (start && Math.hypot(x - start.x, y - start.y) < TOKEN_DRAG_THRESHOLD_PX) {
          e.target.position({ x: token.x, y: token.y })
          onDragCancel?.()
          return
        }
        onDragEnd(x, y)
      }}
    >
      {selected && (
        <Circle
          radius={radius + selectedGap}
          stroke="#a78bfa"
          strokeWidth={selectedStrokeW}
          dash={tokenDash(radius, [8, 6])}
          listening={false}
        />
      )}
      {currentTurn && !defeated && <ActiveTurnHalo radius={radius} />}
      {targetSelected && (
        <Circle
          radius={radius + selectedGap * 1.55}
          stroke="#facc15"
          strokeWidth={Math.max(2, selectedStrokeW * 0.9)}
          dash={tokenDash(radius, [5, 4])}
          shadowBlur={8 * scale}
          shadowColor="rgba(250,204,21,0.85)"
          listening={false}
        />
      )}
      {isDetectedUnseen && (
        <Circle
          radius={radius + selectedGap * 0.65}
          stroke="#94a3b8"
          strokeWidth={Math.max(1.5, baseStrokeW * 0.75)}
          dash={tokenDash(radius, [3, 5])}
          opacity={0.75}
          listening={false}
        />
      )}
      {isStunned && <StunGlow radius={radius} />}
      {isPoisoned && <PoisonCloudGlow radius={radius} />}
      <Circle
        radius={radius}
        fill={defeated ? 'rgba(30,32,45,0.92)' : 'rgba(10,11,22,0.85)'}
        stroke={strokeColor}
        strokeWidth={
          isStunned || isPoisoned
            ? statusStrokeW
            : baseStrokeW
        }
      />
      {tokenImage && tokenImageCrop && (
        <Group
          clipFunc={(context) => {
            context.beginPath()
            context.arc(0, 0, radius - Math.max(1, baseStrokeW / 2), 0, Math.PI * 2)
            context.closePath()
          }}
          listening={false}
        >
          <KonvaImage
            image={tokenImage}
            x={-radius}
            y={-radius}
            width={radius * 2}
            height={radius * 2}
            crop={tokenImageCrop}
            opacity={defeated ? 0.55 : 1}
          />
        </Group>
      )}
      {defeated && (
        <Circle
          radius={radius}
          fill="rgba(148,163,184,0.35)"
          listening={false}
        />
      )}

      {renderMode !== 'body' && hoverLabel && (
        <Group y={-radius - 34 * scale} listening={false}>
          <Rect
            x={-hoverLabelWidth / 2}
            y={-10 * scale}
            width={hoverLabelWidth}
            height={20 * scale}
            cornerRadius={5 * scale}
            fill="rgba(10,11,22,0.92)"
            stroke="rgba(125,211,252,0.65)"
            strokeWidth={tokenLineWidth(radius, 1)}
            shadowBlur={6 * scale}
            shadowColor="rgba(0,0,0,0.55)"
          />
          <Text
            text={hoverLabel}
            x={-hoverLabelWidth / 2}
            y={-8 * scale}
            width={hoverLabelWidth}
            height={16 * scale}
            fontSize={hoverFontSize}
            fontStyle="bold"
            fill="#bae6fd"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}

      {/* Health bar above token */}
      {renderMode !== 'body' && showHpBar && hpPct !== null && (
        <Group y={-radius - 12}>
          <Rect x={-barW / 2} width={barW} height={6} cornerRadius={3} fill="rgba(10,11,22,0.85)" />
          {tempHp > 0 ? (
            <>
              <Rect
                x={-barW / 2}
                width={barW * (hpPct + tempHpPct)}
                height={6}
                cornerRadius={3}
                fill="#facc15"
                opacity={0.95}
              />
              <Rect x={-barW / 2} width={barW * hpPct} height={6} cornerRadius={3} fill={hpColor} />
              {hpPct > 0 && tempHpPct > 0 && (
                <>
                  <Rect
                    x={-barW / 2 + Math.max(0, barW * hpPct - 3)}
                    width={3}
                    height={6}
                    fill={hpColor}
                  />
                  <Rect
                    x={-barW / 2 + Math.max(0, barW * hpPct - 0.5)}
                    width={1}
                    height={6}
                    fill="rgba(15,23,42,0.75)"
                  />
                </>
              )}
            </>
          ) : (
            <Rect x={-barW / 2} width={barW * hpPct} height={6} cornerRadius={3} fill={hpColor} />
          )}
          <Text
            text={tempHp > 0 ? `${hp!.hp}/${hp!.max} (+${tempHp})` : `${hp!.hp}/${hp!.max}`}
            y={-labelSize - 2}
            width={barW * 1.8}
            x={-barW * 0.9}
            fontSize={labelSize}
            fill="#e2e8f0"
            align="center"
          />
        </Group>
      )}
      {!tokenImage && (
        <Text
          text={token.emoji}
          y={emojiOffsetY}
          fontSize={radius * emojiFontScale}
          width={radius * 2}
          height={radius * 2}
          offsetX={radius}
          offsetY={radius}
          align="center"
          verticalAlign="middle"
          opacity={defeated ? 0.65 : 1}
        />
      )}
      {isPoisoned && <PoisonCloud radius={radius} />}
      {isStunned && <StunOrbitStars radius={radius} />}
      {renderMode !== 'body' && (() => {
        let grid = airborne ? 1 : 0
        return (
          <>
            {airborne && (
              <Dnd5eFlightBadge
                radius={radius}
                onClick={() => onStandardConditionClick?.()}
              />
            )}
            {(standardConditions.length > 4 ? standardConditions.slice(0, 3) : standardConditions)
              .map((condition) => (
                <Dnd5eStandardConditionBadge
                  key={`dnd5e-condition:${condition}`}
                  radius={radius}
                  gridIndex={grid++}
                  condition={condition}
                  onClick={() => onStandardConditionClick?.(condition)}
                />
              ))}
            {standardConditions.length > 4 && (
              <Dnd5eStandardConditionBadge
                radius={radius}
                gridIndex={grid++}
                overflowCount={standardConditions.length - 3}
                onClick={() => onStandardConditionClick?.()}
              />
            )}
          </>
        )
      })()}
      {/* 名称标签 */}
      {renderMode !== 'body' && showName && (
        <Group y={radius + 4}>
          <Rect
            x={-radius - 6}
            width={(radius + 6) * 2}
            height={labelBarH}
            fill="rgba(10,11,22,0.8)"
            cornerRadius={Math.max(4, radius * 0.12)}
          />
          <Text
            text={token.label}
            fontSize={labelSize}
            fill={defeated ? '#94a3b8' : '#e2e8f0'}
            width={(radius + 6) * 2}
            offsetX={radius + 6}
            height={labelBarH}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
    </Group>
  )
}

const STUN_STAR_COUNT = 4

/** 燃烧光晕（在 token 底层，向外扩散） */
function StunOrbitStars({ radius }: { radius: number }) {
  const groupRef = useRef<Konva.Group>(null)
  const starRefs = useRef<(Konva.Text | null)[]>([])

  const orbitR = radius * 0.62
  const centerY = -radius * 1.22
  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    (frame) => {
      const t = (frame?.time ?? 0) / 1000
      starRefs.current.forEach((star, i) => {
        if (!star) return
        const baseAngle = (i * 2 * Math.PI) / STUN_STAR_COUNT
        const angle = t * 3.2 + baseAngle
        star.x(Math.cos(angle) * orbitR)
        star.y(centerY + Math.sin(angle) * orbitR * 0.45)
        star.rotation((t * 220 + i * 90) % 360)
        star.opacity(0.75 + Math.sin(t * 6 + i) * 0.25)
      })
    },
    [radius],
  )

  const starSize = Math.max(10, radius * 0.34)
  return (
    <Group ref={groupRef} listening={false}>
      {Array.from({ length: STUN_STAR_COUNT }, (_, i) => (
        <Text
          key={i}
          ref={(el) => {
            starRefs.current[i] = el
          }}
          text={'\u2726'}
          fontSize={starSize}
          fill="#fde047"
          stroke="#ca8a04"
          strokeWidth={tokenLineWidth(radius, 0.5)}
          offsetX={starSize / 2}
          offsetY={starSize / 2}
          shadowBlur={6 * tokenScale(radius)}
          shadowColor="#eab308"
          listening={false}
        />
      ))}
    </Group>
  )
}

function StunGlow({ radius }: { radius: number }) {
  const ringRef = useRef<Konva.Circle>(null)

  useStatusAnimation(
    () => ringRef.current?.getLayer() ?? null,
    (frame) => {
      const ring = ringRef.current
      if (!ring || !frame) return
      const t = frame.time / 600
      ring.opacity(0.2 + Math.sin(t) * 0.15)
      ring.radius(radius + 3 + Math.sin(t * 1.2) * 2)
    },
    [radius],
  )

  return (
    <Circle
      ref={ringRef}
      radius={radius + 3 * tokenScale(radius)}
      stroke="#facc15"
      strokeWidth={tokenLineWidth(radius, 2)}
      dash={tokenDash(radius, [4, 4])}
      opacity={0.25}
      listening={false}
    />
  )
}

interface FogLayerSlot {
  ox: number
  oy: number
  scale: number
  phase: number
  baseOpacity: number
  rot: number
}

const POISON_MIST_GRADIENT: (number | string)[] = [
  0,
  'rgba(130,255,70,0.52)',
  0.35,
  'rgba(80,200,40,0.30)',
  0.7,
  'rgba(30,120,30,0.14)',
  1,
  'rgba(30,120,30,0)',
]

function buildPoisonFogLayer(
  count: number,
  veilCount: number,
  cfg: { scale: [number, number]; opacity: [number, number]; spread: number },
): FogLayerSlot[] {
  const out: FogLayerSlot[] = []

  for (let i = 0; i < veilCount; i++) {
    out.push({
      ox: (i - (veilCount - 1) / 2) * 0.05,
      oy: ((i % 2) * 2 - 1) * 0.04,
      scale: 1.02 + i * 0.04,
      phase: i * 2.1,
      baseOpacity: cfg.opacity[1] * (0.9 + i * 0.06),
      rot: i * 28,
    })
  }

  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963
    const dist = cfg.spread * Math.sqrt((i + 1) / (count + 1))
    const mix = ((i * 7) % 10) / 10
    out.push({
      ox: Math.cos(angle) * dist,
      oy: Math.sin(angle) * dist,
      scale: cfg.scale[0] + mix * (cfg.scale[1] - cfg.scale[0]),
      phase: i * 0.58 + angle,
      baseOpacity: cfg.opacity[0] + mix * (cfg.opacity[1] - cfg.opacity[0]),
      rot: (i * 41 + 11) % 72 - 36,
    })
  }

  return out
}

const POISON_BACK_PARTICLES = buildPoisonFogLayer(16, 3, {
  scale: [0.62, 0.98],
  opacity: [0.18, 0.32],
  spread: 0.36,
})

const POISON_FRONT_PARTICLES = buildPoisonFogLayer(20, 3, {
  scale: [0.55, 0.92],
  opacity: [0.17, 0.28],
  spread: 0.4,
})

/** Fog opacity breathes from 60% to 30%, half cycle 2s, full cycle 4s. */
function poisonFogPulseOpacity(t: number): number {
  return 0.45 + 0.15 * Math.cos(t * (Math.PI / 2))
}

function animateFogLayer(
  node: Konva.Circle,
  slot: FogLayerSlot,
  radius: number,
  t: number,
  opacityMul: number,
) {
  const breathe = 1 + Math.sin(t * 0.45 + slot.phase) * 0.03
  const r = radius * slot.scale * breathe
  const driftX = Math.sin(t * 0.32 + slot.phase) * radius * 0.04
  const driftY = Math.cos(t * 0.26 + slot.phase * 0.85) * radius * 0.03
  const rot = slot.rot + Math.sin(t * 0.18 + slot.phase) * 6

  node.x(slot.ox * radius + driftX)
  node.y(slot.oy * radius + driftY)
  node.radius(r)
  node.fillRadialGradientEndRadius(r)
  node.rotation(rot)
  node.opacity(slot.baseOpacity * opacityMul)
}

/** Poison cloud: radial-gradient fog puffs with slow drifting. */
function PoisonSmokeParticles({
  radius,
  particles,
  opacityMul = 1,
}: {
  radius: number
  particles: FogLayerSlot[]
  opacityMul?: number
}) {
  const groupRef = useRef<Konva.Group>(null)
  const particleRefs = useRef<(Konva.Circle | null)[]>([])

  useStatusAnimation(
    () => groupRef.current?.getLayer() ?? null,
    (frame) => {
      const group = groupRef.current
      if (!group) return
      const t = (frame?.time ?? 0) / 1000
      group.opacity(poisonFogPulseOpacity(t))
      particleRefs.current.forEach((node, i) => {
        if (!node) return
        animateFogLayer(node, particles[i], radius, t, opacityMul)
      })
    },
    [radius, particles, opacityMul],
  )

  return (
    <Group
      ref={groupRef}
      opacity={0.6}
      listening={false}
      clipFunc={(ctx) => {
        ctx.arc(0, 0, radius, 0, Math.PI * 2, false)
      }}
    >
      {particles.map((slot, i) => {
        const r = radius * slot.scale
        return (
          <Circle
            key={i}
            ref={(el) => {
              particleRefs.current[i] = el
            }}
            x={slot.ox * radius}
            y={slot.oy * radius}
            radius={r}
            rotation={slot.rot}
            fillRadialGradientStartPoint={{ x: 0, y: 0 }}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndPoint={{ x: 0, y: 0 }}
            fillRadialGradientEndRadius={r}
            fillRadialGradientColorStops={POISON_MIST_GRADIENT}
            opacity={slot.baseOpacity * opacityMul}
            listening={false}
          />
        )
      })}
    </Group>
  )
}

/** 毒云底层雾（token 下方，可与燃烧叠加） */
function PoisonCloudGlow({ radius }: { radius: number }) {
  return <PoisonSmokeParticles radius={radius} particles={POISON_BACK_PARTICLES} opacityMul={1.1} />
}

/** 毒云粒子（token 上方，可与火焰叠加） */
function PoisonCloud({ radius }: { radius: number }) {
  return <PoisonSmokeParticles radius={radius} particles={POISON_FRONT_PARTICLES} opacityMul={1} />
}

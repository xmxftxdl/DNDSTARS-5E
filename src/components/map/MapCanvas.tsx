import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Group, Circle, Text, Rect, Arrow } from 'react-konva'
import Konva from 'konva'
import { getImage } from '../../lib/imageStore'
import {
  clampGridSize,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_OPACITY,
  gridStrokeRgba,
  measureSegmentCells,
  measureSnapsToGrid,
  snapToCellCenter,
  type GridCell,
} from '../../lib/gridCombat'
import { tokenMovementAnimationPosition } from '../../lib/tokenMovementAnimation'
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
  combatPresentationSavingThrowAbilityLabel,
  type CombatPresentationAttackTargetEffect,
  type CombatPresentationSavingThrowAbility,
} from '../../lib/combatPresentation'
import { preloadBrowserImage } from '../../lib/browserImageCache'
import MapMeasureLine from './MapMeasureLine'
import { rectFromPoints, type AoeHighlight, type DeleteSelectionRect, type MapProjectile, type SpellStatusTokenMark, type StandardConditionTokenMark } from './mapCanvasContracts'
export type { AoeHighlight, DeleteSelectionRect, MapProjectile, SpellStatusTokenMark, StandardConditionTokenMark } from './mapCanvasContracts'
import Dnd5eItemAreaOverlays from './Dnd5eItemAreaOverlays'
import type { ConcentrationTokenMark } from './Dnd5eConcentrationTokenBadge'
import {
  retainPendingPersistentAreaEntrances,
} from './flamingSphereHandoff'
import {
  MAP_CANVAS_MATTE_COLOR,
  MAP_CANVAS_UNMEASURED_SIZE,
  mapCanvasViewportCanRender,
  measureMapCanvasViewport,
} from './mapCanvasSurface'
import {
  TOKEN_BORDER_FLOW_FPS,
  type TokenBorderFlowPalette,
  tokenBorderFallbackPalette,
  tokenBorderFlowRotationDegrees,
} from './tokenBorderFlow'
import { AttackTargetEffect, ChillTouchPersistentMark, CombatProjectileEffect } from './MapCombatEffects'
import {
  AoeCellHighlights,
  TokenBorderFlowRing,
  TokenMovementPathLine,
  TokenNode,
  type RegisterTokenBorderFlowAnimation,
  type TokenBorderFlowAnimationEntry,
  type TokenStatusTooltipChange,
} from './MapTokenNode'
import { usePrefersReducedMotion, useStatusAnimation } from './mapEffectHooks'
import { FogOfWarLayer, LightingLayer, PlayerVisibilityLayer } from './MapVisibilityLayers'
import { MapGeometryDiagnosticsLayer, MapGeometryLayer } from './MapGeometryLayers'
import { Dnd5ePluginAreaOverlays, DifficultTerrainCellOverlays, TerrainElevationContours } from './MapPersistentAreaLayers'
import { gridLinePositions, isMapTokenNode } from './mapCanvasGeometryUtils'
import type { TokenStatusTooltipContent } from './tokenStatusTooltip'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eStandardConditionId } from '../../rulesets/dnd5e/conditions'
import type { Dnd5eTraversalMode } from '../../rulesets/dnd5e/traversal'
import {
  fogOperationForTool,
  fogShapeKindForTool,
  type FogShape,
  type FogTool,
  type MapFogState,
} from '../../lib/fogOfWar'
import {
  mapGeometryAttachOpeningToWall,
  mapGeometryOpeningOverlaps,
  mapGeometryGridSelectionBoundary,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  type MapGeometryEntity,
  type MapGeometryGridCell,
  type MapGeometryState,
  type MapGeometryTool,
  type MapGeometryPoint,
  type MapGeometryWallMaterial,
} from '../../lib/mapGeometry'
import type { MapGeometryDiagnostics } from '../../lib/mapGeometryDiagnostics'
import type { WallDetectionCandidate } from '../../lib/mapImageGeometryDetection'
import { collectMapDifficultTerrainCells } from '../../lib/mapDifficultTerrain'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { campaignLightIsActive } from '../../lib/campaignTime'
import type {
  MapTabletopAnnotation,
  MapTabletopFocus,
  MapTabletopPing,
  MapTabletopPoint,
  MapTabletopTool,
} from '../../lib/mapTabletop'
import type { SceneInteractionPointIcon, SceneRegion } from '../../lib/sceneOrchestration'
import { mapLightingRadiusFromDrag } from './mapLightingPresentation'
import {
  mapCanvasAoeGridCell,
  mapCanvasEffectTokenAreaRenderOffset,
  mapCanvasGeometryDrawShouldStart,
  mapCanvasStageCanPan,
  mapCanvasTokenClickAction,
} from './mapCanvasInteraction'

export interface MoveCircle {
  centerX: number
  centerY: number
  radiusPx: number
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
  /** Campaign clock projection supplied by the page/controller boundary. */
  worldMinute?: number
  /** Exact spell-portrait palettes for player classes and the shared monster frame. */
  tokenBorderPresentations?: Readonly<Record<string, TokenBorderFlowPalette>>
  /** Legacy flat-color fallback retained for callers outside the main map page. */
  tokenBorderColors?: Readonly<Record<string, string>>
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
  onDnd5ePluginAreaClick?: (areaId: string) => void
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
  /** Authoritative concentration markers colored by the concentrating actor. */
  concentrationTokenMarks?: ConcentrationTokenMark[]
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

function measurePointsEqual(a: Point, b: Point): boolean {
  return Math.hypot(b.x - a.x, b.y - a.y) < 1.5
}

export default function MapCanvas({
  map,
  worldMinute = 0,
  tokenBorderPresentations = {},
  tokenBorderColors = {},
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
  onDnd5ePluginAreaClick,
  tokenHoverLabels = {},
  projectiles = [],
  attackTargetEffects = [],
  chillTouchTokenIds = [],
  sanctuaryTokenIds = [],
  spellStatusTokenMarks = [],
  concentrationTokenMarks = [],
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
  const [size, setSize] = useState(MAP_CANVAS_UNMEASURED_SIZE)
  const [loadedMapImage, setLoadedMapImage] = useState<{
    mapId: string
    state: 'loaded' | 'missing' | 'error'
    image?: HTMLImageElement
  } | null>(null)
  const image = loadedMapImage?.mapId === map.id ? loadedMapImage.image : undefined
  const imageLoadState = loadedMapImage?.mapId === map.id ? loadedMapImage.state : 'loading'
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null)
  const [tokenStatusTooltip, setTokenStatusTooltip] = useState<{
    content: TokenStatusTooltipContent
    left: number
    top: number
  } | null>(null)
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
  const tokenBorderFlowLayerRef = useRef<Konva.Layer>(null)
  const tokenBorderFlowAnimationEntriesRef = useRef(
    new Map<string, TokenBorderFlowAnimationEntry>(),
  )
  const reducedTokenBorderMotion = usePrefersReducedMotion()
  const tokenBorderPresentation = (tokenId: string): TokenBorderFlowPalette | undefined => {
    const presentation = tokenBorderPresentations[tokenId]
    if (presentation) return presentation
    const legacyColor = tokenBorderColors[tokenId]
    return legacyColor ? tokenBorderFallbackPalette(legacyColor) : undefined
  }
  const hasTokenBorderFlow = map.tokens.some((token) => !!tokenBorderPresentation(token.id))
  const registerTokenBorderFlowAnimation = useCallback<RegisterTokenBorderFlowAnimation>(
    (tokenId, entry) => {
      if (entry) tokenBorderFlowAnimationEntriesRef.current.set(tokenId, entry)
      else tokenBorderFlowAnimationEntriesRef.current.delete(tokenId)
    },
    [],
  )
  useStatusAnimation(
    () => tokenBorderFlowLayerRef.current,
    () => {
      const now = Date.now()
      // performance.now() is page-global and monotonic. Unlike frame.time it
      // does not restart when this Konva animation is remounted.
      const flowNowMs = reducedTokenBorderMotion ? 0 : performance.now()
      for (const entry of tokenBorderFlowAnimationEntriesRef.current.values()) {
        const token = entry.tokenRef.current
        if (!entry.positionLockedRef.current && token.movementAnimation) {
          entry.group.position(
            tokenMovementAnimationPosition(
              token.movementAnimation,
              now - token.movementAnimation.issuedAt,
            ) ?? { x: token.x, y: token.y },
          )
        }
        entry.flow.rotation(tokenBorderFlowRotationDegrees(flowNowMs))
        entry.flow.opacity(1)
      }
    },
    { active: hasTokenBorderFlow, fps: TOKEN_BORDER_FLOW_FPS },
  )
  const effectTokenAreaOverlayNodesRef = useRef(new Map<string, {
    tokenId: string
    areaAnchorPosition: Point
    node: Konva.Group
  }>())
  const effectTokenDragPositionsRef = useRef<Record<string, Point>>({})
  const [readyPersistentVisualAreaIds, setReadyPersistentVisualAreaIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
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
  const pendingGeometryClickCommitTimersRef = useRef(new Set<number>())
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

  const handleTokenStatusTooltipChange = useCallback<TokenStatusTooltipChange>((tooltip) => {
    if (!tooltip) {
      setTokenStatusTooltip(null)
      return
    }
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return
    const pointerX = tooltip.clientX - bounds.left
    const pointerY = tooltip.clientY - bounds.top
    const estimatedWidth = Math.min(320, Math.max(180, bounds.width - 16))
    const estimatedHeight = 132
    const left = pointerX + 14 + estimatedWidth <= bounds.width
      ? pointerX + 14
      : Math.max(8, pointerX - estimatedWidth - 14)
    const top = pointerY + 16 + estimatedHeight <= bounds.height
      ? pointerY + 16
      : Math.max(8, pointerY - estimatedHeight - 16)
    setTokenStatusTooltip({
      content: { title: tooltip.title, description: tooltip.description },
      left,
      top,
    })
  }, [])

  const markPersistentVisualReady = useCallback((areaId: string) => {
    setReadyPersistentVisualAreaIds((current) => {
      if (current.has(areaId)) return current
      const next = new Set(current)
      next.add(areaId)
      while (next.size > 64) {
        const oldest = next.values().next().value
        if (typeof oldest !== 'string') break
        next.delete(oldest)
      }
      return next
    })
  }, [])

  const visibleProjectiles = useMemo(
    () => retainPendingPersistentAreaEntrances(projectiles, readyPersistentVisualAreaIds),
    [projectiles, readyPersistentVisualAreaIds],
  )

  useEffect(() => {
    // Thunderwave lasts only about one second. Warm this single lightweight
    // texture on every map client so a cold player cache cannot spend the
    // whole presentation window downloading and decoding it.
    void Promise.all([
      preloadBrowserImage('/assets/vfx/thunderwave-fluid.webp'),
      preloadBrowserImage('/assets/vfx/acid-splash-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/poison-spray-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/ray-of-frost-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/eldritch-blast-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/scorching-ray-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/guiding-bolt-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/acid-arrow-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/inflict-wounds-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/healing-word-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/cure-wounds-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/hellish-rebuke-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/shatter-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/lightning-bolt-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/sacred-flame-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/blight-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/flame-strike-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/sunburst-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/cone-of-cold-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/circle-of-death-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/ice-storm-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/freezing-sphere-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/color-spray-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/faerie-fire-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/sleep-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/entangle-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/grease-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/darkness-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/flaming-sphere-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/moonbeam-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/daylight-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/black-tentacles-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/spike-growth-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/mage-hand-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/spiritual-weapon-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/spirit-guardians-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/call-lightning-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/call-lightning-strike-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/insect-plague-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/wall-of-fire-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/blade-barrier-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/chain-lightning-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/disintegrate-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/finger-of-death-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/power-word-stun-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/power-word-kill-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/false-life-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/hypnotic-pattern-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/slow-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/phantasmal-killer-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/banishment-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/misty-step-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/hold-monster-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/counterspell-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/dispel-magic-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/shield-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/lesser-restoration-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/cloudkill-sprite-v2.png'),
      preloadBrowserImage('/assets/vfx/ice-storm-ground-sprite-v2.png'),
    ])
  }, [])

  // Measurement state in image coordinates: fixed segments plus pending/cursor points.
  const [segments, setSegments] = useState<{ a: Point; b: Point }[]>([])
  const [pending, setPending] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)

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

  const syncEffectTokenAreaOverlayPosition = useCallback((tokenId: string, x: number, y: number) => {
    for (const entry of effectTokenAreaOverlayNodesRef.current.values()) {
      if (entry.tokenId !== tokenId) continue
      const offset = mapCanvasEffectTokenAreaRenderOffset({
        anchorMode: 'effect-token',
        areaAnchorPosition: entry.areaAnchorPosition,
        dragPreviewPosition: { x, y },
      })
      entry.node.position(offset)
      entry.node.getLayer()?.batchDraw()
    }
  }, [])

  const registerEffectTokenAreaOverlay = useCallback((
    areaId: string,
    tokenId: string | undefined,
    areaAnchorPosition: Point | undefined,
    node: Konva.Group | null,
  ) => {
    if (!node || !tokenId || !areaAnchorPosition) {
      effectTokenAreaOverlayNodesRef.current.delete(areaId)
      return
    }
    effectTokenAreaOverlayNodesRef.current.set(areaId, { tokenId, areaAnchorPosition, node })
    const dragPosition = effectTokenDragPositionsRef.current[tokenId]
    if (!dragPosition) return
    node.position(mapCanvasEffectTokenAreaRenderOffset({
      anchorMode: 'effect-token',
      areaAnchorPosition,
      dragPreviewPosition: dragPosition,
    }))
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
    if (token.dnd5eSpellEffect) {
      effectTokenDragPositionsRef.current[token.id] = { x, y }
      syncEffectTokenAreaOverlayPosition(token.id, x, y)
    }
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
    if (token.dnd5eSpellEffect) {
      // The animated sphere is a detached persistent-area overlay. Move that
      // Konva group imperatively too, avoiding a full canvas React render for
      // every pointer event.
      effectTokenDragPositionsRef.current[token.id] = { x, y }
      syncEffectTokenAreaOverlayPosition(token.id, x, y)
    }
  }

  const releaseTokenDragPreview = (tokenId: string) => {
    delete effectTokenDragPositionsRef.current[tokenId]
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
      syncEffectTokenAreaOverlayPosition(tokenId, authoritative.x, authoritative.y)
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

  const cancelPendingGeometryClickCommits = useCallback(() => {
    for (const timer of pendingGeometryClickCommitTimersRef.current) {
      window.clearTimeout(timer)
    }
    pendingGeometryClickCommitTimersRef.current.clear()
  }, [])

  useEffect(() => {
    if (geometryEditMode) return
    cancelPendingGeometryClickCommits()
    geometryDragStartRef.current = null
    geometryViewportPanStartRef.current = null
    const timer = window.setTimeout(() => {
      setGeometryDraft(null)
      setGeometryDragActive(false)
      setGeometryViewportPanActive(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [cancelPendingGeometryClickCommits, geometryEditMode])

  useEffect(() => () => cancelPendingGeometryClickCommits(), [cancelPendingGeometryClickCommits])

  const geometryEntityFromDrag = (start: Point, current: Point): MapGeometryEntity | null => {
    const drag = geometryDragStartRef.current
    if (!drag || geometryTool === 'select' || geometryTool === 'delete') return null
    const gridPaintTool = geometryTool === 'elevation' || geometryTool === 'difficult-terrain'
    const common = {
      id: drag.id,
      label: geometryTool === 'wall' ? '墙' : geometryTool === 'door' ? '门' : geometryTool === 'window' ? '窗户' : geometryTool === 'light' ? '场景光源' : geometryTool === 'elevation' ? '高地区域' : geometryTool === 'difficult-terrain' ? '困难地形' : '区域地形',
      createdAt: drag.createdAt,
      baseHeightFeet: 0,
      heightFeet: gridPaintTool ? 0 : geometryTool === 'obstacle' ? 5 : 10,
      blocksVision: geometryTool !== 'obstacle' && !gridPaintTool,
      blocksMovement: !gridPaintTool,
      blocksLineOfEffect: geometryTool !== 'obstacle' && !gridPaintTool,
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
    if (geometryTool === 'difficult-terrain') {
      return {
        ...common,
        kind: 'obstacle',
        cover: 'none',
        terrainCostMultiplier: 2,
        // This is a surface overlay, not a new elevation region. Pathfinding
        // binds it to the terrain surface independently in every covered cell.
        traversal: 'ground',
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
    const gridPaintTool = geometryTool === 'elevation' || geometryTool === 'difficult-terrain'
    const point = rawPoint
      ? geometryTool === 'door' || geometryTool === 'window' || gridPaintTool ? rawPoint : snapGeometryPoint(rawPoint)
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
    const gridCell = gridPaintTool ? geometryGridCellAtPoint(point) : null
    if (gridPaintTool && !gridCell) {
      setGeometryDragActive(false)
      return true
    }
    const gridCells = gridCell
      ? new Map([[`${gridCell.col},${gridCell.row}`, gridCell]])
      : undefined
    geometryDragStartRef.current = {
      point,
      points: gridCells ? geometryGridBoundary(gridCells) : [point],
      id: `geometry:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      gridCells,
      lastGridCell: gridCell ?? undefined,
    }
    setGeometryDraft(geometryEntityFromDrag(point, point))
    return true
  }

  const handleGeometryMouseMove = (stage: Konva.Stage | null): boolean => {
    const drag = geometryDragStartRef.current
    if (!geometryEditMode || !drag) return false
    const rawPoint = relativePoint(stage)
    const gridPaintTool = geometryTool === 'elevation' || geometryTool === 'difficult-terrain'
    const point = rawPoint
      ? geometryTool === 'door' || geometryTool === 'window' || gridPaintTool ? rawPoint : snapGeometryPoint(rawPoint)
      : null
    if (point && gridPaintTool) {
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
    const releasePoint = relativePoint(stage) ?? drag.point
    const draft = geometryDraft ?? geometryEntityFromDrag(drag.point, drag.point)
    geometryDragStartRef.current = null
    setGeometryDragActive(false)
    if (geometryTool === 'door' || geometryTool === 'window') stage?.draggable(true)
    setGeometryDraft(null)
    if (!draft) return true
    const gridRegion = draft.kind === 'obstacle' && (
      draft.terrainRegion || (draft.terrainCostMultiplier ?? 1) > 1
    )
    const terrainRegionArea = gridRegion
      ? Math.abs(draft.points.reduce((area, point, index) => {
          const next = draft.points[(index + 1) % draft.points.length]
          return area + point.x * next.y - next.x * point.y
        }, 0)) / 2
      : 0
    const valid = draft.kind === 'light' || (draft.kind === 'obstacle'
      ? gridRegion
        ? draft.points.length >= 3 && terrainRegionArea >= Math.max(16, map.gridSize ** 2 * 0.04)
        : Math.abs(draft.points[1].x - draft.points[0].x) >= 4 && Math.abs(draft.points[2].y - draft.points[1].y) >= 4
      : Math.hypot(draft.points[1].x - draft.points[0].x, draft.points[1].y - draft.points[0].y) >= 4)
    if (valid) {
      const gridPaintClick = (
        geometryTool === 'elevation' || geometryTool === 'difficult-terrain'
      ) && drag.gridCells?.size === 1
      const lightClick = draft.kind === 'light' &&
        Math.hypot(releasePoint.x - drag.point.x, releasePoint.y - drag.point.y) < 4
      if (pingEnabled && (gridPaintClick || lightClick)) {
        // A browser only reports dblclick after the two click/mouseup cycles. Delay
        // click-only geometry commits briefly so a double click can remain a pure
        // tabletop Ping instead of also painting a cell or placing two lights.
        const timer = window.setTimeout(() => {
          pendingGeometryClickCommitTimersRef.current.delete(timer)
          onGeometryEntityCommit?.(draft)
        }, 320)
        pendingGeometryClickCommitTimersRef.current.add(timer)
      } else {
        onGeometryEntityCommit?.(draft)
      }
    }
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
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize(measureMapCanvasViewport(el))
    })
    ro.observe(el)
    setSize(measureMapCanvasViewport(el))
    return () => ro.disconnect()
  }, [])

  // Reset fitted flag when switching maps so each map auto-fits once.
  // Avoid remounting the stage, which would tear animations and transient interaction state.
  useEffect(() => {
    fittedRef.current = false
  }, [map.id])

  // Auto-fit once after loading each map image.
  useLayoutEffect(() => {
    if (!image || fittedRef.current || size.width === 0 || size.height === 0) return
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
  const difficultTerrainCells = useMemo(
    () => collectMapDifficultTerrainCells({ map, geometry }),
    [geometry, map],
  )
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
      data-combat-projectile-count={visibleProjectiles.length}
      data-combat-projectile-ids={visibleProjectiles.map((projectile) => projectile.id).join(',')}
      data-combat-projectile-kinds={visibleProjectiles.map((projectile) => projectile.kind ?? 'arrow').join(',')}
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
      data-concentration-token-count={concentrationTokenMarks.length}
      data-concentration-token-spells={concentrationTokenMarks
        .map((mark) => `${mark.tokenId}:${mark.spellId}`)
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
      data-difficult-terrain-cell-count={difficultTerrainCells.length}
      data-dm-geometry-wall-count={isDM ? geometry?.walls.length ?? 0 : 0}
      data-geometry-structure-count={geometryStructureCount}
      data-stage-can-pan={stageCanPan ? 'true' : 'false'}
      data-ping-enabled={pingEnabled ? 'true' : 'false'}
      className={`relative h-full w-full overflow-hidden rounded-2xl ${
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
      style={{ backgroundColor: MAP_CANVAS_MATTE_COLOR }}
    >
      {mapCanvasViewportCanRender(size) ? <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        style={{ backgroundColor: MAP_CANVAS_MATTE_COLOR }}
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
          cancelPendingGeometryClickCommits()
          geometryDragStartRef.current = null
          setGeometryDraft(null)
          setGeometryDragActive(false)
          onMapPing?.(point)
        }}
      >
        <Layer name="map-background-layer">
          <Rect
            x={0}
            y={0}
            width={map.width}
            height={map.height}
            fill={MAP_CANVAS_MATTE_COLOR}
            listening={false}
          />
          {image && <KonvaImage image={image} width={map.width} height={map.height} />}
          {gridLines}
          {coordinateLabels}
          <TerrainElevationContours geometry={geometry} inv={inv} />
          <Dnd5eItemAreaOverlays map={map} />
          <Dnd5ePluginAreaOverlays
            map={map}
            isDM={isDM}
            onVisibilityToggle={onDnd5ePluginAreaVisibilityToggle}
            onAreaClick={onDnd5ePluginAreaClick}
            dragPreviewPositions={dragPreviewPositions}
            registerEffectTokenAreaOverlay={registerEffectTokenAreaOverlay}
            onPersistentVisualReady={markPersistentVisualReady}
          />
          <DifficultTerrainCellOverlays map={map} cells={difficultTerrainCells} />
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
          {aoeSelectMode && aoeHighlight?.committedAreaCircles?.map((circle, index) => (
            <Circle
              key={`committed-area-${index}-${circle.centerX}-${circle.centerY}`}
              x={circle.centerX}
              y={circle.centerY}
              radius={circle.radiusPx}
              fill="rgba(124, 58, 237, 0.13)"
              stroke="rgba(196, 181, 253, 0.95)"
              strokeWidth={3}
              dash={[8, 5]}
              listening={false}
            />
          ))}
          {aoeSelectMode && aoeHighlight?.hazardCells && aoeHighlight.hazardCells.length > 0 && (
            <AoeCellHighlights
              map={map}
              cells={aoeHighlight.hazardCells}
              valid={aoeHighlight.valid}
              variant="hazard"
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
        </Layer>
        <Layer name="token-body-layer">
          {map.tokens.map((t) => {
            const hp = hpByToken?.[t.id]
            const defeated = hp != null ? hp.hp <= 0 : defeatedTokenIds.includes(t.id)
            const borderPresentation = tokenBorderPresentation(t.id)
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
              borderColor={borderPresentation?.background}
              draggable={canDragToken(t)}
              hp={hpByToken?.[t.id]}
              showHpBar={
                !!hpByToken?.[t.id] &&
                (isDM || !!t.characterId || t.showHpOnToken !== false)
              }
              hoverLabel={hoveredTokenId === t.id ? tokenHoverLabels[t.id] : undefined}
              showName={hoveredTokenId === t.id}
              concentrationMark={concentrationTokenMarks.find((mark) => mark.tokenId === t.id)}
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
        </Layer>
        <Layer
          ref={tokenBorderFlowLayerRef}
          name="token-border-flow-layer"
          listening={false}
        >
          {map.tokens.map((token) => {
            const presentation = tokenBorderPresentation(token.id)
            const hp = hpByToken?.[token.id]
            const defeated = hp != null
              ? hp.hp <= 0
              : defeatedTokenIds.includes(token.id)
            if (!presentation || defeated) return null
            return (
              <TokenBorderFlowRing
                key={`token-border-flow:${token.id}`}
                token={displayToken(token)}
                presentation={presentation}
                gridSize={map.gridSize}
                builtinGrid={builtinGrid}
                registerPositionNode={registerTokenVisualNode}
                registerAnimation={registerTokenBorderFlowAnimation}
              />
            )
          })}
        </Layer>
        <Layer name="token-foreground-layer">

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
                concentrationMark={concentrationTokenMarks.find((mark) => mark.tokenId === t.id)}
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
          <Group name="token-status-content">
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
                concentrationMark={concentrationTokenMarks.find((mark) => mark.tokenId === t.id)}
                airborne={mapGeometryTokenElevation(geometry, t) >
                  mapGeometryTerrainElevationAtPoint(geometry, t)}
                onStandardConditionClick={(condition) => onDnd5eConditionClick?.(t.id, condition)}
                onStatusTooltipChange={handleTokenStatusTooltipChange}
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
          </Group>
          <Group name="map-interaction-overlay-content">
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
            <MapMeasureLine
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
            <MapMeasureLine
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
          </Group>
        </Layer>
        <Layer name="map-world-overlay-layer">
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
        <Group listening={false}>
          {visibleProjectiles.map((projectile) => (
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
        </Group>
        </Layer>
      </Stage> : null}
      {tokenStatusTooltip ? (
        <div
          role="tooltip"
          data-testid="token-status-tooltip"
          className="pointer-events-none absolute z-[75] w-[min(20rem,calc(100%_-_1rem))] rounded-lg border border-sky-300/35 bg-slate-950/95 px-3 py-2 text-left shadow-[0_10px_32px_rgba(2,6,23,0.72)] backdrop-blur-sm"
          style={{ left: tokenStatusTooltip.left, top: tokenStatusTooltip.top }}
        >
          <strong className="block text-xs font-semibold text-sky-100">
            {tokenStatusTooltip.content.title}
          </strong>
          <span className="mt-1 block text-[11px] leading-4 text-slate-300">
            {tokenStatusTooltip.content.description}
          </span>
        </div>
      ) : null}
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

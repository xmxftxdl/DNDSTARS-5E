import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import Konva from 'konva'
import { getImage } from '../../lib/imageStore'
import {
  cellKey,
  cellTopLeft,
  tokenDisplayRadius,
  TOKEN_MOVE_DURATION_S,
  type GridCell,
} from '../../lib/gridCombat'
import { tokenMovementAnimationPosition, type TokenMovementAnimation } from '../../lib/tokenMovementAnimation'
import Dnd5eConcentrationTokenBadge, { DND5E_CONCENTRATION_TOKEN_IMAGE_SRC, type ConcentrationTokenMark } from './Dnd5eConcentrationTokenBadge'
import { TOKEN_BORDER_FLOW_BASE_OPACITY, type TokenBorderFlowPalette, tokenBorderFlowGradientColorStops, tokenBorderFlowRotationDegrees, tokenBorderFlowWorldMetrics } from './tokenBorderFlow'
import {
  FLIGHT_TOKEN_TOOLTIP,
  SHILLELAGH_TOKEN_TOOLTIP,
  concentrationTokenTooltip,
  overflowConditionTokenTooltip,
  spellStatusTokenTooltip,
  standardConditionTokenTooltip,
  type TokenStatusTooltipContent,
  type TokenStatusTooltipPoint,
} from './tokenStatusTooltip'
import { DND5E_CONDITION_MARKERS } from './dnd5eConditionMarkers'
import { dnd5eActionIconBackdropImage } from './dnd5eActionIconBackdropImage'
import { MAP_SPELL_STATUS_ICONS } from './mapSpellStatusIcons'
import { usePrefersReducedMotion, useStatusAnimation, useTokenBadgeImage } from './mapEffectHooks'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eStandardConditionId } from '../../rulesets/dnd5e/conditions'
import type { SpellStatusTokenMark, StandardConditionTokenMark } from './mapCanvasContracts'

const TOKEN_MOVE_DURATION = TOKEN_MOVE_DURATION_S
const TOKEN_DRAG_THRESHOLD_PX = 4

export type RegisterTokenPositionNode = (
  tokenId: string,
  node: Konva.Group,
  cancelPositionAnimation: () => void,
  setPositionLocked: (locked: boolean) => void,
) => void | (() => void)

export interface TokenBorderFlowAnimationEntry {
  group: Konva.Group
  flow: Konva.Circle
  tokenRef: { current: Token }
  positionLockedRef: { current: boolean }
}

export type RegisterTokenBorderFlowAnimation = (
  tokenId: string,
  entry: TokenBorderFlowAnimationEntry | null,
) => void

/** Token upper-right badges: anchored near 1-2 o'clock, flowing right, max 3 per row. */
const DOUBLE_ARROW_BADGE_RATIO = 0.4

const RIGHT_BADGE_MAX_COLS = 3

/** First badge center sits near the token upper-right border. */
const RIGHT_BADGE_ANCHOR_X_RATIO = 0.56

const RIGHT_BADGE_ANCHOR_Y_RATIO = -0.84

export interface TokenStatusTooltipRequest extends TokenStatusTooltipContent, TokenStatusTooltipPoint {}

export type TokenStatusTooltipChange = (tooltip?: TokenStatusTooltipRequest) => void

function showTokenStatusTooltip(
  onTooltipChange: TokenStatusTooltipChange | undefined,
  content: TokenStatusTooltipContent,
  event: Konva.KonvaEventObject<MouseEvent>,
) {
  onTooltipChange?.({
    ...content,
    clientX: event.evt.clientX,
    clientY: event.evt.clientY,
  })
}

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

export function AoeCellHighlights({
  map,
  cells,
  valid,
  variant = 'attack',
}: {
  map: BattleMap
  cells: GridCell[]
  valid: boolean
  variant?: 'attack' | 'range' | 'hazard'
}) {
  const g = Math.max(1, map.gridSize)
  const fill =
    variant === 'hazard'
      ? valid
        ? 'rgba(220, 38, 38, 0.38)'
        : 'rgba(100, 116, 139, 0.28)'
      : variant === 'range'
      ? valid
        ? 'rgba(59, 130, 246, 0.42)'
        : 'rgba(100, 116, 139, 0.28)'
      : valid
        ? 'rgba(245, 158, 11, 0.42)'
        : 'rgba(100, 116, 139, 0.28)'
  const stroke =
    variant === 'hazard'
      ? valid
        ? 'rgba(251, 113, 133, 0.95)'
        : 'rgba(148, 163, 184, 0.55)'
      : variant === 'range'
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
  tooltip,
  onTooltipChange,
}: {
  radius: number
  gridIndex: number
  condition?: Dnd5eStandardConditionId
  mark?: StandardConditionTokenMark
  overflowCount?: number
  onClick?: () => void
  tooltip: TokenStatusTooltipContent
  onTooltipChange?: TokenStatusTooltipChange
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
      listening={!!onClick || !!onTooltipChange}
      onClick={(event) => { event.cancelBubble = true; onClick?.() }}
      onTap={(event) => { event.cancelBubble = true; onClick?.() }}
      onMouseEnter={(event) => showTokenStatusTooltip(onTooltipChange, tooltip, event)}
      onMouseMove={(event) => showTokenStatusTooltip(onTooltipChange, tooltip, event)}
      onMouseLeave={() => onTooltipChange?.()}
    >
      <Circle
        radius={size / 2}
        fill={mark?.backgroundColor ?? style?.fill ?? '#312e81'}
        stroke={mark?.borderColor ?? style?.stroke ?? '#c4b5fd'}
        strokeWidth={tokenLineWidth(radius, 1.5)}
        shadowBlur={4 * tokenScale(radius)}
        shadowColor={mark?.glowColor ?? style?.stroke ?? '#a78bfa'}
        listening={!!onClick || !!onTooltipChange}
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
        listening={!!onClick || !!onTooltipChange}
      />
      {proneImage && !overflowCount && (
        <KonvaImage
          image={proneImage}
          crop={{ x: 48, y: 165, width: 424, height: 208 }}
          x={-size * 0.5}
          y={-size * 0.36}
          width={size}
          height={size * 0.72}
          listening={!!onClick || !!onTooltipChange}
        />
      )}
    </Group>
  )
}

function ShillelaghTokenBadge({
  radius,
  gridIndex,
  onTooltipChange,
}: {
  radius: number
  gridIndex: number
  onTooltipChange?: TokenStatusTooltipChange
}) {
  const size = rightBadgeSize(radius)
  const { x, y } = rightBadgeGridPos(radius, size, gridIndex)
  const scale = tokenScale(radius)
  return (
    <Group
      x={x}
      y={y}
      listening={!!onTooltipChange}
      onMouseEnter={(event) => showTokenStatusTooltip(onTooltipChange, SHILLELAGH_TOKEN_TOOLTIP, event)}
      onMouseMove={(event) => showTokenStatusTooltip(onTooltipChange, SHILLELAGH_TOKEN_TOOLTIP, event)}
      onMouseLeave={() => onTooltipChange?.()}
    >
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
  onTooltipChange?: TokenStatusTooltipChange
}) {
  const size = rightBadgeSize(input.radius)
  const { x, y } = rightBadgeGridPos(input.radius, size, input.gridIndex)
  const scale = tokenScale(input.radius)
  const spec = MAP_SPELL_STATUS_ICONS[input.mark.statusId]
  const tooltip = spellStatusTokenTooltip(input.mark.statusId)
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
      listening={!!input.onTooltipChange}
      name={`spell-status-token spell-status-${input.mark.statusId}`}
      onMouseEnter={(event) => showTokenStatusTooltip(input.onTooltipChange, tooltip, event)}
      onMouseMove={(event) => showTokenStatusTooltip(input.onTooltipChange, tooltip, event)}
      onMouseLeave={() => input.onTooltipChange?.()}
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
            globalCompositeOperation={input.mark.statusId === 'monster-damage-aversion' ? 'source-over' : 'screen'}
            opacity={input.mark.statusId === 'monster-damage-aversion' ? 1 : 0.94}
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
        listening={!!input.onTooltipChange}
      />
    </Group>
  )
}

function Dnd5eFlightBadge({
  radius,
  onClick,
  onTooltipChange,
}: {
  radius: number
  onClick?: () => void
  onTooltipChange?: TokenStatusTooltipChange
}) {
  const size = rightBadgeSize(radius)
  const { x, y } = rightBadgeGridPos(radius, size, 0)
  return (
    <Group
      x={x}
      y={y}
      listening={!!onClick || !!onTooltipChange}
      onClick={(event) => { event.cancelBubble = true; onClick?.() }}
      onTap={(event) => { event.cancelBubble = true; onClick?.() }}
      onMouseEnter={(event) => showTokenStatusTooltip(onTooltipChange, FLIGHT_TOKEN_TOOLTIP, event)}
      onMouseMove={(event) => showTokenStatusTooltip(onTooltipChange, FLIGHT_TOKEN_TOOLTIP, event)}
      onMouseLeave={() => onTooltipChange?.()}
    >
      <Circle
        radius={size / 2}
        fill="#083344"
        stroke="#67e8f9"
        strokeWidth={tokenLineWidth(radius, 1.5)}
        shadowBlur={5 * tokenScale(radius)}
        shadowColor="#22d3ee"
        listening={!!onClick || !!onTooltipChange}
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
        listening={!!onClick || !!onTooltipChange}
      />
    </Group>
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

/**
 * Circular adaptation of the combat-log perimeter flow. The deep support and
 * the full seven-stop line share one centerline. Rotating the vector gradient
 * moves a soft white highlight without introducing a separate dashed segment.
 */
export function TokenBorderFlowRing({
  token,
  presentation,
  gridSize,
  builtinGrid,
  registerPositionNode,
  registerAnimation,
}: {
  token: Token
  presentation: TokenBorderFlowPalette
  gridSize: number
  builtinGrid: boolean
  registerPositionNode: RegisterTokenPositionNode
  registerAnimation: RegisterTokenBorderFlowAnimation
}) {
  const radius = tokenDisplayRadius(gridSize, token.size, builtinGrid)
  const groupRef = useRef<Konva.Group>(null)
  const flowRef = useRef<Konva.Circle>(null)
  const tokenRef = useRef(token)
  const positionLockedRef = useRef(false)
  const flowMetrics = useMemo(() => tokenBorderFlowWorldMetrics(radius), [radius])
  const [initialFlowNowMs] = useState(() => (
    typeof performance === 'undefined' ? 0 : performance.now()
  ))
  // The source portrait frame is centered 2.75 units inside an 80-unit edge.
  // Preserve that inset so the complete stroke overlays the portrait edge.
  const ringRadius = Math.max(
    1,
    radius - flowMetrics.baseStrokeWidth * (2.75 / 4.8),
  )
  const gradientColorStops = useMemo(
    () => tokenBorderFlowGradientColorStops(presentation),
    [presentation],
  )
  const initialFlowRotation = tokenBorderFlowRotationDegrees(initialFlowNowMs)

  useLayoutEffect(() => {
    tokenRef.current = token
  }, [token])

  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    return registerPositionNode(
      token.id,
      group,
      () => undefined,
      (locked) => {
        positionLockedRef.current = locked
      },
    )
  }, [registerPositionNode, token.id])

  useLayoutEffect(() => {
    const group = groupRef.current
    const flow = flowRef.current
    if (!group || !flow) return
    registerAnimation(token.id, {
      group,
      flow,
      tokenRef,
      positionLockedRef,
    })
    return () => registerAnimation(token.id, null)
  }, [registerAnimation, token.id])

  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group || positionLockedRef.current) return
    const movementPosition = token.movementAnimation
      ? tokenMovementAnimationPosition(
          token.movementAnimation,
          Date.now() - token.movementAnimation.issuedAt,
        )
      : undefined
    group.position(movementPosition ?? { x: token.x, y: token.y })
  }, [token.movementAnimation, token.x, token.y])

  return (
    <Group ref={groupRef} x={token.x} y={token.y} listening={false}>
      <Group name="token-class-flow-ring" listening={false}>
        <Circle
          name="token-class-flow-support"
          radius={ringRadius}
          stroke={presentation.backgroundDeep}
          strokeWidth={flowMetrics.baseStrokeWidth}
          opacity={TOKEN_BORDER_FLOW_BASE_OPACITY}
          listening={false}
        />
        <Circle
          ref={flowRef}
          name="token-class-flow-line"
          radius={ringRadius}
          rotation={initialFlowRotation}
          strokeLinearGradientStartPoint={{ x: -ringRadius, y: -ringRadius }}
          strokeLinearGradientEndPoint={{ x: ringRadius, y: ringRadius }}
          strokeLinearGradientColorStops={gradientColorStops}
          strokeWidth={flowMetrics.flowStrokeWidth}
          shadowColor={presentation.glow}
          shadowBlur={flowMetrics.glowBlur}
          shadowOpacity={0.9}
          listening={false}
        />
      </Group>
    </Group>
  )
}

export function TokenMovementPathLine({
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

export function TokenNode({
  renderMode = 'full',
  token,
  gridSize,
  builtinGrid = false,
  selected,
  targetSelected = false,
  defeated = false,
  currentTurn = false,
  borderColor,
  draggable = true,
  hp,
  showHpBar = true,
  standardConditions = [],
  standardConditionMarks = [],
  shillelaghActive = false,
  spellStatusMarks = [],
  concentrationMark,
  airborne = false,
  onStandardConditionClick,
  onStatusTooltipChange,
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
  borderColor?: string
  draggable?: boolean
  hp?: { hp: number; max: number; temp?: number }
  showHpBar?: boolean
  standardConditions?: readonly Dnd5eStandardConditionId[]
  standardConditionMarks?: readonly StandardConditionTokenMark[]
  shillelaghActive?: boolean
  spellStatusMarks?: readonly SpellStatusTokenMark[]
  concentrationMark?: ConcentrationTokenMark
  airborne?: boolean
  onStandardConditionClick?: (condition?: Dnd5eStandardConditionId) => void
  onStatusTooltipChange?: TokenStatusTooltipChange
  hoverLabel?: string
  showName?: boolean
  onHoverChange?: (hovered: boolean) => void
  onSelect: () => void
  onDragStart?: (x: number, y: number) => void
  onDragMove?: (x: number, y: number) => void
  onDragEnd: (x: number, y: number) => void
  /** Cancel sub-threshold drags: clear preview without movement/broadcast. */
  onDragCancel?: () => void
  registerPositionNode?: RegisterTokenPositionNode
  instantPosition?: boolean
}) {
  const groupRef = useRef<Konva.Group>(null)
  const sharedTokenImageId = token.tokenPortraitImageId ?? token.portraitImageId
  const tokenImageKey = token.tokenPortrait
    ? `inline:${token.tokenPortrait}`
    : sharedTokenImageId
      ? `shared:${sharedTokenImageId}`
      : ''
  const [loadedTokenImage, setLoadedTokenImage] = useState<{ key: string; image?: HTMLImageElement }>()
  const tokenImage = loadedTokenImage?.key === tokenImageKey ? loadedTokenImage.image : undefined
  const concentrationTokenImage = useTokenBadgeImage(
    concentrationMark ? DND5E_CONCENTRATION_TOKEN_IMAGE_SRC : undefined,
  )
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
  // Conditions are presented exclusively by badges in token-status-layer.
  // They must never recolor, widen, or replace the class/monster perimeter.
  const hasPresentationBorder = !!borderColor && !defeated
  const strokeColor = defeated ? '#94a3b8' : token.color
  const bodyStrokeWidth = hasPresentationBorder ? 0 : baseStrokeW
  const portraitClipInset = hasPresentationBorder ? 0 : Math.max(1, baseStrokeW / 2)
  const barW = radius * 2
  const hoverFontSize = Math.max(8, radius * 0.32)
  const hoverLabelWidth = hoverLabel
    ? Math.min(radius * 9, Math.max(radius * 2.4, hoverLabel.length * hoverFontSize * 0.92))
    : radius * 2.4
  const isDragonEmoji = token.emoji === '\u{1f409}' || token.emoji === '\u{1f432}'
  const isDetectedUnseen = token.perceptionVisibility === 'detected-unseen'
  // Flaming Sphere already has a persistent animated area visual. Keep its
  // authoritative effect token as an invisible drag/select hit target so
  // movement and Headless settlement still work without drawing a second
  // black-backed fire token on top of the sphere.
  const hidePersistentEffectTokenBody =
    token.dnd5eSpellEffect?.spellId === 'flaming-sphere' ||
    token.dnd5eSpellEffect?.spellId === 'spiritual-weapon'
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
    } else if (sharedTokenImageId) {
      void getImage(sharedTokenImageId).then((blob) => {
        if (!blob || disposed) return
        objectUrl = URL.createObjectURL(blob)
        load(objectUrl)
      })
    }

    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [renderMode, token.tokenPortrait, sharedTokenImageId, tokenImageKey])

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

  const nameLayer = showName && !hidePersistentEffectTokenBody ? (
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
        <Group y={-radius - 12} listening={false}>
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
                onTooltipChange={onStatusTooltipChange}
              />
            )}
            {shillelaghActive && (
              <ShillelaghTokenBadge
                radius={radius}
                gridIndex={airborne ? 1 : 0}
                onTooltipChange={onStatusTooltipChange}
              />
            )}
            {concentrationMark && (() => {
              const size = rightBadgeSize(radius)
              const position = rightBadgeGridPos(radius, size, grid++)
              return (
                <Dnd5eConcentrationTokenBadge
                  x={position.x}
                  y={position.y}
                  size={size}
                  image={concentrationTokenImage}
                  mark={concentrationMark}
                  onTooltipChange={(point) => onStatusTooltipChange?.(point ? {
                    ...concentrationTokenTooltip(concentrationMark.spellId),
                    ...point,
                  } : undefined)}
                />
              )
            })()}
            {spellStatusMarks.map((mark) => (
              <SpellStatusTokenBadge
                key={`spell-status:${mark.statusId}`}
                radius={radius}
                gridIndex={grid++}
                mark={mark}
                onTooltipChange={onStatusTooltipChange}
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
                  tooltip={standardConditionTokenTooltip(condition)}
                  onTooltipChange={onStatusTooltipChange}
                />
              ))}
            {standardConditions.length > 4 && (
              <Dnd5eStandardConditionBadge
                radius={radius}
                gridIndex={grid++}
                overflowCount={standardConditions.length - 3}
                onClick={() => onStandardConditionClick?.()}
                tooltip={overflowConditionTokenTooltip(standardConditions.slice(3))}
                onTooltipChange={onStatusTooltipChange}
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
        listening={renderMode === 'vitals' && !!onStatusTooltipChange}
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
      {/* Creature Tokens with a presentation border already have the shared
          spell-portrait frame in token-border-flow-layer.  Do not key this
          fallback off a condition-specific visual state: conditions belong
          exclusively to token-status-layer and must not resurrect the legacy
          two-wave halo around the portrait. */}
      {currentTurn && !borderColor && !defeated && !hidePersistentEffectTokenBody && (
        <ActiveTurnHalo radius={radius} />
      )}
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
      {isDetectedUnseen && !hidePersistentEffectTokenBody && (
        <Circle
          radius={radius + selectedGap * 0.65}
          stroke="#94a3b8"
          strokeWidth={Math.max(1.5, baseStrokeW * 0.75)}
          dash={tokenDash(radius, [3, 5])}
          opacity={0.75}
          listening={false}
        />
      )}
      {hidePersistentEffectTokenBody ? (
        <Circle
          name="persistent-spell-effect-token-hitbox"
          radius={radius}
          fill="rgba(0,0,0,0.001)"
          strokeWidth={0}
        />
      ) : (
        <Circle
          radius={radius}
          fill={defeated ? 'rgba(30,32,45,0.92)' : 'rgba(10,11,22,0.85)'}
          stroke={strokeColor}
          strokeWidth={bodyStrokeWidth}
        />
      )}
      {!hidePersistentEffectTokenBody && tokenImage && tokenImageCrop && (
        <Group
          clipFunc={(context) => {
            context.beginPath()
            context.arc(0, 0, radius - portraitClipInset, 0, Math.PI * 2)
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
      {defeated && !hidePersistentEffectTokenBody && (
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
        <Group y={-radius - 12} listening={false}>
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
      {!hidePersistentEffectTokenBody && !tokenImage && (
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
      {renderMode !== 'body' && (() => {
        let grid = airborne ? 1 : 0
        return (
          <>
            {airborne && (
              <Dnd5eFlightBadge
                radius={radius}
                onClick={() => onStandardConditionClick?.()}
                onTooltipChange={onStatusTooltipChange}
              />
            )}
            {concentrationMark && (() => {
              const size = rightBadgeSize(radius)
              const position = rightBadgeGridPos(radius, size, grid++)
              return (
                <Dnd5eConcentrationTokenBadge
                  x={position.x}
                  y={position.y}
                  size={size}
                  image={concentrationTokenImage}
                  mark={concentrationMark}
                  onTooltipChange={(point) => onStatusTooltipChange?.(point ? {
                    ...concentrationTokenTooltip(concentrationMark.spellId),
                    ...point,
                  } : undefined)}
                />
              )
            })()}
            {(standardConditions.length > 4 ? standardConditions.slice(0, 3) : standardConditions)
              .map((condition) => (
                <Dnd5eStandardConditionBadge
                  key={`dnd5e-condition:${condition}`}
                  radius={radius}
                  gridIndex={grid++}
                  condition={condition}
                  mark={standardConditionMarks.find((mark) => mark.condition === condition)}
                  onClick={() => onStandardConditionClick?.(condition)}
                  tooltip={standardConditionTokenTooltip(condition)}
                  onTooltipChange={onStatusTooltipChange}
                />
              ))}
            {standardConditions.length > 4 && (
              <Dnd5eStandardConditionBadge
                radius={radius}
                gridIndex={grid++}
                overflowCount={standardConditions.length - 3}
                onClick={() => onStandardConditionClick?.()}
                tooltip={overflowConditionTokenTooltip(standardConditions.slice(3))}
                onTooltipChange={onStatusTooltipChange}
              />
            )}
          </>
        )
      })()}
      {/* 名称标签 */}
      {renderMode !== 'body' && showName && !hidePersistentEffectTokenBody && (
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

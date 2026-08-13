import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  Image,
  PanResponder,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Canvas, Circle, Group, Line, Rect, Skia, vec } from '@shopify/react-native-skia'
import type {
  CameraState,
  MobileRenderQuality,
  MobileSceneInteractionPoint,
  PlayerSceneSnapshot,
  PlayerTokenView,
} from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'
import { clampCamera, screenToWorld } from './tileMath'
import { SkiaTile } from './SkiaTile'
import { SkiaMapImage } from './SkiaMapImage'
import { useTileScheduler } from './useTileScheduler'

interface GestureOrigin {
  camera: CameraState
  centerX: number
  centerY: number
  distance: number
  startedAt: number
}

function touchMetrics(touches: readonly { pageX: number; pageY: number }[]) {
  if (touches.length < 2) return { centerX: touches[0]?.pageX ?? 0, centerY: touches[0]?.pageY ?? 0, distance: 0 }
  const [a, b] = touches
  return {
    centerX: (a.pageX + b.pageX) / 2,
    centerY: (a.pageY + b.pageY) / 2,
    distance: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
  }
}

function tokenAtScreenPoint(tokens: PlayerTokenView[], camera: CameraState, x: number, y: number) {
  return tokens
    .map((token) => ({ token, distance: Math.hypot(camera.x + token.x * camera.scale - x, camera.y + token.y * camera.scale - y) }))
    .filter(({ token, distance }) => distance <= Math.max(26, token.radius * camera.scale + 12))
    .sort((a, b) => a.distance - b.distance)[0]?.token ?? null
}

export function MobileSkiaMap({
  snapshot,
  quality,
  moving,
  onMovingChange,
  onMove,
  onCacheStats,
  targeting,
  onTargetToken,
  onTargetPoint,
  interactionPoints = [],
  onInteract,
}: {
  snapshot: PlayerSceneSnapshot
  quality: MobileRenderQuality
  moving: boolean
  onMovingChange: (moving: boolean) => void
  onMove: (tokenId: string, x: number, y: number) => Promise<void>
  onCacheStats?: (stats: { diskBytes: number; gpuBytes: number }) => void
  targeting?: 'token' | 'area' | null
  onTargetToken?: (token: PlayerTokenView) => void
  onTargetPoint?: (point: { x: number; y: number }) => void
  interactionPoints?: MobileSceneInteractionPoint[]
  onInteract?: (interactionPointId: string) => Promise<void>
}) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [camera, setCamera] = useState<CameraState>(snapshot.cameraHint ?? { x: 0, y: 0, scale: 0.1 })
  const [selectedId, setSelectedId] = useState(snapshot.controlledTokens[0]?.id ?? '')
  const [message, setMessage] = useState('长按地图或点击“移动”后选择落点')
  const origin = useRef<GestureOrigin | null>(null)
  const moved = useRef(false)
  const pixelRatio = quality === 'lite' ? 1 : quality === 'standard' ? Math.min(1.5, PixelRatio.get()) : Math.min(2, PixelRatio.get())
  const scheduler = useTileScheduler(snapshot.mapManifest, camera, viewport, pixelRatio, quality)

  useEffect(() => {
    onCacheStats?.({ diskBytes: scheduler.diskBytes, gpuBytes: scheduler.estimatedGpuBytes })
  }, [onCacheStats, scheduler.diskBytes, scheduler.estimatedGpuBytes])

  useEffect(() => {
    setCamera((current) => clampCamera(current, viewport, snapshot.mapManifest))
  }, [snapshot.sceneId, snapshot.mapManifest.assetHash, viewport.width, viewport.height])

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const metrics = touchMetrics(event.nativeEvent.touches)
      origin.current = { camera, ...metrics, startedAt: Date.now() }
      moved.current = false
    },
    onPanResponderMove: (event, gesture) => {
      const initial = origin.current
      if (!initial) return
      const metrics = touchMetrics(event.nativeEvent.touches)
      if (event.nativeEvent.touches.length >= 2 && initial.distance > 0) {
        moved.current = true
        const scale = Math.max(0.035, Math.min(1.8, initial.camera.scale * metrics.distance / initial.distance))
        const world = screenToWorld(initial.camera, { x: initial.centerX, y: initial.centerY })
        setCamera(clampCamera({
          scale,
          x: metrics.centerX - world.x * scale,
          y: metrics.centerY - world.y * scale,
        }, viewport, snapshot.mapManifest))
        return
      }
      if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5) moved.current = true
      setCamera(clampCamera({
        ...initial.camera,
        x: initial.camera.x + gesture.dx,
        y: initial.camera.y + gesture.dy,
      }, viewport, snapshot.mapManifest))
    },
    onPanResponderRelease: (event, gesture) => {
      const initial = origin.current
      origin.current = null
      if (!initial || moved.current || Date.now() - initial.startedAt > 320) return
      const x = event.nativeEvent.locationX
      const y = event.nativeEvent.locationY
      const token = tokenAtScreenPoint(snapshot.visibleTokens, camera, x, y)
      if (token && targeting === 'token') {
        onTargetToken?.(token)
        setMessage(`已选择目标：${token.name}`)
        return
      }
      if (targeting === 'area') {
        const world = screenToWorld(camera, { x, y })
        onTargetPoint?.(world)
        setMessage('已选择区域落点')
        return
      }
      if (token) {
        setSelectedId(token.id)
        setMessage(token.controlled ? '已选择你的 Token' : `${token.name} · HP ${token.hp}/${token.maxHp}`)
        return
      }
      const world = screenToWorld(camera, { x, y })
      const interaction = interactionPoints
        .map((point) => ({ point, distance: Math.hypot(point.x - world.x, point.y - world.y) }))
        .filter(({ distance }) => distance <= Math.max(22 / camera.scale, (snapshot.mapManifest.grid?.sizeWorldUnits ?? 70) * .7))
        .sort((a, b) => a.distance - b.distance)[0]?.point
      if (interaction) {
        setMessage(`正在互动：${interaction.name}`)
        void onInteract?.(interaction.id)
          .then(() => setMessage(`${interaction.name}已交由 Host 结算`))
          .catch((cause) => setMessage(`互动被拒绝：${cause instanceof Error ? cause.message : '未知原因'}`))
        return
      }
      if (!moving) return
      const controlled = snapshot.controlledTokens.find((candidate) => candidate.id === selectedId) ?? snapshot.controlledTokens[0]
      if (!controlled) return
      onMovingChange(false)
      setMessage('正在等待 Host 校验移动…')
      void onMove(controlled.id, world.x, world.y)
        .then(() => setMessage('移动已由 Host 确认'))
        .catch((cause) => setMessage(`移动被拒绝：${cause instanceof Error ? cause.message : '未知原因'}`))
    },
  }), [camera, interactionPoints, moving, onInteract, onMove, onMovingChange, onTargetPoint, onTargetToken, selectedId, snapshot, targeting, viewport])

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setViewport({ width, height })
  }
  const selected = snapshot.visibleTokens.find((token) => token.id === selectedId)
  const visiblePath = useMemo(() => {
    if (!snapshot.visionMaskEnabled || !snapshot.visibilityPolygons?.length) return null
    const path = Skia.Path.Make()
    for (const polygon of snapshot.visibilityPolygons) {
      if (polygon.length < 3) continue
      path.moveTo(camera.x + polygon[0].x * camera.scale, camera.y + polygon[0].y * camera.scale)
      for (let index = 1; index < polygon.length; index += 1) {
        path.lineTo(camera.x + polygon[index].x * camera.scale, camera.y + polygon[index].y * camera.scale)
      }
      path.close()
    }
    return path
  }, [camera, snapshot.visibilityPolygons, snapshot.visionMaskEnabled])
  const gridSize = (snapshot.mapManifest.grid?.sizeWorldUnits ?? 300) * camera.scale
  const gridLines = []
  if (gridSize >= 12) {
    const startX = ((camera.x % gridSize) + gridSize) % gridSize
    const startY = ((camera.y % gridSize) + gridSize) % gridSize
    for (let x = startX; x < viewport.width; x += gridSize) gridLines.push(<Line key={`gx-${x}`} p1={vec(x, 0)} p2={vec(x, viewport.height)} color="#ffffff24" strokeWidth={1} />)
    for (let y = startY; y < viewport.height; y += gridSize) gridLines.push(<Line key={`gy-${y}`} p1={vec(0, y)} p2={vec(viewport.width, y)} color="#ffffff24" strokeWidth={1} />)
  }

  return (
    <View style={styles.root} onLayout={onLayout} {...panResponder.panHandlers}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="#111827" />
        {snapshot.mapManifest.delivery === 'single-image'
          ? <SkiaMapImage manifest={snapshot.mapManifest} camera={camera} />
          : scheduler.tiles.map((tile) => <SkiaTile key={`${tile.level}/${tile.x}/${tile.y}`} tile={tile} camera={camera} />)}
        {gridLines}
        {snapshot.opaqueSegments.filter((segment) => !segment.open).map((segment) => (
          <Line
            key={segment.id}
            p1={vec(camera.x + segment.ax * camera.scale, camera.y + segment.ay * camera.scale)}
            p2={vec(camera.x + segment.bx * camera.scale, camera.y + segment.by * camera.scale)}
            color="#f5f3ff"
            strokeWidth={Math.max(2, 10 * camera.scale)}
          />
        ))}
        {snapshot.fogChunks.filter((chunk) => !chunk.explored).map((chunk) => (
          <Rect
            key={chunk.chunkId}
            x={camera.x + chunk.bounds.x * camera.scale}
            y={camera.y + chunk.bounds.y * camera.scale}
            width={chunk.bounds.width * camera.scale}
            height={chunk.bounds.height * camera.scale}
            color="#02030aee"
          />
        ))}
        {visiblePath && (
          <Group clip={visiblePath} invertClip>
            <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="#02030afa" />
          </Group>
        )}
        {!targeting && interactionPoints.map((point) => {
          const x = camera.x + point.x * camera.scale
          const y = camera.y + point.y * camera.scale
          return <Fragment key={`interaction:${point.id}`}><Circle cx={x} cy={y} r={13} color="#071827e8" /><Circle cx={x} cy={y} r={10} color={colors.warning} /><Circle cx={x} cy={y} r={4} color="#fff4c4" /></Fragment>
        })}
        {snapshot.visibleTokens.map((token) => {
          const x = camera.x + token.x * camera.scale
          const y = camera.y + token.y * camera.scale
          const radius = Math.max(7, token.radius * camera.scale)
          const selected = token.id === selectedId
          const activeTurn = token.id === snapshot.initiative?.currentTokenId
          return (
            <Fragment key={token.id}>
              {activeTurn && <Circle cx={x} cy={y} r={radius + 11} color="#f7c94888" />}
              {selected && <Circle cx={x} cy={y} r={radius + 7} color={token.controlled ? colors.primary : colors.warning} />}
              <Circle cx={x} cy={y} r={radius + 3} color={token.friendly ? colors.teal : colors.danger} />
              <Circle cx={x} cy={y} r={radius} color={token.portraitColor} />
              <Rect x={x - radius} y={y + radius + 4} width={radius * 2} height={3} color="#261f34" />
              <Rect x={x - radius} y={y + radius + 4} width={radius * 2 * token.hp / token.maxHp} height={3} color={colors.success} />
            </Fragment>
          )
        })}
      </Canvas>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {snapshot.visibleTokens.map((token) => {
          if (!token.portraitSource) return null
          const x = camera.x + token.x * camera.scale
          const y = camera.y + token.y * camera.scale
          const radius = Math.max(7, token.radius * camera.scale)
          const inset = Math.min(3, radius / 3)
          return <Image
            key={`portrait:${token.id}`}
            source={token.portraitSource}
            resizeMode="cover"
            style={[
              styles.mapPortrait,
              {
                left: x - radius + inset,
                top: y - radius + inset,
                width: Math.max(4, (radius - inset) * 2),
                height: Math.max(4, (radius - inset) * 2),
                borderRadius: Math.max(2, radius - inset),
              },
            ]}
          />
        })}
      </View>
      <View pointerEvents="none" style={styles.mapHud}>
        <View style={styles.badge}><Text style={styles.badgeText}>{snapshot.mapManifest.worldWidth} × {snapshot.mapManifest.worldHeight}</Text></View>
        <View style={styles.badge}><Text style={styles.badgeText}>{quality.toUpperCase()} · {snapshot.mapManifest.delivery === 'single-image' ? '单图投影' : `${scheduler.tiles.length} 纹理`}</Text></View>
        {targeting && <View style={[styles.badge, styles.targetBadge]}><Text style={styles.targetText}>{targeting === 'area' ? '选择区域落点' : '选择生物目标'}</Text></View>}
      </View>
      <View pointerEvents="none" style={styles.message}><Text numberOfLines={1} style={styles.messageText}>{message}</Text></View>
      {selected && (
        <View pointerEvents="none" style={styles.tokenCard}>
          {selected.portraitSource
            ? <Image source={selected.portraitSource} resizeMode="cover" style={styles.tokenPortrait} />
            : <View style={[styles.tokenDot, { backgroundColor: selected.portraitColor }]} />}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.tokenName}>{selected.name}</Text>
            <Text style={styles.tokenMeta}>HP {selected.hp}/{selected.maxHp}{selected.conditions.length ? ` · ${selected.conditions.join('、')}` : ''}</Text>
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="镜头回到角色"
        style={styles.recenter}
        onPress={() => {
          const token = snapshot.controlledTokens[0]
          if (!token) return
          setCamera((current) => clampCamera({
            ...current,
            x: viewport.width / 2 - token.x * current.scale,
            y: viewport.height / 2 - token.y * current.scale,
          }, viewport, snapshot.mapManifest))
        }}
      ><Text style={styles.recenterText}>◎</Text></Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#111827' },
  mapHud: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6 },
  badge: { backgroundColor: '#070711cc', borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  targetBadge: { borderColor: colors.warning },
  targetText: { color: colors.warning, fontSize: 10, fontWeight: '900' },
  message: { position: 'absolute', left: 50, right: 50, bottom: 94, alignItems: 'center' },
  messageText: { color: colors.text, fontSize: 11, backgroundColor: '#070711dd', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  tokenCard: { position: 'absolute', left: 12, right: 12, bottom: 16, minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: '#11111dee', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapPortrait: { position: 'absolute' },
  tokenPortrait: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.text },
  tokenDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.text },
  tokenName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  tokenMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  recenter: { position: 'absolute', right: 14, top: 52, width: 42, height: 42, borderRadius: 21, backgroundColor: '#11111dee', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  recenterText: { color: colors.teal, fontSize: 24, fontWeight: '800' },
})

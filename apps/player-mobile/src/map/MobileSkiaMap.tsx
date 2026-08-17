import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  Image,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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
import { cameraForPinch } from './gestureMath'

function tokenAtScreenPoint(tokens: PlayerTokenView[], camera: CameraState, x: number, y: number) {
  return tokens
    .map((token) => ({ token, distance: Math.hypot(camera.x + token.x * camera.scale - x, camera.y + token.y * camera.scale - y) }))
    .filter(({ token, distance }) => distance <= Math.max(26, token.radius * camera.scale + 12))
    .sort((a, b) => a.distance - b.distance)[0]?.token ?? null
}

function colorWithAlpha(color: string, alpha: string, fallback: string) {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${alpha}`
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map((part) => `${part}${part}`).join('')}${alpha}`
  }
  return fallback
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
  const cameraRef = useRef(camera)
  const panOrigin = useRef<CameraState>(camera)
  const pinchOrigin = useRef<{ camera: CameraState; centerX: number; centerY: number }>({ camera, centerX: 0, centerY: 0 })
  const pixelRatio = quality === 'lite' ? 1 : quality === 'standard' ? Math.min(1.5, PixelRatio.get()) : Math.min(2, PixelRatio.get())
  const scheduler = useTileScheduler(snapshot.mapManifest, camera, viewport, pixelRatio, quality)

  useEffect(() => { cameraRef.current = camera }, [camera])

  useEffect(() => {
    onCacheStats?.({ diskBytes: scheduler.diskBytes, gpuBytes: scheduler.estimatedGpuBytes })
  }, [onCacheStats, scheduler.diskBytes, scheduler.estimatedGpuBytes])

  useEffect(() => {
    setCamera((current) => clampCamera(current, viewport, snapshot.mapManifest))
  }, [snapshot.sceneId, snapshot.mapManifest.assetHash, viewport.width, viewport.height])

  const handleMapTap = useCallback((x: number, y: number) => {
      const activeCamera = cameraRef.current
      const token = tokenAtScreenPoint(snapshot.visibleTokens, activeCamera, x, y)
      if (token && targeting === 'token') {
        onTargetToken?.(token)
        setMessage(`已选择目标：${token.name}`)
        return
      }
      if (targeting === 'area') {
        const world = screenToWorld(activeCamera, { x, y })
        onTargetPoint?.(world)
        setMessage('已选择区域落点')
        return
      }
      if (token) {
        setSelectedId(token.id)
        setMessage(token.controlled ? '已选择你的 Token' : `${token.name} · HP ${token.hp}/${token.maxHp}`)
        return
      }
      const world = screenToWorld(activeCamera, { x, y })
      const interaction = interactionPoints
        .map((point) => ({ point, distance: Math.hypot(point.x - world.x, point.y - world.y) }))
        .filter(({ distance }) => distance <= Math.max(22 / activeCamera.scale, (snapshot.mapManifest.grid?.sizeWorldUnits ?? 70) * .7))
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
  }, [interactionPoints, moving, onInteract, onMove, onMovingChange, onTargetPoint, onTargetToken, selectedId, snapshot, targeting])

  const mapGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(6)
      .maxPointers(1)
      .onBegin(() => { panOrigin.current = cameraRef.current })
      .onUpdate((event) => {
        const initial = panOrigin.current
        const next = clampCamera({
          ...initial,
          x: initial.x + event.translationX,
          y: initial.y + event.translationY,
        }, viewport, snapshot.mapManifest)
        cameraRef.current = next
        setCamera(next)
      })
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin((event) => {
        pinchOrigin.current = { camera: cameraRef.current, centerX: event.focalX, centerY: event.focalY }
      })
      .onUpdate((event) => {
        const initial = pinchOrigin.current
        const next = clampCamera(cameraForPinch(
          initial.camera,
          { centerX: initial.centerX, centerY: initial.centerY, distance: 1 },
          { centerX: event.focalX, centerY: event.focalY, distance: event.scale },
        ), viewport, snapshot.mapManifest)
        cameraRef.current = next
        setCamera(next)
      })
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(320)
      .maxDistance(8)
      .onEnd((event, success) => { if (success) handleMapTap(event.x, event.y) })
    return Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, tap))
  }, [handleMapTap, snapshot.mapManifest, viewport])

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
  const gridWorldSize = snapshot.mapManifest.grid?.sizeWorldUnits ?? 300
  const gridOffsetX = snapshot.mapManifest.grid?.offsetX ?? 0
  const gridOffsetY = snapshot.mapManifest.grid?.offsetY ?? 0
  const pixelsPerFoot = gridWorldSize * camera.scale / 5
  const gridLines = []
  if (gridSize >= 12) {
    const startX = ((camera.x % gridSize) + gridSize) % gridSize
    const startY = ((camera.y % gridSize) + gridSize) % gridSize
    for (let x = startX; x < viewport.width; x += gridSize) gridLines.push(<Line key={`gx-${x}`} p1={vec(x, 0)} p2={vec(x, viewport.height)} color="#ffffff24" strokeWidth={1} />)
    for (let y = startY; y < viewport.height; y += gridSize) gridLines.push(<Line key={`gy-${y}`} p1={vec(0, y)} p2={vec(viewport.width, y)} color="#ffffff24" strokeWidth={1} />)
  }

  return (
    <GestureDetector gesture={mapGesture}>
    <View style={styles.root} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="#111827" />
        {snapshot.mapManifest.delivery === 'single-image'
          ? <SkiaMapImage manifest={snapshot.mapManifest} camera={camera} />
          : scheduler.tiles.map((tile) => <SkiaTile key={`${tile.level}/${tile.x}/${tile.y}`} tile={tile} camera={camera} />)}
        {(snapshot.lights ?? []).map((light) => {
          const x = camera.x + light.x * camera.scale
          const y = camera.y + light.y * camera.scale
          return <Fragment key={`light:${light.id}`}>
            <Circle cx={x} cy={y} r={Math.max(1, (light.brightRadiusFeet + light.dimRadiusFeet) * pixelsPerFoot)} color={colorWithAlpha(light.color, '18', '#ffd16618')} />
            <Circle cx={x} cy={y} r={Math.max(1, light.brightRadiusFeet * pixelsPerFoot)} color={colorWithAlpha(light.color, '30', '#ffd16630')} />
          </Fragment>
        })}
        {(snapshot.persistentAreas ?? []).flatMap((area) => area.cells.map((cell) => {
          const x = camera.x + (gridOffsetX + cell.col * gridWorldSize) * camera.scale
          const y = camera.y + (gridOffsetY + cell.row * gridWorldSize) * camera.scale
          const darkness = area.lighting?.kind === 'magical-darkness'
          return <Fragment key={`area:${area.id}:${cell.col}:${cell.row}`}>
            <Rect x={x} y={y} width={gridSize} height={gridSize} color={darkness ? '#02030ad8' : colorWithAlpha(area.color, '3d', '#8b5cf63d')} />
            <Rect x={x + 1} y={y + 1} width={Math.max(0, gridSize - 2)} height={Math.max(0, gridSize - 2)} color={area.color} style="stroke" strokeWidth={Math.max(1, Math.min(3, camera.scale * 5))} strokeJoin="round" />
          </Fragment>
        }))}
        {(snapshot.terrainElevations ?? []).map((terrain) => terrain.points.map((point, index, points) => {
          const next = points[(index + 1) % points.length]
          return <Line
            key={`terrain:${terrain.id}:${index}`}
            p1={vec(camera.x + point.x * camera.scale, camera.y + point.y * camera.scale)}
            p2={vec(camera.x + next.x * camera.scale, camera.y + next.y * camera.scale)}
            color={terrain.magicalDarkness ? '#312e81' : terrain.elevationFeet >= 0 ? '#fbbf24' : '#38bdf8'}
            strokeWidth={Math.max(1.5, 3 * camera.scale)}
          />
        }))}
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
          return <Fragment key={`interaction:${point.id}`}><Circle cx={x} cy={y} r={13} color="#071827e8" /><Circle cx={x} cy={y} r={10} color="#fbbf24" /><Circle cx={x} cy={y} r={4} color="#fff4c4" /></Fragment>
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
              {selected && <Circle cx={x} cy={y} r={radius + 7} color={token.controlled ? '#8b5cf6' : '#fbbf24'} />}
              <Circle cx={x} cy={y} r={radius + 3} color={token.friendly ? '#2dd4bf' : '#fb7185'} />
              <Circle cx={x} cy={y} r={radius} color={token.portraitSource || token.avatar ? '#11131d' : token.portraitColor} />
              <Rect x={x - radius} y={y + radius + 4} width={radius * 2} height={3} color="#261f34" />
              <Rect x={x - radius} y={y + radius + 4} width={radius * 2 * token.hp / token.maxHp} height={3} color="#34d399" />
            </Fragment>
          )
        })}
      </Canvas>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {snapshot.visibleTokens.map((token) => {
          const x = camera.x + token.x * camera.scale
          const y = camera.y + token.y * camera.scale
          const radius = Math.max(7, token.radius * camera.scale)
          const inset = Math.min(3, radius / 3)
          return <MapTokenPortrait
            key={`portrait:${token.id}`}
            token={token}
            left={x - radius + inset}
            top={y - radius + inset}
            diameter={Math.max(4, (radius - inset) * 2)}
          />
        })}
      </View>
      {targeting && <View pointerEvents="none" style={styles.mapHud}><View style={[styles.badge, styles.targetBadge]}><Text style={styles.targetText}>{targeting === 'area' ? '选择区域落点' : '选择生物目标'}</Text></View></View>}
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
    </GestureDetector>
  )
}

function MapTokenPortrait({ token, left, top, diameter }: { token: PlayerTokenView; left: number; top: number; diameter: number }) {
  const [failedUri, setFailedUri] = useState('')
  const source = token.portraitSource
  const showImage = !!source?.uri && failedUri !== source.uri
  return <View style={[styles.mapPortrait, { left, top, width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
    {showImage
      ? <Image source={source} resizeMode="cover" style={styles.mapPortraitImage} onError={() => setFailedUri(source.uri)} />
      : <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.mapPortraitFallback, { fontSize: Math.max(8, Math.min(24, diameter * 0.55)) }]}>{token.avatar || token.name.slice(0, 1) || '·'}</Text>}
  </View>
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
  tokenCard: { position: 'absolute', left: 76, right: 12, bottom: 16, minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: '#11111dee', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapPortrait: { position: 'absolute', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#11131d' },
  mapPortraitImage: { width: '100%', height: '100%' },
  mapPortraitFallback: { color: '#f4f1ff', width: '86%', textAlign: 'center', fontWeight: '900' },
  tokenPortrait: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.text },
  tokenDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.text },
  tokenName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  tokenMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  recenter: { position: 'absolute', right: 14, top: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: '#11111dee', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  recenterText: { color: colors.teal, fontSize: 24, fontWeight: '800' },
})

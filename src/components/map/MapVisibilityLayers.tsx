import { Circle, Group, Line, Rect } from 'react-konva'
import type { BattleMap, Token } from '../../store/maps'
import {
  DND5E_DEFAULT_PLAYER_VISION_RANGE_FEET,
  mapGeometryAbsoluteElevationAtPoint,
  mapGeometryLightPolygon,
  mapGeometryMagicalDarknessObstacleIsSuppressed,
  mapGeometryObstacleAffectsElevation,
  mapGeometrySpellLightingSources,
  mapGeometryTokenElevation,
  mapGeometryVisibilityPolygon,
  mapGeometryVisibleTargets,
  type MapGeometryPoint,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import { campaignLightIsActive } from '../../lib/campaignTime'
import {
  type FogShape,
  type MapFogState,
} from '../../lib/fogOfWar'
import { compileDnd5eEffectiveVisionProfile } from '../../../shared/dnd5e-vision-profile.mjs'
import {
  mapLightingAmbientOpacity,
  mapLightingDarkvisionCutoutOpacity,
  mapLightingGlowOpacity,
  mapLightingShouldRender,
} from './mapLightingPresentation'



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



export function FogOfWarLayer({
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
    <Group listening={false}>
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
    </Group>
  )
}



export function PlayerVisibilityLayer({
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
    <Group listening={false}>
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
    </Group>
  )
}



export function LightingLayer({
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
    <Group name="map-lighting-content" listening={false}>
      <Group listening={false}>
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
      </Group>
      <Group listening={false}>
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
      </Group>
      {(magicalDarkness.length > 0 || spellDarkness.length > 0) && <Group listening={false}>
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
      </Group>}
    </Group>
  )
}

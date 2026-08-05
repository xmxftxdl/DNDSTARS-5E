import { Circle, Group, Line, Rect, Text } from 'react-konva'
import Konva from 'konva'
import type { BattleMap } from '../../store/maps'
import {
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryDoorPhysicalState,
  mapGeometryWallRenderSegments,
  type MapGeometryEntity,
  type MapGeometryPoint,
  type MapGeometryState,
  type MapGeometryTool,
  type MapGeometryWallMaterial,
} from '../../lib/mapGeometry'
import type { MapGeometryDiagnostics } from '../../lib/mapGeometryDiagnostics'
import type { WallDetectionCandidate } from '../../lib/mapImageGeometryDetection'
import { geometryEntityPoints } from './mapCanvasGeometryUtils'



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



export function MapGeometryLayer({
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
    <Group listening={entityEditListening || matchingToolEditListening || doorInteractionMode}>
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
          listening: (entityEditListening || (editMode && (
            tool === 'obstacle' || tool === 'difficult-terrain'
          ))) && !isDraft,
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
    </Group>
  )
}



export function MapGeometryDiagnosticsLayer({
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
    <Group listening={!!onCandidateRemove}>
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
    </Group>
  )
}

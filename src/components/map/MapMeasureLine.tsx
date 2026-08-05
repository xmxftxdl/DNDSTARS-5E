import Konva from 'konva'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { DND_FEET_PER_CELL } from '../../lib/gridCombat'

export interface MapMeasurePoint {
  x: number
  y: number
}

export interface MapMeasureLineProps {
  a: MapMeasurePoint
  b: MapMeasurePoint
  cells: number
  snapMeasure: boolean
  inv: number
  preview?: boolean
  onDelete?: () => void
}

/**
 * Pure Konva projection for a persisted or in-progress ruler segment.
 * Measurement state and deletion authority remain with the parent controller.
 */
export default function MapMeasureLine({
  a,
  b,
  cells,
  snapMeasure,
  inv,
  preview = false,
  onDelete,
}: MapMeasureLineProps) {
  const feet = cells * DND_FEET_PER_CELL
  const label = snapMeasure
    ? `${cells} 格 / ${feet} 尺`
    : `${cells.toFixed(1)} 格 / ${feet.toFixed(1)} 尺`
  const degenerate = a.x === b.x && a.y === b.y
  const handleDelete = onDelete
    ? (event: Konva.KonvaEventObject<PointerEvent>) => {
        event.evt.preventDefault()
        event.cancelBubble = true
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

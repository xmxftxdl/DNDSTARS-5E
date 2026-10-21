import { Circle, Group, Text } from 'react-konva'
import { controlledFlameAppearance } from '../../../shared/controlled-flame-state.mjs'
import type { MapGeometryState } from '../../lib/mapGeometry'
import type { MapFogState } from '../../lib/fogOfWar'
import type { BattleMap, Token } from '../../store/maps'
import { playerVisibleCanvasTokens } from './playerTokenVisibility'

export interface ControlledFlameSceneInput {
  map: BattleMap
  geometry?: MapGeometryState
  fog?: MapFogState
  worldMinute: number
  isDM: boolean
  visionSourceTokenIds: readonly string[]
}

/** Descriptions remain literal text; visibility follows the same policy as map tokens. */
export function controlledFlameSceneMarkers(input: ControlledFlameSceneInput) {
  return (input.geometry?.lights ?? []).flatMap(light => {
    if (!light.enabled || !light.controlledFlame || light.points.length !== 1) return []
    const appearance = controlledFlameAppearance(light.controlledFlame, input.worldMinute)
    if (!appearance.enabled || !appearance.shape) return []
    const point = light.points[0]
    const marker: Token = { id: `controlled-flame:${light.id}`, type: 'obstacle', label: '', emoji: '', color: appearance.color,
      x: point.x, y: point.y, elevationFeet: light.elevationFeet, size: 1 }
    if (!input.isDM && !playerVisibleCanvasTokens({ ...input,
      map: { ...input.map, tokens: [...input.map.tokens, marker] },
    }).some(token => token.id === marker.id)) return []
    return [{ id: light.id, ...point, color: appearance.color, description: appearance.shape }]
  })
}

export function ControlledFlameSceneLayer(input: ControlledFlameSceneInput & { inv: number }) {
  return <Group name="controlled-flame-images" listening={false}>
    {controlledFlameSceneMarkers(input).map(marker => <Group key={marker.id} x={marker.x} y={marker.y} listening={false}>
      <Circle radius={8 * input.inv} fill={marker.color} opacity={0.65} shadowColor={marker.color} shadowBlur={14 * input.inv} />
      <Text name="controlled-flame-image-description" x={12 * input.inv} y={-12 * input.inv} width={180 * input.inv}
        height={72 * input.inv} fontSize={12 * input.inv} lineHeight={1.25} wrap="char" ellipsis
        text={`火焰影像：${marker.description}`} fill="#fff7ed" stroke="#1c1917" strokeWidth={3 * input.inv}
        fillAfterStrokeEnabled listening={false} />
    </Group>)}
  </Group>
}

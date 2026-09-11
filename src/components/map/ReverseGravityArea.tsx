import { Group, Circle, Text } from 'react-konva'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { persistentAreaCircularRangeGeometry } from './persistentAreaRangePresentation'
import { ReverseGravityEffect } from './ReverseGravityEffect'
export function ReverseGravityArea({ area, map }: { area: Dnd5ePluginArea; map: BattleMap }) {
 const geometry = persistentAreaCircularRangeGeometry({cells:area.cells,anchorCell:area.anchorCell,gridSize:map.gridSize,gridOffsetX:map.gridOffsetX,gridOffsetY:map.gridOffsetY})
 if (!geometry) return null
 const { x, y, radius } = geometry
 return <Group name="reverse-gravity-area" listening={false}>
  <ReverseGravityEffect persistent projectile={{id:area.id,kind:'reverse-gravity',from:{x,y},to:{x,y},radiusPx:radius}}/>
  <Circle name="reverse-gravity-range" x={x} y={y} radius={radius} stroke="#ddd6fe" strokeWidth={2} strokeScaleEnabled={false} shadowColor="#8b5cf6" shadowBlur={8}/>
  <Circle x={x} y={y} radius={Math.max(1,radius-5)} stroke="#a5f3fc" strokeWidth={1} strokeScaleEnabled={false} dash={[7,7]} opacity={0.8}/>
  <Text x={x-55} y={y+radius+8} width={110} align="center" text="↑ 反重力范围" fontSize={13} fill="#ede9fe" stroke="#111827" strokeWidth={0.5}/>
 </Group>
}

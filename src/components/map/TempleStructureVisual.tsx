import {useMemo} from 'react'
import {Group,Line} from 'react-konva'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {templeVisualParts} from './templeVisualGeometry'

export function TempleStructureVisual({geometry,elevationFeet,worldMinute}:{geometry?:MapGeometryState;elevationFeet:number;worldMinute:number}){
 const parts=useMemo(()=>templeVisualParts(geometry,elevationFeet,worldMinute),[geometry,elevationFeet,worldMinute])
 return <Group name="temple-structure-visual" listening={false}>
  {parts.map(({entity,kind})=><Group key={entity.id} name={`temple-${kind}`}>
   <Line points={entity.points.flatMap(point=>[point.x,point.y])} closed
    fill={kind==='wall'?'#dfd8b9':kind==='roof'?'#45454c':'rgba(155,145,112,0.15)'}
    stroke={kind==='wall'?'#f4e3ae':kind==='roof'?'#c0b48b':undefined}
    strokeWidth={kind==='wall'?3:2} strokeScaleEnabled={false} lineJoin="miter" perfectDrawEnabled={false}/>
  </Group>)}
 </Group>
}

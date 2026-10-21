import {useMemo} from 'react'
import {Group,Line} from 'react-konva'
import type {MapGeometryState} from '../../lib/mapGeometry'
import {fortressVisualParts} from './fortressVisualGeometry'

export function FortressStructureVisual({geometry,elevationFeet,worldMinute}:{geometry?:MapGeometryState;elevationFeet:number;worldMinute:number}){
 const parts=useMemo(()=>fortressVisualParts(geometry,elevationFeet,worldMinute),[geometry,elevationFeet,worldMinute])
 return <Group name="fortress-structure-visual" listening={false}>
  {parts.map(({entity,kind})=>{
   const points=entity.points.flatMap(point=>[point.x,point.y])
   const [a,b,c,d]=entity.points
   return <Group key={entity.id} name={`fortress-${kind}`}>
    <Line points={points} closed fill={kind==='wall'?'#77756b':kind==='stairs'?'#8e8a7c':'#575950'}
     stroke={kind==='wall'?'#c2bca9':'#353a35'} strokeWidth={kind==='wall'?1.5:0.8} perfectDrawEnabled={false}/>
    {a&&b&&c&&d&&kind!=='floor'&&Array.from({length:kind==='stairs'?9:4},(_,index)=>{
     const t=(index+1)/(kind==='stairs'?10:5)
     return <Line key={index} points={[a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,d.x+(c.x-d.x)*t,d.y+(c.y-d.y)*t]}
      stroke={kind==='stairs'?'#e1d6bd':'#3d413b'} strokeWidth={0.8} listening={false}/>
    })}
   </Group>
  })}
 </Group>
}

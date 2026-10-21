import {Group,Line} from 'react-konva'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {rectangularPrismOutline} from '../../../shared/rectangular-prism.mjs'

/** The persistent wall shares the exact projected solid with its placement preview. */
export function RectangularLightVisual({map,area}:{map:BattleMap;area:Dnd5ePluginArea}){
 const points=rectangularPrismOutline(map,area)
 if(!points?.length)return null
 const color=area.lighting?.kind==='light'?area.lighting.color??'#fff4cb':'#fff4cb'
 return <Group name="persistent-rectangular-light" id={`light-wall:${area.id}`} listening={false}
   clipFunc={context=>{
    context.beginPath()
    for(const cell of area.cells)context.rect(map.gridOffsetX+cell.col*map.gridSize,map.gridOffsetY+cell.row*map.gridSize,map.gridSize,map.gridSize)
   }}>
   <Line points={points} closed fill={color} opacity={0.18} stroke={color} strokeWidth={8} shadowColor={color} shadowBlur={14}/>
   <Line name="prism-light-outline" points={points} closed fill={color} opacity={0.6} stroke="#fffef5" strokeWidth={1.5}/>
 </Group>
}

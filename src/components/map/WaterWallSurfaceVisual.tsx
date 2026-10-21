import {memo,useRef} from 'react'
import {Group,Line} from 'react-konva'
import type Konva from 'konva'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {wallSurfaceVisualGeometry} from './wallSurfaceVisualGeometry'
import {usePrefersReducedMotion,useStatusAnimation} from './mapEffectHooks'
export const WaterWallSurfaceVisual=memo(function WaterWallSurfaceVisual({area,map,hitOnly=false}:{area:Dnd5ePluginArea;map:BattleMap;hitOnly?:boolean}){
 const glow=useRef<Konva.Group>(null),reduced=usePrefersReducedMotion()
 const frozen=!!area.entityProfile,shapes=wallSurfaceVisualGeometry(area,map)
 useStatusAnimation(()=>glow.current?.getLayer()??null,frame=>{
  if(!frame||!glow.current)return
  glow.current.opacity(.4+.1*Math.sin(frame.time/1100))
  for(const line of glow.current.getChildren())if('dashOffset' in line)(line as Konva.Line).dashOffset(-frame.time/95)
 },{active:!hitOnly&&!frozen&&!reduced&&shapes.length>0,fps:20})
 if(!shapes.length)return null
 return <Group name={hitOnly?'wall-surface-hit':frozen?'frozen-water-wall':'water-wall-surface'} listening={hitOnly} clipFunc={ctx=>{
  ctx.beginPath();for(const cell of area.cells)ctx.rect(map.gridOffsetX+cell.col*map.gridSize,map.gridOffsetY+cell.row*map.gridSize,map.gridSize,map.gridSize)
 }}>
  {shapes.map((shape,i)=><Line key={i} points={shape.points} closed fill={hitOnly?'rgba(255,255,255,0.001)':frozen?'#78b9ce':'#137c9e'}
   opacity={hitOnly?1:frozen ? .9 :Math.min(.65,.2+.45*shape.heightFraction)} stroke={hitOnly?undefined:frozen?'#e2f7ff':'#78daee'} strokeWidth={hitOnly?0:frozen?1.5:1}/>) }
  {!hitOnly&&<Group ref={glow} listening={false} opacity={frozen ? .8 :.4}>
   {shapes.map((shape,i)=><Line key={i} points={shape.spine} stroke={frozen?'#effcff':'#baf6ff'} strokeWidth={frozen?1.5:1} dash={frozen?[3,7]:[8,12]} opacity={Math.min(1,.25+shape.heightFraction)} listening={false}/>) }
  </Group>}
 </Group>
})

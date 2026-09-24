import { IceWallFrigidAir } from './IceWallFrigidAir'
import { Group, Line, Rect, Text } from 'react-konva'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { stoneWallPanelPlacement } from './stoneWallPlacement'
export function IceWallVisual({area,map,draftPanelId}:{area:Pick<Dnd5ePluginArea,'stoneWall'>;map:BattleMap;draftPanelId?:string}) {
 return <Group listening={false}>{area.stoneWall?.panels.map((panel,index)=>{
  const p=stoneWallPanelPlacement(panel,map),width=Math.max(5,map.gridSize/(map.feetPerCell??5))
  if(panel.hitPoints===0)return <IceWallFrigidAir key={panel.id} panel={panel} map={map} />
  return <Group key={panel.id} opacity={panel.id === draftPanelId ? .45 : 1}>
   <Group x={p.x} y={p.y} rotation={p.angle}>
    <Rect x={-p.length/2} y={-width/2} width={p.length} height={width} fillLinearGradientStartPoint={{x:0,y:0}} fillLinearGradientEndPoint={{x:0,y:width}} fillLinearGradientColorStops={[0,'#e0f2fe',.3,'#7dd3fc',.6,'#0891b2',1,'#cffafe']} stroke="#e0f2fe" strokeWidth={1}/>
    {[.2,.5,.8].map(t=><Line key={t} points={[-p.length/2+p.length*t,-width/2,-p.length/2+p.length*(t+.08),0,-p.length/2+p.length*(t+.03),width/2]} stroke="rgba(240,249,255,.75)" strokeWidth={1}/>)}
   </Group>
   <Text x={p.x-15} y={p.y-width/2-15} width={30} align="center" text={String(index+1)} fill="#e0f2fe" fontSize={11}/>
  </Group>
 })}</Group>
}

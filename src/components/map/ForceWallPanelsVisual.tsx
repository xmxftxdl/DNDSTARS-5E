import { Group, Line, Text } from 'react-konva'
import type { BattleMap } from '../../store/maps'
import type { StoneWallPanel } from '../../rulesets/dnd5e/stoneWall'
import { stoneWallPanelPlacement } from './stoneWallPlacement'
export function ForceWallPanelsVisual({panels,map,draftPanelId}:{panels:readonly StoneWallPanel[];map:BattleMap;draftPanelId?:string}) {
 return <Group listening={false}>{panels.map((panel,index)=>{
  const p=stoneWallPanelPlacement(panel,map),draft=panel.id===draftPanelId
  return <Group key={panel.id} opacity={draft?.5:1}>
   <Line points={[p.start.x,p.start.y,p.end.x,p.end.y]} stroke="#818cf8" strokeWidth={Math.max(8,map.gridSize*.18)} opacity={.22} lineCap="round"/>
   <Line points={[p.start.x,p.start.y,p.end.x,p.end.y]} stroke="#a5b4fc" strokeWidth={4} shadowColor="#6366f1" shadowBlur={8} lineCap="round" dash={draft?[7,5]:undefined}/>
   <Line points={[p.start.x,p.start.y,p.end.x,p.end.y]} stroke="#e0f2fe" strokeWidth={1} lineCap="round"/>
   <Text x={p.x-12} y={p.y-19} width={24} align="center" text={String(index+1)} fontSize={11} fill="#e0e7ff"/>
  </Group>
 })}</Group>
}

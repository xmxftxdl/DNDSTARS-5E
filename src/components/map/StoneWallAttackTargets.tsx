import { stoneWallPanels } from '../../rulesets/dnd5e/stoneWall'
import { useState } from 'react'
import { Group, Line, Text, Circle } from 'react-konva'
import type { BattleMap } from '../../store/maps'
import { stoneWallPanelPlacement } from './stoneWallPlacement'
import { iceWallFromCells, wallArmorClass } from '../../rulesets/dnd5e/wallObjectRules'

export function StoneWallAttackTargets({ map, onSelect, isDM = false }: { map: BattleMap; isDM?: boolean; onSelect: (areaId: string, panelId: string) => void }) {
  const [hover, setHover] = useState<string>()
  return <Group>
    {map.dnd5ePluginAreas?.filter(a => isDM || !a.hiddenFromPlayers).flatMap(area => {
      const force = area.coreSpellId === 'wall-of-force'
      if(force && area.forceShell && area.anchorCell) {
        const x=map.gridOffsetX+(area.anchorCell.col+.5)*map.gridSize,y=map.gridOffsetY+(area.anchorCell.row+.5)*map.gridSize
        return [<Group key={area.id}>
          <Circle x={x} y={y} radius={area.forceShell.radiusFeet/(map.feetPerCell??5)*map.gridSize}
            stroke="#c4b5fd" strokeWidth={5} hitStrokeWidth={18} opacity={.7}
            onMouseDown={e=>{e.cancelBubble=true}} onTouchStart={e=>{e.cancelBubble=true}}
            onClick={e=>{e.cancelBubble=true;onSelect(area.id,'force-wall')}} onTap={e=>{e.cancelBubble=true;onSelect(area.id,'force-wall')}}/>
          <Text x={x-100} y={y-10} width={200} align="center" text="力场墙 · 免疫所有伤害" fill="#f5f3ff" fontSize={13} listening={false}/>
        </Group>]
      }
      const panels=area.forceWall ? stoneWallPanels(area.forceWall,map) : area.stoneWall?.panels ?? (force?iceWallFromCells(area.cells,map.feetPerCell??5)?.panels:undefined)
      return panels?.filter(p=>p.hitPoints>0).map(panel=>{
        const p=stoneWallPanelPlacement(panel,map),key=`${area.id}:${panel.id}`
        return <Group key={key}>
          <Line points={[p.start.x,p.start.y,p.end.x,p.end.y]} stroke={hover===key?'#fbbf24':force?'#c4b5fd':'#fb7185'}
            strokeWidth={Math.max(6,map.gridSize*.22)} opacity={hover===key?.7:.35} hitStrokeWidth={Math.max(14,map.gridSize*.4)}
            onMouseEnter={()=>setHover(key)} onMouseLeave={()=>setHover(undefined)}
            onMouseDown={e=>{e.cancelBubble=true}} onTouchStart={e=>{e.cancelBubble=true}}
            onClick={e=>{e.cancelBubble=true;onSelect(area.id,panel.id)}} onTap={e=>{e.cancelBubble=true;onSelect(area.id,panel.id)}}/>
          {hover===key && <Text x={p.x-125} y={p.y-30} width={250} align="center"
            text={force?'力场墙 · 免疫所有伤害':`${area.label} 第 ${panels!.indexOf(panel)+1} 段 · AC ${wallArmorClass(area)} · ${panel.hitPoints}/${panel.maxHitPoints} HP`}
            fill="#fef3c7" stroke="#1c1917" strokeWidth={.5} fontSize={13} listening={false}/>}
        </Group>
      })??[]
    })}
  </Group>
}

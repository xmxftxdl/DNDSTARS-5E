import { Circle, Group, Line, Text } from 'react-konva'
import type { BattleMap, Token } from '../../store/maps'
import { multipartTokenHeadProjections } from '../../rulesets/dnd5e/multipartMapGeometry'

/** Render anchors only. Selecting a head still targets the one shared creature. */
export function MultipartHeadLayer({map,tokens,onSelect}:{map:BattleMap;tokens:readonly Token[];onSelect:(id:string)=>void}) {
  return <>{tokens.flatMap(token => {
    const parts = token.dnd5eCombatState?.monsterMultipart
    if (!parts) return []
    const alive = parts.heads.filter(head=>head.alive)
    return multipartTokenHeadProjections(token,map).map((head,index)=><Group key={`${token.id}:${alive[index].id}`}>
      <Line points={[token.x,token.y,head.x,head.y]} stroke="#c4b5a5" strokeWidth={Math.max(3,map.gridSize/10)}
        onClick={()=>onSelect(token.id)} onTap={()=>onSelect(token.id)} />
      <Circle x={head.x} y={head.y} radius={map.gridSize*0.38} fill="#dbd2c5" stroke="#7f1d1d" strokeWidth={2}
        onClick={()=>onSelect(token.id)} onTap={()=>onSelect(token.id)} />
      <Text x={head.x-map.gridSize*0.3} y={head.y-map.gridSize*0.15} width={map.gridSize*0.6}
        text={alive[index].id.replace('head-','')} align="center" fontSize={map.gridSize*0.3} fill="#450a0a" listening={false}/>
    </Group>)
  })}</>
}

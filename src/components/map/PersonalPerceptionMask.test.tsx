import { expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
vi.mock('react-konva',()=>({Line:'Line',Rect:'Rect'}))
import { PersonalPerceptionMask } from './PersonalPerceptionMask'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import type { BattleMap, Token } from '../../store/maps'

const victim:Token={id:'victim',characterId:'mine',type:'player',label:'victim',x:125,y:125,size:1,color:'',emoji:'',
  dnd5eCombatState:{activeEffects:[{...createDnd5eMechanicalEffect({definitionId:'test:prison',label:'Prison',source:{kind:'spell'},targetId:'victim'}),
    initialSpaceBoundary:{mapId:'map',x:125,y:125,halfWidthUnits:25,bottomFeet:0,topFeet:5}}]}}
const map:BattleMap={id:'map',name:'map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[victim,{...victim,id:'ally',characterId:'theirs',x:350,dnd5eCombatState:{activeEffects:[]}}]}
function nodes(value:ReactNode):ReactElement<Record<string,any>>[]{
  if(Array.isArray(value))return value.flatMap(nodes)
  if(!value||typeof value!=='object'||!('props' in value))return []
  const node=value as ReactElement<Record<string,any>>
  return [node,...nodes(node.props.children)]
}
it('renders a five-foot visual cap without ordinary fog or a spatial prison',()=>{
  const limited=structuredClone(map)
  limited.tokens[0].dnd5eCombatState!.activeEffects=[createDnd5eMechanicalEffect({definitionId:'test:sight-cap',label:'Short sight',source:{kind:'feature'},targetId:'victim',modifiers:{sightRangeLimitFeet:5}})]
  const rendered=nodes(PersonalPerceptionMask({map:limited,viewerCharacterId:'mine',worldMinute:0}))
  expect(rendered.filter(n=>n.props.name==='personal-perception-cover')).toHaveLength(1)
  const points=rendered.find(n=>n.props.name==='personal-perception-cutout')!.props.points as number[]
  for(let i=0;i<points.length;i+=2)expect(Math.hypot(points[i]-125,points[i+1]-125)).toBeLessThanOrEqual(50.001)
  limited.tokens[0].dnd5eCombatState!.activeEffects=[]
  expect(PersonalPerceptionMask({map:limited,viewerCharacterId:'mine',worldMinute:0})).toBeNull()
})
it('covers the map without fog, ignoring unrestricted party allies when viewing the trapped character',()=>{
  const rendered=nodes(PersonalPerceptionMask({map,viewerCharacterId:'mine',worldMinute:0}))
  expect(rendered.filter(n=>n.props.name==='personal-perception-cover')).toHaveLength(1)
  const holes=rendered.filter(n=>n.props.name==='personal-perception-cutout')
  expect(holes).toHaveLength(1)
  expect(holes[0].props.points.every((n:number)=>n>=100-1e-6&&n<=150+1e-6)).toBe(true)
})
it('does not mask unaffected characters or a suspended effect',()=>{
  expect(PersonalPerceptionMask({map,viewerCharacterId:'theirs',worldMinute:0})).toBeNull()
  const suspended=structuredClone(map)
  suspended.tokens[0].dnd5eCombatState!.activeEffects![0].suspendedBy=['suppression']
  expect(PersonalPerceptionMask({map:suspended,viewerCharacterId:'mine',worldMinute:0})).toBeNull()
})

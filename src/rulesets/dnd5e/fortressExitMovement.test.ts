import {expect,it} from 'vitest'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import {snapTokenToGridCenter} from '../../lib/gridCombat'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap} from '../../store/maps'
import {placeDnd5eMightyFortressKeep} from './mightyFortressStructure'
import {prepareDnd5eExplorationMove} from './playerMoveAction'
it('walks from an off-grid structure exit to a snapped destination without crossing intact walls',()=>{
 const angle=37*Math.PI/180,origin={x:1025-600*Math.cos(angle)+600*Math.sin(angle),y:1025-600*Math.sin(angle)-600*Math.cos(angle)}
 const point=(x:number,y:number)=>({x:origin.x+10*x*Math.cos(angle)-10*y*Math.sin(angle),y:origin.y+10*x*Math.sin(angle)+10*y*Math.cos(angle)})
 const map:BattleMap={id:'keep',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,snapMonstersToGrid:true,
 tokens:[{id:'caster',characterId:'hero',type:'player',label:'Hero',size:1,color:'',emoji:'',...point(55,.5),elevationFeet:0}]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry('keep',1),structureId:'keep',origin,rotationDegrees:37,elevationFeet:0,createdAt:1,towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'hero',worldMinute:0}}).geometry
 const character=normalizeCharacter({id:'hero',name:'Hero',charClass:'法师',level:15,maxHp:60,currentHp:60})
 const action={id:'exit',type:'move-token' as const,characterId:'hero',actorTokenId:'caster',targetPosition:point(55,-10)} as Parameters<typeof prepareDnd5eExplorationMove>[0]['action']
 try{
  setMapGeometryRuntime([geometry])
  expect(prepareDnd5eExplorationMove({action,map,characters:[character]}).ok).toBe(false)
  const open={...geometry,obstacles:geometry.obstacles.map(w=>w.id==='keep:outer-north.0.3'?{...w,dnd5eDurability:{...w.dnd5eDurability!,hitPoints:0}}:w)}
  setMapGeometryRuntime([open])
  const result=prepareDnd5eExplorationMove({action,map,characters:[character]})
  expect(result.ok).toBe(true)
  if(!result.ok)throw Error(result.reason)
  expect(result.prepared.path[0]).toEqual(point(55,.5))
  expect(result.prepared.to).toEqual(snapTokenToGridCenter(action.targetPosition!.x,action.targetPosition!.y,map.tokens[0],map))
  expect(result.prepared.path.at(-1)).toEqual(result.prepared.to)
 }finally{setMapGeometryRuntime([])}
})

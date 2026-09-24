import { describe,it,expect } from 'vitest'
import type { BattleMap,Dnd5ePluginArea,Token } from '../../store/maps'
import { stoneWallPanels,stoneWallCells } from './stoneWall'
import { wallOverlapsCreature,wallPushDestinations,resolveWallPush } from './wallCreationDisplacement'
function fixture(spell='wall-of-stone'){
 const token:Token={id:'bull',label:'牛头人',type:'enemy',size:2,x:200,y:200,hp:46,maxHp:76,emoji:'',color:''}
 const map:BattleMap={id:'wall-push-test',name:'map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[token]}
 const layout={mode:'thick' as const,start:{col:2,row:3},angles:[25,110]},panels=stoneWallPanels(layout,map)
 const area={id:'wall',coreSpellId:spell,label:spell,cells:stoneWallCells(panels),stoneWall:{mode:spell==='wall-of-ice'?'ice':'thick',saveDc:15,panels},blocking:{movement:true},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10}} as Dnd5ePluginArea
 if(spell==='wall-of-force'){delete area.stoneWall;area.forceWall=layout}
 map.dnd5ePluginAreas=[area];return {map,area,token}
}
describe('wall creation push selection',()=>{
 it.each(['wall-of-stone','wall-of-ice','wall-of-force'])('%s finds legal positions for a large creature cut by bent panels',spell=>{
  const {map,area,token}=fixture(spell);expect(wallOverlapsCreature(map,area,token)).toBe(true)
  const choices=wallPushDestinations(map,area,token);expect(choices.length).toBeGreaterThan(0)
  const before=JSON.stringify(map),after=resolveWallPush(map,area.id,token.id,choices[0])!
  expect(wallOverlapsCreature(after,area,after.tokens[0])).toBe(false)
  expect(after.tokens[0].hp).toBe(46);expect(after.dnd5ePluginAreas).toEqual(map.dnd5ePluginAreas)
  expect(JSON.stringify(map)).toBe(before)
  expect(resolveWallPush(after,area.id,token.id,choices[0])).toBeUndefined()
  expect(resolveWallPush(map,area.id,token.id,{col:15,row:15})).toBeUndefined()
 })
 it('does not displace creatures above the wall or merely enclosed by it',()=>{
  const {map,area,token}=fixture();token.elevationFeet=15;expect(wallOverlapsCreature(map,area,token)).toBe(false)
  token.elevationFeet=0;token.x=700;token.y=700;expect(wallPushDestinations(map,area,token)).toEqual([])
 })
 it('excludes occupied landing positions and existing physical walls',()=>{
  const {map,area,token}=fixture(),choice=wallPushDestinations(map,area,token)[0]
  map.tokens.push({...token,id:'other',x:(choice.col+1)*50,y:(choice.row+1)*50})
  expect(wallPushDestinations(map,area,token)).not.toContainEqual(choice)
  map.dnd5ePluginAreas!.push({...area,id:'existing'})
  expect(wallPushDestinations(map,area,token)).toEqual([])
 })
})

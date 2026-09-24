import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { iceWallFromCells, wallDamageAfterDefenses } from './wallObjectRules'
import { settleStoneWallAttack } from './stoneWallAttack'
import { stoneWallIntersects } from '../../../shared/stone-wall-geometry.mjs'
function fixture() {
 const cells=[0,1,2,3].map(col=>({col,row:2}))
 const area={id:'ice',pluginId:'core',featureId:'wall-of-ice',createdRound:1,expiresAfterRound:100,label:'冰墙术',sourceKind:'core-spell',coreSpellId:'wall-of-ice',anchorMode:'fixed',cells,slotLevel:7,stoneWall:iceWallFromCells(cells,5,17),blocking:{movement:true,lineOfEffect:true,vision:true},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10}} as Dnd5ePluginArea
 const map={id:'map',name:'Map',width:800,height:800,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[area]} as BattleMap
 return {map,characters:[],areaId:'ice',panelId:'panel-1',hit:true,total:12,damage:15,damageType:'fire'}
}
describe('ice and force wall objects',()=>{
 it('assigns 30HP to each 10-foot ice section without duplicate cells',()=>{
 const area=fixture().map.dnd5ePluginAreas![0];expect(area.stoneWall!.panels.map(p=>p.hitPoints)).toEqual([30,30]);expect(area.stoneWall!.panels.flatMap(p=>p.cells)).toHaveLength(4)
 })
 it('uses AC12, doubles fire and retains a destroyed section as cold air',()=>{
 const result=settleStoneWallAttack(fixture())!;expect(result).toMatchObject({armorClass:12,damage:30,outcome:'destroyed',concentrationEnded:false})
 const area=result.map.dnd5ePluginAreas![0];expect(area.stoneWall!.panels.map(p=>p.hitPoints)).toEqual([0,30]);expect(area.cells).toHaveLength(4)
 expect(area.triggers).toEqual([expect.objectContaining({timing:'on-enter',oncePerTurn:true,cells:[{col:0,row:2},{col:1,row:2}],savingThrow:{ability:'con',dc:17,onSuccess:'half'},damage:{count:6,sides:6,modifier:0,type:'cold'}})])
 })
 it('keeps 2014 cold damage normal and object poison/psychic immunity',()=>{
 const area=fixture().map.dnd5ePluginAreas![0];expect(wallDamageAfterDefenses(area,15,'cold')).toBe(15)
 for(const type of ['poison','psychic'])expect(settleStoneWallAttack({...fixture(),damageType:type})?.damage).toBe(0)
 expect(settleStoneWallAttack({...fixture(),hit:false,total:11})?.hitPointsAfter).toBe(30)
 })
 it('opens only a destroyed segment and keeps cold air after every panel breaks',()=>{
 const input=fixture(),first=settleStoneWallAttack(input)!;const before=input.map.dnd5ePluginAreas![0],after=first.map.dnd5ePluginAreas![0]
 const ray=(area:Dnd5ePluginArea,x:number)=>stoneWallIntersects(area,input.map,{x,y:50},{x,y:200},0,0)
 expect(ray(before,25)).toBe(true);expect(ray(after,25)).toBe(false);expect(ray(after,175)).toBe(true)
 const last=settleStoneWallAttack({...input,map:first.map,panelId:'panel-2'})!;expect(last.map.dnd5ePluginAreas).toHaveLength(1);expect(last.concentrationEnded).toBe(false);expect(last.map.dnd5ePluginAreas![0].triggers![0].cells).toHaveLength(4)
 })
 it('round-trips destroyed panels without restoring HP',()=>{
 const result=settleStoneWallAttack(fixture())!;const state=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map],selectedId:'map'})))
 expect(state.maps[0].dnd5ePluginAreas![0].stoneWall!.panels.map(p=>p.hitPoints)).toEqual([0,30])
 expect(state.maps[0].dnd5ePluginAreas![0].triggers![0].cells).toHaveLength(2)
 })
 it('migrates legacy ice and rejects ordinary force-wall damage',()=>{
 const input=fixture();delete input.map.dnd5ePluginAreas![0].stoneWall
 expect(migrateMapsState({maps:[input.map]}).maps[0].dnd5ePluginAreas![0].stoneWall?.mode).toBe('ice')
 input.map.dnd5ePluginAreas![0].coreSpellId='wall-of-force';expect(settleStoneWallAttack(input)).toBeUndefined();expect(wallDamageAfterDefenses(input.map.dnd5ePluginAreas![0],999,'force')).toBe(0)
 })
})


it('triggers cold air once per turn only through the breached cells',()=>{
 const result=settleStoneWallAttack(fixture())!,map=result.map,area=map.dnd5ePluginAreas![0]
 area.relation='any';area.includeSelf=true
 const token={id:'walker',type:'enemy' as const,label:'walker',size:1,x:25,y:25,emoji:'',color:''};map.tokens=[token]
 const input={map,timing:'on-enter' as const,round:1,turnKey:'turn1',movement:{token,to:{x:25,y:225}}}
 expect(collectDnd5ePersistentAreaTriggers(input)).toHaveLength(1)
 area.triggerReceipts=[{triggerId:'wall-of-ice-frigid-air',targetTokenId:'walker',round:1,turnKey:'turn1',transactionId:'saved'}]
 expect(collectDnd5ePersistentAreaTriggers(input)).toHaveLength(0)
 expect(collectDnd5ePersistentAreaTriggers({...input,turnKey:'turn2'})).toHaveLength(1)
 expect(collectDnd5ePersistentAreaTriggers({...input,turnKey:'turn2',movement:{token:{...token,x:175},to:{x:175,y:225}}})).toHaveLength(0)
})

it('preserves force panel bends across save and blocks only actual panels',()=>{
 const map=fixture().map,area=map.dnd5ePluginAreas![0]
 area.coreSpellId='wall-of-force';delete area.stoneWall
 area.forceWall={mode:'thick',start:{col:2,row:2},angles:[0,90]}
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0].dnd5ePluginAreas![0]
 expect(restored.forceWall).toEqual(area.forceWall)
 expect(stoneWallIntersects(restored,map,{x:175,y:75},{x:175,y:175},0,0)).toBe(true)
 expect(stoneWallIntersects(restored,map,{x:175,y:200},{x:275,y:200},0,0)).toBe(true)
 expect(stoneWallIntersects(restored,map,{x:125,y:200},{x:175,y:200},0,0)).toBe(false)
})

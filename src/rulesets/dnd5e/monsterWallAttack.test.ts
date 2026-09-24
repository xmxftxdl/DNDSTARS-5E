import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { stoneWallPanels,stoneWallCells } from './stoneWall'
import { prepareMonsterWallAttack,spendMonsterWallAttackUses } from './monsterWallAttack'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import type { Dnd5eMonsterAction } from './monsters'
function fixture(slug='minotaur',actionIndex=0) {
 const token:Token={id:'monster',label:slug,poolId:`srd-5.1:${slug}`,type:'enemy',x:125,y:75,size:2,hp:76,maxHp:76,color:'',emoji:''}
 const map:BattleMap={id:'monster-wall-test',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]}
 const panels=stoneWallPanels({mode:'thick',start:{col:1,row:2},angles:[0,90]},map)
 map.dnd5ePluginAreas=[{id:'wall',label:'石墙术',cells:stoneWallCells(panels),stoneWall:{mode:'thick',panels,saveDc:15},blocking:{movement:true,lineOfEffect:true,vision:true}} as Dnd5ePluginArea]
 return {map,characters:[],actorTokenId:'monster',areaId:'wall',panelId:'panel-1',actionIndex,resourceKind:'action' as const,economy:createDnd5eTurnEconomyCounts('turn')}
}
describe('monster wall weapon attacks',()=>{
 it('uses minotaur greataxe +6 and 2d12+4 without a character sheet',()=>{
  const result=prepareMonsterWallAttack(fixture());expect(result.ok).toBe(true);if(!result.ok)return
  expect(result.entries).toHaveLength(1)
  expect(result.entries[0].attack).toMatchObject({toHit:6,damage:[{count:2,sides:12,bonus:4,type:'slashing'}]})
  expect(result.resource).toBe('action')
 })
 it('expands fixed weapon multiattack without consuming a separate action per strike',()=>{
  const result=prepareMonsterWallAttack(fixture('hill-giant'));expect(result.ok).toBe(true);if(!result.ok)return
  expect(result.entries.map(e=>e.action.id)).toEqual(['greatclub','greatclub'])
  expect(result.resource).toBe('action')
 })
 it('rejects spent actions, dead actors, out-of-range and destroyed segments',()=>{
  const spent=fixture();spent.economy.action.current=0;expect(prepareMonsterWallAttack(spent).ok).toBe(false)
  const dead=fixture();dead.map.tokens[0].hp=0;expect(prepareMonsterWallAttack(dead).ok).toBe(false)
  const far=fixture();far.map.tokens[0].y=900;expect(prepareMonsterWallAttack(far).ok).toBe(false)
  const gone=fixture();gone.map.dnd5ePluginAreas![0].stoneWall!.panels[0].hitPoints=0;expect(prepareMonsterWallAttack(gone).ok).toBe(false)
 })
 it('supports ranged attacks and long-range disadvantage',()=>{
  const input=fixture('hill-giant',2);input.map.tokens[0].y=925
  const result=prepareMonsterWallAttack(input);expect(result).toMatchObject({ok:true,entries:[{mode:'disadvantage',attack:{mode:'ranged'}}]})
 })
 it('consumes limited child uses exactly once per actual occurrence, including misses',()=>{
  const token=fixture().map.tokens[0]
  const attack={id:'spike',name:'Spike',kind:'weapon-attack',description:'',usage:{kind:'per-day',max:3}} as Dnd5eMonsterAction
  const result=spendMonsterWallAttackUses(token,[attack,attack])!
  expect(result.dnd5eCombatState?.monsterActionUsesByActionId?.spike.current).toBe(1)
  expect(token.dnd5eCombatState).toBeUndefined()
  expect(spendMonsterWallAttackUses(result,[attack,attack])).toBeUndefined()
  const recharge={...attack,id:'charged',usage:{kind:'recharge',dieSides:6,minimum:5}} as Dnd5eMonsterAction
  const spent=spendMonsterWallAttackUses(token,[recharge])!
  expect(spendMonsterWallAttackUses(spent,[recharge])).toBeUndefined()
 })
 it('preserves an explicit DM advantage mode',()=>{
  expect(prepareMonsterWallAttack({...fixture(),rollMode:'advantage'})).toMatchObject({ok:true,entries:[{mode:'advantage'}]})
 })
})

it("uses ice wall AC12 for monsterWallAttack",()=>{const input=fixture();input.map.dnd5ePluginAreas![0].coreSpellId="wall-of-ice";expect(prepareMonsterWallAttack(input)).toMatchObject({ok:true,armorClass:12})})

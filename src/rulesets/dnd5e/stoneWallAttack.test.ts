import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { DND5E_FIGHTER_STARTING_EQUIPMENT, DND5E_LONGBOW } from './equipment'
import { applyDnd5eInventoryMutation } from './items'
import { stoneWallPanels, stoneWallCells } from './stoneWall'
import { prepareStoneWallAttack, stoneWallAttackRoll, settleStoneWallAttack } from './stoneWallAttack'
import { createDnd5eTurnEconomyCounts, spendDnd5eTurnResource } from './turnEconomy'
function fixture() {
 const actor: Character = { id:'fighter',name:'战士',charClass:'战士',level:5,abilities:{str:16,dex:12,con:14,int:10,wis:10,cha:10},currentHp:44,maxHp:44,conditions:[],equipment:DND5E_FIGHTER_STARTING_EQUIPMENT,player:'',avatar:'',accent:'',race:'人类',background:'',experience:0,reputation:0,savingThrows:[],skills:[],tempHp:0,hitDice:'1d10',ac:10,speed:30,initiativeBonus:0,saveDC:10,passivePerception:10,inspiration:0,notes:'',dmNotes:'',visibleToPlayers:true }
 const map: BattleMap = {id:'wall-attack',name:'Map',width:800,height:800,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,feetPerCell:5,tokens:[{id:'hero',label:'Hero',type:'player',characterId:actor.id,x:125,y:75,size:1,emoji:'',color:''}]}
 const panels = stoneWallPanels({mode:'thick',start:{col:1,row:2},angles:[0,0]},map)
 const area = {id:'wall',coreSpellId:'wall-of-stone',label:'石墙术',anchorMode:'fixed',cells:stoneWallCells(panels),stoneWall:{mode:'thick',panels,saveDc:15},blocking:{movement:true,lineOfEffect:true,vision:true},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10}} as Dnd5ePluginArea
 map.dnd5ePluginAreas=[area]
 const action = {id:'attack',mapId:map.id,type:'dnd5e-weapon-attack',characterId:actor.id,actorTokenId:'hero',dnd5eWallTarget:{areaId:'wall',panelId:'panel-1'}} as SharedPlayerActionState
 return {map,characters:[actor],action,economy:createDnd5eTurnEconomyCounts('turn')}
}
describe('stone wall weapon attacks',()=>{
 it('targets the nearest part of a segment, rolls against AC15 and uses natural 1/20',()=>{
  const prepared=prepareStoneWallAttack(fixture());expect(prepared.ok).toBe(true);if(!prepared.ok)return
  expect(prepared.spendsAction).toBe(true)
  expect(prepared.point).toEqual({x:125,y:125})
  expect(stoneWallAttackRoll(prepared,1).hit).toBe(false)
  expect(stoneWallAttackRoll(prepared,20)).toMatchObject({hit:true,critical:true})
 })
 it('shares Extra Attack usage with creature attacks and denies spent actions',()=>{
  const input=fixture();input.economy={...spendDnd5eTurnResource(input.economy,'action').economy,attacksUsed:1}
  expect(prepareStoneWallAttack(input)).toMatchObject({ok:true,spendsAction:false,attackNumber:2})
  input.economy.attacksUsed=2;expect(prepareStoneWallAttack(input)).toMatchObject({ok:false,reason:'attack-action-spent'})
 })
 it('rejects missing, destroyed, distant and obstructed segments',()=>{
  const missing=fixture();missing.action.dnd5eWallTarget!.panelId='missing';expect(prepareStoneWallAttack(missing).ok).toBe(false)
  const destroyed=fixture();destroyed.map.dnd5ePluginAreas![0].stoneWall!.panels[0].hitPoints=0;expect(prepareStoneWallAttack(destroyed).ok).toBe(false)
  const distant=fixture();distant.map.tokens[0].y=700;expect(prepareStoneWallAttack(distant)).toMatchObject({ok:false,reason:'target-out-of-range'})
 })
 it('validates ammunition without spending it until settlement and uses long-range disadvantage',()=>{
  const input=fixture();input.characters[0]={...input.characters[0],equipment:{mainWeapon:DND5E_LONGBOW}}
  expect(prepareStoneWallAttack(input)).toMatchObject({ok:false,reason:'ammunition-unavailable'})
  input.characters=applyDnd5eInventoryMutation(input.characters,{type:'grant',characterId:'fighter',templateId:'srd-5.1:item:arrows',quantity:2}).characters
  const before=JSON.stringify(input.characters)
  input.map.tokens[0].y=2000
  const prepared=prepareStoneWallAttack(input);expect(prepared).toMatchObject({ok:true,mode:'disadvantage'})
  expect(JSON.stringify(input.characters)).toBe(before)
  if(prepared.ok) expect(prepared.ammunition.character).not.toEqual(input.characters[0])
 })
 it('rejects actors unable to attack, and does not let a request choose another character',()=>{
  const input=fixture();input.characters[0].conditions=['stunned'];expect(prepareStoneWallAttack(input)).toMatchObject({ok:false,reason:'invalid-actor'})
  input.characters[0].conditions=[];input.action.characterId='other';expect(prepareStoneWallAttack(input).ok).toBe(false)
 })
 it('does not apply creature-only attack riders to walls',()=>{
  const input=fixture();input.action.dnd5eWeaponAttackOptions={divineSmiteSlotLevel:1};expect(prepareStoneWallAttack(input)).toMatchObject({ok:false,reason:'wall-attack-options-unsupported'})
 })
 it('damages only the chosen segment, supports misses, zero damage and object immunities',()=>{
  const {map,characters}=fixture();const input={map,characters,areaId:'wall',panelId:'panel-1',hit:true,total:20,damage:200,damageType:'slashing'}
  const destroyed=settleStoneWallAttack(input)!
  expect(destroyed.outcome).toBe('destroyed');expect(destroyed.map.dnd5ePluginAreas![0].stoneWall!.panels.map(p=>p.hitPoints)).toEqual([0,180])
  expect(settleStoneWallAttack({...input,hit:false,total:30})?.damage).toBe(0)
  expect(settleStoneWallAttack({...input,damageType:'poison'})?.hitPointsAfter).toBe(180)
  expect(settleStoneWallAttack({...input,damageType:'psychic'})?.damage).toBe(0)
  expect(settleStoneWallAttack({...input,damage:0})?.hitPointsAfter).toBe(180)
 })
})

it("uses ice wall AC12 for stoneWallAttack",()=>{const input=fixture();input.map.dnd5ePluginAreas![0].coreSpellId="wall-of-ice";expect(prepareStoneWallAttack(input)).toMatchObject({ok:true,armorClass:12})})

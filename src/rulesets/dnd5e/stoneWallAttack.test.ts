import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { DND5E_FIGHTER_STARTING_EQUIPMENT, DND5E_LONGBOW } from './equipment'
import { applyDnd5eInventoryMutation } from './items'
import { stoneWallPanels, stoneWallCells } from './stoneWall'
import { prepareStoneWallAttack, stoneWallAttackRoll, settleStoneWallAttack, settleStoneWallWeaponResources } from './stoneWallAttack'
import { createDnd5eMechanicalEffect } from './activeEffects'
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
  it('uses a pillar entity AC/HP and destroys it through ordinary weapon settlement',()=>{
   const input=fixture(),area=input.map.dnd5ePluginAreas![0]
   delete area.stoneWall
   area.anchorCell={col:2,row:2};area.cells=[area.anchorCell];area.circularGeometry={radiusFeet:2.5}
   area.entityProfile={armorClass:5,hitPoints:30,cannotAttack:true,invisible:false,supportsStanding:true,destructionTerrain:{radiusFeet:10,squareFeetPerMinute:25}}
   input.action.dnd5eWallTarget!.panelId='entity'
   const attack=prepareStoneWallAttack(input)
   expect(attack).toMatchObject({ok:true,armorClass:5,spendsAction:true,panel:{hitPoints:30}})
   expect(settleStoneWallAttack({map:input.map,characters:input.characters,areaId:area.id,panelId:'entity',hit:false,total:1,damage:0,damageType:'slashing'})).toMatchObject({outcome:'miss',damage:0,hitPointsAfter:30})
   expect(settleStoneWallAttack({map:input.map,characters:input.characters,areaId:area.id,panelId:'entity',hit:true,total:5,damage:0,damageType:'slashing'})).toMatchObject({outcome:'hit',damage:0,hitPointsAfter:30})
   expect(settleStoneWallAttack({map:input.map,characters:input.characters,areaId:area.id,panelId:'entity',hit:true,total:5,damage:30,damageType:'psychic'})).toMatchObject({damage:0,hitPointsAfter:30})
   const settled=settleStoneWallAttack({map:input.map,characters:input.characters,areaId:area.id,panelId:'entity',hit:true,total:5,damage:30,damageType:'slashing'})
   expect(settled?.outcome).toBe('destroyed')
   expect(settled?.map.dnd5ePluginAreas?.some(a=>a.id===area.id)).toBe(false)
   expect(settled?.map.dnd5ePluginAreas?.find(a=>a.id===area.id+':debris')?.movementCostMultiplier).toBe(2)
   expect(settleStoneWallAttack({map:input.map,characters:input.characters,areaId:area.id,panelId:'wrong',hit:true,total:20,damage:30,damageType:'slashing'})).toBeUndefined()
   area.entityCurrentHitPoints=0
   expect(prepareStoneWallAttack(input).ok).toBe(false)
  })
 it('enforces automatic miss even on natural 20 and forged successful settlement',()=>{
  const input=fixture(),area=input.map.dnd5ePluginAreas![0]
  delete area.stoneWall
  area.coreSpellId=undefined
  area.anchorCell={col:2,row:2};area.cells=[area.anchorCell]
  area.entityProfile={armorClass:5,hitPoints:30,cannotAttack:true,invisible:false,attacksAutomaticallyMiss:true}
  input.action.dnd5eWallTarget!.panelId='entity'
  const prepared=prepareStoneWallAttack(input)
  expect(prepared.ok).toBe(true);if(!prepared.ok)return
  expect(stoneWallAttackRoll(prepared,20)).toMatchObject({hit:false,critical:false})
  const result=settleStoneWallAttack({map:input.map,characters:input.characters,areaId:area.id,panelId:'entity',hit:true,total:999,damage:999,damageType:'force'})
  expect(result).toMatchObject({outcome:'miss',damage:0,hitPointsAfter:30,concentrationEnded:false})
  expect(result?.map).toEqual(input.map)
 })
 it('prepares and settles an untouchable projection without numeric AC or HP',()=>{
  const input=fixture(),area=input.map.dnd5ePluginAreas![0]
  delete area.stoneWall;area.coreSpellId=undefined
  area.anchorCell={col:2,row:3};area.cells=[1,2,3].flatMap(col=>[2,3,4].map(row=>({col,row})));area.projectionDefense='untouchable-illusion'
  input.action.dnd5eWallTarget!.panelId='entity'
  const prepared=prepareStoneWallAttack(input)
  expect(prepared).toMatchObject({ok:true,armorClass:null,spendsAction:true,panel:{hitPoints:null,maxHitPoints:null}})
  if(!prepared.ok)return
  expect(stoneWallAttackRoll(prepared,20)).toMatchObject({hit:false,critical:false})
  expect(settleStoneWallAttack({map:input.map,characters:input.characters,areaId:area.id,panelId:'entity',hit:true,total:999,damage:999,damageType:'force'})).toMatchObject({outcome:'miss',damage:0,armorClass:null,hitPointsAfter:null})
  expect(area.entityProfile).toBeUndefined()
  input.map.tokens[0].y=25
  expect(prepareStoneWallAttack(input)).toMatchObject({ok:false,reason:'target-out-of-range'})
 })
 it('spends the last enchanted arrow against an object and ends its source concentration',()=>{
  const input=fixture();input.characters[0]={...input.characters[0],equipment:{mainWeapon:DND5E_LONGBOW}}
  input.characters=applyDnd5eInventoryMutation(input.characters,{type:'grant',characterId:'fighter',templateId:'srd-5.1:item:arrows',quantity:2}).characters
  input.characters[0].dnd5eCombatState={concentrationSpellId:'flames',activeEffects:[createDnd5eMechanicalEffect({definitionId:'flames',label:'Flames',targetId:'hero',source:{kind:'spell',actorId:'hero'},duration:{type:'concentration',sourceActorId:'hero',concentrationId:'flames'},modifiers:{weaponEnchantment:{weaponId:DND5E_LONGBOW.id,attackAndDamageBonus:0,remainingAttacks:1,bonusDamage:{count:1,sides:6,type:'fire'}}}})]}
  const prepared=prepareStoneWallAttack(input);expect(prepared.ok).toBe(true);if(!prepared.ok)return
  const result=settleStoneWallWeaponResources(input.map,input.characters,prepared)
  expect(result.characters[0].dnd5eInventory?.entries.find(entry=>entry.item.ammunitionKind==='arrow')?.quantity).toBe(1)
  expect(result.characters[0].dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  expect(result.characters[0].dnd5eCombatState?.activeEffects).toHaveLength(0)
 })
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

it('aims a player weapon at the nearby frozen section instead of the distant parent anchor',()=>{
 const input=fixture(),area=input.map.dnd5ePluginAreas![0]
 delete area.stoneWall;area.coreSpellId=undefined
 area.anchorCell={col:10,row:2};area.rectGeometry={lengthFeet:30,widthFeet:1,gridAligned:false,direction:{dc:1,dr:0}}
 area.cells=Array.from({length:9},(_,i)=>({col:7+i,row:2}))
 area.vertical={mode:'volume',baseElevationFeet:0,heightFeet:20}
 area.wallSurfaceSections=[{startFeet:0,endFeet:5,bottomFeet:0,topFeet:5}]
 area.entityProfile={armorClass:5,hitPoints:15,cannotAttack:true,invisible:false}
 input.map.tokens[0].x=375
 input.action.dnd5eWallTarget!.panelId='entity'
 const ready=prepareStoneWallAttack(input)
 expect(ready,ready.ok?'':ready.reason).toMatchObject({ok:true,armorClass:5})
 if(ready.ok){expect(ready.point.x).toBeCloseTo(375,3);expect(ready.point.y).toBe(125)}
 area.wallSurfaceSections=[{startFeet:0,endFeet:5,bottomFeet:10,topFeet:15}]
 expect(prepareStoneWallAttack(input)).toMatchObject({ok:false,reason:'target-out-of-range'})
 area.wallSurfaceSections=[]
 expect(prepareStoneWallAttack(input).ok).toBe(false)
})

import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eEquipmentAttack,resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {DND5E_SHORTBOW,DND5E_LONGSWORD} from './equipment'
import {applyDnd5eInventoryMutation} from './items'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'

it.each(['normal','advantage','disadvantage'] as const)('actual equipment facade retains %s and the weapon attack ability independently of its original dice',mode=>{
 for(const ranged of [true,false]){
  const actor=normalizeCharacter({id:'actor',name:'Actor',level:4,charClass:'战士',currentHp:30,maxHp:30,abilities:{str:16,dex:16,con:14,int:10,wis:10,cha:10},equipment:{mainWeapon:ranged?DND5E_SHORTBOW:DND5E_LONGSWORD}})
  const supplied=applyDnd5eInventoryMutation([actor],{type:'grant',characterId:actor.id,templateId:'srd-5.1:item:arrows',quantity:20}).characters[0]
  const target=normalizeCharacter({id:'target',name:'Target',level:4,charClass:'战士',currentHp:30,maxHp:30})
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'actor-token',characterId:actor.id,type:'player',label:'Actor',x:25,y:25,size:1,color:'',emoji:''},{id:'target-token',characterId:target.id,type:'enemy',label:'Target',x:ranged?125:75,y:25,size:1,color:'',emoji:''}]}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'dnd5e-weapon-attack',actorTokenId:'actor-token',characterId:'actor',targetTokenId:'target-token',round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eEquipmentAttack({action,map,characters:[supplied,target],attacksUsed:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason)
  // The engine derives the effective mode from the real prepared action. The
  // number and faces of the supplied dice do not manufacture that mode.
  prepared.prepared.attackMode=mode
  const source={prepared:prepared.prepared,d20:1,...(mode==='normal'?{}:{d20Second:1}),damageRolls:[]}
  const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eEquipmentAttack,'actor-token','attack')
  const result=session.run(prepared.prepared.state)
  expect(result.status,JSON.stringify(result)).toBe('original-d20-ready')
  if(result.status!=='original-d20-ready')throw Error('Actual facade did not reach its raw checkpoint')
  expect(result.request).toMatchObject({rollMode:mode,attackAbility:ranged?'dex':'str',originalRolls:mode==='normal'?[1]:[1,1],values:mode==='normal'?[1]:[1,1]})
 }
})

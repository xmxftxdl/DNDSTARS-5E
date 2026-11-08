import {expect} from 'vitest'
import {applyDnd5eInventoryMutation} from './items'
import {prepareDnd5eSpellCast} from './spellAction'
import {getDnd5eSrdCombatSpell} from './spells'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
export function radiantSelectedScene(actor:Character,spellId='sacred-flame',slotLevel=0){
 const grant=applyDnd5eInventoryMutation([actor],{type:'grant',characterId:actor.id,templateId:'srd-5.1:item:component-pouch',quantity:1});expect(grant.ok).toBe(true);actor=grant.characters[0]
 const map:BattleMap={id:'radiant-scene',name:'True Celestial source scene',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'caster',characterId:actor.id,type:'player',label:'Celestial',x:25,y:25,size:1,color:'',emoji:''},{id:'enemy',poolId:'srd-5.1:ogre',type:'enemy',label:'Foe',x:125,y:25,size:1,color:'',emoji:'',hp:59,maxHp:59},{id:'other',poolId:'srd-5.1:ogre',type:'enemy',label:'Other',x:175,y:25,size:1,color:'',emoji:'',hp:59,maxHp:59}]},action:SharedPlayerActionState={id:'radiant-original:area-one',mapId:map.id,combatId:'radiant-combat',sourceMode:'player',status:'pending',type:'dnd5e-spell-cast',actorTokenId:'caster',characterId:actor.id,targetTokenId:'enemy',dnd5eSpellCast:{spellId,castingClassId:'warlock',slotLevel,targetTokenId:'enemy',...(spellId==='eldritch-blast'?{targetTokenIds:['enemy'],projectileTargetIds:['enemy','enemy']}:{}),...(getDnd5eSrdCombatSpell(spellId)?.area?{areaTargetCell:{col:2,row:0}}:{})},round:1,initiativeIndex:0,seq:1,updatedAt:1},initiativeOrder=[{tokenId:'caster',label:'Celestial',roll:20,color:'',emoji:''},{tokenId:'enemy',label:'Foe',roll:10,color:'',emoji:''},{tokenId:'other',label:'Other',roll:5,color:'',emoji:''}],input={action,map,characters:[actor],initiativeOrder},prepared=prepareDnd5eSpellCast(input)
 expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 return{input,prepared:prepared.prepared}
}

import {it,expect} from 'vitest'
import {celestialRadiantSelectedBundle} from './celestialRadiantSelected.fixture'
import {growSearingCelestial} from './celestialLawfulGrowth.fixture'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import {withDnd5eSpellDamageSelectedAbilityBonus} from './spellDamageSelectedAbilityBonus'
import {applyDnd5eInventoryMutation,normalizeDnd5eInventory} from './items'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
function fixture(actor:Character,spellId='sacred-flame',slotLevel=0,itemInstanceId?:string){
 const map:BattleMap={id:'radiant-selected',name:'Native selected spell roll',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'caster',characterId:actor.id,type:'player',label:'Celestial',x:25,y:25,size:1,color:'',emoji:''},{id:'enemy',poolId:'srd-5.1:ogre',type:'enemy',label:'Foe',x:125,y:25,size:1,color:'',emoji:'',hp:59,maxHp:59},{id:'other',poolId:'srd-5.1:ogre',type:'enemy',label:'Other',x:175,y:25,size:1,color:'',emoji:'',hp:59,maxHp:59}]},action:SharedPlayerActionState={id:'radiant-original:one',mapId:map.id,combatId:'radiant-combat',sourceMode:'player',status:'pending',type:'dnd5e-spell-cast',actorTokenId:'caster',characterId:actor.id,targetTokenId:'enemy',dnd5eSpellCast:{spellId,...(itemInstanceId?{itemInstanceId}:{castingClassId:'warlock' as const}),slotLevel,targetTokenId:'enemy',...(spellId==='scorching-ray'?{targetTokenIds:['enemy','other'],projectileTargetIds:['enemy','other','enemy']}: {})},round:1,initiativeIndex:0,seq:1,updatedAt:1}
 const prepared=prepareDnd5eSpellCast({action,map,characters:[actor],initiativeOrder:[{tokenId:'caster',label:'Celestial',roll:20,color:'',emoji:''},{tokenId:'enemy',label:'Foe',roll:10,color:'',emoji:''},{tokenId:'other',label:'Other',roll:5,color:'',emoji:''}]});expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 return {prepared:prepared.prepared,action}
}
it.each([{cha:16,use:true,damage:11},{cha:8,use:true,damage:7},{cha:16,use:false,damage:8}])('real Celestial6 optional radiant damage preserves actual CHA and decline: %j',({cha,use,damage})=>{
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(celestialRadiantSelectedBundle()));try{
  const actor=growSearingCelestial(6,cha),f=fixture(actor);expect(actor.dnd5ePluginFeatureIds??[]).toEqual([]);const before=structuredClone(f.prepared.state),seen:string[]=[]
  const cast=withDnd5eSpellDamageSelectedAbilityBonus(options=>{seen.push(options[0].castParentId);return use?options[0].featureId:null},()=>resolvePreparedDnd5eSpellCast({prepared:f.prepared,effectRolls:[4,4],savingThrowD20:1}))
  expect(cast.result.ok,JSON.stringify(cast.result)).toBe(true);expect(cast.result.state.combatants.enemy.currentHp).toBe(59-damage);expect(f.prepared.state).toEqual(before);expect(seen).toEqual([f.action.id]);const events=cast.result.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied');expect(events).toHaveLength(use?1:0)
  if(use){expect(events[0]).toMatchObject({castParentId:f.action.id,targetId:'enemy',amount:Math.floor((cha-10)/2)});const settled=cast.application!.characters.find(c=>c.id===actor.id)!;expect(JSON.parse(JSON.stringify(settled.dnd5eCombatState?.spellDamageSelectedAbilityBonusUses))).toEqual(cast.result.state.combatants.caster.classState.spellDamageSelectedAbilityBonusUses)}
 }finally{dispose()}
})
it('a true item spell has no Warlock casting-class restriction and adds CHA only to the second selected ray against its actual target',()=>{
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(celestialRadiantSelectedBundle()));try{
  const actor=growSearingCelestial(6),grant=applyDnd5eInventoryMutation([actor],{type:'grant',characterId:actor.id,templateId:'srd-5.1:magic-item:circlet-of-blasting',quantity:1});expect(grant.ok).toBe(true);const item=normalizeDnd5eInventory(grant.characters[0]).entries.find(e=>e.templateId==='srd-5.1:magic-item:circlet-of-blasting')!,equip=applyDnd5eInventoryMutation(grant.characters,{type:'equip',characterId:actor.id,instanceId:item.instanceId,slot:'helmet'});expect(equip.ok).toBe(true);const f=fixture(equip.characters[0],'scorching-ray',2,item.instanceId);expect(f.prepared.castingClassId).toBeUndefined();const seen:string[]=[]
  const cast=withDnd5eSpellDamageSelectedAbilityBonus(options=>{seen.push(options[0].targetId);return options[0].targetId==='other'?options[0].featureId:null},()=>resolvePreparedDnd5eSpellCast({prepared:f.prepared,effectRolls:[],targetAttacks:[{targetId:'enemy',d20:15,effectRolls:[3,4]},{targetId:'other',d20:15,effectRolls:[3,4]},{targetId:'enemy',d20:15,effectRolls:[3,4]}]}))
  expect(cast.result.ok,JSON.stringify(cast.result)).toBe(true);expect(seen).toEqual(['enemy','other']);expect(cast.result.state.combatants.enemy.currentHp).toBe(45);expect(cast.result.state.combatants.other.currentHp).toBe(49);expect(cast.result.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied')).toHaveLength(1)
 }finally{dispose()}
})

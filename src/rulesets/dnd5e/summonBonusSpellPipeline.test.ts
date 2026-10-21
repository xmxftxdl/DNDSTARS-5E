import './activeEffects'
import {it,expect} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {syncCharacterClassResources} from '../../lib/classResources'
import {prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast} from './pluginSpellTransaction'
import {createDnd5eEffectiveRulesContextV1} from './effectiveRulesContext'
import {applyDnd5eActivityMapHandoffsV1} from './activities/dnd5eActivityMapInteraction'
import {getDnd5eSrdMonster} from './monsters'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {migrateMapsState,type BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
it.each([false,true])('applies owned summon bonuses through actual spell settlement and map reload (owned=%s)',async(owned)=>{
 let featureId=''
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.summon-cast',name:'Summon cast regression',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){featureId=api.registerFeature({id:'bonus',name:'Summon bonus',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'bonus',name:'Summon bonus',description:'Synthetic',level:1,trigger:{kind:'after-spell-cast'},targeting:{kind:'self'},effects:[],mechanic:{kind:'summoned-creature-bonus',source:'spell',creatureTypes:['beast','fey'],maximumHitPointsPerHitDie:2,naturalWeaponAttacksMagical:true},automation:'full'}})}})
 try{
  const actor=syncCharacterClassResources(normalizeCharacter({id:'druid',name:'Druid',dnd5ePluginFeatureIds:owned?[featureId]:[],charClass:'德鲁伊',level:7,dnd5eClassLevels:{druid:7},abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},dnd5eClassChoices:{classes:{druid:{selections:{'spell-prepared':['conjure-woodland-beings']}}}}}))
  const map:BattleMap={id:'woodland',name:'Woodland',width:1000,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'caster',type:'player',characterId:actor.id,label:'Druid',x:25,y:25,size:1,color:'',emoji:''}]}
  const action:SharedPlayerActionState={id:'cast',mapId:map.id,sourceMode:'player',status:'pending',type:'dnd5e-spell-cast',actorTokenId:'caster',characterId:actor.id,targetTokenIds:[],targetCell:{col:4,row:2},dnd5eSpellCast:{spellId:'conjure-woodland-beings',castingClassId:'druid',slotLevel:4,targetTokenId:'',targetTokenIds:[],areaTargetCell:{col:4,row:2},activityChoices:{formation:'one-cr-2',mode:'srd-5.1:sea-hag'}},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const initiativeOrder=[{tokenId:'caster',label:'Druid',emoji:'',color:'',roll:20}]
  const ready=prepareDnd5ePluginSpellCast({map,characters:[actor],initiativeOrder,action,effectiveRules:createDnd5eEffectiveRulesContextV1({houseRules:{spellcastingPrerequisitesEnabled:false}})})
  expect(ready.ok,ready.ok?'':ready.reason).toBe(true);if(!ready.ok)return
  const result=resolvePreparedDnd5ePluginSpellCast({prepared:ready.prepared,rolls:{activityRolls:{}}})
  expect(result.result.ok,result.result.ok?'':result.result.reason).toBe(true);if(!result.result.ok)return
  expect(result.result.state.combatants.caster.classResources['dnd5e-spell-slot-4'].current).toBe(0)
  expect(result.result.state.combatants.caster.turn.actionAvailable).toBe(false)
  const monster=getDnd5eSrdMonster('srd-5.1:sea-hag')!,bonus=owned?Number(monster.hitPoints.dice.match(/^(\d+)d/)![1])*2:0
  expect(result.result.activityHandoffs?.summons[0].maximumHitPointBonus??0).toBe(bonus)
  expect(result.result.activityHandoffs?.summons[0].naturalWeaponAttacksMagical===true).toBe(owned)
  const placed=applyDnd5eActivityMapHandoffsV1({map,activity:ready.prepared.activity!,packageId:'srd-5.1',actionId:action.id,actorId:'caster',concentrationId:'conjure-woodland-beings',round:1,handoffs:result.result.activityHandoffs!,selection:{summonCells:[{col:4,row:2}],summonInitiativeD20s:[12]}})
  expect(placed.ok,placed.ok?'':placed.reason).toBe(true);if(!placed.ok)return
  const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[placed.map],selectedId:map.id}))).maps[0]
  const summon=restored.tokens.find(t=>t.dnd5eSummon)!
  expect(summon.dnd5eSummon?.sourceSpellId).toBe('conjure-woodland-beings')
  expect(summon.maxHp).toBe(monster.hitPoints.average+bonus)
  const host=createDnd5eMapCombatSnapshot({map:restored,characters:[actor],combatId:'reloaded',initiativeOrder:[...initiativeOrder,...placed.initiativeEntries]}).state
  expect(host.combatants[summon.id].naturalWeaponAttacksMagical===true).toBe(owned)
  expect(host.combatants[summon.id].weaponAttacksMagical).not.toBe(true)
 }finally{dispose()}
})

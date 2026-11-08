import {it,expect} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'

it.each(['wizard','sorcerer'] as const)('native Fire Bolt retains the actual %s spellcasting ability at its original checkpoint',classId=>{
 const actor=normalizeCharacter({id:'caster',name:'Caster',race:'人类',dnd5eRaceId:'human',rulesetId:'dnd5e-2014-srd-5.1',charClass:classId==='wizard'?'法师':'术士',level:4,currentHp:30,maxHp:30,abilities:{str:10,dex:10,con:14,int:18,wis:10,cha:18},dnd5eClassLevels:{[classId]:4},dnd5eClassChoices:{classes:{[classId]:{selections:{'spell-cantrips':['fire-bolt']}}}}})
 const target=normalizeCharacter({id:'target',name:'Target',level:4,charClass:'战士',currentHp:30,maxHp:30})
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'caster-token',characterId:'caster',type:'player',label:'Caster',x:25,y:25,size:1,color:'',emoji:''},{id:'target-token',characterId:'target',type:'enemy',label:'Target',x:125,y:25,size:1,color:'',emoji:''}]}
 const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'target-token',dnd5eSpellCast:{spellId:'fire-bolt',castingClassId:classId,slotLevel:0,targetTokenId:'target-token'},round:1,initiativeIndex:0,seq:1,updatedAt:1}
 const prepared=prepareDnd5eSpellCast({action,map,characters:[actor,target],initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
 if(!prepared.ok)throw Error(prepared.reason)
 for(const mode of ['normal','advantage','disadvantage'] as const){
  const actual=structuredClone(prepared.prepared);actual.attackMode=mode
  const source={prepared:actual,d20:1,...(mode==='normal'?{}:{d20Second:1}),effectRolls:[]}
  const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,'caster-token','attack')
  const result=session.run(actual.state)
  expect(result.status,JSON.stringify(result)).toBe('original-d20-ready')
  if(result.status!=='original-d20-ready')throw Error('Actual spell facade did not reach original dice')
  expect(result.request).toMatchObject({actorId:'caster-token',kind:'attack',rollMode:mode,attackAbility:classId==='wizard'?'int':'cha',originalRolls:mode==='normal'?[1]:[1,1]})
 }
})

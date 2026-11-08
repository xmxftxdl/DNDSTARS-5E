import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {restoreClassResources} from '../../lib/classResources'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from './mapBridge'
import {resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {getDnd5eSrdMonster} from './monsters'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import type {BattleMap} from '../../store/maps'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('retains actual native Halfling Lucky after the BL owner declines the same original die',async()=>{
 const{package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30}),first=restoreClassResources(normalizeCharacter({id:'first',name:'First',charClass:'德鲁伊',dnd5eClassLevels:{druid:4},dnd5eClassChoices:{classes:{druid:{selections:{'wild-shape-known-forms':['srd-5.1:cat']}}}},level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'first-member',currentHp:30,maxHp:30}),'long-rest');let characters=[helper,first]
  let map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'skeleton',characterId:'first',label:'Actual Wild Shape',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'goblin',poolId:'srd-5.1:goblin',label:'Goblin',x:75,y:25,size:1,type:'enemy',hp:20,maxHp:20,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:75,size:1,type:'player',color:'',emoji:''}]}
  const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),monster=getDnd5eSrdMonster('srd-5.1:cat')
  if(!monster)throw Error('Actual SRD skeleton required')
  const beforeShape=createDnd5eMapCombatSnapshot({combatId:'actual-precombat-shape',map,characters,initiativeOrder}),shape=resolveDnd5eHeadlessAction(beforeShape.state,{type:'druid-wild-shape',actorId:'skeleton',formId:'srd-5.1:cat'})
  expect(shape.ok).toBe(true);if(!shape.ok)throw Error(shape.reason)
  const shaped=planDnd5eMapResultApplication({state:shape.state,events:[...shape.events],map,characters,characterIdByCombatantId:beforeShape.characterIdByCombatantId});characters=shaped.characters;map=shaped.map
  expect(characters.find(character=>character.id==='first')?.classResources?.['dnd5e-wild-shape'].current).toBe(1)
  expect(characters.find(character=>character.id==='first')?.dnd5eCombatState?.wildShapeFormId).toBe('srd-5.1:cat')
  const prepared=prepareDnd5eMonsterAttack({combatId:'combat',round:1,map,characters,initiativeOrder,actorTokenId:'skeleton',targetTokenId:'goblin',actionIndex:monster.actions.findIndex(action=>action.attack?.mode==='melee')})
  if(!prepared.ok)throw Error(prepared.reason)
  const source={prepared:prepared.prepared,transactionId:'host-monster-attack',rolls:[{d20:1,mode:'normal' as const,damageRolls:[]}]}
  const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eMonsterAttack,'skeleton','attack')
  try{
   const pending=session.run(prepared.prepared.state)
   expect(pending.status).toBe('pending-ally-natural-one');if(pending.status!=='pending-ally-natural-one')throw Error('Actual BL original required')
   expect(pending.request.nativeLucky).not.toBe(true)
   const native=session.resumeAllyNaturalOne(prepared.prepared.state,pending.occurrence,pending.request,undefined)
   expect(native.status).toBe('pending-ally-natural-one');if(native.status!=='pending-ally-natural-one')throw Error('Actual original native Lucky required')
   expect(native.request).toMatchObject({actorId:'skeleton',nativeLucky:true,originalRolls:[1],dieIndex:0,options:[{ownerId:'skeleton',featureId:'dnd5e-racial-halfling-lucky'}]})
   const ready=session.resumeAllyNaturalOne(prepared.prepared.state,native.occurrence,native.request,{ownerId:'skeleton',featureId:'dnd5e-racial-halfling-lucky',replacement:1})
   expect(ready.status).toBe('original-d20-ready');if(ready.status!=='original-d20-ready')throw Error('Actual native pre-damage ready required')
   expect(ready.request).toMatchObject({originalRolls:[1],values:[1],finalizedDice:[0]})
   expect(ready.snapshot.combatants['helper-token'].turn.reactionAvailable).toBe(true)
   expect(ready.events.filter(event=>event.type==='halfling-lucky-rerolled')).toHaveLength(1)
   expect(ready.events.some(event=>event.type==='ally-natural-one-rerolled')).toBe(false)
  }finally{session.cancel()}
 }finally{dispose()}
})

import {normalizeCharacter} from '../../../src/store/characters'
import {syncCharacterClassResources} from '../../../src/lib/classResources'
import {prepareDnd5eEquipmentAttack,resolvePreparedDnd5eEquipmentAttack} from '../../../src/rulesets/dnd5e/equipmentAttackAction'
import {DND5E_SHORTSWORD} from '../../../src/rulesets/dnd5e/equipment'
import {createDnd5ePreparedDamageCommitSession} from '../../../src/rulesets/dnd5e/damageCommitSession'
import {captureSecondChancePreparedOriginal,createSecondChancePreparedReplayAsync} from '../../../src/pages/maps/secondChancePreparedParent'
import type {BattleMap} from '../../../src/store/maps'
import type {SharedPlayerActionState} from '../../../src/lib/sharedCombatTypes'
import {originalD20ReplaySourceKey} from '../../../src/rulesets/dnd5e/allyNaturalOneCheckpoint'
import {it,expect} from 'vitest'
import {registerDnd5eRulesPlugin} from '../../../src/rulesets/dnd5e/pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,dnd5eCombatantPairKey,type Dnd5eAction} from '../../../src/rulesets/dnd5e/headlessCombatEngine'
import {createDnd5eDamageCommitSession} from '../../../src/rulesets/dnd5e/damageCommitSession'
const registerJoint=(status:'full'|'manual'='full')=>registerDnd5eRulesPlugin({manifest:{id:'test.joint-luck',name:'Joint raw and incoming',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'Private'},setup(api){
  api.registerFeat({id:'bountiful',name:'Bountiful',summary:'Test',description:'Test',automation:status,declarativeAbility:{schemaVersion:1,id:'bountiful',name:'Bountiful',description:'Test',level:1,automation:'full',trigger:{kind:'after-d20-roll'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'ally',rangeFeet:30,requiresSight:true,includeSelf:false},effects:[],mechanic:{kind:'ally-natural-one-reroll'}}})
  api.registerFeat({id:'second',name:'Second Chance',summary:'Test',description:'Test',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'short-rest'}],declarativeAbility:{schemaVersion:1,id:'second',name:'Second Chance',description:'Test',level:1,automation:'full',trigger:{kind:'after-d20-roll'},cost:{economy:'reaction',resources:[{resourceId:'uses',amount:1}]},targeting:{kind:'self'},effects:[],mechanic:{kind:'incoming-hit-attack-die-reroll'}}})
 }})
it('a persisted native parent must retain its original-die reaction before reaching the true Second Chance hit boundary',async()=>{
 const dispose=registerJoint()
 try{
  const make=(id:string,initiative:number,controller:'player'|'dm')=>createDnd5eCombatant({id,name:id,initiative,controller,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const actor=make('actor',30,'player'),owner=make('owner',20,'player'),defender=make('defender',10,'dm')
  owner.pluginFeatureIds=['test.joint-luck:feat-bountiful'];owner.racialRules={halflingLucky:true,halfOrcRelentlessEndurance:false,halfOrcSavageAttacks:false,innateSpells:[]}
  defender.pluginFeatureIds=['test.joint-luck:feat-second'];defender.classResources={'test.joint-luck:uses':{current:1,max:1}}
  const state=startDnd5eHeadlessCombat('joint',[actor,owner,defender]);state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','owner')]:5,[dnd5eCombatantPairKey('actor','defender')]:5}
  const action:Dnd5eAction={type:'attack',actorId:'actor',targetId:'defender',attackModifier:5,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}}
  const original=createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:'parent'})
  const pending=original.run(state);expect(pending.status).toBe('pending-ally-natural-one');if(pending.status!=='pending-ally-natural-one')throw Error('raw source was not reached')
  const decision={ownerId:'owner',featureId:'test.joint-luck:feat-bountiful',replacement:15}
  const hit=original.resumeAllyNaturalOne(state,pending.occurrence,pending.request,decision)
  expect(hit.status).toBe('pending-incoming-attack');if(hit.status!=='pending-incoming-attack')throw Error('real SC hit not reached')
  expect(hit.facts.dice).toEqual([15]);expect(state.combatants.defender.currentHp).toBe(30)
  // The new Host-only typed field is the proposed fix; old native session
  // currently ignores it and incorrectly asks for the already-decided raw die.
  const restored=createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:'parent',originalD20Replay:{parentId:'parent',sourceKey:originalD20ReplaySourceKey('parent',state,action),facts:[{occurrence:pending.occurrence,request:pending.request,decision}]}})
  const resumed=restored.run(state)
  expect(resumed.status).toBe('pending-incoming-attack')
  if(resumed.status==='pending-incoming-attack')expect(resumed.facts.dice).toEqual([15])
  const makeCharacter=(id:string,race:string,feat?:string)=>syncCharacterClassResources(normalizeCharacter({id,name:id,roomMemberId:id+'-member',race,dnd5eRaceId:race==='半身人'?'halfling':'human',charClass:'战士',level:4,abilities:{str:16,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[feat]:[]}))
  const attacker=makeCharacter('attacker','人类'),helper=makeCharacter('helper','半身人','test.joint-luck:bountiful'),target=makeCharacter('target','半身人','test.joint-luck:second')
  attacker.equipment={mainWeapon:DND5E_SHORTSWORD}
  target.classResources={...target.classResources,'test.joint-luck:uses':{current:1,max:1}}
  const characters=[attacker,helper,target]
  const map:BattleMap={id:'prepared-map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,label:character.name,x:index===2?75:25,y:index===1?75:25,type:index===2?'enemy':'player',emoji:'',color:'',size:1}))}
  const roomAction:SharedPlayerActionState={id:'prepared-parent',mapId:map.id,combatId:'prepared-combat',roomMemberId:'attacker-member',sourceMode:'player',status:'pending',type:'dnd5e-weapon-attack',actorTokenId:'attacker-token',characterId:'attacker',targetTokenId:'target-token',round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eEquipmentAttack({map,characters,action:roomAction,attacksUsed:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true);if(!prepared.ok)throw Error('real equipment parent could not prepare')
  const facadeSource={prepared:prepared.prepared,d20:1,damageRolls:[3]}
  const facadeOriginal=createDnd5ePreparedDamageCommitSession(facadeSource,resolvePreparedDnd5eEquipmentAttack,()=>false)
  const raw=facadeOriginal.run(prepared.prepared.state);expect(raw.status).toBe('pending-ally-natural-one');if(raw.status!=='pending-ally-natural-one')throw Error('real equipment original checkpoint missing')
  const facadeDecision={ownerId:'helper-token',featureId:'test.joint-luck:feat-bountiful',replacement:15}
  const realHit=facadeOriginal.resumeAllyNaturalOne(prepared.prepared.state,raw.occurrence,raw.request,facadeDecision)
  expect(realHit.status).toBe('pending-incoming-attack')
  const boundSource={...facadeSource,hostOriginalD20Replay:{parentId:roomAction.id,sourceKey:originalD20ReplaySourceKey(roomAction.id,prepared.prepared.state,roomAction),facts:[{occurrence:raw.occurrence,request:raw.request,decision:facadeDecision}]}}
  const captured=captureSecondChancePreparedOriginal(resolvePreparedDnd5eEquipmentAttack,boundSource)
  expect(captured).toBeDefined();if(!captured)throw Error('real SC facade capture failed')
  const recovered=await createSecondChancePreparedReplayAsync(JSON.parse(JSON.stringify(captured)))
  try{const replayed=recovered.run(recovered.originalState);expect(replayed.status).toBe('pending-incoming-attack');if(replayed.status==='pending-incoming-attack')expect(replayed.facts.dice).toEqual([15])}finally{await recovered.dispose()}

 }finally{dispose()}
})

it('bound original choices reject changed parent/raw source and cannot mechanically revive a feature switched to manual',()=>{
 let dispose=registerJoint()
 try{
  const make=(id:string,initiative:number,controller:'player'|'dm')=>createDnd5eCombatant({id,name:id,initiative,controller,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const actor=make('actor',30,'player'),owner=make('owner',20,'player'),defender=make('defender',10,'dm')
  owner.pluginFeatureIds=['test.joint-luck:feat-bountiful'];owner.racialRules={halflingLucky:true,halfOrcRelentlessEndurance:false,halfOrcSavageAttacks:false,innateSpells:[]}
  const state=startDnd5eHeadlessCombat('joint-bound',[actor,owner,defender]);state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','owner')]:5}
  const action:Dnd5eAction={type:'attack',actorId:'actor',targetId:'defender',attackModifier:5,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}}
  const initial=createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:'parent'}),pending=initial.run(state)
  if(pending.status!=='pending-ally-natural-one')throw Error('real pending source missing')
  const originalD20Replay={parentId:'parent',sourceKey:originalD20ReplaySourceKey('parent',state,action),facts:[{occurrence:0,request:pending.request,decision:{ownerId:'owner',featureId:'test.joint-luck:feat-bountiful',replacement:15}}]}
  expect(()=>createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:'other',originalD20Replay})).toThrow('original-d20-replay-source-mismatch')
  expect(()=>createDnd5eDamageCommitSession(state,{...action,d20:2},()=>false,{transactionId:'parent',originalD20Replay})).toThrow('original-d20-replay-source-mismatch')
  dispose();dispose=registerJoint('manual')
  const replay=createDnd5eDamageCommitSession(state,action,()=>false,{transactionId:'parent',originalD20Replay})
  expect(replay.run(state)).toMatchObject({status:'rejected',reason:'changed-reaction'})
  expect(state.combatants.owner.turn.reactionAvailable).toBe(true);expect(state.combatants.defender.currentHp).toBe(30)
 }finally{dispose()}
})

import {recordBountifulOriginalAfterDice} from './bountifulLuckNormalAck'
import {commitSecondChanceHostAttack} from '../../pages/maps/secondChanceHostCommit'
import {issueSecondChanceAttack} from '../../pages/maps/issueSecondChanceAttack'
import {processSecondChanceRequest} from '../../pages/maps/processSecondChanceRequest'
import {prepareDeclinedSecondChanceParent,publishSecondChanceParent} from '../../pages/maps/publishSecondChanceParent'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {persistBountifulOriginalParent,bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,bountifulPreparedReplayFacts} from './bountifulLuckReceipt'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
import {normalizeCharacter} from '../../store/characters'
import {syncCharacterClassResources} from '../../lib/classResources'
import {prepareDnd5eEquipmentAttack,resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {DND5E_SHORTSWORD} from './equipment'
import {createDnd5ePreparedDamageCommitSession} from './damageCommitSession'
import {captureSecondChancePreparedOriginal,createSecondChancePreparedReplayAsync} from '../../pages/maps/secondChancePreparedParent'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import {it,expect,vi} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,dnd5eCombatantPairKey,type Dnd5eAction} from './headlessCombatEngine'
import {createDnd5eDamageCommitSession} from './damageCommitSession'
const registerJoint=(status:'full'|'manual'='full')=>registerDnd5eRulesPlugin({manifest:{id:'test.joint-luck',name:'Joint raw and incoming',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'Private'},setup(api){
  api.registerFeat({id:'bountiful',name:'Bountiful',summary:'Test',description:'Test',automation:status,declarativeAbility:{schemaVersion:1,id:'bountiful',name:'Bountiful',description:'Test',level:1,automation:'full',trigger:{kind:'after-d20-roll'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'ally',rangeFeet:30,requiresSight:true,includeSelf:false},effects:[],mechanic:{kind:'ally-natural-one-reroll'}}})
  api.registerFeat({id:'second',name:'Second Chance',summary:'Test',description:'Test',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'short-rest'}],declarativeAbility:{schemaVersion:1,id:'second',name:'Second Chance',description:'Test',level:1,automation:'full',trigger:{kind:'after-d20-roll'},cost:{economy:'reaction',resources:[{resourceId:'uses',amount:1}]},targeting:{kind:'self'},effects:[],mechanic:{kind:'incoming-hit-attack-die-reroll'}}})
 }})
it.each(['decline','use','missing-private-original','changed-authenticated-choice'] as const)('the persisted after-damage-dice Bountiful→SecondChance original parent shares one final CAS (%s)',async scenario=>{
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

  type Resource={_sync:{revision:number};[key:string]:unknown}
  const jointState=prepared.prepared.state
  const economy=Object.fromEntries(Object.values(jointState.combatants).map(actor=>[actor.id,createDnd5eTurnEconomyCounts(jointState.combatId+':'+jointState.round+':'+actor.id,actor.speed)]))
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:map.id,combatId:jointState.combatId,round:1,initiativeIndex:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,slotId:token.id,label:token.label,roll:20-index})),dnd5eTurnEconomyByToken:economy},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[roomAction]}}
  const batches:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(writes,options)=>{for(const write of writes)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of writes)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;batches.push(writes.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const rawFacadeSource={...facadeSource,damageRolls:[]}
  await persistBountifulOriginalParent({parentId:roomAction.id,source:rawFacadeSource,resolve:resolvePreparedDnd5eEquipmentAttack,actorId:'attacker-token',kind:'attack'},gateway)
  const append=(actorTokenId:string,characterId:string,roomMemberId:string,body:object)=>{const rows=data['player-action-requests'].requests as object[];const id='joint-response-'+rows.length;data['player-action-requests'].requests=[...rows,{id,roomMemberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:map.id,combatId:jointState.combatId,actorTokenId,characterId,...body}];return id}
  const stage=await driveBountifulOriginalParent({mapId:map.id,parentId:roomAction.id},gateway,{showChoice:async receipt=>{const option=receipt.request.options[0],control=receipt.controllers[option.ownerId];append(option.ownerId,control.characterId,control.memberId,{bountifulLuck:{parentId:roomAction.id,occurrence:receipt.identity.occurrence,command:{phase:'reaction',...option,decision:'use'}}})},requestRoll:async(receipt,refresh)=>{const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt);append(roller.tokenId,requireCharacterRoller(roller),roller.memberId,{bountifulLuck:{parentId:roomAction.id,occurrence:receipt.identity.occurrence,command:{phase:'roll',rollRequestId:id,value:15}}});await refresh();append(roller.tokenId,requireCharacterRoller(roller),'host',{bountifulLuck:{parentId:roomAction.id,occurrence:receipt.identity.occurrence,command:{phase:'confirm',rollRequestId:id,rawValue:15,value:15}}})}})
  await recordBountifulOriginalAfterDice({action:roomAction,source:facadeSource,resolve:resolvePreparedDnd5eEquipmentAttack,authorityUnchanged:()=>true},gateway)
  expect(batches.filter(names=>names.length===3)).toHaveLength(0)
  const realBound={...facadeSource,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:roomAction.id,source:facadeSource,receipts:stage.receipts})}
  const realCaptured=captureSecondChancePreparedOriginal(resolvePreparedDnd5eEquipmentAttack,realBound)
  if(!realCaptured)throw Error('No real prepared parent capture')
  const incoming=await issueSecondChanceAttack({mapId:map.id,parentTransactionId:roomAction.id,preparedOriginal:realCaptured},gateway)
  expect(incoming.attack.dice).toEqual([15])
  expect((data.characters.characters as typeof characters).find(row=>row.id==='target')?.currentHp).toBe(target.currentHp)
  const rows=data['player-action-requests'].requests as object[],declineId='sc-decline'
  data['player-action-requests'].requests=[...rows,{id:declineId,roomMemberId:'target-member',type:'dnd5e-second-chance',status:'pending',sourceMode:'player',mapId:map.id,combatId:jointState.combatId,actorTokenId:'target-token',characterId:'target',secondChance:{phase:'reaction',attackReceiptId:incoming.attack.id,decision:scenario==='use'?'use':'decline'}}]
  await processSecondChanceRequest({mapId:map.id,requestId:declineId},gateway)
  const scInput={mapId:map.id,attackReceiptId:incoming.attack.id}
  if(scenario==='use'){
   const command=async(body:object,memberId:string)=>{const id=append('attacker-token','attacker',memberId,{type:'dnd5e-second-chance',secondChance:{attackReceiptId:incoming.attack.id,...body}});await processSecondChanceRequest({mapId:map.id,requestId:id},gateway)}
   await command({phase:'select-die',dieIndex:0},'attacker-member')
   const attacks=data.combat.secondChanceAttacks as Record<string,{rollRequestId?:string}>,rollRequestId=attacks[incoming.attack.id].rollRequestId
   await command({phase:'roll-result',rollRequestId,value:2},'attacker-member')
   await command({phase:'confirm-roll',rollRequestId,value:2},'host')
   await commitSecondChanceHostAttack(scInput,gateway)
  }else await prepareDeclinedSecondChanceParent(scInput,gateway)
  if(scenario==='missing-private-original'||scenario==='changed-authenticated-choice'){
   if(scenario==='missing-private-original')delete data.combat.bountifulOriginalParents
   else{const parents=data.combat.bountifulOriginalParents as Record<string,{hostReroll:{value:number}}>;parents[bountifulOriginalParentReceiptId(roomAction.id,0)].hostReroll.value=14}
   const beforeReject=structuredClone(data)
   await expect(publishSecondChanceParent(scInput,gateway)).rejects.toThrow(scenario==='missing-private-original'?'bountiful-joint:real-original-parent-required':'bountiful-joint:changed-authenticated-choices')
   expect(data).toEqual(beforeReject);expect(batches.filter(names=>names.length===3)).toHaveLength(0)
   return
  }
  const result=await publishSecondChanceParent(scInput,gateway)
  expect(result.ok).toBe(true)
  expect(result.state.combatants['target-token'].currentHp).toBe(scenario==='use'?target.currentHp:target.currentHp-6)
  expect(result.state.combatants['helper-token'].turn.reactionAvailable).toBe(false)
  expect(data.combat.dnd5eTurnEconomyByToken).toMatchObject({'helper-token':{reaction:{current:0}},'target-token':{reaction:{current:scenario==='use'?0:1}}})
  expect(batches.filter(names=>names.length===3)).toHaveLength(1)
  const savedParents=data.combat.bountifulOriginalParents as Record<string,{consumed?:{transactionId:string}}>
  expect(savedParents[bountifulOriginalParentReceiptId(roomAction.id,0)].consumed).toMatchObject({transactionId:roomAction.id})
  const beforeReplay=structuredClone(data)
  expect(await publishSecondChanceParent(scInput,gateway)).toEqual(result)
  expect(data).toEqual(beforeReplay)

 }finally{dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}

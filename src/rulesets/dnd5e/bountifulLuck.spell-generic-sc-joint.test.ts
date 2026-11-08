import {captureSecondChancePreparedOriginal} from '../../pages/maps/secondChancePreparedParent'
import {issueSecondChanceAttack} from '../../pages/maps/issueSecondChanceAttack'
import {processSecondChanceRequest} from '../../pages/maps/processSecondChanceRequest'
import {commitSecondChanceHostAttack} from '../../pages/maps/secondChanceHostCommit'
import {prepareDeclinedSecondChanceParent,publishSecondChanceParent} from '../../pages/maps/publishSecondChanceParent'
import {bountifulPreparedReplayFacts} from './bountifulLuckReceipt'
import {readBountifulSpellOriginalRaw} from './bountifulLuckPersistentRoomDriver'
import {actualMapsExtra,actualMapsMint} from './bountifulLuck.boundExtraMap.testSupport.ts'
import {prepareBountifulDeferredExtraD20} from './bountifulLuckDeferredD20'
import {isCombatInterruptKind} from '../../lib/combatInterruptProtocol'
import {recordCombatInterruptRollOptions,type SharedCombatInterruptQueueState} from '../../lib/combatInterruptQueue'
import {writeDicePoolCheckpoint,readDicePoolCheckpoint} from '../../presentation/maps/dicePoolCheckpoint'
import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {bountifulDeferredD20RequestId} from './bountifulLuckDeferredD20'
import {commitD20ChoiceReroll} from '../../pages/maps/commitD20ChoiceReroll'
import {createD20ChoiceRerollContribution,createD20RollConfirmationInterrupt,durableD20RollId} from '../../lib/rollConfirmation'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
import {beginBountifulSpellOriginalAttack} from './bountifulLuckSpellOriginal'
import {continueBountifulSpellOriginalAttack} from './bountifulSpellOriginalD20Flow'
const beginBountifulEquipmentOriginal=(input:Pick<Parameters<typeof beginBountifulSpellOriginalAttack>[0],'action'|'source'>,gateway:Parameters<typeof beginBountifulSpellOriginalAttack>[1],ui:Parameters<typeof beginBountifulSpellOriginalAttack>[2])=>beginBountifulSpellOriginalAttack({...input,actorId:'ally-token',rollCursor:1,authorityUnchanged:()=>true},gateway,ui)
import {recordBountifulOriginalAfterDice} from './bountifulLuckNormalAck'
import {it,expect,vi} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {driveBountifulOriginalParent,BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it.each(['decline','use'] as const)('native Fire Bolt generic choice survives refresh then real SC %s shares final costs and HP',async scenario=>{const replacement=17;
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const disposeBase=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeSC=registerDnd5eRulesPlugin({manifest:{id:'test.spell-joint',name:'Joint Second Chance',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'Private'},setup(api){api.registerFeat({id:'second',name:'Second Chance',summary:'Test',description:'Test',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'short-rest'}],declarativeAbility:{schemaVersion:1,id:'second',name:'Second Chance',description:'Test',level:1,automation:'full',trigger:{kind:'after-d20-roll'},cost:{economy:'reaction',resources:[{resourceId:'uses',amount:1}]},targeting:{kind:'self'},effects:[],mechanic:{kind:'incoming-hit-attack-die-reroll'}}})}})
 const dispose=()=>{disposeSC();disposeBase()}
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const actor=normalizeCharacter({...make('ally',false),race:'人类',dnd5eRaceId:'human',charClass:'法师',equipment:{},dnd5eClassLevels:{wizard:4},abilities:{str:10,dex:14,con:14,int:18,wis:10,cha:10},inspiration:1,dnd5eClassChoices:{classes:{wizard:{selections:{'spell-cantrips':['fire-bolt']}}}}});
  const target=make('target',false);target.dnd5eFeatIds=['test.spell-joint:second'];target.classResources={...target.classResources,'test.spell-joint:uses':{current:1,max:1}};
  const characters=[actor,make('first',true),make('second',true),target]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:index===3?'enemy':'player',label:c.name,x:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:('parent-'+replacement),mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'ally-member',type:'dnd5e-spell-cast',dnd5eSpellCast:{spellId:'fire-bolt',castingClassId:'wizard',slotLevel:0,targetTokenId:'target-token'},actorTokenId:'ally-token',characterId:'ally',targetTokenId:'target-token',round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,slotId:token.id,label:token.label,roll:20-index}))},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const rawRollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:('parent-'+replacement),occurrenceIndex:0})+':pool:1d20'
  const source={prepared:prepared.prepared,d20:1,effectRolls:[] as number[],hostOriginalRollActorId:'ally-token',hostOriginalRollKind:'attack' as const,...captureBountifulOriginalRawIssuer({mapId:'map',parentId:('parent-'+replacement),mode:'dm',rollId:rawRollId,cursor:1,raw:[1]})}
  await expect(beginBountifulEquipmentOriginal({action,source},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  const untouched=structuredClone(data.characters),sequence:string[]=[],rolls:string[]=[]
  const append=(receipt:BountifulOriginalDieReceipt,actorTokenId:string,characterId:string,memberId:string,command:object)=>{
   const rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId,characterId,bountifulLuck:{parentId:('parent-'+replacement),occurrence:receipt.identity.occurrence,command}}]
  }
  // A closed or unanswered UI does not manufacture a decline or any cost.
  await expect(driveBountifulOriginalParent({mapId:'map',parentId:('parent-'+replacement)},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(data.characters).toEqual(untouched)
  const stage=await beginBountifulEquipmentOriginal({action,source},gateway,{
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=12;append(receipt,roller.tokenId,requireCharacterRoller(roller),roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe('ally-member');append(fresh,roller.tokenId,requireCharacterRoller(roller),'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  })
  if(!stage)throw Error('Real equipment raw did not issue its private parent')
  expect(stage.rawDice).toEqual([1]);expect(stage.retainedDice).toEqual([1])
  expect(sequence).toEqual(['first-token:0','second-token:0'])
  expect(rolls).toEqual([])
  expect(stage.rawDice).toEqual([1]);expect(stage.retainedDice).toEqual([1])
  expect(stage.receipts).toHaveLength(1)
  expect(data.characters).toEqual(untouched)
  expect(writes.every(names=>names.length<3)).toBe(true)


  const option=dnd5eCoreInspirationChoiceRerollOption(characters[0],'ally-token','normal')
  if(!option)throw Error('Real core Inspiration option missing')
  const prompt=createD20RollConfirmationInterrupt({mapId:'map',combatId:'combat',rollId:bountifulDeferredD20RequestId(('parent-'+replacement),rawRollId,0,0),bountifulParent:{parentId:('parent-'+replacement),sourceOccurrence:0,dieIndex:0,rawRollId},label:'Normal post-original reroll',originalValue:1,rollerCharacterId:'ally',eligibleModifiers:[option]})
  const contribution=createD20ChoiceRerollContribution({interruptId:prompt.id,characterId:'ally',characterName:characters[0].name,featureId:option.featureId,featureLabel:option.featureLabel,decision:'use'})
  prompt.contributions=[contribution];prompt.status='rolling'
  data['combat-interrupts']={_sync:{revision:1},mapId:'map',interrupts:[prompt],updatedAt:1}

  if(contribution.kind!=='choice-reroll')throw Error('actual choice contribution required');
  const extraInput={mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution};
  const proof=await prepareBountifulDeferredExtraD20(extraInput,gateway);
  expect(proof.rollerCharacterId).toBe('ally');expect(proof.count).toBe(1);
  expect(await prepareBountifulDeferredExtraD20(structuredClone(extraInput),gateway)).toEqual(proof);
  await expect(prepareBountifulDeferredExtraD20({...extraInput,expectedContribution:{...contribution,createdAt:contribution.createdAt+1}},gateway)).rejects.toThrow('locked-accepted-contribution-required');
  await expect(prepareBountifulDeferredExtraD20({...extraInput,acceptedContributionId:'old-contribution'},gateway)).rejects.toThrow('authenticated-contribution-required');
  const originalQueue=structuredClone(data['combat-interrupts']);
  const checkForged=async(change:(row:typeof prompt)=>void)=>{
    const altered=structuredClone(prompt);change(altered);
    data['combat-interrupts']={...structuredClone(originalQueue),interrupts:[altered]};
    const copied=altered.contributions?.[0];
    if(!copied||copied.kind!=='choice-reroll')throw Error('test needs concrete choice');
    await expect(prepareBountifulDeferredExtraD20({mapId:'map',interruptId:altered.id,acceptedContributionId:copied.id,expectedContribution:copied},gateway)).rejects.toThrow();
    data['combat-interrupts']=structuredClone(originalQueue);
  };
  await checkForged(row=>{row.id='ordinary-roll-with-copied-bountiful-payload';row.contributions![0].id=row.id+':ally:choice-reroll'});
  await checkForged(row=>{row.actorCharId='other'});
  await checkForged(row=>{row.payload.originalValue=20});
  await checkForged(row=>{row.payload.bountifulParent!.parentId='old-parent'});
  await checkForged(row=>{row.payload.bountifulParent!.rawRollId='copied-old-die'});
  await checkForged(row=>{row.payload.eligibleModifiers![0].featureId='foreign-core-source'});
  await checkForged(row=>{row.status='done'});
  await checkForged(row=>{row.mapId='other-map'});
  const originalCharacters=structuredClone(data.characters);
  const changedCharacters=structuredClone(characters);changedCharacters[0].inspiration=0;data.characters.characters=changedCharacters;
  await expect(prepareBountifulDeferredExtraD20(extraInput,gateway)).rejects.toThrow('stale-original-materials');
  data.characters=originalCharacters;
  const beforeRaw=structuredClone(data.characters),cursor=new Map([[action.id,source.hostOriginalDiceCursor]]);
  const raw=await actualMapsExtra(prompt,contribution.id,gateway,async(count,sides,_label,_target,options)=>{
    const id=actualMapsMint(count,sides,options,cursor,action.id);
    writeDicePoolCheckpoint(id,sides,[replacement],true);
    return readDicePoolCheckpoint(id,count,sides)!.values;
  });
  expect(raw).toEqual([replacement]);expect(data.characters).toEqual(beforeRaw);
  const queue=data['combat-interrupts'];
  const rolled=recordCombatInterruptRollOptions({mapId:'map',interrupts:[prompt],updatedAt:1},prompt.id,{contributionId:contribution.id,values:[1,...raw!]},3);
  if(!rolled)throw Error('actual queue did not retain raw options');
  data['combat-interrupts']={...rolled,_sync:{revision:queue._sync.revision+1}};
  await expect(prepareBountifulDeferredExtraD20(extraInput,gateway)).rejects.toThrow('locked-accepted-contribution-required');
  // Real raw options survive while the generic cost and original HP are still
  // unpublished. A fresh page resumes the original raw cursor and skips extra
  // dice, exactly as the actual Maps handler does when rollOptions is present.
  const restored=await gateway.loadResource<SharedCombatInterruptQueueState>('combat-interrupts');
  const restoredPrompt=restored?.interrupts[0];
  if(!restoredPrompt||!isCombatInterruptKind(restoredPrompt,'roll-confirmation'))throw Error('Actual restored raw prompt required');
  expect(restoredPrompt.payload.rollOptions?.values).toEqual([1,replacement]);
  const reloadedCursor=new Map([[action.id,source.hostOriginalDiceCursor]]);
  const damageRequestId=actualMapsMint(1,10,{},reloadedCursor,action.id);
  let damageForNative=readDicePoolCheckpoint(damageRequestId,1,10)?.values;
  if(!damageForNative){writeDicePoolCheckpoint(damageRequestId,10,[3],true);damageForNative=readDicePoolCheckpoint(damageRequestId,1,10)!.values;}
  const input={mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,now:4}
  const count=writes.length
  await expect(commitD20ChoiceReroll({...input,deferToParent:{parentId:'foreign',sourceOccurrence:0,dieIndex:0}},gateway)).rejects.toThrow('real-private-parent-required')
  await expect(commitD20ChoiceReroll({...input,deferToParent:{parentId:('parent-'+replacement),sourceOccurrence:0,dieIndex:1}},gateway)).rejects.toThrow('original-die-required')
  const actualPrompt=(data['combat-interrupts'].interrupts as typeof prompt[])[0]
  const actualRollId=actualPrompt.payload.rollId
  actualPrompt.payload.rollId='foreign-raw:0'
  await expect(commitD20ChoiceReroll(input,gateway)).rejects.toThrow('authenticated-original-request-required')
  actualPrompt.payload.rollId=actualRollId
  actualPrompt.actorCharId='other'
  await expect(commitD20ChoiceReroll(input,gateway)).rejects.toThrow('authenticated-original-request-required')
  actualPrompt.actorCharId='ally'
  actualPrompt.payload.originalValue=20
  await expect(commitD20ChoiceReroll(input,gateway)).rejects.toThrow('authenticated-original-request-required')
  actualPrompt.payload.originalValue=1
  expect(writes).toHaveLength(count)
  const response=await commitD20ChoiceReroll(input,gateway)
  expect(response.finalValue).toBe(replacement)
  expect((data.characters.characters as typeof characters)[0].inspiration).toBe(1)
  expect(writes.slice(count)).toEqual([['combat','combat-interrupts']])
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  const first=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)[0]
  expect(first.postOriginalD20).toEqual([expect.objectContaining({parentId:('parent-'+replacement),actorId:'ally-token',characterId:'ally',rawRollId,interruptId:prompt.id,contributionId:contribution.id,originalValue:1,selectedValue:replacement,featureId:option.featureId,resourceCosts:option.resourceCosts})])
  expect(await commitD20ChoiceReroll(input,gateway)).toEqual(response)
  expect(writes).toHaveLength(count+1)
  await expect(commitD20ChoiceReroll({...input,acceptedContributionId:'foreign'},gateway)).rejects.toThrow('reroll-contribution-mismatch')
  expect(writes).toHaveLength(count+1)
  const saved=await readBountifulSpellOriginalRaw({mapId:'map',parentId:action.id},gateway);
  if(!saved||saved.source.hostOriginalRollKind!=='attack')throw Error('Actual persisted caster raw missing');
  expect(saved.source.d20).toBe(1);expect(saved.source.hostOriginalRollId).toBe(source.hostOriginalRollId);
  const restoredStage=await continueBountifulSpellOriginalAttack({action,source:{...saved.source,hostOriginalRollKind:'attack'},actorId:'ally-token',rollCursor:1,authorityUnchanged:()=>true},gateway,{original:{showChoice:async()=>{throw Error('Owner phase must not repeat')},requestRoll:async()=>{throw Error('Original die must not repeat')}},confirmSelfReroll:async()=>{throw Error('Confirmed generic choice must not repeat')}});
  expect(restoredStage?.retainedDice).toEqual([replacement]);
  const finalSource={...source,effectRolls:replacement===17?damageForNative:[]}
  await expect(recordBountifulOriginalAfterDice({action,source:{...finalSource,bardicInspirationRoll:7},resolve:resolvePreparedDnd5eSpellCast,authorityUnchanged:()=>true},gateway)).rejects.toThrow('real-continuation-rejected')
  const liveFirst=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)[0]
  const realFacts=structuredClone(liveFirst.postOriginalD20)
  if(!realFacts?.length)throw Error('Missing authenticated deferred source')
  liveFirst.postOriginalD20=realFacts.map(fact=>({...fact,readyOrdinal:fact.readyOrdinal+1}))
  await expect(recordBountifulOriginalAfterDice({action,source:finalSource,resolve:resolvePreparedDnd5eSpellCast,authorityUnchanged:()=>true},gateway)).rejects.toThrow('real-continuation-rejected')
  liveFirst.postOriginalD20=realFacts.map(fact=>({...fact,resourceCosts:[{...fact.resourceCosts[0],amount:2}]}))
  await expect(recordBountifulOriginalAfterDice({action,source:finalSource,resolve:resolvePreparedDnd5eSpellCast,authorityUnchanged:()=>true},gateway)).rejects.toThrow('real-continuation-rejected')
  liveFirst.postOriginalD20=realFacts
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  await recordBountifulOriginalAfterDice({action,source:finalSource,resolve:resolvePreparedDnd5eSpellCast,authorityUnchanged:()=>true},gateway)

  const parents=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>);
  const captured=captureSecondChancePreparedOriginal(resolvePreparedDnd5eSpellCast,{...finalSource,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:action.id,source:finalSource,receipts:parents})});
  if(!captured)throw Error('Actual prepared Fire Bolt capture missing');
  const incoming=await issueSecondChanceAttack({mapId:'map',parentTransactionId:action.id,preparedOriginal:captured},gateway);
  expect(incoming.attack.dice).toEqual([17]);
  expect(data.characters).toEqual(untouched);expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0);
  const command=async(body:object,memberId:string,actorTokenId='ally-token',characterId='ally')=>{
    const rows=data['player-action-requests'].requests as object[],id='sc-response-'+rows.length;
    data['player-action-requests'].requests=[...rows,{id,roomMemberId:memberId,type:'dnd5e-second-chance',sourceMode:'player',status:'pending',mapId:'map',combatId:'combat',actorTokenId,characterId,secondChance:{attackReceiptId:incoming.attack.id,...body}}];
    await processSecondChanceRequest({mapId:'map',requestId:id},gateway);
  };
  await command({phase:'reaction',decision:scenario},'target-member','target-token','target');
  const scInput={mapId:'map',attackReceiptId:incoming.attack.id};
  if(scenario==='use'){
    await command({phase:'select-die',dieIndex:0},'ally-member');
    const attacks=data.combat.secondChanceAttacks as Record<string,{rollRequestId?:string}>,rollRequestId=attacks[incoming.attack.id].rollRequestId;
    await command({phase:'roll-result',rollRequestId,value:2},'ally-member');
    await command({phase:'confirm-roll',rollRequestId,value:2},'host');
    await commitSecondChanceHostAttack(scInput,gateway);
  }else await prepareDeclinedSecondChanceParent(scInput,gateway);
  // Existing SC accepts and pays its own reaction in its normal cost CAS.
  // BL-linked generic Inspiration and original spell damage remain deferred.
  expect(writes.filter(names=>names.includes('characters'))).toEqual(scenario==='use'?[['characters','combat']]:[]);
  expect((data.characters.characters as typeof characters).find(row=>row.id==='ally')?.inspiration).toBe(1);
  expect((data.characters.characters as typeof characters).find(row=>row.id==='target')?.currentHp).toBe(30);
  const result=await publishSecondChanceParent(scInput,gateway);
  expect(result.ok).toBe(true);
  const committed=data.characters.characters as typeof characters;
  expect(committed.find(row=>row.id==='target')?.currentHp).toBe(scenario==='use'?30:27);
  expect(committed.find(row=>row.id==='ally')?.inspiration).toBe(0);
  expect(committed.find(row=>row.id==='target')?.classResources?.['test.spell-joint:uses'].current).toBe(scenario==='use'?0:1);
  expect(writes.filter(names=>names.includes('characters'))).toEqual(scenario==='use'?[['characters','combat'],['characters','maps','combat']]:[['characters','maps','combat']]);
  expect(Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)[0].consumed?.transactionId).toBe(action.id);
  const before=structuredClone(data),writeCount=writes.length;
  expect(await publishSecondChanceParent(scInput,gateway)).toEqual(result);expect(data).toEqual(before);expect(writes).toHaveLength(writeCount);

 }finally{dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}

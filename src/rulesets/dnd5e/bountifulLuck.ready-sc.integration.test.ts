import {captureSecondChancePreparedOriginal} from '../../pages/maps/secondChancePreparedParent'
import {issueSecondChanceAttack} from '../../pages/maps/issueSecondChanceAttack'
import {processSecondChanceRequest} from '../../pages/maps/processSecondChanceRequest'
import {commitSecondChanceHostAttack} from '../../pages/maps/secondChanceHostCommit'
import {prepareDeclinedSecondChanceParent,publishSecondChanceParent} from '../../pages/maps/publishSecondChanceParent'
import {recordBountifulReadyAfterDice} from './bountifulReadyAfterDice'
import {continueBountifulSpellOriginalAttack} from './bountifulSpellOriginalD20Flow'
import {prepareBountifulReadyExtraD20} from './bountifulReadyGenericReplay'
import {commitD20ChoiceReroll} from '../../pages/maps/commitD20ChoiceReroll'
import {issueBountifulReadyGenericPrompt,readBountifulReadyGenericReplay} from './bountifulReadyGenericReplay'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {createD20ChoiceRerollContribution} from '../../lib/rollConfirmation'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {durableD20RollId} from '../../lib/rollConfirmation'
import {prepareDnd5eSpellCast} from './spellAction'
import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it.each(['decline','use'] as const)('keeps a genuine ready-only spell parent through Second Chance %s and final CAS',async scenario=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeLatest=registerDnd5eRulesPlugin({manifest:{id:'test.pre-ready',name:'Actual must-use-latest fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},setup(api){api.registerFeat({id:'latest',name:'Latest result',summary:'Latest result',description:'Declared data-only saving throw reroll',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'long-rest'}],declarativeAbility:{schemaVersion:1,id:'latest',name:'Latest result',description:'Use the new result',level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'none',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'d20-choice-reroll',rollKinds:['attack'],scopes:['self-roll'],additionalDice:1,selection:'must-use-latest'}}})}})
 const disposeSC=registerDnd5eRulesPlugin({manifest:{id:'test.spell-joint',name:'Joint Second Chance',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'Private'},setup(api){api.registerFeat({id:'second',name:'Second Chance',summary:'Test',description:'Test',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'short-rest'}],declarativeAbility:{schemaVersion:1,id:'second',name:'Second Chance',description:'Test',level:1,automation:'full',trigger:{kind:'after-d20-roll'},cost:{economy:'reaction',resources:[{resourceId:'uses',amount:1}]},targeting:{kind:'self'},effects:[],mechanic:{kind:'incoming-hit-attack-die-reroll'}}})}})
 try{
  const make=(id:string,feat=false)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:feat?'半身人':'人类',dnd5eRaceId:feat?'halfling':'human',charClass:'战士',level:4,currentHp:30,maxHp:30,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster'),charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['fire-bolt']}}}}}),first=make('first');caster.dnd5eFeatIds=['test.pre-ready:latest'];caster.classResources={...caster.classResources,'test.pre-ready:uses':{current:1,max:1}};first.dnd5eFeatIds=['test.spell-joint:second'];first.classResources={...first.classResources,'test.spell-joint:uses':{current:1,max:1}}
  const characters=[caster,first,make('second'),make('helper',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,type:index===1?'enemy':'player',label:character.name,x:index===1?225:index===2?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'first-token',targetTokenIds:['first-token'],dnd5eSpellCast:{spellId:'fire-bolt',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'first-token',targetTokenIds:['first-token']},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const raw=captureBountifulOriginalRawIssuer({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:0}),cursor:1,raw:[2]})

  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))});if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))},'player-action-requests':{_sync:{revision:1},requests:[action]}}
  for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]?._sync.revision??0);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);for(const write of batch)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:(data[write.name]?._sync.revision??0)+1}};writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const source={prepared:prepared.prepared,d20:2,effectRolls:[],hostOriginalRollActorId:'caster-token',hostOriginalRollKind:'attack' as const,...raw}
  const before=structuredClone(data)
  const stage=await continueBountifulSpellOriginalAttack({action,source,actorId:'caster-token',rollCursor:1,authorityUnchanged:()=>true},gateway,{
   original:{showChoice:async()=>{throw Error('Original20 cannot ask for a natural-one decision')},requestRoll:async()=>{throw Error('Original20 cannot request a BL replacement')}},
   confirmSelfReroll:async request=>{
    const scope=request.bountifulReadyParent;if(!scope)throw Error('Native ready20 requires its own ready-frame identity')
    const prompt=await issueBountifulReadyGenericPrompt({mapId:'map',frameId:scope.frameId,dieIndex:request.dieIndex},gateway)
    expect(prompt.payload.rollId).toBe(request.rollId)
    const option=prompt.payload.eligibleModifiers?.find(row=>row.featureId==='test.pre-ready:feat-latest');if(!option)throw Error('Actual current declared source required')
    const contribution=createD20ChoiceRerollContribution({interruptId:prompt.id,characterId:'caster',characterName:caster.name,featureId:option.featureId,featureLabel:option.featureLabel,decision:'use',selectedIndex:1})
    if(contribution.kind!=='choice-reroll')throw Error('Actual generic choice contribution required')
    prompt.contributions=[contribution];prompt.status='rolling'
    data['combat-interrupts'].interrupts=[prompt];data['combat-interrupts']._sync.revision++
    const beforeDice=await prepareBountifulReadyExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution},gateway)
    expect(beforeDice).toMatchObject({count:1,rollerCharacterId:'caster'});expect(beforeDice.rollRequestId).toMatch(/^bountiful-ready-extra-d20:[a-f0-9]{64}$/)
    expect(await prepareBountifulReadyExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution},gateway)).toEqual(beforeDice)
    await expect(prepareBountifulReadyExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:{...contribution,characterId:'helper'}},gateway)).rejects.toThrow('locked-original-contribution-required')
    prompt.payload.rollOptions={contributionId:contribution.id,values:[2,17]}
    data['combat-interrupts'].interrupts=[prompt];data['combat-interrupts']._sync.revision++
    const settled=await commitD20ChoiceReroll({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id},gateway)
    if(settled.finalValue===undefined)throw Error('Actual generic committer must return retained result')
    return settled.finalValue
   },
  })
  if(!stage||!('hostOriginalReadyFrameId'in stage))throw Error('Actual ready-stage continuation required')
  const id=stage.hostOriginalReadyFrameId
  expect(stage.retainedDice).toEqual([17]);expect(stage.originalReady.originalRolls).toEqual([2]);expect(stage.receipts).toEqual([])
  expect(stage.previewState.combatants['caster-token'].classResources['test.pre-ready:uses'].current).toBe(0)
  expect(data.characters).toEqual(before.characters);expect(data.maps).toEqual(before.maps)
  await recordBountifulReadyAfterDice({action,frameId:id,source:{...source,effectRolls:[3]},rollCursor:2,authorityUnchanged:()=>true},gateway)
  const replay=await readBountifulReadyGenericReplay({mapId:'map',frameId:id},gateway)
  const captured=captureSecondChancePreparedOriginal(resolvePreparedDnd5eSpellCast,{...replay.source,hostOriginalD20Replay:replay.binding})
  if(!captured)throw Error('Actual native ready-only parent required')
  const incoming=await issueSecondChanceAttack({mapId:'map',parentTransactionId:action.id,preparedOriginal:captured},gateway);
  expect(incoming.attack.dice).toEqual([17]);
  expect(data.characters).toEqual(before.characters);expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0);
  const command=async(body:object,memberId:string,actorTokenId='caster-token',characterId='caster')=>{
    const rows=data['player-action-requests'].requests as object[],id='sc-response-'+rows.length;
    data['player-action-requests'].requests=[...rows,{id,roomMemberId:memberId,type:'dnd5e-second-chance',sourceMode:'player',status:'pending',mapId:'map',combatId:'combat',actorTokenId,characterId,secondChance:{attackReceiptId:incoming.attack.id,...body}}];
    await processSecondChanceRequest({mapId:'map',requestId:id},gateway);
  };
  await command({phase:'reaction',decision:scenario},'first-member','first-token','first');
  const scInput={mapId:'map',attackReceiptId:incoming.attack.id};
  if(scenario==='use'){
    await command({phase:'select-die',dieIndex:0},'caster-member');
    const attacks=data.combat.secondChanceAttacks as Record<string,{rollRequestId?:string}>,rollRequestId=attacks[incoming.attack.id].rollRequestId;
    await command({phase:'roll-result',rollRequestId,value:2},'caster-member');
    await command({phase:'confirm-roll',rollRequestId,value:2},'host');
    await commitSecondChanceHostAttack(scInput,gateway);
  }else await prepareDeclinedSecondChanceParent(scInput,gateway);
  // Existing SC accepts and pays its own reaction in its normal cost CAS.
  // BL-linked generic Inspiration and original spell damage remain deferred.
  expect(writes.filter(names=>names.includes('characters'))).toEqual(scenario==='use'?[['characters','combat']]:[]);
  expect((data.characters.characters as typeof characters).find(row=>row.id==='caster')?.classResources?.['test.pre-ready:uses'].current).toBe(1);
  expect((data.characters.characters as typeof characters).find(row=>row.id==='first')?.currentHp).toBe(30);
  const lockedReady=structuredClone(data.combat.bountifulReadyParents)
  const rows=data.combat.bountifulReadyParents as Record<string,{postReadyD20:{selectedValue:number;rerollValues:number[]}[]}>
  rows[id].postReadyD20[0].selectedValue=16;rows[id].postReadyD20[0].rerollValues=[16]
  const beforeRejected=writes.length
  await expect(publishSecondChanceParent(scInput,gateway)).rejects.toThrow('changed-authenticated-ready-choices')
  expect(writes).toHaveLength(beforeRejected)
  data.combat.bountifulReadyParents=lockedReady
  const result=await publishSecondChanceParent(scInput,gateway);
  expect(result.ok).toBe(true);
  const committed=data.characters.characters as typeof characters;
  expect(committed.find(row=>row.id==='first')?.currentHp).toBe(scenario==='use'?30:27);
  expect(committed.find(row=>row.id==='caster')?.classResources?.['test.pre-ready:uses'].current).toBe(0);
  expect(committed.find(row=>row.id==='first')?.classResources?.['test.spell-joint:uses'].current).toBe(scenario==='use'?0:1);
  expect(writes.filter(names=>names.includes('characters'))).toEqual(scenario==='use'?[['characters','combat'],['characters','maps','combat']]:[['characters','maps','combat']]);
  expect(data.combat.bountifulOriginalParents).toBeUndefined();
  expect((data.combat.bountifulReadyParents as Record<string,{consumed?:{transactionId:string}}>)[id].consumed?.transactionId).toBe(action.id);
  const after=structuredClone(data),writeCount=writes.length;
  expect(await publishSecondChanceParent(scInput,gateway)).toEqual(result);expect(data).toEqual(after);expect(writes).toHaveLength(writeCount);

 }finally{disposeSC();disposeLatest();dispose()}
})

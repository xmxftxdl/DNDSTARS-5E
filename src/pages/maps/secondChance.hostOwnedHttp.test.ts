import{sharedChoiceAudience}from'./sharedChoiceAudience'

import{unregisterContentDefinitionPackage}from'../../domain/content/contentDefinitionRegistry'

import{prepareSecondChanceParentCriticalDice}from'./publishSecondChanceParent'

import{createSecondChancePersistentRoomUI}from'../../lib/secondChancePersistentRoomUI'

import{driveSecondChancePersistentRoomParent}from'./secondChancePersistentRoomDriver'

import{submitSecondChanceChoice,submitSecondChanceRoll,submitSecondChanceHostConfirmation,recordSecondChanceHostOwnedRawDice}from'../../lib/secondChanceClientCommands'

import{publishSecondChanceParent}from'./publishSecondChanceParent'

const nativeArchiveBase64='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'



import{createNativeEnvelopeApi}from'./secondChanceNativeApiTestHelper'

import{issueSecondChanceAttack}from'./issueSecondChanceAttack'

import{processSecondChanceRequest}from'./processSecondChanceRequest'

import{commitSecondChanceHostAttack}from'./secondChanceHostCommit'

import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from'../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities'

import{afterEach,expect,it,vi}from'vitest'

import{readDnd5eStarMod}from'../../rulesets/dnd5e/starModAdapter'

import{dnd5eRulesPluginFromUnifiedContentBundleV1}from'../../rulesets/dnd5e/unifiedContent'

import{automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability'

import{registerDnd5eRulesPlugin}from'../../rulesets/dnd5e/pluginApi'

import{normalizeCharacter}from'../../store/characters'

import{syncCharacterClassResources}from'../../lib/classResources'

import{createDnd5eMapCombatSnapshot}from'../../rulesets/dnd5e/mapBridge'





import{dnd5eAdvancementFeatOptions}from'../../components/character/featAdvancementOptions'

import{applyDnd5eLevelAdvancement}from'../../rulesets/dnd5e/levelAdvancement'





const session=vi.hoisted(()=>({current:{roomId:'room',memberId:'dm',role:'dm'}}));vi.mock('../../lib/roomSession',async()=>({...await vi.importActual('../../lib/roomSession'),getRoomSession:()=>session.current}))

const disposers:(()=>void)[]=[];afterEach(()=>{while(disposers.length)disposers.pop()!()})

async function fixture(mode:'full'|'manual'|'partial',stale=false){

 ensureDnd5eCoreSpellActivitiesRegisteredV1()

 const raw=Buffer.from(nativeArchiveBase64,'base64'),bundle=(await readDnd5eStarMod(new Uint8Array(raw).buffer)).bundle

 expect(bundle.definitions[0].kind).toBe('feat');expect((bundle.definitions[0].payload as any).automation).toBe('full');expect((bundle.definitions[0].payload as any).declarativeAbility.automation).toBe('full')

 const original=structuredClone(bundle.definitions[0].payload)

 if(!stale)bundle.definitions[0].automation=automationCapabilityFromLegacyStatus(mode)

 disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle)))

 const before=normalizeCharacter({id:'hero',name:'Hero',race:'半身人',dnd5eRaceId:'halfling',roomId:'room',roomMemberId:'player',charClass:'战士',level:3,dnd5eClassLevels:{fighter:3},dnd5eClassChoices:{fighter:{fightingStyles:['archery'],subclass:'champion'}},abilities:{str:10,dex:19,con:19,int:10,wis:10,cha:19},currentHp:40,maxHp:40,hitPointMaximumMode:'fixed'})

 const option=dnd5eAdvancementFeatOptions(before).find(row=>row.name==='花开二度')!;expect(option?.eligible).toBe(true)

 const advanced=applyDnd5eLevelAdvancement(before,{schemaVersion:1,classId:'fighter',subclassId:'champion',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[{classLevel:4,choice:{kind:'feat',featId:option.id}}],contentChoiceSelections:{[option.id]:{'second-chance-ability':['dex']}},fighterFightingStyles:['archery']});expect(advanced.ok,JSON.stringify(advanced)).toBe(true);if(!advanced.ok)throw Error(advanced.reason)

 const owner=syncCharacterClassResources(advanced.character),enemy=normalizeCharacter({id:'enemy',name:'Enemy',roomId:'room',roomMemberId:'player',charClass:'战士',level:4,currentHp:30,maxHp:30}),map:any={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'enemy-token',characterId:'enemy',type:'enemy',label:'Enemy',x:25,y:25,size:1,emoji:'E',color:''},{id:'hero-token',characterId:'hero',type:'player',label:'Hero',x:75,y:25,size:1,emoji:'H',color:''}]},order=map.tokens.map((token:any,index:number)=>({tokenId:token.id,label:token.label,roll:20-index,emoji:'',color:''})),snapshot=createDnd5eMapCombatSnapshot({map,characters:[enemy,owner],combatId:'native-envelope',initiativeOrder:order})

 if(stale){disposers.pop()!();bundle.definitions[0].automation=automationCapabilityFromLegacyStatus(mode);disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle)))}

 expect(bundle.definitions[0].payload).toEqual(original)

 return{owner,map,enemy,snapshot,order,packageId:bundle.manifest.id,replaceWithLegacy(){disposers.pop()!();disposers.push(registerDnd5eRulesPlugin({manifest:bundle.manifest,setup(api){api.registerFeat(structuredClone(bundle.definitions[0].payload) as any)}}))},reinstall(next:'manual'|'partial'|'uninstall'){disposers.pop()!();if(next!=='uninstall'){bundle.definitions[0].automation=automationCapabilityFromLegacyStatus(next);disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle)))}},resourceId:bundle.manifest.id+':second-chance-uses'}

}



it.each(['dm-character-roller','native-monster-roller','dm-defender']as const)('real authenticated HTTP Host-owned Second Chance phase completes original parent (%s)',async kind=>{

 const f=await fixture('full'),owner={...f.owner,roomMemberId:kind==='dm-defender'?'dm':'player'},enemy={...f.enemy,roomMemberId:kind==='dm-character-roller'?'dm':'player'},map=structuredClone(f.map)

 if(kind==='native-monster-roller'){delete map.tokens[0].characterId;map.tokens[0].label='哥布林'}

 const revision=(value:object)=>({...value,_sync:{revision:1}}),docs={characters:revision({characters:kind==='native-monster-roller'?[owner]:[owner,enemy]}),maps:revision({maps:[map]}),combat:revision({active:true,mapId:'map',combatId:f.snapshot.state.combatId,round:1,initiativeIndex:0,initiativeOrder:f.order,updatedAt:1})},api=await createNativeEnvelopeApi(docs)

 const issued=await issueSecondChanceAttack({mapId:'map',parentTransactionId:'actual-host-owned-parent',action:{type:'attack',actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}}},api.gateway),appendFor=(role:'dm'|'player')=>({appendPlayerActionRequest:async(action:any)=>{const response=await api.post('player-action-requests/append',{action},role);expect(response.status,JSON.stringify({kind,phase:action.secondChance?.phase,...response})).toBe(200);await processSecondChanceRequest({mapId:'map',requestId:action.id},api.gateway)}})

 expect(issued.attack.rollerControllerMemberId).toBe(kind==='dm-defender'?'player':'dm');expect(issued.attack.targetControllerMemberId).toBe(kind==='dm-defender'?'dm':'player')

 await submitSecondChanceChoice({mapId:'map',context:{attackReceiptId:issued.attack.id,combatId:issued.attack.combatId,actorTokenId:'hero-token',characterId:'hero',phase:'reaction',featureId:issued.featureId,diceCount:1},optionId:issued.featureId,round:1,initiativeIndex:0},appendFor(kind==='dm-defender'?'dm':'player'))

 await submitSecondChanceChoice({mapId:'map',context:{attackReceiptId:issued.attack.id,combatId:issued.attack.combatId,actorTokenId:'enemy-token',characterId:issued.attack.rollerCharacterId??'enemy-token',phase:'select-die',featureId:issued.featureId,diceCount:1},optionId:'die:0',round:1,initiativeIndex:0},appendFor(kind==='dm-defender'?'player':'dm'))

 const selected=(await api.read('combat')).secondChanceAttacks[issued.attack.id],context={attackReceiptId:issued.attack.id,combatId:issued.attack.combatId,actorTokenId:'enemy-token',characterId:issued.attack.rollerCharacterId??'enemy-token',rollRequestId:selected.rollRequestId,count:1,sides:20}

 await submitSecondChanceRoll({mapId:'map',context,values:[1],round:1,initiativeIndex:0},appendFor(kind==='dm-defender'?'player':'dm'))

 const raw=(await api.read('combat')).secondChanceAttacks[issued.attack.id];expect(raw.rollerD20.authenticatedMemberId).toBe(issued.attack.rollerControllerMemberId);expect(raw.rollerConfirmation).toBeUndefined()

 await submitSecondChanceHostConfirmation({mapId:'map',context,values:[1],round:1,initiativeIndex:0},appendFor('dm'))

 const committed=await commitSecondChanceHostAttack({mapId:'map',attackReceiptId:issued.attack.id},api.gateway);expect(committed.hit).toBe(false)

 const result=await publishSecondChanceParent({mapId:'map',attackReceiptId:issued.attack.id},api.gateway);expect(result.ok,JSON.stringify(result)).toBe(true)

 const chars=await api.read('characters'),combat=await api.read('combat');expect(chars.characters.find((row:any)=>row.id==='hero').currentHp).toBe(owner.currentHp);expect(chars.characters.find((row:any)=>row.id==='hero').classResources[f.resourceId].current).toBe(0);expect(combat.dnd5eTurnEconomyByToken['hero-token'].reaction.current).toBe(0);expect(combat.secondChanceAttacks[issued.attack.id].parentContinuation.phase).toBe('consumed');expect(await publishSecondChanceParent({mapId:'map',attackReceiptId:issued.attack.id},api.gateway)).toEqual(result);expect(await api.read('characters')).toEqual(chars);expect(await api.read('combat')).toEqual(combat)

})



it.each(['dm-character-roller','native-monster-roller','native-monster-critical','native-monster-critical-cancel-reload','cancel-raw-reload']as const)('actual Host persistent UI posts raw then independent final confirmation through authenticated HTTP without pre-processing in append (%s)',async kind=>{

 const f=await fixture('full'),owner=f.owner,enemy={...f.enemy,roomMemberId:'dm'},map=structuredClone(f.map)

 if(kind.startsWith('native-monster')){delete map.tokens[0].characterId;map.tokens[0].label='哥布林'}

 const characters=kind.startsWith('native-monster')?[owner]:[owner,enemy],revision=(value:object)=>({...value,_sync:{revision:1}}),api=await createNativeEnvelopeApi({characters:revision({characters}),maps:revision({maps:[map]}),combat:revision({active:true,mapId:'map',combatId:f.snapshot.state.combatId,round:1,initiativeIndex:0,initiativeOrder:f.order,updatedAt:1})}),phases:string[]=[]

 const appendFor=(role:'dm'|'player')=>({appendPlayerActionRequest:async(action:any)=>{const response=await api.post('player-action-requests/append',{action},role);phases.push(action.secondChance.phase+':'+response.status);expect(response.status,JSON.stringify({kind,phase:action.secondChance.phase,...response})).toBe(200)}})

 let cancel=kind==='cancel-raw-reload',cancelCritical=kind==='native-monster-critical-cancel-reload',physicalCriticalRolls=0;const makeUI=()=>createSecondChancePersistentRoomUI({map,characters:()=>characters,choose:async request=>{const context=(request.context as any).secondChance,optionId=context.phase==='reaction'?context.featureId:'die:0';await submitSecondChanceChoice({mapId:'map',context,optionId,round:1,initiativeIndex:0},appendFor(context.phase==='reaction'?'player':'dm'));return optionId},rollD20:async(_label,_name,owned)=>{expect(owned.rollerTokenId).toBe('enemy-token');expect(owned.rollerCharacterId).toBe(kind.startsWith('native-monster')?undefined:'enemy');await recordSecondChanceHostOwnedRawDice({mapId:'map',requestId:owned.durableRollRequestId!,rollerTokenId:owned.rollerTokenId,values:[9],sides:20,round:1,initiativeIndex:0},{...api.gateway,...appendFor('dm')});if(cancel){cancel=false;throw Error('combat-dice-cancelled')}return kind.startsWith('native-monster-critical')?20:1},rollDice:async(count,sides,_label,_name,owned)=>{physicalCriticalRolls++;expect([count,sides]).toEqual([1,6]);await recordSecondChanceHostOwnedRawDice({mapId:'map',requestId:owned.durableRollRequestId!,rollerTokenId:owned.rollerTokenId,values:[2],sides,round:1,initiativeIndex:0},{...api.gateway,...appendFor('dm')});if(cancelCritical){cancelCritical=false;throw Error('combat-dice-cancelled')}return[6]},confirmStoredRoll:async(values,sides)=>{expect(values).toEqual(sides===20?[9]:[2]);return sides===20?[kind.startsWith('native-monster-critical')?20:1]:[6]},gateway:{...api.gateway,...appendFor('dm')},round:()=>1,initiativeIndex:()=>0})

 const input={mapId:'map',parentTransactionId:'actual-host-ui-parent',action:{type:'attack' as const,actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing' as const}}}

 if(kind==='cancel-raw-reload'){await expect(driveSecondChancePersistentRoomParent(input,api.gateway,makeUI())).rejects.toThrow('second-chance-parent-pending');const saved=await api.read('combat'),pending=Object.values(saved.secondChanceAttacks)[0]as any;expect(pending.rollerD20.value).toBe(9);expect(pending.rollerConfirmation).toBeUndefined();expect((await api.read('characters')).characters.find((row:any)=>row.id==='hero').classResources[f.resourceId].current).toBe(1);expect(JSON.parse(JSON.stringify(pending)).rollerD20.value).toBe(9)}if(kind==='native-monster-critical-cancel-reload'){await expect(driveSecondChancePersistentRoomParent(input,api.gateway,makeUI())).rejects.toThrow('second-chance-parent-pending');const pending=Object.values((await api.read('combat')).secondChanceAttacks)[0]as any;expect(Object.values(pending.criticalDice)).toEqual([[2]]);expect(pending.criticalDiceConfirmations??{}).toEqual({})} const terminal=await driveSecondChancePersistentRoomParent(input,api.gateway,makeUI()).then(()=>undefined,error=>error);expect(terminal?.message,JSON.stringify({phases,terminal:terminal?.message})).toBe('second-chance-parent-published')

 if(kind.startsWith('native-monster-critical'))expect(physicalCriticalRolls).toBe(1);expect(phases).toEqual(['reaction:200','select-die:200','roll-result:200','confirm-roll:200',...(kind.startsWith('native-monster-critical')?['critical-roll-result:200','confirm-critical-roll:200']:[])])

 const combat=await api.read('combat'),receipt=Object.values(combat.secondChanceAttacks)[0]as any,chars=await api.read('characters');expect(receipt.rollerD20).toMatchObject({authenticatedMemberId:'dm',value:9});expect(receipt.rollerConfirmation).toMatchObject({authenticatedMemberId:'dm',rawValue:9,value:kind.startsWith('native-monster-critical')?20:1});if(kind.startsWith('native-monster-critical')){expect(Object.values(receipt.criticalDice)).toEqual([[2]]);expect(Object.values(receipt.criticalDiceConfirmations)).toEqual([expect.objectContaining({authenticatedMemberId:'dm',rawValues:[2],values:[6]})])}expect(receipt.parentContinuation.phase).toBe('consumed');expect(chars.characters.find((row:any)=>row.id==='hero').currentHp).toBe(owner.currentHp-(kind.startsWith('native-monster-critical')?10:0));expect(chars.characters.find((row:any)=>row.id==='hero').classResources[f.resourceId].current).toBe(0)

})



async function transportFixture(stage:'reaction'|'select'|'raw'|'critical'='select',hostDefender=false){

 const f=await fixture('full'),owner={...f.owner,roomMemberId:hostDefender?'dm':'player'},enemy={...f.enemy,roomMemberId:hostDefender?'player':'dm'},revision=(data:object)=>({...data,_sync:{revision:1}}),api=await createNativeEnvelopeApi({characters:revision({characters:[owner,enemy]}),maps:revision({maps:[f.map]}),combat:revision({active:true,mapId:'map',combatId:f.snapshot.state.combatId,round:1,initiativeIndex:0,initiativeOrder:f.order,updatedAt:1})})

 const issued=await issueSecondChanceAttack({mapId:'map',parentTransactionId:'host-phase-guard-parent',action:{type:'attack',actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}}},api.gateway)

 let seq=0;const action=(command:Record<string,unknown>,target=false):any=>({id:'host-guard-'+(++seq),mapId:'map',combatId:issued.attack.combatId,actorTokenId:target?'hero-token':'enemy-token',characterId:target?'hero':'enemy',type:'dnd5e-second-chance',sourceMode:'dm',roomMemberId:'forged-principal',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1,secondChance:{attackReceiptId:issued.attack.id,...command}})

 const send=async(command:Record<string,unknown>,role:'dm'|'player'='dm',target=false)=>{const request=action(command,target),response=await api.post('player-action-requests/append',{action:request},role);expect(response.status,JSON.stringify(response)).toBe(200);return processSecondChanceRequest({mapId:'map',requestId:request.id},api.gateway)}

 if(stage!=='reaction')await send({phase:'reaction',decision:'use'},hostDefender?'dm':'player',true)

 let selected:any;if(stage==='raw'||stage==='critical')selected=await send({phase:'select-die',dieIndex:0},hostDefender?'player':'dm')

 let supplement:any;if(stage==='critical'){await send({phase:'roll-result',rollRequestId:selected.rollRequestId,value:20},hostDefender?'player':'dm');await send({phase:'confirm-roll',rollRequestId:selected.rollRequestId,value:20});await commitSecondChanceHostAttack({mapId:'map',attackReceiptId:issued.attack.id},api.gateway);supplement=await prepareSecondChanceParentCriticalDice({mapId:'map',attackReceiptId:issued.attack.id},api.gateway);expect(supplement?.count).toBe(1)}

 const candidate=action(stage==='reaction'?{phase:'reaction',decision:'use'}:stage==='select'?{phase:'select-die',dieIndex:0}:stage==='raw'?{phase:'roll-result',rollRequestId:selected.rollRequestId,value:9}:{phase:'critical-roll-result',supplementRequestId:supplement.id,values:[2]},stage==='reaction')

 return{...f,owner,enemy,api,issued,candidate,send}

}

it('Host-controlled defender showChoice resolves to real DM audience and appends only the actual authenticated DM reaction',async()=>{

 const f=await transportFixture('reaction',true),seen:any[]=[],ui=createSecondChancePersistentRoomUI({map:f.map,characters:()=>[f.owner,f.enemy],choose:async request=>{seen.push(request);expect(request.audience).toBe('dm');expect(request.actor?.id).toBe('hero');expect(sharedChoiceAudience(request.audience,f.owner.roomMemberId,'dm')).toBe('dm');const context=(request.context as any).secondChance;await submitSecondChanceChoice({mapId:'map',context,optionId:context.featureId,round:1,initiativeIndex:0},{appendPlayerActionRequest:async action=>{expect((await f.api.post('player-action-requests/append',{action},'dm')).status).toBe(200)}});return context.featureId},rollD20:async()=>{throw Error('No roll at defender choice')},rollDice:async()=>[],gateway:{...f.api.gateway,appendPlayerActionRequest:async action=>{expect((await f.api.post('player-action-requests/append',{action},'dm')).status).toBe(200)}},round:()=>1,initiativeIndex:()=>0})

 await ui.showChoice({receipt:f.issued,context:{attackReceiptId:f.issued.attack.id,combatId:f.issued.attack.combatId,actorTokenId:'hero-token',characterId:'hero',phase:'reaction',featureId:f.issued.featureId,diceCount:1}})

 expect(seen).toHaveLength(1);const queue=await f.api.read('player-action-requests'),request=queue.requests[0];expect(request).toMatchObject({sourceMode:'dm',roomMemberId:'dm',secondChance:{phase:'reaction',decision:'use'}});await processSecondChanceRequest({mapId:'map',requestId:request.id},f.api.gateway);expect((await f.api.read('combat')).secondChanceAttacks[f.issued.attack.id].reactionDecision).toEqual({authenticatedMemberId:'dm',decision:'use'})

})

it.each(['map','combat','actor','character','receipt','index','extra-field','no-use','characters-revision','maps-revision','current-owner','current-source','not-active','turn-key']as const)('authenticated DM cannot use the owned-phase transport with stale or foreign %s',async boundary=>{

 const f=await transportFixture(boundary==='no-use'?'reaction':'select'),request=structuredClone(f.candidate)

 request.secondChance={attackReceiptId:f.issued.attack.id,phase:'select-die',dieIndex:0}

 if(boundary==='map')request.mapId='other-map';if(boundary==='combat')request.combatId='other-combat';if(boundary==='actor')request.actorTokenId='hero-token';if(boundary==='character')request.characterId='hero';if(boundary==='receipt')request.secondChance.attackReceiptId='foreign';if(boundary==='index')request.secondChance.dieIndex=1;if(boundary==='extra-field')(request.secondChance as any).controllerMemberId='dm'

 if(['characters-revision','current-owner','current-source'].includes(boundary)){const chars=await f.api.read('characters');if(boundary==='current-owner')chars.characters.find((row:any)=>row.id==='enemy').roomMemberId='player';if(boundary==='current-source')chars.characters.find((row:any)=>row.id==='hero').dnd5eFeatIds=[];await f.api.gateway.saveResourcesAtomically([{name:'characters',expectedRevision:chars._sync.revision,data:chars}],{transactionId:'real-character-boundary-'+boundary})}

 if(boundary==='maps-revision'){const maps=await f.api.read('maps');await f.api.gateway.saveResourcesAtomically([{name:'maps',expectedRevision:maps._sync.revision,data:maps}],{transactionId:'real-map-version-change'})}

 if(boundary==='not-active'||boundary==='turn-key'){const combat=await f.api.read('combat');if(boundary==='not-active')combat.active=false;else combat.dnd5eTurnEconomyByToken['hero-token'].turnKey='foreign-turn';await f.api.gateway.saveResourcesAtomically([{name:'combat',expectedRevision:combat._sync.revision,data:combat}],{transactionId:'real-combat-boundary-'+boundary})}

 const before={combat:await f.api.read('combat'),characters:await f.api.read('characters'),queue:await f.api.read('player-action-requests')},response=await f.api.post('player-action-requests/append',{action:request},'dm');expect(response.status,JSON.stringify(response)).toBe(403);expect(await f.api.read('combat')).toEqual(before.combat);expect(await f.api.read('characters')).toEqual(before.characters);expect(await f.api.read('player-action-requests')).toEqual(before.queue)

})

it.each(['wrong-request','out-of-range','already-raw','critical-before-commit','wrong-critical-profile','critical-face','already-critical']as const)('Host raw/critical dice transport rejects %s with no second fact or cost',async boundary=>{

 const critical=boundary.includes('critical')&&boundary!=='critical-before-commit',f=await transportFixture(critical?'critical':'raw'),request=structuredClone(f.candidate)

 if(boundary==='wrong-request')request.secondChance.rollRequestId='foreign-request';if(boundary==='out-of-range')request.secondChance.value=21

 if(boundary==='already-raw'){await f.send({phase:'roll-result',rollRequestId:request.secondChance.rollRequestId,value:9})}

 if(boundary==='critical-before-commit')request.secondChance={attackReceiptId:f.issued.attack.id,phase:'critical-roll-result',supplementRequestId:'foreign-critical',values:[2]}

 if(boundary==='wrong-critical-profile')request.secondChance.supplementRequestId='foreign-critical';if(boundary==='critical-face')request.secondChance.values=[7]

 if(boundary==='already-critical')await f.send({...request.secondChance})

 const before={combat:await f.api.read('combat'),characters:await f.api.read('characters'),queue:await f.api.read('player-action-requests')},response=await f.api.post('player-action-requests/append',{action:request},'dm');expect(response.status,JSON.stringify(response)).toBe(403);expect(await f.api.read('combat')).toEqual(before.combat);expect(await f.api.read('characters')).toEqual(before.characters);expect(await f.api.read('player-action-requests')).toEqual(before.queue)

})

it.each(['manual','partial','uninstall','generic-unregister']as const)('actual Host raw seam rejects a retained original whose live source became %s',async mode=>{

 const f=await transportFixture('raw');if(mode==='generic-unregister')unregisterContentDefinitionPackage(f.packageId);else f.reinstall(mode)

 const before={combat:await f.api.read('combat'),characters:await f.api.read('characters'),queue:await f.api.read('player-action-requests')},append=vi.fn(async(action:any)=>{expect((await f.api.post('player-action-requests/append',{action},'dm')).status).toBe(200)})

 await expect(recordSecondChanceHostOwnedRawDice({mapId:'map',requestId:f.candidate.secondChance.rollRequestId as string,rollerTokenId:'enemy-token',values:[9],sides:20,round:1,initiativeIndex:0},{...f.api.gateway,appendPlayerActionRequest:append})).rejects.toThrow('owned-raw-source-unavailable');expect(append).not.toHaveBeenCalled();expect(await f.api.read('combat')).toEqual(before.combat);expect(await f.api.read('characters')).toEqual(before.characters);expect(await f.api.read('player-action-requests')).toEqual(before.queue)

})



it.each(['reaction','select','raw','critical']as const)('actual DM transport cannot take a currently player-controlled %s phase',async stage=>{

 const f=await transportFixture(stage,stage!=='reaction'),before={combat:await f.api.read('combat'),characters:await f.api.read('characters'),queue:await f.api.read('player-action-requests')},response=await f.api.post('player-action-requests/append',{action:f.candidate},'dm');expect(response.status,JSON.stringify(response)).toBe(403);expect(await f.api.read('combat')).toEqual(before.combat);expect(await f.api.read('characters')).toEqual(before.characters);expect(await f.api.read('player-action-requests')).toEqual(before.queue)

})

it('player payload cannot forge the authenticated Host defender identity',async()=>{

 const f=await transportFixture('reaction',true),before={combat:await f.api.read('combat'),characters:await f.api.read('characters')},response=await f.api.post('player-action-requests/append',{action:f.candidate},'player');expect(response.status).toBe(200);const queued=(await f.api.read('player-action-requests')).requests.find((row:any)=>row.id===f.candidate.id);expect(queued).toMatchObject({roomMemberId:'player',sourceMode:'player'});await expect(processSecondChanceRequest({mapId:'map',requestId:f.candidate.id},f.api.gateway)).rejects.toThrow('reaction-not-authorized');expect(await f.api.read('combat')).toEqual(before.combat);expect(await f.api.read('characters')).toEqual(before.characters)

})


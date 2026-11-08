import{driveSecondChancePersistentRoomParent}from'./secondChancePersistentRoomDriver'
import{SecondChanceMapsSettlementSignal}from'./secondChanceMapsSettlement'
import{processSecondChanceRequest}from'./processSecondChanceRequest'
import{secondChancePhaseRequestId}from'../../lib/secondChanceClientCommands'
import{normalizeSharedCampaignTime}from'../../lib/campaignTime'
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
import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from'../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities'
import{createNativeEnvelopeApi}from'./secondChanceNativeApiTestHelper'
import{issueSecondChanceAttack}from'./issueSecondChanceAttack'
const session=vi.hoisted(()=>({current:{roomId:'room',memberId:'dm',role:'dm'}}));vi.mock('../../lib/roomSession',async()=>({...await vi.importActual('../../lib/roomSession'),getRoomSession:()=>session.current}))
const disposers:(()=>void)[]=[];afterEach(()=>{while(disposers.length)disposers.pop()!();session.current={roomId:'room',memberId:'dm',role:'dm'}})
const nativeArchiveBase64='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'
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




import{dnd5eSpellAuthorityResolutionContext}from'./spellSettlementCoordinator'
import{prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast}from'../../rulesets/dnd5e/spellAction'
import{captureSecondChancePreparedOriginal}from'./secondChancePreparedParent'
async function ordinaryFixture(withClock=true){
 const f=await fixture('full'),caster=normalizeCharacter({...f.enemy,charClass:'术士',dnd5eClassLevels:{sorcerer:4},equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['fire-bolt']}}}}}),characters=[caster,f.owner],map=f.map
 const action:any={id:'real-exploration-fire-bolt',mapId:map.id,type:'dnd5e-spell-cast',actorTokenId:'enemy-token',characterId:'enemy',targetTokenId:'hero-token',sourceMode:'player',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'fire-bolt',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'hero-token'}}
 const authority=dnd5eSpellAuthorityResolutionContext({combatActive:false,map,actorTokenId:'enemy-token',initiativeOrder:[]});expect(authority.exploration).toBe(true)
 const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:authority.initiativeOrder});expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 const source={prepared:prepared.prepared,d20:18,d20Second:18,effectRolls:[4]},result=resolvePreparedDnd5eSpellCast(source);expect(result.result.ok).toBe(true);expect(result.result.events.find(event=>event.type==='attack-resolved')).toMatchObject({hit:true})
 const api=await createNativeEnvelopeApi({characters:{characters},maps:{maps:[map]},combat:{active:false,mapId:'old-map',combatId:'old-combat',round:9,initiativeIndex:0,initiativeOrder:[],updatedAt:1},...(withClock?{'campaign-time':normalizeSharedCampaignTime({worldMinute:480,updatedAt:1})}:{})})
 expect((await api.post('player-action-requests/append',{action},'player')).status).toBe(200)
 const parent=captureSecondChancePreparedOriginal(resolvePreparedDnd5eSpellCast,source)!;expect(parent.adapterId).toBe('spell')
 return{f,caster,characters,map,action,parent,api}
}
it.each([true,false])('a real ordinary exploration Fire Bolt hit retains inactive room and publishes once, clock initially present=%s',async(withClock)=>{
 const{f,characters,map,action,parent,api}=await ordinaryFixture(withClock)
 const receipt=await issueSecondChanceAttack({mapId:map.id,parentTransactionId:action.id,preparedOriginal:parent},api.gateway)
 expect(receipt.sceneScope?.kind).toBe('ordinary-exploration')
 const stored=await api.read('combat');expect(stored.active).toBe(false);expect(stored.combatId).toBe('old-combat');expect(stored.round).toBe(9);expect((await api.read('characters')).characters).toEqual(characters)
 const originalSave=api.gateway.saveResourcesAtomically.getMockImplementation()!;api.gateway.saveResourcesAtomically.mockImplementation(async(writes:any,options:any)=>{console.log('ORDINARY_SC_REVISIONS',JSON.stringify({transaction:options.transactionId,reads:options.readRevisions}));return originalSave(writes,options)});const append=async(receipt:any,phase:string,extra:object,member:'player'|'dm'='player')=>{const actor=phase==='reaction'?'hero-token':'enemy-token',characterId=actor==='hero-token'?'hero':'enemy',requestId=secondChancePhaseRequestId(receipt.attack.id,phase),body={id:requestId,mapId:map.id,combatId:receipt.attack.combatId,type:'dnd5e-second-chance',actorTokenId:actor,characterId,sourceMode:member==='dm'?'dm':'player',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1,secondChance:{attackReceiptId:receipt.attack.id,phase,...extra}};expect((await api.post('player-action-requests/append',{action:body},member)).status).toBe(200);return requestId}
 const ui:any={showChoice:async({receipt,context}:any)=>{await append(receipt,context.phase,context.phase==='reaction'?{decision:'use'}:{dieIndex:0})},requestRoll:async({receipt,rollRequestId}:any)=>{const requestId=await append(receipt,'roll-result',{rollRequestId,value:1});await processSecondChanceRequest({mapId:map.id,requestId},api.gateway);await append(receipt,'confirm-roll',{rollRequestId,value:1},'dm')},prepareFollowups:async()=>({combatRevision:1,authorityUnchanged:()=>true})}
 const drive=async()=>{try{await driveSecondChancePersistentRoomParent({mapId:map.id,parentTransactionId:action.id,preparedOriginal:parent},api.gateway,ui);throw Error('typed settlement required')}catch(error){if(!(error instanceof SecondChanceMapsSettlementSignal))throw error;return error.settlement}}
 expect((await drive()).kind).toBe('second-chance-parent-published')
 const after=await api.read('combat'),ownerAfter=(await api.read('characters')).characters.find((row:any)=>row.id==='hero');expect(after.active).toBe(false);expect(after.combatId).toBe('old-combat');expect(after.round).toBe(9);expect(after.dnd5eTurnEconomyByToken).toBeUndefined();expect(ownerAfter.currentHp).toBe(f.owner.currentHp);expect(ownerAfter.classResources[f.resourceId].current).toBe(0);expect(ownerAfter.dnd5eCombatState.sceneReactionSpent).toMatchObject({roomId:'room',parentTransactionId:action.id})
 const writes=api.gateway.saveResourcesAtomically.mock.calls.length;expect((await drive()).kind).toBe('second-chance-parent-published');expect(api.gateway.saveResourcesAtomically.mock.calls).toHaveLength(writes)
 expect(api.gateway.saveResourcesAtomically.mock.calls.filter((call:any)=>call[1]?.transactionId==='second-chance-parent:'+action.id)).toHaveLength(1)
 const clock=await api.read('campaign-time')??{...normalizeSharedCampaignTime({worldMinute:480,updatedAt:1}),_sync:{schemaVersion:1,revision:0,writerId:'scene-dm',writtenAt:2}};clock.worldMinute+=10;expect((await api.post('campaign-time',clock,'dm','PUT')).status).toBe(200)
 const transfer=await api.read('maps');transfer.maps[0].id='second-map';expect((await api.post('maps',transfer,'dm','PUT')).status).toBe(200)
 const normalized=await api.read('characters');normalized.characters=normalized.characters.map((row:any)=>normalizeCharacter(row));expect((await api.post('characters',normalized,'dm','PUT')).status).toBe(200)
 const currentCharacters=(await api.read('characters')).characters,currentOwner=currentCharacters.find((row:any)=>row.id==='hero');expect(currentOwner.dnd5eCombatState.sceneReactionSpent).toEqual(ownerAfter.dnd5eCombatState.sceneReactionSpent);expect(currentOwner.classResources[f.resourceId].current).toBe(0)
 const nextAction={...action,id:'fresh-exploration-after-used-sc',mapId:'second-map'},nextMap=(await api.read('maps')).maps[0],context=dnd5eSpellAuthorityResolutionContext({combatActive:false,map:nextMap,actorTokenId:'enemy-token',initiativeOrder:[]}),nextPrepared=prepareDnd5eSpellCast({action:nextAction,map:nextMap,characters:currentCharacters,initiativeOrder:context.initiativeOrder});expect(nextPrepared.ok).toBe(true);if(!nextPrepared.ok)throw Error(nextPrepared.reason)
 const nextSource={prepared:nextPrepared.prepared,d20:18,d20Second:18,effectRolls:[4]},nextNative=resolvePreparedDnd5eSpellCast(nextSource);expect(nextNative.result.ok).toBe(true);expect(nextNative.result.events.some(event=>event.type==='attack-resolved'&&event.hit)).toBe(true)
 expect((await api.post('player-action-requests/append',{action:nextAction},'player')).status).toBe(200)
 const nextOriginal=captureSecondChancePreparedOriginal(resolvePreparedDnd5eSpellCast,nextSource)!;await expect(issueSecondChanceAttack({mapId:'second-map',parentTransactionId:nextAction.id,preparedOriginal:nextOriginal},api.gateway)).rejects.toThrow(/incoming-hit-not-awaiting-choice|scene-reaction/)
 expect((await api.read('characters')).characters).toEqual(currentCharacters);expect((await api.read('combat')).active).toBe(false)


})

for(const changed of ['characters','maps','map-geometry','campaign-time','combat'] as const)it(`ordinary scene pending parent rejects real ${changed} change without SC HP or cost publication`,async()=>{
 const{f,map,action,parent,api}=await ordinaryFixture(),receipt=await issueSecondChanceAttack({mapId:map.id,parentTransactionId:action.id,preparedOriginal:parent},api.gateway)
 let data=await api.read(changed)
 if(changed==='characters')data.characters[0].currentHp-=1
 if(changed==='maps')data.maps[0].tokens[0].x+=50
 if(changed==='combat')data.round=10
 if(changed==='campaign-time')data.worldMinute+=1
 if(changed==='map-geometry')data={schemaVersion:1,maps:[],updatedAt:2,_sync:{schemaVersion:1,revision:0,writerId:'fixture-dm',writtenAt:2}}
 const modified=await api.post(changed,data,'dm','PUT');expect(modified.status,JSON.stringify(modified.payload)).toBe(200)
 const before=await api.read('characters'),beforeCombat=await api.read('combat')
 const ui:any={showChoice:async({receipt}:any)=>{const response:any={id:secondChancePhaseRequestId(receipt.attack.id,'reaction'),mapId:map.id,combatId:receipt.attack.combatId,type:'dnd5e-second-chance',actorTokenId:'hero-token',characterId:'hero',sourceMode:'player',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1,secondChance:{attackReceiptId:receipt.attack.id,phase:'reaction',decision:'use'}};expect((await api.post('player-action-requests/append',{action:response},'player')).status).toBe(200)},requestRoll:async()=>{throw Error('stale original cannot request a physical die')},prepareFollowups:async()=>({combatRevision:1,authorityUnchanged:()=>true})}
 await expect(driveSecondChancePersistentRoomParent({mapId:map.id,parentTransactionId:action.id,preparedOriginal:parent},api.gateway,ui)).rejects.toThrow(/stale|scope|parent-identity|actual-api-transaction:409/)
 expect(await api.read('characters')).toEqual(before);expect((await api.read('characters')).characters.find((row:any)=>row.id==='hero').classResources[f.resourceId].current).toBe(1)
 expect((await api.read('combat')).secondChanceAttacks[receipt.attack.id]).toEqual(beforeCombat.secondChanceAttacks[receipt.attack.id]);expect((await api.read('combat')).active).toBe(false)
})

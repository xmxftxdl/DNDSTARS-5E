const nativeArchiveBase64='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'
import{unregisterContentDefinitionPackage}from'../../domain/content/contentDefinitionRegistry'
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
import{syncCharacterClassResources,spendClassResource}from'../../lib/classResources'
import{createDnd5eMapCombatSnapshot}from'../../rulesets/dnd5e/mapBridge'
import{resolveDnd5eActionWithDamageReactions}from'../../rulesets/dnd5e/damageReactionFlow'
import{dnd5eIncomingAttackRerollOptions}from'../../rulesets/dnd5e/headlessCombatEngine'
import{dnd5eAdvancementFeatOptions}from'../../components/character/featAdvancementOptions'
import{applyDnd5eLevelAdvancement}from'../../rulesets/dnd5e/levelAdvancement'
import{buildInitiativeOrder}from'../mapsPageHelpers'
import{recoverSecondChanceOnConfirmedInitiative}from'../../lib/secondChanceInitiativeRecovery'
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
it.each([{mode:'full' as const,stale:false},{mode:'manual' as const,stale:false},{mode:'partial' as const,stale:false},{mode:'manual' as const,stale:true},{mode:'partial' as const,stale:true}])('true native envelope $mode stale=$stale preserves manual pool but only full can intercept a real Map attack',async({mode,stale})=>{
 const f=await fixture(mode,stale),before=f.snapshot.state.combatants['hero-token'],startHp=before.currentHp;expect(before.classResources[f.resourceId].current).toBe(1);let offers=0
 const result=await resolveDnd5eActionWithDamageReactions({state:f.snapshot.state,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('unrelated dice')},action:{type:'attack',actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}},chooseIncomingAttackReroll:async request=>{offers++;return{featureId:dnd5eIncomingAttackRerollOptions(request.state,request.facts.event)[0].featureId,dieIndex:0,newD20:1}}})
 expect(result.ok,JSON.stringify(result)).toBe(true);expect(offers).toBe(mode==='full'?1:0);expect(result.state.combatants['hero-token'].currentHp).toBe(startHp-(mode==='full'?0:4));expect(result.state.combatants['hero-token'].classResources[f.resourceId].current).toBe(mode==='full'?0:1)
})
it.each(['manual','partial']as const)('true native envelope %s cannot perform SC-only initiative recovery while payload remains full',async mode=>{
 const f=await fixture(mode,true),spent=spendClassResource(f.owner,f.resourceId,1)!;expect(spent.classResources![f.resourceId].current).toBe(0)
 const entry=buildInitiativeOrder(f.map.tokens,[f.enemy,spent],{combatId:'next-native-combat',phase:'combat-start'}).find(row=>row.tokenId==='hero-token')!;expect(entry.initiativeCalculation?.rolls).toHaveLength(1)
 expect(recoverSecondChanceOnConfirmedInitiative(spent,'next-native-combat',entry).classResources![f.resourceId].current).toBe(0)
})

it.each(['full','manual','partial','uninstall','generic-unregister']as const)('real native issued parent with authenticated decisions and disk JSON reload enforces current envelope %s at Host commit',async mode=>{
 const f=await fixture('full'),revision=(data:object)=>({...data,_sync:{revision:1}}),docs={characters:revision({characters:[f.owner,f.enemy]}),maps:revision({maps:[f.map]}),combat:revision({active:true,mapId:'map',combatId:f.snapshot.state.combatId,round:1,initiativeIndex:0,initiativeOrder:f.order,updatedAt:1})},api=await createNativeEnvelopeApi(docs)
 const issued=await issueSecondChanceAttack({mapId:'map',parentTransactionId:'real-native-parent',action:{type:'attack',actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}}},api.gateway)
 expect(issued.parentDefinitionSignature).toMatch(/^sha256:/);expect(issued.featureDefinitionSignature).toBeTruthy();expect(issued.hostControllerMemberId).toBe('dm')
 async function send(command:Record<string,unknown>,role:'dm'|'player',target=false){const id='native-'+String(command.phase),action={id,mapId:'map',combatId:issued.attack.combatId,type:'dnd5e-second-chance',status:'pending',sourceMode:'player',actorTokenId:target?'hero-token':'enemy-token',characterId:target?'hero':'enemy',round:1,initiativeIndex:0,seq:1,updatedAt:1,secondChance:{attackReceiptId:issued.attack.id,...command}};const appended=await api.post('player-action-requests/append',{action},role);expect(appended.status,JSON.stringify(appended)).toBe(200);return processSecondChanceRequest({mapId:'map',requestId:id},api.gateway)}
 await send({phase:'reaction',decision:'use'},'player',true);const selected=await send({phase:'select-die',dieIndex:0},'player');await send({phase:'roll-result',rollRequestId:selected.rollRequestId,value:1},'player');await send({phase:'confirm-roll',rollRequestId:selected.rollRequestId,value:1},'dm')
 if(mode==='generic-unregister')unregisterContentDefinitionPackage(f.packageId);else if(mode!=='full')f.reinstall(mode)
 const before={characters:await api.read('characters'),combat:await api.read('combat')},reloaded=JSON.parse(JSON.stringify(before.combat));expect(reloaded.secondChanceAttacks[issued.attack.id].rollerConfirmation.value).toBe(1)
 const input={mapId:'map',attackReceiptId:issued.attack.id}
 if(mode==='full'){
  const result=await commitSecondChanceHostAttack(input,api.gateway);expect(result.hit).toBe(false);const saved=await api.read('characters');expect(saved.characters.find((c:any)=>c.id==='hero').classResources[f.resourceId].current).toBe(0)
  const after=await api.read('combat');expect(after.dnd5eTurnEconomyByToken['hero-token'].reaction.current).toBe(0);expect(await commitSecondChanceHostAttack(input,api.gateway)).toEqual(result);expect(await api.read('characters')).toEqual(saved);expect(await api.read('combat')).toEqual(after)
 }else{
  await expect(commitSecondChanceHostAttack(input,api.gateway)).rejects.toThrow(/second-chance:(?:changed-parent-definitions|owned-feature-required|changed-feature-definition)/)
  expect(await api.read('characters')).toEqual(before.characters);expect(await api.read('combat')).toEqual(before.combat)
 }
})

it('full native source retains actual confirmed-initiative recovery exactly once per genuine receipt',async()=>{
 const f=await fixture('full'),spent=spendClassResource(f.owner,f.resourceId,1)!,entry=buildInitiativeOrder(f.map.tokens,[f.enemy,spent],{combatId:'native-full-initiative',phase:'combat-start'}).find(row=>row.tokenId==='hero-token')!
 const recovered=recoverSecondChanceOnConfirmedInitiative(spent,'native-full-initiative',entry);expect(recovered.classResources![f.resourceId].current).toBe(1)
 const spentAgain=spendClassResource(recovered,f.resourceId,1)!;expect(recoverSecondChanceOnConfirmedInitiative(spentAgain,'native-full-initiative',entry).classResources![f.resourceId].current).toBe(0)
})

it.each([false,true])('generic source unregister cannot restore legacy fallback for a native source (prepared=%s)',async prepared=>{
 const f=await fixture('full');expect(unregisterContentDefinitionPackage(f.packageId)).toBe(true)
 const state=prepared?f.snapshot.state:createDnd5eMapCombatSnapshot({map:f.map,characters:[f.enemy,f.owner],combatId:'native-envelope',initiativeOrder:f.order}).state;let offers=0
 const result=await resolveDnd5eActionWithDamageReactions({state,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('unrelated dice')},action:{type:'attack',actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}},chooseIncomingAttackReroll:async request=>{offers++;return{featureId:dnd5eIncomingAttackRerollOptions(request.state,request.facts.event)[0].featureId,dieIndex:0,newD20:1}}})
 expect(result.ok,JSON.stringify(result)).toBe(true);expect(offers).toBe(0);expect(result.state.combatants['hero-token'].classResources[f.resourceId].current).toBe(1)
})
it('generic source unregister prevents native-only confirmed initiative recovery',async()=>{
 const f=await fixture('full'),spent=spendClassResource(f.owner,f.resourceId,1)!;unregisterContentDefinitionPackage(f.packageId)
 const entry=buildInitiativeOrder(f.map.tokens,[f.enemy,spent],{combatId:'orphan-initiative',phase:'combat-start'}).find(row=>row.tokenId==='hero-token')!
 expect(recoverSecondChanceOnConfirmedInitiative(spent,'orphan-initiative',entry).classResources![f.resourceId].current).toBe(0)
})
it('new legacy same-ID source after native teardown retains its own full contract',async()=>{
 const f=await fixture('full');f.replaceWithLegacy();const state=createDnd5eMapCombatSnapshot({map:f.map,characters:[f.enemy,f.owner],combatId:'native-envelope',initiativeOrder:f.order}).state;let offers=0
 const result=await resolveDnd5eActionWithDamageReactions({state,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('unrelated dice')},action:{type:'attack',actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}},chooseIncomingAttackReroll:async request=>{offers++;return{featureId:dnd5eIncomingAttackRerollOptions(request.state,request.facts.event)[0].featureId,dieIndex:0,newD20:1}}})
 expect(result.ok,JSON.stringify(result)).toBe(true);expect(offers).toBe(1);expect(result.state.combatants['hero-token'].classResources[f.resourceId].current).toBe(0)
})

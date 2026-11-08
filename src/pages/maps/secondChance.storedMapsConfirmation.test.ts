import{getRoomSession}from'../../lib/roomSession'
import{afterEach,expect,it,vi}from'vitest'
import ts from'typescript'
import vm from'node:vm'
import mapsSource from'../MapsWorkspacePage.tsx?raw'
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
import{processSecondChanceRequest}from'./processSecondChanceRequest'
import{commitSecondChanceHostAttack}from'./secondChanceHostCommit'
import{prepareSecondChanceParentCriticalDice}from'./publishSecondChanceParent'
import{lockSecondChanceRawForHostConfirmation,submitSecondChanceRoll}from'../../lib/secondChanceClientCommands'
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



async function delegatedFixture(critical=false){
 const f=await fixture('full'),revision=(data:object)=>({...data,_sync:{revision:1}}),api=await createNativeEnvelopeApi({characters:revision({characters:[f.owner,f.enemy]}),maps:revision({maps:[f.map]}),combat:revision({active:true,mapId:'map',combatId:f.snapshot.state.combatId,round:1,initiativeIndex:0,initiativeOrder:f.order,updatedAt:1})})
 const issued=await issueSecondChanceAttack({mapId:'map',parentTransactionId:'delegated-parent',action:{type:'attack',actorId:'enemy-token',targetId:'hero-token',d20:18,attackModifier:5,damage:{count:1,sides:6,bonus:0,rolls:[4],type:'slashing'}}},api.gateway)
 let seq=0;const send=async(command:Record<string,unknown>,target=false,role:'dm'|'player'='player')=>{const action:any={id:'setup-'+(++seq),mapId:'map',combatId:issued.attack.combatId,actorTokenId:target?'hero-token':'enemy-token',characterId:target?'hero':'enemy',type:'dnd5e-second-chance',sourceMode:'player',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1,secondChance:{attackReceiptId:issued.attack.id,...command}};expect((await api.post('player-action-requests/append',{action},role)).status).toBe(200);return processSecondChanceRequest({mapId:'map',requestId:action.id},api.gateway)}
 await send({phase:'reaction',decision:'use'},true);let selected=await send({phase:'select-die',dieIndex:0}),supplement:any
 if(critical){await send({phase:'roll-result',rollRequestId:selected.rollRequestId,value:20});await send({phase:'confirm-roll',rollRequestId:selected.rollRequestId,value:20},false,'dm');await commitSecondChanceHostAttack({mapId:'map',attackReceiptId:issued.attack.id},api.gateway);supplement=await prepareSecondChanceParentCriticalDice({mapId:'map',attackReceiptId:issued.attack.id},api.gateway);expect(supplement?.count).toBe(1);selected=(await api.read('combat')).secondChanceAttacks[issued.attack.id]}
 const requestId=critical?supplement.id:selected.rollRequestId,context={attackReceiptId:issued.attack.id,combatId:issued.attack.combatId,actorTokenId:'enemy-token',characterId:'enemy',rollRequestId:requestId,count:1,sides:critical?6:20,supplementRequestId:supplement?.id},append=async(role:'dm'|'player',action:any)=>{const response=await api.post('player-action-requests/append',{action},role);expect(response.status,JSON.stringify(response)).toBe(200)}
 const postRaw=async(value=critical?3:9)=>submitSecondChanceRoll({mapId:'map',context,values:[value],round:1,initiativeIndex:0},{appendPlayerActionRequest:action=>append('player',action)})
 const gateway={...api.gateway,appendPlayerActionRequest:async(action:any)=>append('dm',action)},input={mapId:'map',requestId,rollerTokenId:'enemy-token',values:[critical?3:9],sides:critical?6:20,round:1,initiativeIndex:0}
 return{...f,api,issued,selected,supplement,context,requestId,gateway,input,postRaw,send}
}

function actualStoredConfirmation(sandbox:Record<string,unknown>){const parsed=ts.createSourceFile('MapsWorkspacePage.tsx',mapsSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression:ts.Expression|undefined;const visit=(n:ts.Node)=>{if(!expression&&ts.isVariableDeclaration(n)&&n.name.getText(parsed)==='confirmSecondChanceStoredRoll'&&n.initializer)expression=n.initializer;ts.forEachChild(n,visit)};visit(parsed);if(!expression)throw Error('Actual Maps stored callback missing');vm.runInNewContext(ts.transpileModule('globalThis.confirm='+expression.getText(parsed),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,sandbox);return(sandbox as any).confirm}
for(const critical of[false,true])it(`actual Maps reload callback confirms locked player ${critical?'critical':'D20'} raw with no DM ownership substitution`,async()=>{
 const f=await delegatedFixture(critical),rawId=await f.postRaw();await processSecondChanceRequest({mapId:'map',requestId:rawId},f.api.gateway);
 const remembered=vi.fn(),confirm=vi.fn(async()=>[1]),sandbox:any={getRoomSession,isDM:true,activeMap:f.map,findExplicitDiceToken:(id:string,characterId?:string)=>f.map.tokens.find((t:any)=>t.id===id&&(!characterId||t.characterId===characterId)),useCharacterStore:{getState:()=>({characters:[f.owner,f.enemy]})},isDiceCharacterOwnedByCurrentDm:()=>false,rememberDiceOwner:remembered,confirmDmDice:confirm,dnd5eCombatTokenSide:()=> 'player',shouldHideDmControlledCombatRoll:()=>false,roundRef:{current:1},initiativeIndexRef:{current:0},lockSecondChanceRawForHostConfirmation,loadSharedResource:f.gateway.loadResource,saveSharedResourcesAtomically:f.gateway.saveResourcesAtomically,appendSharedPlayerActionRequest:f.gateway.appendPlayerActionRequest};
 expect(await actualStoredConfirmation(sandbox)(f.input.values,f.input.sides,'花开二度','Enemy',{rollerTokenId:'enemy-token',rollerCharacterId:'enemy',durableRollRequestId:f.requestId})).toEqual([1]);for(const owner of[{rollerTokenId:'hero-token',rollerCharacterId:'hero',durableRollRequestId:f.requestId},{rollerTokenId:'enemy-token',rollerCharacterId:'enemy',durableRollRequestId:'second-chance:foreign'},{rollerTokenId:'enemy-token',rollerCharacterId:'foreign',durableRollRequestId:f.requestId}])await expect(actualStoredConfirmation(sandbox)(f.input.values,f.input.sides,'花开二度','Enemy',owner)).rejects.toThrow();expect(confirm).toHaveBeenCalledTimes(1);expect(remembered).toHaveBeenCalledTimes(1);const locked=(await f.api.read('combat')).secondChanceAttacks[f.issued.attack.id];expect(critical?locked.criticalDice[f.requestId]:locked.rollerD20.value).toEqual(critical?[3]:9)
})

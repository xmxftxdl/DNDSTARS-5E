import{resolveDnd5eHeadlessAction,dnd5eHeadlessTurnKey}from'./headlessCombatEngine'
import{planDnd5eMapResultApplication}from'./mapBridge'
import{findDnd5eOpportunityWindowsForMove,prepareDnd5eOpportunityAttack,resolvePreparedDnd5eOpportunityAttack}from'./opportunityAttackAction'
import{afterEach,expect,it,vi}from'vitest'
import{automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability'
import type{Dnd5eActivityDefinitionV1}from'./activities/dnd5eActivityContracts'
const originalText='魔能斩 E LDRITCH S MITE\n先决条件：第 5\n级，刃之魔契\n每回合一次， 当你用契约武器命中一个生物时， 你\n可以消耗一个邪术师法术位，以此对目标造成额外\n1d8+ 每法术位等级 1d8 点的力场伤害，如果目标的体\n型在巨型或以下，则你还可以将他击入 倒地 Prone 。'
function eldritchSource(namespace:string){return{id:'eldritch-smite',name:'魔能斩',summary:'契约武器命中时消耗邪术师法术位追加力场伤害，可击倒巨型或更小的生物。',description:originalText,automation:'full' as const,classRequirements:[{classId:'warlock',minimumLevel:5}],classChoiceRequirements:[{classId:'warlock',groupId:'pact-boon',anyOf:['blade']},{classId:'warlock',groupId:'eldritch-invocations',anyOf:[namespace+':eldritch-smite']}]}}
function eldritchActivities():Dnd5eActivityDefinitionV1[]{return([3,4,5]as const).flatMap(slot=>[false,true].map(prone=>({schemaVersion:1,id:`eldritch-smite-slot${slot}${prone?'-prone':''}`,name:`魔能斩·${slot}环${prone?'·击倒':''}`,activation:{kind:'free'},invocation:{kind:'triggered',event:'attack-hit',confirmation:'actor-choice',retention:'single-event'},target:{kind:'creature',count:1,relation:'any'},requirements:[{kind:'combat-active',active:true},{kind:'class-level',classId:'warlock',minimum:slot===3?5:slot===4?7:9,...(slot<5?{maximum:slot===3?6:8}:{})},{kind:'attack-pact-weapon'},{kind:'once-per-turn',key:'eldritch-smite'},...(prone?[{kind:'size-rank' as const,subject:'target' as const,maximum:4}]:[])],consumption:[{kind:'resource',resourceId:'dnd5e-pact-slot',amount:{kind:'constant',value:1},consumeOn:'resolve'}],outcomes:[{id:'smite',when:{kind:'always'},operations:[{id:'force',kind:'damage',target:'target',amount:{kind:'dice',rollId:'smite-force',count:slot+1,sides:8},damageType:'force',magical:true,critical:'double-dice'},...(prone?[{id:'prone',kind:'apply-effect' as const,target:'target' as const,effectId:'eldritch-prone'}]:[])]}],...(prone?{effects:[{schemaVersion:1 as const,id:'eldritch-prone',name:'魔能斩·倒地',stacking:'replace' as const,duration:{kind:'permanent' as const},conditions:['prone' as const],magical:true}]}:{}),automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'eldritch-smite'}})))}

import{normalizeCharacter}from'../../store/characters'
import{applyDnd5eLevelAdvancement,buildDnd5eLevelAdvancementPlan}from'./levelAdvancement'
import{registerDnd5eRulesPlugin}from'./pluginApi'
import{exportDnd5eStarMod,readDnd5eStarMod}from'./starModAdapter'
import{dnd5eRulesPluginFromUnifiedContentBundleV1}from'./unifiedContent'
import{commitPactWeaponSummon,type PactAuthorityCharacter}from'./pactWeaponSummonHost'
import{applyDnd5eInventoryMutation}from'./items'
import{normalizeSharedCampaignTime}from'../../lib/campaignTime'
import{prepareDnd5eEquipmentAttack,resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{resolveDnd5ePreparedWithMaterialDamageReactions}from'./damageReactionFlow'
const session=vi.hoisted(()=>({current:{roomId:'room',memberId:'dm',role:'dm'}}));vi.mock('../../lib/roomSession',async()=>({...await vi.importActual('../../lib/roomSession'),getRoomSession:()=>session.current}));const disposers:(()=>void)[]=[];afterEach(()=>{while(disposers.length)disposers.pop()!()})
async function fixture(options:{level?:number;size?:'超大型'|'巨型';removeAuthority?:boolean;extraAttack?:boolean}={}){
 const ns='test.real-eldritch-smite',cap={schemaVersion:1 as const,level:'full' as const,supportedPhases:[],manualPhases:[],limitations:[]},decoded=await readDnd5eStarMod(await exportDnd5eStarMod({format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:ns,name:'Original Eldritch Smite',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'Private',contentCategory:'mixed',distributionPolicy:'local-only'},assets:[],definitions:[{schemaVersion:1,namespace:ns,version:'1.0.0',kind:'feature',id:'eldritch-smite',name:'魔能斩',automation:cap,activities:eldritchActivities(),payload:eldritchSource(ns)}]}));disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle)))
 let owner=normalizeCharacter({id:'owner',name:'Owner',roomId:'room',roomMemberId:'player',charClass:'邪术师',level:2,dnd5eClassLevels:{warlock:2},abilities:{str:16,dex:14,con:14,int:10,wis:10,cha:16},currentHp:60,maxHp:60,hitPointMaximumMode:'fixed',equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]},dnd5eClassChoices:{classes:{warlock:{subclass:'fiend',selections:{'eldritch-invocations':['armor-of-shadows','devils-sight'],'spell-cantrips':['eldritch-blast','mage-hand'],'spell-known':['charm-person','comprehend-languages','expeditious-retreat']}}}}})
 for(const level of[3,4,5]){const gained=applyDnd5eLevelAdvancement(owner,{schemaVersion:1,classId:'warlock',subclassId:'fiend',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:level===4?[{classLevel:4,choice:{kind:'ability-score',increases:{str:2}}}]:[],classChoiceSelections:{...(level===3?{'pact-boon':['blade']}:{}),'eldritch-invocations':[options.extraAttack&&level===5?'thirsting-blade':'armor-of-shadows','devils-sight',...(level===5?[ns+':eldritch-smite']:[])]},spellSelections:{cantrips:['eldritch-blast','mage-hand',...(level>=4?['prestidigitation']:[])],knownSpells:['charm-person','comprehend-languages','expeditious-retreat','hold-person',...(level>=4?['mirror-image']:[]),...(level===5?['counterspell']:[])]}});expect(gained.ok,JSON.stringify({level,...gained})).toBe(true);if(!gained.ok)throw Error(gained.reason);owner=gained.character}

 for(let next=6;next<=(options.level??5);next++){
  const plan=buildDnd5eLevelAdvancementPlan(owner,'warlock',1,'fiend');if(!plan)throw Error('Missing actual growth plan')
  const spell=plan.spellAdvancement!,cantrips=[...spell.previousCantrips],knownSpells=[...spell.previousKnownSpells]
  for(const row of spell.cantripOptions)if(cantrips.length<spell.targetCantripCount&&!cantrips.includes(row.id))cantrips.push(row.id)
  for(const row of spell.spellOptions)if(knownSpells.length<(spell.targetKnownSpellCount??0)&&!knownSpells.includes(row.id))knownSpells.push(row.id)
  const classChoiceSelections:Record<string,string[]>={}
  for(const requirement of plan.choiceRequirements){const choices=[...requirement.currentSelections];for(const option of ['beast-speech','fiendish-vigor','beguiling-influence'])if(choices.length<requirement.targetLimit&&!choices.includes(option)&&requirement.options.some(row=>row.id===option))choices.push(option);classChoiceSelections[requirement.key]=choices}
  const advanced=applyDnd5eLevelAdvancement(owner,{schemaVersion:1,classId:'warlock',subclassId:'fiend',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{cha:2}}})),classChoiceSelections,spellSelections:{cantrips,knownSpells}})
  expect(advanced.ok,JSON.stringify({next,...advanced})).toBe(true);if(!advanced.ok)throw Error(advanced.reason);owner=advanced.character
 }
 expect(owner.dnd5ePluginFeatureIds??[]).not.toContain(ns+':eldritch-smite')
 const map:any={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'owner-token',characterId:'owner',type:'player',label:'Owner',x:25,y:25,size:1,color:'',emoji:''},{id:'target',type:'enemy',label:'哥布林',x:75,y:25,size:1,color:'',emoji:'',hp:100,maxHp:100,...(options.size?{creatureSize:options.size}:{})}]},revision=(value:any)=>({...value,_sync:{revision:1}}),docs:any={characters:revision({characters:[owner]}),maps:revision({maps:[map]}),combat:revision({active:false}),'campaign-time':revision(normalizeSharedCampaignTime({worldMinute:100,updatedAt:1}))};
 const gateway={loadResource:async<T>(name:string)=>structuredClone(docs[name])as T,saveResourcesAtomically:vi.fn(async(writes:any[],options:any)=>{for(const w of writes){expect(w.expectedRevision).toBe(docs[w.name]?._sync.revision??0);docs[w.name]=revision(w.data);docs[w.name]._sync.revision=w.expectedRevision+1}return{status:'committed' as const,transactionId:options.transactionId,revisions:{}}})};await commitPactWeaponSummon({mapId:'map',actorTokenId:'owner-token',templateId:'srd-5.1:equipment:dnd5e-longsword',expectedPactRevision:0,transactionId:'actual-summon'},gateway);owner=docs.characters.characters[0];const id=(owner as PactAuthorityCharacter).dnd5ePactWeaponAuthority!.state.binding!.inventoryInstanceId,equip=applyDnd5eInventoryMutation([owner],{type:'equip',characterId:'owner',instanceId:id,slot:'mainWeapon'});if(!equip.ok)throw Error(equip.reason);owner=equip.characters[0];if(options.removeAuthority)delete(owner as PactAuthorityCharacter).dnd5ePactWeaponAuthority;
 const action:any={id:'real-map-attack',mapId:'map',combatId:'combat',round:1,initiativeIndex:0,actorTokenId:'owner-token',characterId:'owner',targetTokenId:'target',sourceMode:'player',type:'dnd5e-weapon-attack',status:'pending',seq:1,updatedAt:1},initiativeOrder=[{tokenId:'owner-token',label:'Owner',roll:20,emoji:'',color:''},{tokenId:'target',label:'Target',roll:10,emoji:'',color:''}],prepared=prepareDnd5eEquipmentAttack({characters:[owner],map:docs.maps.maps[0],action,attacksUsed:0,initiativeOrder});expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason);return{prepared:prepared.prepared,ns,owner,gateway,action,initiativeOrder}
}
async function settle(f:Awaited<ReturnType<typeof fixture>>,options:{critical?:boolean;prone?:boolean;accept?:boolean}={}){
 const dice:{count:number;sides:number}[]=[],offered:string[]=[],slot=(f.owner.dnd5eClassLevels!.warlock??0)>=9?5:(f.owner.dnd5eClassLevels!.warlock??0)>=7?4:3
 const output=await resolveDnd5ePreparedWithMaterialDamageReactions({combatRevision:1,authorityUnchanged:()=>true,confirm:async r=>{offered.push(r.activity.id);return{accepted:options.accept!==false&&r.activity.id===`eldritch-smite-slot${slot}${options.prone?'-prone':''}`}},roll:async r=>{dice.push({count:r.count,sides:r.sides});return Array(r.count).fill(2)}},{prepared:f.prepared,d20:options.critical?20:18,damageRolls:options.critical?[3,3]:[3]},resolvePreparedDnd5eEquipmentAttack)
 expect(output.result.ok,JSON.stringify(output.result)).toBe(true);return{output,dice,offered,slot}
}

it('real Thirsting Blade second ordinary Map attack in the same turn cannot spend a second Pact slot for Eldritch Smite',async()=>{
 const f=await fixture({extraAttack:true}),first=await settle(f)
 expect(first.dice).toEqual([{count:4,sides:8}]);expect(first.output.application).toBeTruthy()
 const application=first.output.application!,actor=first.output.result.state.combatants['owner-token'],history=actor.classState.attackActionHistory!
 expect(history.attacksTaken).toBe(1);expect(actor.classResources['dnd5e-pact-slot'].current).toBe(1)
 const economy={turnKey:history.turnKey,attacksUsed:1,action:{current:0,max:1},bonusAction:{current:1,max:1},reaction:{current:1,max:1},movement:{current:30,max:30}}
 const prepared=prepareDnd5eEquipmentAttack({characters:application.characters,map:application.map,action:{...f.action,id:'second-real-attack'},attacksUsed:1,initiativeOrder:f.initiativeOrder,turnEconomy:economy,turnEconomyByToken:{'owner-token':economy}})
 expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 const second=await settle({...f,prepared:prepared.prepared})
 expect(second.offered).toEqual([]);expect(second.dice).toEqual([])
 expect(second.output.result.state.combatants['owner-token'].classResources['dnd5e-pact-slot'].current).toBe(1)
 expect(second.output.result.state.combatants['owner-token'].classState.attackActionHistory?.attacksTaken).toBe(2)
 expect(second.output.result.events.filter(e=>e.type==='damage-applied')).toHaveLength(1)
 const ended=resolveDnd5eHeadlessAction(second.output.result.state,{type:'end-turn',actorId:'owner-token'})
 expect(ended.ok,JSON.stringify(ended)).toBe(true);expect(ended.state.initiativeOrder[ended.state.initiativeIndex]).toBe('target');expect(ended.state.round).toBe(second.output.result.state.round)
 const live=planDnd5eMapResultApplication({state:ended.state,map:second.output.application!.map,characters:second.output.application!.characters,characterIdByCombatantId:f.prepared.characterIdByCombatantId,events:[...ended.events]}),targetEconomy={...economy,turnKey:dnd5eHeadlessTurnKey(ended.state,'target'),attacksUsed:0,action:{current:1,max:1}}
 const windows=findDnd5eOpportunityWindowsForMove({map:live.map,characters:live.characters,movingToken:live.map.tokens.find(t=>t.id==='target')!,to:{x:175,y:25},turnEconomyByToken:{'owner-token':economy,target:targetEconomy},combatContext:{combatId:ended.state.combatId,round:ended.state.round,initiativeOrder:f.initiativeOrder,initiativeIndex:ended.state.initiativeIndex,active:true}})
 expect(windows.map(w=>w.attacker.id)).toContain('owner-token')
 const opportunity=prepareDnd5eOpportunityAttack({combatId:ended.state.combatId,round:ended.state.round,map:live.map,characters:live.characters,initiativeOrder:f.initiativeOrder,initiativeIndex:ended.state.initiativeIndex,actorTokenId:'owner-token',targetTokenId:'target',turnEconomy:economy,targetTurnEconomy:targetEconomy})
 expect(opportunity.ok,JSON.stringify(opportunity)).toBe(true);if(!opportunity.ok)throw Error(opportunity.reason)
 const offturnDice:any[]=[],offturn=await resolveDnd5ePreparedWithMaterialDamageReactions({combatRevision:3,authorityUnchanged:()=>true,confirm:async r=>({accepted:r.activity.id==='eldritch-smite-slot3'}),roll:async r=>{offturnDice.push({count:r.count,sides:r.sides});return Array(r.count).fill(2)}},{prepared:opportunity.prepared,d20:18,damageRolls:[3]},resolvePreparedDnd5eOpportunityAttack)
 expect(offturn.result.ok,JSON.stringify(offturn.result)).toBe(true);expect(offturnDice).toEqual([{count:4,sides:8}]);expect(offturn.result.state.combatants['owner-token'].classResources['dnd5e-pact-slot'].current).toBe(0);expect(offturn.result.state.combatants['owner-token'].turn.reactionAvailable).toBe(false)
 const targetEnded=resolveDnd5eHeadlessAction(offturn.result.state,{type:'end-turn',actorId:'target'})
 expect(targetEnded.ok,JSON.stringify(targetEnded)).toBe(true);expect(targetEnded.state.initiativeOrder[targetEnded.state.initiativeIndex]).toBe('owner-token');expect(targetEnded.state.round).toBe(2)
 const currentKey=dnd5eHeadlessTurnKey(targetEnded.state,'owner-token');expect(targetEnded.state.combatants['owner-token'].classState.declarativeUsedTurnKeys?.['eldritch-smite']).not.toBe(currentKey)
 const next=planDnd5eMapResultApplication({state:targetEnded.state,map:offturn.application!.map,characters:offturn.application!.characters,characterIdByCombatantId:f.prepared.characterIdByCombatantId,events:[...targetEnded.events]}),nextEconomy={...economy,turnKey:currentKey,attacksUsed:0,action:{current:1,max:1}}
 const exhausted=prepareDnd5eEquipmentAttack({characters:next.characters,map:next.map,action:{...f.action,id:'round-two-no-pact-slots',round:2,initiativeIndex:0},attacksUsed:0,initiativeOrder:f.initiativeOrder,turnEconomy:nextEconomy,turnEconomyByToken:{'owner-token':nextEconomy}})
 expect(exhausted.ok,JSON.stringify(exhausted)).toBe(true);if(!exhausted.ok)throw Error(exhausted.reason)
 const noSlots=await settle({...f,prepared:exhausted.prepared});expect(noSlots.offered).toEqual([]);expect(noSlots.dice).toEqual([]);expect(noSlots.output.result.state.combatants['owner-token'].classResources['dnd5e-pact-slot'].current).toBe(0)


})


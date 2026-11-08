import{createBountifulActivityOriginalNativeSession,readBountifulActivityOriginalOperation,readBountifulActivityMissingOriginalOperation}from'../../pages/maps/bountifulActivityOriginalNative'
import{it,expect,vi}from'vitest'
import{buildActivityCumulativeScene}from'./bountifulActivityCumulative.scene.fixture'
import{normalizeCharacter}from'../../store/characters'
import{syncDnd5eHitPoints}from'./hitPoints'
import{syncCharacterClassResources}from'../../lib/classResources'
import{buildDnd5eSpellAdvancementPlanFromSelections,applyDnd5eSpellAdvancement}from'./spellAdvancement'
import{buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement}from'./levelAdvancement'
import{applyDnd5eInventoryMutation}from'./items'
import{prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction'
import{createDnd5eTurnEconomyCounts}from'./turnEconomy'
import{resolveDnd5eHeadlessAction}from'./headlessCombatEngine'
import{planDnd5eMapResultApplication}from'./mapBridge'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

function growCoreSorcerer(){
 let character=syncDnd5eHitPoints(normalizeCharacter({id:'tele-caster',name:'Lawful Telekinesis caster',rulesetId:'dnd5e-2014-srd-5.1',roomId:'room',roomMemberId:'caster-member',charClass:'术士',level:1,dnd5eClassLevels:{sorcerer:1},dnd5eRaceId:'human',abilities:{str:10,dex:12,con:14,int:10,wis:10,cha:16},dnd5eClassChoices:{classes:{sorcerer:{subclass:'draconic',selections:{'class-skills':['arcana','persuasion'],'draconic-ancestor':['red']}}}}}))
 const initial=buildDnd5eSpellAdvancementPlanFromSelections({classId:'sorcerer',fromClassLevel:0,toClassLevel:1,subclassId:'draconic',selections:character.dnd5eClassChoices!.classes!.sorcerer!.selections});if(!initial)throw Error('Actual initial spell plan required')
 let cantrips=initial.cantripOptions.slice(0,initial.targetCantripCount).map(s=>s.id),spells=initial.spellOptions.slice(0,initial.targetKnownSpellCount).map(s=>s.id)
 const learned=applyDnd5eSpellAdvancement(character,initial,{cantrips,knownSpells:spells},'draconic');if(!learned.ok)throw Error(learned.reason);character=learned.character
 for(let next=2;next<=9;next++){
  const plan=buildDnd5eLevelAdvancementPlan(character,'sorcerer',1,'draconic');if(!plan?.spellAdvancement)throw Error('Actual next level plan required')
  const p=plan.spellAdvancement;cantrips=[...new Set([...cantrips,...p.cantripOptions.map(s=>s.id)])].slice(0,p.targetCantripCount)
  const available=p.spellOptions.map(s=>s.id);spells=[...new Set([...(next===9?['telekinesis']:[]),...spells,...available])].slice(0,p.targetKnownSpellCount)
  const result=applyDnd5eLevelAdvancement(character,{schemaVersion:1,classId:'sorcerer',subclassId:'draconic',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[4,8].includes(next)?[{classLevel:next,choice:{kind:'ability-score',increases:{cha:2}}}]:[],classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...new Set([...r.currentSelections,...r.options.map(o=>o.id)])].slice(0,r.targetLimit)])),spellSelections:{cantrips,knownSpells:spells}})
  if(!result.ok)throw Error(JSON.stringify(result));character=result.character
 }
 const grant=applyDnd5eInventoryMutation([syncCharacterClassResources(character)],{type:'grant',characterId:character.id,templateId:'srd-5.1:item:component-pouch',quantity:1});if(!grant.ok)throw Error(grant.reason);return grant.characters[0]
}

it('actual continuing Telekinesis formula produces only its own private original operation and preserves complete source',async()=>{
 const scene=await buildActivityCumulativeScene();try{
  const caster=growCoreSorcerer(),old=scene.input.prepared,map={...old.map,tokens:[{id:'tele-caster-token',characterId:caster.id,type:'player'as const,dnd5eSide:'player'as const,label:'Telekinesis caster',x:525,y:325,size:1,color:'',emoji:'T',hp:caster.currentHp,maxHp:caster.maxHp},...old.map.tokens.filter(t=>t.id!=='actual-goblin'&&t.id!=='caster-token')]},characters=[caster,...old.characters.filter(c=>c.id!=='caster')],order=map.tokens.map((t,index)=>({tokenId:t.id,label:t.label,roll:25-index,color:'',emoji:''}))
  const action={id:'lawful-telekinesis-cast',mapId:map.id,combatId:'activity-original-telekinesis',sourceMode:'player'as const,status:'pending'as const,roomMemberId:'caster-member',type:'dnd5e-spell-cast'as const,actorTokenId:'tele-caster-token',characterId:caster.id,targetTokenId:'soul-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'telekinesis',castingClassId:'sorcerer'as const,slotLevel:5,targetTokenId:'soul-token'}}
  const prepared=prepareDnd5ePluginSpellCast({action,map,characters,initiativeOrder:order,roomRequiredPlugins:[]});if(!prepared.ok)throw Error(prepared.reason)
  const cast=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:{'telekinesis-caster-d20:soul-token':{values:[18],modifier:0,total:18},'telekinesis-target-d20:soul-token':{values:[10],modifier:0,total:10}}}});expect(cast.result.ok,cast.result.ok?'ok':cast.result.reason).toBe(true);if(!cast.result.ok)throw Error(cast.result.reason)
  expect(cast.application!.characters.find(c=>c.id===caster.id)!.classResources!['dnd5e-spell-slot-5'].current).toBe(0)
  let state=cast.result.state;for(let index=0;index<order.length;index++){const end=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:state.initiativeOrder[state.initiativeIndex]});if(!end.ok)throw Error(end.reason);state=end.state}
  const projection=planDnd5eMapResultApplication({map:cast.application!.map,characters:cast.application!.characters,state,events:[],characterIdByCombatantId:prepared.prepared.characterIdByCombatantId}),controller=state.combatants['tele-caster-token'].classState.activeEffects!.find(e=>e.grantedActivities?.includes('spell:telekinesis:control'))!;expect(controller).toBeDefined()
  const repeat={...action,id:'lawful-telekinesis-repeat',type:'dnd5e-plugin-action'as const,round:state.round,dnd5eSpellCast:undefined,dnd5ePluginAction:{featureId:'srd-5.1:effect-control.spell:telekinesis:control',payload:{activeEffectId:controller.id}}},continued=prepareDnd5ePluginFeatureAction({action:repeat,map:projection.map,characters:projection.characters,initiativeOrder:order,roomRequiredPlugins:[],turnEconomy:createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':tele-caster-token:normal')});if(!continued.ok)throw Error(continued.reason)
  const input={prepared:continued.prepared,rolls:{'telekinesis-caster-d20:soul-token':{values:[18],modifier:0,total:18},'telekinesis-target-d20:soul-token':{values:[1],modifier:0,total:1}}},original=structuredClone(input)

  expect(()=>createBountifulActivityOriginalNativeSession({...input,hostOriginalD20Replay:{}} as never,'soul-token')).toThrow('protected-replay-required')
  const unsupportedPrelude=structuredClone(input);Reflect.set(unsupportedPrelude.prepared,'attackActionTeleport',{destination:{x:600,y:400}});expect(()=>createBountifulActivityOriginalNativeSession(unsupportedPrelude,'soul-token')).toThrow('protected-prelude-required');expect(input).toEqual(original)

  const ordinaryMissing=await resolvePreparedDnd5ePluginFeatureAction({...input,rolls:{}});expect(ordinaryMissing.result.ok).toBe(false);if(!ordinaryMissing.result.ok)expect(ordinaryMissing.result.reason).toBe('invalid-dice')
  for(const sourceSide of[true,false]){
   const partial:Parameters<typeof createBountifulActivityOriginalNativeSession>[0]={...input,rolls:sourceSide?{}:{'telekinesis-caster-d20:soul-token':input.rolls['telekinesis-caster-d20:soul-token']}},missingSession=createBountifulActivityOriginalNativeSession(partial,'soul-token')
   try{const stage=missingSession.run();expect(stage.status).toBe('missing-activity-ability-original');if(stage.status!=='missing-activity-ability-original')throw Error(stage.status);const operation=missingSession.missingOriginal(stage),facts=readBountifulActivityMissingOriginalOperation(operation)
    expect(facts.parentId).toBe(repeat.id);expect(facts.request).toMatchObject({actorId:sourceSide?'tele-caster-token':'soul-token',rollId:sourceSide?'telekinesis-caster-d20:soul-token':'telekinesis-target-d20:soul-token',mode:'normal',count:1,sides:20});expect('values'in facts.request).toBe(false);expect(facts.precedingPools).toHaveLength(sourceSide?0:1);if(!sourceSide)expect(facts.precedingPools[0]).toMatchObject({actorId:'tele-caster-token',values:[18]});expect(facts.effectTimestamp).toBeGreaterThan(0)
    expect(()=>missingSession.operation(stage)).toThrow('actual-issued-original-pause-required');expect(()=>missingSession.missingOriginal(structuredClone(stage))).toThrow('actual-issued-missing-pause-required');expect(()=>readBountifulActivityMissingOriginalOperation({})).toThrow('changed-or-unissued-missing-operation');Reflect.set(stage.request,'actorId','forged');expect(()=>readBountifulActivityMissingOriginalOperation(operation)).toThrow('changed-or-unissued-missing-operation')
   }finally{await missingSession.dispose()}
  }

  const priorB=createBountifulActivityOriginalNativeSession({...input,rolls:{'telekinesis-caster-d20:soul-token':{values:[1],modifier:0,total:1}}},'soul-token');try{const stage=priorB.run();expect(stage.status).toBe('pending-ally-natural-one');if(stage.status!=='pending-ally-natural-one')throw Error(stage.status);const facts=readBountifulActivityOriginalOperation(priorB.operation(stage));expect(facts.request.actorId).toBe('tele-caster-token');expect(facts.pool.rollId).toBe('telekinesis-caster-d20:soul-token');expect(()=>priorB.resumeAllyNaturalOne(stage.occurrence,stage.request)).toThrow('protected-prefix-required')}finally{await priorB.dispose()}
  const invalid=createBountifulActivityOriginalNativeSession({...input,rolls:{'telekinesis-caster-d20:soul-token':{values:[0],modifier:0,total:0}}},'soul-token');try{const stage=invalid.run();expect(stage.status).not.toBe('missing-activity-ability-original');expect(()=>invalid.missingOriginal(stage)).toThrow('actual-issued-missing-pause-required')}finally{await invalid.dispose()}
  const native=createBountifulActivityOriginalNativeSession(input,'soul-token')
  try{
   const stage=native.run();expect(stage.status).toBe('pending-ally-natural-one');if(stage.status!=='pending-ally-natural-one')throw Error(stage.status)
   const operation=native.operation(stage),facts=readBountifulActivityOriginalOperation(operation)
   expect(facts.parentId).toBe(repeat.id);expect(facts.request).toMatchObject({actorId:'soul-token',kind:'ability-check',originalRolls:[1]});expect(facts.pool).toMatchObject({actorId:'soul-token',rollId:'telekinesis-target-d20:soul-token',mode:'normal',values:[1]});expect(facts.pool.checkId).toContain('telekinesis-contest');expect(facts.effectTimestamp).toBeGreaterThan(0)
   expect(facts.source).toEqual(input);expect(()=>readBountifulActivityOriginalOperation({})).toThrow('changed-or-unissued-operation');expect(()=>readBountifulActivityOriginalOperation(JSON.parse(JSON.stringify(operation)))).toThrow('changed-or-unissued-operation');expect(()=>native.operation(structuredClone(stage))).toThrow('actual-issued-original-pause-required')
   const other=createBountifulActivityOriginalNativeSession(input,'soul-token');try{expect(()=>other.operation(stage)).toThrow('actual-issued-original-pause-required')}finally{await other.dispose()}
   const casterFirst=createBountifulActivityOriginalNativeSession(input,'tele-caster-token');try{const casterStage=casterFirst.run();expect(casterStage.status).toBe('original-d20-ready');expect(()=>casterFirst.operation(casterStage)).toThrow('actual-issued-original-pause-required')}finally{await casterFirst.dispose()}
   facts.source.prepared.state.combatants['soul-token'].currentHp=999;expect(readBountifulActivityOriginalOperation(operation).source).toEqual(input)
   const lucky=native.resumeAllyNaturalOne(stage.occurrence,stage.request);expect(lucky.status).toBe('pending-ally-natural-one');if(lucky.status==='pending-ally-natural-one')expect(lucky.request.nativeLucky).toBe(true);expect(()=>native.operation(lucky)).toThrow('actual-issued-original-pause-required')
   stage.snapshot.combatants['soul-token'].currentHp++;expect(()=>readBountifulActivityOriginalOperation(operation)).toThrow('changed-or-unissued-operation')
   expect(input).toEqual(original)
  }finally{await native.dispose()}
 }finally{scene.dispose()}
})

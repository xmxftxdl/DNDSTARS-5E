import{it,expect,vi}from'vitest'
import{buildMonsterZeroScene}from'./damageZeroMonsterOriginal.scene.fixture'
import{normalizeCharacter}from'../../store/characters'
import{syncDnd5eHitPoints}from'./hitPoints'
import{syncCharacterClassResources}from'../../lib/classResources'
import{buildDnd5eSpellAdvancementPlanFromSelections,applyDnd5eSpellAdvancement}from'./spellAdvancement'
import{buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement}from'./levelAdvancement'
import{applyDnd5eInventoryMutation}from'./items'
import{prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{prepareDnd5ePluginFeatureAction}from'./pluginFeatureAction'
import{createDnd5eTurnEconomyCounts}from'./turnEconomy'
import{withAllyNaturalOneCheckpoints,withDnd5eOriginalD20ReadyObserver}from'./allyNaturalOneCheckpoint'
import{resolveDnd5eHeadlessAction}from'./headlessCombatEngine'
import{planDnd5eMapResultApplication}from'./mapBridge'
import{captureSecondChancePluginFeatureBoundary}from'../../pages/maps/secondChancePluginFeatureBoundary'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
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

it.each([{choice:'decline',replacement:undefined},{choice:'use-one',replacement:1},{choice:'use-eighteen',replacement:18}])('actual Telekinesis original ability1 B-decline then optional Native Lucky %s stays in the original facade',async scenario=>{
 const scene=await buildMonsterZeroScene();try{
  const caster=growCoreSorcerer(),old=scene.input.prepared,map={...old.map,tokens:[{id:'tele-caster-token',characterId:caster.id,type:'player'as const,dnd5eSide:'player'as const,label:'Telekinesis caster',x:525,y:325,size:1,color:'',emoji:'T',hp:caster.currentHp,maxHp:caster.maxHp},...old.map.tokens.filter(t=>t.id!=='actual-goblin'&&t.id!=='caster-token')]},characters=[caster,...old.characters.filter(c=>c.id!=='caster')],order=map.tokens.map((t,index)=>({tokenId:t.id,label:t.label,roll:25-index,color:'',emoji:''}))
  const action={id:'lawful-telekinesis-cast',mapId:map.id,combatId:'activity-original-telekinesis',sourceMode:'player'as const,status:'pending'as const,roomMemberId:'caster-member',type:'dnd5e-spell-cast'as const,actorTokenId:'tele-caster-token',characterId:caster.id,targetTokenId:'soul-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'telekinesis',castingClassId:'sorcerer'as const,slotLevel:5,targetTokenId:'soul-token'}}
  const prepared=prepareDnd5ePluginSpellCast({action,map,characters,initiativeOrder:order,roomRequiredPlugins:[]});if(!prepared.ok)throw Error(prepared.reason)
  const cast=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:{'telekinesis-caster-d20:soul-token':{values:[18],modifier:0,total:18},'telekinesis-target-d20:soul-token':{values:[10],modifier:0,total:10}}}});expect(cast.result.ok,cast.result.ok?'ok':cast.result.reason).toBe(true);if(!cast.result.ok)throw Error(cast.result.reason)
  expect(cast.application!.characters.find(c=>c.id===caster.id)!.classResources!['dnd5e-spell-slot-5'].current).toBe(0)
  let state=cast.result.state;for(let index=0;index<order.length;index++){const end=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:state.initiativeOrder[state.initiativeIndex]});if(!end.ok)throw Error(end.reason);state=end.state}
  const projection=planDnd5eMapResultApplication({map:cast.application!.map,characters:cast.application!.characters,state,events:[],characterIdByCombatantId:prepared.prepared.characterIdByCombatantId}),controller=state.combatants['tele-caster-token'].classState.activeEffects!.find(e=>e.grantedActivities?.includes('spell:telekinesis:control'))!;expect(controller).toBeDefined()
  const repeat={...action,id:'lawful-telekinesis-repeat',type:'dnd5e-plugin-action'as const,round:state.round,dnd5eSpellCast:undefined,dnd5ePluginAction:{featureId:'srd-5.1:effect-control.spell:telekinesis:control',payload:{activeEffectId:controller.id}}},continued=prepareDnd5ePluginFeatureAction({action:repeat,map:projection.map,characters:projection.characters,initiativeOrder:order,roomRequiredPlugins:[],turnEconomy:createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':tele-caster-token:normal')});if(!continued.ok)throw Error(continued.reason)
  const input={prepared:continued.prepared,rolls:{'telekinesis-caster-d20:soul-token':{values:[18],modifier:0,total:18},'telekinesis-target-d20:soul-token':{values:[1],modifier:0,total:1}}},original=structuredClone(input),observed:unknown[]=[]
  const boundary=captureSecondChancePluginFeatureBoundary(input)

  try{
   const session=createDnd5eOriginalD20Session(input,value=>boundary.resolve(value.prepared.state) as never,'soul-token','ability-check')
   try{
    const bounty=session.run(input.prepared.state);expect(bounty.status).toBe('pending-ally-natural-one');if(bounty.status!=='pending-ally-natural-one')throw Error(bounty.status)
    expect(bounty.request).toMatchObject({actorId:'soul-token',kind:'ability-check',originalRolls:[1]});expect(bounty.request.options.some(option=>option.ownerId==='helper-token')).toBe(true)
    const lucky=session.resumeAllyNaturalOne(input.prepared.state,bounty.occurrence,bounty.request);expect(lucky.status).toBe('pending-ally-natural-one');if(lucky.status!=='pending-ally-natural-one')throw Error(lucky.status)
    const unanswered=session.run(input.prepared.state);expect(unanswered.status).toBe('pending-ally-natural-one');if(unanswered.status==='pending-ally-natural-one'){expect(unanswered.occurrence).toBe(lucky.occurrence);expect(unanswered.request).toEqual(lucky.request)}
    expect(lucky.request).toMatchObject({nativeLucky:true,actorId:'soul-token',originalRolls:[1]});const option=lucky.request.options[0],decision=scenario.replacement===undefined?undefined:{...option,replacement:scenario.replacement}
    const ready=withDnd5eOriginalD20ReadyObserver(request=>observed.push(request),()=>session.resumeAllyNaturalOne(input.prepared.state,lucky.occurrence,lucky.request,decision));expect(ready.status).toBe('original-d20-ready');if(ready.status!=='original-d20-ready')throw Error(ready.status)
    expect(ready.request).toMatchObject({actorId:'soul-token',kind:'ability-check',originalRolls:[1],values:[scenario.replacement??1],finalizedDice:scenario.replacement===undefined?[]:[0]});expect(ready.snapshot.combatants['helper-token'].turn.reactionAvailable).toBe(true)
   }finally{session.cancel()}
  }finally{await boundary.abort()}
  const completion=captureSecondChancePluginFeatureBoundary(input),requests:unknown[]=[]
  try{
   const native=withAllyNaturalOneCheckpoints(request=>{requests.push(request);if(request.nativeLucky&&scenario.replacement!==undefined)return{...request.options[0],replacement:scenario.replacement};return undefined},()=>completion.resolve(input.prepared.state),undefined,true)
   const final=await completion.complete(native);expect(final.result.ok,final.result.ok?'ok':final.result.reason).toBe(true);if(!final.result.ok)throw Error(final.result.reason)
   expect(final.result.state.combatants['tele-caster-token'].turn.actionAvailable).toBe(false);expect(final.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(true);expect(final.result.state.combatants['soul-token'].currentHp).toBe(2)
   expect(final.result.state.combatants['tele-caster-token'].concentrating).toBe(true);expect(final.application!.characters.find(c=>c.id===caster.id)!.classResources!['dnd5e-spell-slot-5'].current).toBe(0)
   expect(final.result.events.filter(event=>event.type==='ally-natural-one-rerolled')).toHaveLength(0);expect(final.result.events.filter(event=>event.type==='halfling-lucky-rerolled')).toHaveLength(scenario.replacement===undefined?0:1);expect(requests).toHaveLength(2)
  }finally{await completion.abort()}
  expect(input).toEqual(original);expect(observed.length).toBeGreaterThan(0)
 }finally{scene.dispose()}
})

import{casterFor}from'./bountifulPairedCurseCaster.scene.fixture'
import{createDnd5eMapCombatSnapshot}from'../mapBridge'
import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from'../activities/dnd5eCoreSpellActivities'
/** True UI authority-patch normalization occurs before re-preparing the same lawful repeat action. Growth, real cast and full turn cycle are unchanged. */
import{buildActivityCumulativeScene}from'./bountifulActivityCumulative.scene.fixture'
import{normalizeCharacter,projectDnd5eAuthorityCharacterPatch}from'../../../store/characters'
import{syncDnd5eHitPoints}from'../hitPoints'
import{syncCharacterClassResources}from'../../../lib/classResources'
import{buildDnd5eSpellAdvancementPlanFromSelections,applyDnd5eSpellAdvancement}from'../spellAdvancement'
import{buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement}from'../levelAdvancement'
import{applyDnd5eInventoryMutation}from'../items'
import{prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast}from'../pluginSpellTransaction'
import{prepareDnd5ePluginFeatureAction}from'../pluginFeatureAction'
import{createDnd5eTurnEconomyCounts}from'../turnEconomy'
import{resolveDnd5eHeadlessAction}from'../headlessCombatEngine'
import{planDnd5eMapResultApplication}from'../mapBridge'
function growCoreSorcerer(){
 let character=syncDnd5eHitPoints(normalizeCharacter({id:'tele-caster',name:'Lawful Telekinesis caster',rulesetId:'dnd5e-2014-srd-5.1',roomId:'room',roomMemberId:'caster-member',charClass:'术士',level:1,dnd5eClassLevels:{sorcerer:1},dnd5eRaceId:'halfling',race:'半身人',abilities:{str:10,dex:12,con:14,int:10,wis:10,cha:16},dnd5eClassChoices:{classes:{sorcerer:{subclass:'draconic',selections:{'class-skills':['arcana','persuasion'],'draconic-ancestor':['red']}}}}}))
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
export async function buildFirstOwnPairedActivityOriginalSource(){
 const scene=await buildActivityCumulativeScene();
  const caster=growCoreSorcerer(),curse=await casterFor('bestow-curse'),old=scene.input.prepared;let map={...old.map,tokens:[{id:'support-token',characterId:curse.id,type:'player'as const,dnd5eSide:'enemy'as const,label:curse.name,x:525,y:375,size:1,color:'',emoji:'C',hp:curse.currentHp,maxHp:curse.maxHp},{id:'tele-caster-token',characterId:caster.id,type:'player'as const,dnd5eSide:'player'as const,label:'Telekinesis caster',x:525,y:325,size:1,color:'',emoji:'T',hp:caster.currentHp,maxHp:caster.maxHp},...old.map.tokens.filter(t=>t.id!=='actual-goblin'&&t.id!=='caster-token'&&t.id!=='helper-token').map(t=>t.id==='foe-token'?{...t,dnd5eSide:'player'as const,x:575,y:375}:t)]},characters=[curse,caster,...old.characters.filter(c=>c.id!=='caster'&&c.id!=='helper')],order=map.tokens.map((t,index)=>({tokenId:t.id,label:t.label,roll:25-index,color:'',emoji:''}))
  const snap=createDnd5eMapCombatSnapshot({map,characters,combatId:'activity-original-telekinesis',initiativeOrder:order,geometry:null});ensureDnd5eCoreSpellActivitiesRegisteredV1();const cursed=resolveDnd5eHeadlessAction(snap.state,{type:'plugin-spell-activity',actorId:'support-token',pluginAction:{type:'plugin',pluginId:'srd-5.1',actionId:'spell:bestow-curse',transactionId:'real-paired-curse',actorId:'support-token',targetId:'tele-caster-token',targetIds:['tele-caster-token'],distanceFeet:5,castLevel:3,payload:{activityChoices:{mode:'ability',ability:'cha'}},rolls:{'bestow-curse-save:tele-caster-token':{values:[2],modifier:0,total:2}}},spell:{castingClassId:'cleric',spellId:'bestow-curse',spellName:'Bestow Curse',spellLevel:3,slotLevel:3,castingTime:'action',declaredTargetIds:['tele-caster-token'],concentrationRounds:10,concentrationTargetIds:['tele-caster-token'],spellSchool:'necromancy'}});if(!cursed.ok)throw Error('Actual paired curse:'+cursed.reason);const curseEnd=resolveDnd5eHeadlessAction(cursed.state,{type:'end-turn',actorId:'support-token'});if(!curseEnd.ok)throw Error(curseEnd.reason);const curseProjection=planDnd5eMapResultApplication({map,characters,state:curseEnd.state,events:[...cursed.events,...curseEnd.events],characterIdByCombatantId:snap.characterIdByCombatantId});map=curseProjection.map;characters=curseProjection.characters;const action={id:'lawful-telekinesis-cast',mapId:map.id,combatId:'activity-original-telekinesis',sourceMode:'player'as const,status:'pending'as const,roomMemberId:'caster-member',type:'dnd5e-spell-cast'as const,actorTokenId:'tele-caster-token',characterId:caster.id,targetTokenId:'foe-token',round:curseEnd.state.round,initiativeIndex:curseEnd.state.initiativeIndex,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'telekinesis',castingClassId:'sorcerer'as const,slotLevel:5,targetTokenId:'foe-token'}}
  const prepared=prepareDnd5ePluginSpellCast({action,map,characters,initiativeOrder:order,roomRequiredPlugins:[]});if(!prepared.ok)throw Error(prepared.reason)
  const cast=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:{'telekinesis-caster-d20:foe-token':{values:[18,18],modifier:0,total:36},'telekinesis-target-d20:foe-token':{values:[10],modifier:0,total:10}}}});if(!cast.result.ok)throw Error(cast.result.reason)
  
  let state=cast.result.state;for(let index=0;index<order.length;index++){const end=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:state.initiativeOrder[state.initiativeIndex]});if(!end.ok)throw Error(end.reason);state=end.state}
  const projection=planDnd5eMapResultApplication({map:cast.application!.map,characters:cast.application!.characters,state,events:[],characterIdByCombatantId:prepared.prepared.characterIdByCombatantId}),controller=state.combatants['tele-caster-token'].classState.activeEffects!.find(e=>e.grantedActivities?.includes('spell:telekinesis:control'))!;if(!controller)throw Error('Actual Telekinesis controller required')
  const repeat={...action,id:'lawful-telekinesis-repeat',type:'dnd5e-plugin-action'as const,round:state.round,dnd5eSpellCast:undefined,dnd5ePluginAction:{featureId:'srd-5.1:effect-control.spell:telekinesis:control',payload:{activeEffectId:controller.id,activityChoices:{movement:'hold'}}}},continued=prepareDnd5ePluginFeatureAction({action:repeat,map:projection.map,characters:projection.characters.map(character=>projectDnd5eAuthorityCharacterPatch(character,{})),initiativeOrder:order,roomRequiredPlugins:[],turnEconomy:createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':tele-caster-token:normal')});if(!continued.ok)throw Error(continued.reason)
  const input={prepared:continued.prepared,rolls:{'telekinesis-caster-d20:foe-token':{values:[18],modifier:0,total:18},'telekinesis-target-d20:foe-token':{values:[18],modifier:0,total:18}}},original=structuredClone(input)
 return{input,original,scene,dispose:()=>scene.dispose()};
}

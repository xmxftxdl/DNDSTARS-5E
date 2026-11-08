import {normalizeCharacter} from '../../store/characters'
import {applyDnd5eInitialSubclassBuildGrantsV1} from './initialSubclassBuildGrants'
import {buildDnd5eSpellAdvancementPlanFromSelections,applyDnd5eSpellAdvancement} from './spellAdvancement'
import {buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement} from './levelAdvancement'
import {restoreClassResources} from '../../lib/classResources'
import {syncDnd5eHitPoints} from './hitPoints'
export function growDepthGiftWarlock(invocationId:string,targetLevel=5,cha=16,wantedSpell?:string,wantedCantrip?:string){
 let actor=normalizeCharacter({id:'depth-breather',name:'Depth Breather',charClass:'邪术师',level:1,dnd5eClassLevels:{warlock:1},dnd5eRaceId:'human',race:'人类',hitPointMaximumMode:'fixed',abilities:{str:10,dex:12,con:14,int:10,wis:10,cha},savingThrows:['wis','cha'],skills:['arcana','deception'],dnd5eClassChoices:{classes:{warlock:{subclass:'fiend',selections:{'class-skills':['arcana','deception']}}}}})
 const initial=applyDnd5eInitialSubclassBuildGrantsV1(actor);if(!initial.ok)throw Error(initial.reason);actor=initial.character
 const first=buildDnd5eSpellAdvancementPlanFromSelections({classId:'warlock',fromClassLevel:0,toClassLevel:1,subclassId:'fiend',selections:actor.dnd5eClassChoices!.classes!.warlock!.selections});if(!first)throw Error('No real Warlock1 spell plan')
 const spells=applyDnd5eSpellAdvancement(actor,first,{cantrips:first.cantripOptions.filter(o=>!['light','sacred-flame'].includes(o.id)).sort((a,b)=>Number(b.id===wantedCantrip)-Number(a.id===wantedCantrip)).slice(0,first.targetCantripCount).map(o=>o.id),knownSpells:first.spellOptions.slice(0,first.targetKnownSpellCount).map(o=>o.id)},'fiend');if(!spells.ok)throw Error(spells.reason);actor=restoreClassResources(spells.character,'long-rest')
 for(let level=2;level<=targetLevel;level++){
  const plan=buildDnd5eLevelAdvancementPlan(actor,'warlock',1,'fiend');if(!plan?.spellAdvancement)throw Error('No real level plan');const s=plan.spellAdvancement
  const result=applyDnd5eLevelAdvancement(actor,{schemaVersion:1,classId:'warlock',subclassId:'fiend',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{dex:2}}})),classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,r.key==='pact-boon'?['blade']:r.key==='eldritch-invocations'?['armor-of-shadows','devils-sight',invocationId].slice(0,r.targetLimit):[...r.currentSelections,...r.options.filter(o=>!r.currentSelections.includes(o.id)).map(o=>o.id)].slice(0,r.targetLimit)])),contentChoiceSelections:Object.fromEntries(plan.contentAdvancements.map(c=>[c.contentId,Object.fromEntries(c.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))])),spellSelections:{cantrips:[...s.previousCantrips,...s.cantripOptions.filter(o=>!s.previousCantrips.includes(o.id)).map(o=>o.id)].slice(0,s.targetCantripCount),knownSpells:[...s.previousKnownSpells,...s.spellOptions.filter(o=>!s.previousKnownSpells.includes(o.id)).sort((a,b)=>Number(b.id===wantedSpell)-Number(a.id===wantedSpell)).map(o=>o.id)].slice(0,s.targetKnownSpellCount)}})
  if(!result.ok)throw Error('Warlock'+level+':'+result.reason);actor=restoreClassResources(result.character,'long-rest')
 }
 return syncDnd5eHitPoints(actor)
}

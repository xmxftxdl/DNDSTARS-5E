import {normalizeCharacter} from '../../store/characters'
import {applyDnd5eSpellAdvancement,buildDnd5eSpellAdvancementPlanFromSelections} from './spellAdvancement'
import {buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement} from './levelAdvancement'
import {applyDnd5eContentBuildChoicesV1} from './buildChoices'
import {dnd5ePluginSubclassDefinition} from './pluginApi'
import {syncCharacterClassResources} from '../../lib/classResources'
import {subclassId} from './stormSorcery.passives.native.fixture'
export function growStorm(level=1){
 let c=normalizeCharacter({id:'storm',name:'Storm',charClass:'术士',rulesetId:'dnd5e-2014-srd-5.1',level:1,dnd5eClassLevels:{sorcerer:1},abilities:{str:10,dex:12,con:14,int:10,wis:10,cha:16},dnd5eClassChoices:{classes:{sorcerer:{subclass:subclassId,selections:{'class-skills':['arcana','persuasion']}}}}})
 const first=buildDnd5eSpellAdvancementPlanFromSelections({classId:'sorcerer',fromClassLevel:0,toClassLevel:1,subclassId,selections:c.dnd5eClassChoices!.classes!.sorcerer!.selections});if(!first)throw Error('Real Sorcerer1 spell plan required');let cantrips=first.cantripOptions.slice(0,first.targetCantripCount).map(s=>s.id),spells=first.spellOptions.slice(0,first.targetKnownSpellCount).map(s=>s.id)
 const learned=applyDnd5eSpellAdvancement(c,first,{cantrips,knownSpells:spells},subclassId);if(!learned.ok)throw Error(learned.reason);c=learned.character
 const sub=dnd5ePluginSubclassDefinition(subclassId);if(!sub)throw Error('Registered actual source required');const built=applyDnd5eContentBuildChoicesV1({character:c,contentId:sub.id,advancements:sub.advancements?.filter(a=>a.level<=1)});if(!built.ok)throw Error(built.reason);c=built.character
 for(let next=2;next<=level;next++){const plan=buildDnd5eLevelAdvancementPlan(c,'sorcerer',1,subclassId);if(!plan?.spellAdvancement)throw Error('Actual next Sorcerer plan required');const p=plan.spellAdvancement;cantrips=[...new Set([...cantrips,...p.cantripOptions.map(s=>s.id)])].slice(0,p.targetCantripCount);spells=[...new Set([...spells,...p.spellOptions.map(s=>s.id)])].slice(0,p.targetKnownSpellCount);const ability=c.abilities.dex<20?'dex':c.abilities.con<20?'con':'str';const result=applyDnd5eLevelAdvancement(c,{schemaVersion:1,classId:'sorcerer',subclassId,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[4,8,12,16,19].includes(next)?[{classLevel:next,choice:{kind:'ability-score',increases:{[ability]:2}}}]:[],classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...new Set([...r.currentSelections,...r.options.map(o=>o.id)])].slice(0,r.targetLimit)])),spellSelections:{cantrips,knownSpells:spells}});if(!result.ok)throw Error(JSON.stringify(result));c=result.character}
 return syncCharacterClassResources(c)
}

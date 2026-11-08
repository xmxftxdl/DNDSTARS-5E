import {buildTempestuousLandingActors} from './tempestuousHostOriginalActors.fixture'
import {applyDnd5eLevelAdvancement,buildDnd5eLevelAdvancementPlan} from '../levelAdvancement'
import {restoreClassResources} from '../../../lib/classResources'
import {projectDnd5eAuthorityCharacterPatch} from '../../../store/characters'

export async function growActualWardStorm(){
 const original=await buildTempestuousLandingActors({roomId:'room',memberId:'dm',hostMemberId:'dm'});let storm=original.characters[0]
 for(let level=2;level<=3;level++){
  const plan=buildDnd5eLevelAdvancementPlan(storm,'sorcerer',1,'local.xge.repaired.archer93:storm-sorcery');if(!plan?.spellAdvancement)throw Error('Actual Storm advancement required')
  const s=plan.spellAdvancement,known=[...s.previousKnownSpells,...['scorching-ray',...s.spellOptions.map(o=>o.id)].filter(id=>s.spellOptions.some(o=>o.id===id)&&!s.previousKnownSpells.includes(id))].filter((id,i,a)=>a.indexOf(id)===i).slice(0,s.targetKnownSpellCount)
  const next=applyDnd5eLevelAdvancement(storm,{schemaVersion:1,classId:'sorcerer',subclassId:'local.xge.repaired.archer93:storm-sorcery',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...r.options.map(o=>o.id).filter(id=>!r.currentSelections.includes(id))].slice(0,r.targetLimit)])),contentChoiceSelections:Object.fromEntries(plan.contentAdvancements.map(c=>[c.contentId,Object.fromEntries(c.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))])),spellSelections:{cantrips:[...s.previousCantrips,...s.cantripOptions.map(o=>o.id).filter(id=>!s.previousCantrips.includes(id))].slice(0,s.targetCantripCount),knownSpells:known}})
  if(!next.ok)throw Error(next.reason);storm=next.character
 }
 return projectDnd5eAuthorityCharacterPatch(restoreClassResources(storm,'long-rest'),{})
}

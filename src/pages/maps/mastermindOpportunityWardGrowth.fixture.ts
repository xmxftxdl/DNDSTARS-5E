import{expect}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import{applyDnd5eLevelAdvancement,buildDnd5eLevelAdvancementPlan}from'../../rulesets/dnd5e/levelAdvancement'
import{applyDnd5eLongRestBenefits}from'../../rulesets/dnd5e/campaignTimeRules'
export function grownWardCover(){
 let cover=normalizeCharacter({id:'cover',name:'Actual Open Hand',charClass:'武僧',level:1,dnd5eClassLevels:{monk:1},abilities:{str:10,dex:14,con:12,int:10,wis:16,cha:10},currentHp:9,maxHp:9})
 for(let level=2;level<=11;level++){const plan=buildDnd5eLevelAdvancementPlan(cover,'monk',1,'open-hand');if(!plan)throw Error('Real Monk advance plan required');const next=applyDnd5eLevelAdvancement(cover,{schemaVersion:1,classId:'monk',subclassId:'open-hand',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{wis:2}}})),classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,r.options.slice(0,r.targetLimit).map(o=>o.id)])),contentChoiceSelections:Object.fromEntries(plan.contentAdvancements.map(a=>[a.contentId,Object.fromEntries(a.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))]))});if(!next.ok)throw Error('Actual Monk growth '+level+':'+next.reason);cover=next.character}
 expect(cover.dnd5eCombatState?.tranquilityActive).not.toBe(true);cover=applyDnd5eLongRestBenefits(cover,480);expect(cover.dnd5eCombatState?.tranquilityActive).toBe(true)
return cover}

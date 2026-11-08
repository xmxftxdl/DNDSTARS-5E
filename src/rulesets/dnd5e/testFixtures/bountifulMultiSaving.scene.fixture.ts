import{trueHalfSavingSource}from'./bountifulInitialBraveSaving.scene.fixture'
import{buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement}from'../levelAdvancement'
import{restoreClassResources}from'../../../lib/classResources'
import{prepareDnd5ePluginSpellCast}from'../pluginSpellTransaction'
import{activeDnd5eRulesPluginRequirements}from'../pluginApi'

/** Actual Wizard1 spellbook is retained while lawful advancement supplies the
 * second-level slot that the registered Cause Fear activity uses for two targets. */
export async function trueMultiSavingSource(secondTargetId:'helper-token'|'caster-token'='helper-token'){
 const initial=await trueHalfSavingSource()
 try{
  const base=initial.source.prepared;let wizard=base.characters.find(c=>c.id==='support')!
  for(let level=2;level<=3;level++){
   const plan=buildDnd5eLevelAdvancementPlan(wizard,'wizard',1,'evocation');if(!plan?.spellAdvancement)throw Error('Actual Wizard level plan required')
   const sp=plan.spellAdvancement,book=[...sp.previousWizardSpellbook]
   for(const option of sp.spellOptions)if(book.length<(sp.targetWizardSpellbookCount??0)&&!book.includes(option.id))book.push(option.id)
   const choices=Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...r.options.map(o=>o.id).filter(id=>!r.currentSelections.includes(id))].slice(0,r.targetLimit)]))
   const content=Object.fromEntries(plan.contentAdvancements.map(row=>[row.contentId,Object.fromEntries(row.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))]))
   const next=applyDnd5eLevelAdvancement(wizard,{schemaVersion:1,classId:'wizard',subclassId:'evocation',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],classChoiceSelections:choices,contentChoiceSelections:content,spellSelections:{cantrips:sp.cantripOptions.slice(0,sp.targetCantripCount).map(s=>s.id),wizardSpellbook:book}})
   if(!next.ok)throw Error(next.reason);wizard=restoreClassResources(next.character,'long-rest')
  }
  if(wizard.level!==3||wizard.classResources?.['dnd5e-spell-slot-2']?.current!==2)throw Error('True Wizard3 and two second-level slots required')
  const characters=base.characters.map(c=>c.id===wizard.id?wizard:c),map={...base.map,tokens:base.map.tokens.map(t=>({...t,...(t.characterId===wizard.id?{hp:wizard.currentHp,maxHp:wizard.maxHp}:{}),...(t.id===secondTargetId?{dnd5eSide:'player' as const}:{})}))}
  const order=map.tokens.map((t,i)=>({tokenId:t.id,slotId:t.id+':normal',label:t.label,roll:30-i,color:'',emoji:''}))
  const action={...base.action,id:'actual-Wizard3-CauseFear-two-targets',combatId:'actual-multi-saving',dnd5eSpellCast:{...base.action.dnd5eSpellCast!,slotLevel:2,targetTokenId:'foe-token',targetTokenIds:['foe-token',secondTargetId]}}
  const prepared=prepareDnd5ePluginSpellCast({map,characters,roomRequiredPlugins:activeDnd5eRulesPluginRequirements(),initiativeOrder:order,action})
  if(!prepared.ok)throw Error('Actual upcast Cause Fear:'+prepared.reason)
  if(prepared.prepared.targets.length!==2)throw Error('Actual registered upcast target count required')
  return{prepared:prepared.prepared,dispose:initial.dispose}
 }catch(error){initial.dispose();throw error}
}
export async function trueMultiHumanBSource(){const scene=await trueMultiSavingSource('caster-token');return{source:{prepared:scene.prepared,currentRoom:{maps:[scene.prepared.map],characters:scene.prepared.characters},rolls:{activityRolls:{}}},dispose:scene.dispose}}

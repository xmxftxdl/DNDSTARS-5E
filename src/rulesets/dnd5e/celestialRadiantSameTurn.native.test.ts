import {it,expect} from 'vitest'
import {celestialRadiantSelectedBundle} from './celestialRadiantSelected.fixture'
import {growSearingCelestial} from './celestialLawfulGrowth.fixture'
import {radiantSelectedScene} from './celestialRadiantSelectedScene.fixture'
import {buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement} from './levelAdvancement'
import {restoreClassResources} from '../../lib/classResources'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {withDnd5eSpellDamageSelectedAbilityBonus} from './spellDamageSelectedAbilityBonus'
import {FIGHTER_RESOURCE_KEYS} from './fighter'
it('genuine Celestial6 Fighter2 uses actual Action Surge for two distinct spell casts in the same native turn, with one bonus per cast and no per-turn limit',()=>{
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(celestialRadiantSelectedBundle()));try{
  let actor=growSearingCelestial(6);const records=[]
  for(let level=1;level<=2;level++){
   const plan=buildDnd5eLevelAdvancementPlan(actor,'fighter',1);expect(plan).toBeDefined();if(!plan)throw Error('Actual multiclass Fighter plan required')
   const result=applyDnd5eLevelAdvancement(actor,{schemaVersion:1,classId:'fighter',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],fighterFightingStyles:['defense'],classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...r.options.filter(o=>!r.currentSelections.includes(o.id)).map(o=>o.id)].slice(0,r.targetLimit)])),contentChoiceSelections:Object.fromEntries(plan.contentAdvancements.map(c=>[c.contentId,Object.fromEntries(c.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))]))});expect(result.ok,result.ok?'actual-level-up':result.reason).toBe(true);if(!result.ok)throw Error(result.reason);actor=restoreClassResources(result.character,'long-rest');records.push({classId:'fighter',classLevel:level,totalLevel:actor.level})
  }
  expect(records).toEqual([{classId:'fighter',classLevel:1,totalLevel:7},{classId:'fighter',classLevel:2,totalLevel:8}]);expect(actor.dnd5eClassLevels).toMatchObject({warlock:6,fighter:2});expect(actor.dnd5ePluginFeatureIds??[]).toEqual([]);const f=radiantSelectedScene(actor),before=structuredClone(f.prepared.state),first=withDnd5eSpellDamageSelectedAbilityBonus(options=>options[0].featureId,()=>resolvePreparedDnd5eSpellCast({prepared:f.prepared,effectRolls:[4,4],savingThrowD20:1}));expect(first.result.ok).toBe(true);expect(first.result.state.combatants.enemy.currentHp).toBe(48)
  const surge=resolveDnd5eHeadlessAction(first.result.state,{type:'fighter-action-surge',actorId:'caster',resourceKey:FIGHTER_RESOURCE_KEYS.actionSurge,alreadyUsedThisTurn:false});expect(surge.ok,surge.ok?'actual-surge':surge.reason).toBe(true);expect(surge.state.combatants.caster.classResources[FIGHTER_RESOURCE_KEYS.actionSurge].current).toBe(0)
  const secondParent=f.input.action.id+':second',second=withDnd5eSpellDamageSelectedAbilityBonus(options=>options[0].featureId,()=>resolveDnd5eHeadlessAction(surge.state,{type:'cast-spell',castInstanceId:secondParent,actorId:'caster',castingClassId:'warlock',spellId:'sacred-flame',slotLevel:0,targetId:'other',savingThrowD20:1,effectRolls:[4,4]}));expect(second.ok,second.ok?'actual-second-spell':second.reason).toBe(true);expect(second.state.combatants.other.currentHp).toBe(48);expect(second.state.round).toBe(first.result.state.round);expect(second.state.initiativeIndex).toBe(first.result.state.initiativeIndex);expect(first.result.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied')).toHaveLength(1);expect(second.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied')).toHaveLength(1);expect(Object.keys(second.state.combatants.caster.classState.spellDamageSelectedAbilityBonusUses??{})).toHaveLength(2);expect(f.prepared.state).toEqual(before)
 }finally{dispose()}
})

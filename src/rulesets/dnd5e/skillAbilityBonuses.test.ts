

import {it,expect} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eSkillCheckModifier} from './checks'
it('projects a permanent imported ability-modifier skill bonus without activation',async()=>{
 const {migrateCharacterToDnd5e,createCombatantFromDnd5eCharacter}=await import('./character')
 const {startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eEnvironmentalSkillBonus}=await import('./headlessCombatEngine')
 const namespace='test.courtier-passive'
 const bundle:any={format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:namespace,name:'Passive check probe',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Local tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'courtier',name:'Passive check probe',automation:automationCapabilityFromLegacyStatus('full'),payload:{id:'courtier',name:'Passive check probe',summary:'Synthetic contract probe',description:'Synthetic contract probe',automation:'full',classRequirements:[{classId:'fighter',minimumLevel:7}]},effects:[{schemaVersion:1,id:'courtier-bonus',name:'Passive check bonus',duration:{kind:'permanent'},stacking:'unique-by-source',modifiers:[{kind:'ability-check',mode:'add',ability:'cha',skill:'persuasion',value:{kind:'reference',reference:{kind:'actor-ability-modifier',ability:'wis'}}}]}]}]}
 const roundtrip=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(roundtrip.bundle))
 try{
  for(const score of [8,10,16,20]){
   const hero=normalizeCharacter({id:'hero',currentHp:20,maxHp:20,charClass:'战士',level:7,dnd5eClassLevels:{fighter:7},dnd5ePluginFeatureIds:[namespace+':courtier'],skills:[],abilities:{str:10,dex:10,con:10,int:10,wis:score,cha:14}})
   const restored=JSON.parse(JSON.stringify(hero)),before=structuredClone(restored)
   expect(dnd5eSkillCheckModifier(restored,'persuasion'),`wis=${score}`).toBe(2+Math.floor((score-10)/2))
   expect(dnd5eSkillCheckModifier(restored,'deception')).toBe(2)
   expect(dnd5eSkillCheckModifier({...restored,dnd5ePluginFeatureIds:[]},'persuasion')).toBe(2)
   expect(dnd5eSkillCheckModifier({...restored,level:6,dnd5eClassLevels:{fighter:6}},'persuasion')).toBe(2)
   const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(restored),controller:'player',initiativeD20:20,position:{x:0,y:0}})
   const state=JSON.parse(JSON.stringify(startDnd5eHeadlessCombat('courtier',[actor,{...structuredClone(actor),id:'opponent',controller:'dm',initiative:-1}])))
   expect(dnd5eEnvironmentalSkillBonus(state,state.combatants.hero,'persuasion','cha')).toBe(Math.floor((score-10)/2))
   expect(dnd5eEnvironmentalSkillBonus(state,state.combatants.hero,'persuasion','str')).toBe(0)
   const result=resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'hero',ability:'cha',skill:'persuasion',d20:10,dc:10})
   expect(result.ok,JSON.stringify({reason:result.ok ? undefined : result.reason})).toBe(true)
   expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',total:12+Math.floor((score-10)/2)}))
   const reduced={...restored,dnd5eCombatState:{schemaVersion:2,abilityScoreReductionLedger:[{id:'reduced',ability:'wis',amount:2,recovery:'restoration-magic'}]}}
   expect(dnd5eSkillCheckModifier(reduced,'persuasion')).toBe(2+Math.floor((score-12)/2))
   expect(restored).toEqual(before)
  }
 }finally{dispose()}
})





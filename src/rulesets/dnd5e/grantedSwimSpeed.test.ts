import {it,expect} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {registerDnd5eRulesPlugin,cloneStaticCombatModifiers} from './pluginApi'
import {createCombatantFromDnd5eCharacter,migrateCharacterToDnd5e} from './character'
import {dnd5eEffectiveCharacterMovementProfile} from './characterMovement'
import {dnd5eEffectiveOptionalMovementSpeed} from './headlessCombatEngine'
it('roundtrips fixed swimming and breathing, retaining faster speeds and obeying eligibility and exhaustion',async()=>{
 const namespace='test.granted-swim'
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:namespace,name:'Swim',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'swim',name:'Swim',automation:automationCapabilityFromLegacyStatus('full'),payload:{id:'swim',name:'Swim',summary:'Synthetic',description:'Synthetic',automation:'full',classRequirements:[{classId:'barbarian',minimumLevel:6}]},effects:[{schemaVersion:1,id:'swim-passive',name:'Swim',duration:{kind:'permanent'},stacking:'unique-by-source',modifiers:[{kind:'character-capability',capability:'swimSpeedMinimumFeet',value:30},{kind:'character-capability',capability:'canBreatheWater',value:true}]}]}]}
 const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 try{
  const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'野蛮人',level:6,dnd5eClassLevels:{barbarian:6},speed:40,maxHp:30,currentHp:30,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},equipment:{},dnd5ePluginFeatureIds:[namespace+':swim']})
  for(const [patch,speed,breath]of [[{},30,true],[{dnd5eMovementSpeeds:{swim:50}},50,true],[{exhaustionLevel:2},15,true],[{exhaustionLevel:5},0,true],[{dnd5eClassLevels:{barbarian:5}},0,false],[{dnd5ePluginFeatureIds:[]},0,false]]as const){
   const character=JSON.parse(JSON.stringify({...hero,...patch})),saved=JSON.stringify(character)
   const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(character),controller:'player',initiativeD20:10,position:{x:0,y:0}})
   expect(dnd5eEffectiveOptionalMovementSpeed(actor,'swim')??0).toBe(speed)
   expect(actor.canBreatheWater===true).toBe(breath)
   const profile=dnd5eEffectiveCharacterMovementProfile(character)
   expect(profile.swimSpeed??0).toBe(speed);expect(profile.canBreatheWater===true).toBe(breath)
   expect(JSON.stringify(character)).toBe(saved)
  }
 }finally{dispose()}
})
it.each([-1,1001,1.5,NaN])('rejects invalid fixed swimming speed %s',value=>{expect(()=>cloneStaticCombatModifiers({swimSpeedMinimumFeet:value},'test')).toThrow()})

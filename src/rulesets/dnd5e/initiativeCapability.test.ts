import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {registerDnd5eRulesPlugin,cloneStaticCombatModifiers} from './pluginApi'
import {dnd5eAbilityCheckMode} from './checks'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {listRegisteredContentDefinitionPackages,unregisterContentDefinitionPackage,registerContentDefinitionPackage} from '../../domain/content/contentDefinitionRegistry'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
it.each(['full','inner-manual','outer-manual']as const)('applies initiative capability only with two fully automated registered gates: %s',async mode=>{
 const id='test.initiative-capability'
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id,name:'Initiative capability',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],definitions:[{schemaVersion:1,namespace:id,version:'1.0.0',kind:'feature',id:'initiative',name:'Initiative',automation:automationCapabilityFromLegacyStatus('full'),payload:{id:'initiative',name:'Initiative',description:'Synthetic static initiative capability',summary:'Synthetic',automation:mode==='inner-manual'?'manual':'full',staticModifiers:{initiativeAdvantage:true}},effects:[{schemaVersion:1,id:'initiative',name:'Initiative',duration:{kind:'permanent'},stacking:'unique-by-source',modifiers:[{kind:'character-capability',capability:'initiativeAdvantage',value:true}]}]}]}
 const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 let disposeDowngrade:(()=>void)|undefined
 if(mode==='outer-manual'){
  const original=listRegisteredContentDefinitionPackages().find(row=>row.packageId===id)!
  expect(unregisterContentDefinitionPackage(id)).toBe(true)
  disposeDowngrade=registerContentDefinitionPackage({...original,definitions:original.definitions.map(row=>({...row,automation:automationCapabilityFromLegacyStatus('manual')}))}).dispose
 }
 try{
  const character=normalizeCharacter({id:'holder',charClass:'战士',level:1,dnd5eClassLevels:{fighter:1},dnd5ePluginFeatureIds:[id+':initiative']})
  expect(dnd5eAbilityCheckMode(character,{initiative:true})).toBe(mode==='full'?'advantage':'normal')
  expect(dnd5eAbilityCheckMode(character,{ability:'dex'})).toBe('normal')
  expect(dnd5eAbilityCheckMode(character,{ability:'dex',skill:'stealth'})).toBe('normal')
  expect(dnd5eAbilityCheckMode({...character,exhaustionLevel:1},{initiative:true})).toBe(mode==='full'?'normal':'disadvantage')
  const unowned={...character,dnd5ePluginFeatureIds:[]}
  expect(dnd5eAbilityCheckMode(unowned,{initiative:true})).toBe('normal')
 }finally{disposeDowngrade?.();dispose()}
})
it('rejects nonboolean capability values while preserving the existing Barbarian initiative rule',()=>{
 expect(()=>cloneStaticCombatModifiers({initiativeAdvantage:'yes'}as never,'invalid')).toThrow()
 expect(dnd5eAbilityCheckMode(normalizeCharacter({level:7,charClass:'野蛮人',dnd5eClassLevels:{barbarian:7}}),{initiative:true})).toBe('advantage')
})

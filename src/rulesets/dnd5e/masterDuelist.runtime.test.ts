import{it,expect}from'vitest'
import{nativeMasterDuelistBundle,growMasterRogue}from'./masterDuelist.native.fixture'
import{exportDnd5eStarMod,readDnd5eStarMod,projectDnd5eStarModRuntime}from'./starModAdapter'
import{parseDnd5eUnifiedContentBundleV1,dnd5eRulesPluginFromUnifiedContentBundleV1}from'./unifiedContent'
import{registerDnd5eRulesPlugin,dnd5eCharacterHasPluginFeature,dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginResourceDefinition}from'./pluginApi'
it('actual native source survives two archive rounds and the genuine unified-native Page runtime projection',async()=>{
 const first=await exportDnd5eStarMod(await nativeMasterDuelistBundle()),firstRead=await readDnd5eStarMod(first),second=await exportDnd5eStarMod(firstRead.bundle),secondRead=await readDnd5eStarMod(second),runtime=parseDnd5eUnifiedContentBundleV1(await projectDnd5eStarModRuntime(second));expect(secondRead.bundle.definitions).toEqual(firstRead.bundle.definitions);expect(runtime).toBeDefined();if(!runtime)throw Error('Actual Page unified-native runtime required');
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(runtime));try{const ns=runtime.manifest.id,actor=growMasterRogue(ns),lower=growMasterRogue(ns,16),fid=ns+':swashbuckler.master-duelist';expect(actor.dnd5ePluginFeatureIds??[]).toEqual([]);expect(dnd5eCharacterHasPluginFeature(actor,fid)).toBe(true);expect(dnd5eCharacterHasPluginFeature(lower,fid)).toBe(false);expect(dnd5ePluginFeatureCurrentEnvelopeFullV1(fid)).toBe(true);const resource=dnd5ePluginResourceDefinition(ns+':master-duelist');expect(resource?.resetOn).toBe('short-rest');expect(resource?.initialCurrent).toBe(1);expect(resource?.minimumLevel).toBe(17)}finally{dispose()}
})

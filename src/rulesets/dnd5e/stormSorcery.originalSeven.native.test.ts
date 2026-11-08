import {it,expect} from 'vitest'
import {buildStormOriginalSevenDraft,stormOriginalSevenSource} from './stormSorcery.originalSeven.native.fixture'
import {buildDnd5eCustomRulesContentPackageV2,parseDnd5eContentPackageV2,dnd5eContentPackageAutomationCoverageV2,dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {declarativeAbilityCompatibilityV1,validateDeclarativeSubclassAbilityV1} from './declarativeSubclassAbility'
import {exportDnd5eStarMod,readDnd5eStarMod,exportLegacyDnd5eStarMod,projectDnd5eStarModRuntime} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {registerDnd5eRulesPlugin,dnd5ePluginSubclassCurrentEnvelopeFullV1,dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5eCharacterHasPluginFeature} from './pluginApi'
import {registeredDnd5ePluginFeatures} from './plugins/pluginContentCatalog'
import {growStorm} from './stormSorcery.growth.native.fixture'
import {dnd5eCharacterKnownLanguagesV1} from './buildChoices'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {dnd5eEffectiveFlySpeed} from './headlessCombatEngine'
import {dnd5eEffectiveCharacterMovementProfile} from './characterMovement'

it('strictly covers original seven through their executed declarations without granting a generic after-hit exception',async()=>{
 const {draft,originalAbilities}=await buildStormOriginalSevenDraft(),pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(buildDnd5eCustomRulesContentPackageV2(draft)).buffer)!
 const rows=dnd5eContentPackageAutomationCoverageV2(pkg).entries.filter(r=>r.category==='subclass-ability');expect(rows.map(r=>r.status)).toEqual(Array(7).fill('full'));expect(draft.subclasses[0].abilities.map((a:any)=>a.id)).toEqual(originalAbilities.map((a:any)=>a.id))
 const fury=draft.subclasses[0].abilities.find((a:any)=>a.id==='storms-fury');expect(declarativeAbilityCompatibilityV1(fury).effective).toBe('full');const generic={...fury,mechanic:undefined};expect(declarativeAbilityCompatibilityV1(generic).effective).not.toBe('full');const wrong={...fury,cost:{economy:'action'}};expect(()=>validateDeclarativeSubclassAbilityV1(wrong)).toThrow();expect(declarativeAbilityCompatibilityV1(wrong).effective).not.toBe('full')
 for(const a of draft.subclasses[0].abilities){const old=originalAbilities.find((r:any)=>r.id===a.id);expect([a.id,a.name,a.description,a.level]).toEqual([old.id,old.name,old.description,old.level])}
})
it.each(['missing','foreign-class','foreign-subclass','wrong-level','manual','empty-immunity','unsupported-static']as const)('a real Wind Soul summary cannot gain full coverage from an invalid owned implementation: %s',async mode=>{
 const {draft}=await buildStormOriginalSevenDraft(),feature=draft.features.find((f:any)=>f.id==='wind-immunity');if(mode==='missing')draft.features=draft.features.filter((f:any)=>f!==feature);if(mode==='foreign-class')feature.sourceClassId='wizard';if(mode==='foreign-subclass')feature.sourceSubclassId=draft.manifest.id+':other';if(mode==='wrong-level')feature.minimumLevel=17;if(mode==='manual')feature.automation='manual';if(mode==='empty-immunity')feature.staticModifiers.damageImmunities=[];if(mode==='unsupported-static')feature.staticModifiers={canBreatheWater:true}
 const pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(buildDnd5eCustomRulesContentPackageV2(draft)).buffer)!;expect(dnd5eContentPackageAutomationCoverageV2(pkg).entries.find(r=>r.category==='subclass-ability'&&r.id==='storm-sorcery:wind-soul')?.status).not.toBe('full')
})
it('rejects unknown damage defenses at the actual package boundary',async()=>{const {draft}=await buildStormOriginalSevenDraft();draft.features.find((f:any)=>f.id==='wind-immunity').staticModifiers.damageImmunities=['not-a-damage-type'];expect(()=>buildDnd5eCustomRulesContentPackageV2(draft)).toThrow()})
it('round-trips both standard carriers and acquires the original seven at genuine levels with their real defenses',async()=>{
 const made=await stormOriginalSevenSource();const canonicalDefinitions=made.bundle.definitions.map(d=>({...d,tags:d.tags??[],source:d.source??{packageId:made.namespace,packageVersion:made.bundle.manifest.version,contentVersion:d.version}}));let bundle=made.bundle,pkg=made.pkg;for(let n=0;n<2;n++){bundle=(await readDnd5eStarMod(await exportDnd5eStarMod(bundle))).bundle;expect(bundle.definitions).toEqual(canonicalDefinitions);const bytes=await exportLegacyDnd5eStarMod(pkg);const next=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(bytes));expect(next).toEqual(made.pkg);pkg=next!}
 for(const carrier of['legacy','unified']as const){const dispose=registerDnd5eRulesPlugin(carrier==='legacy'?dnd5eRulesPluginFromContentPackageV2(pkg):dnd5eRulesPluginFromUnifiedContentBundleV1(bundle));try{expect(dnd5ePluginSubclassCurrentEnvelopeFullV1(made.namespace+':storm-sorcery')).toBe(true);const features=registeredDnd5ePluginFeatures().filter(f=>f.ownerPluginId===made.namespace);for(const kind of['storm-fury','storm-cast-flight','storm-cast-eruption'])expect(features.filter(f=>f.declarativeAbility?.mechanic?.kind===kind)).toHaveLength(1)
  const originals=made.originalAbilities.map((a:any)=>{const f=features.find(f=>f.declarativeAbility?.id===a.id)!;expect(f,a.id).toBeTruthy();expect(dnd5ePluginFeatureCurrentEnvelopeFullV1(f.id)).toBe(true);return{...a,featureId:f.id}})
  for(const level of[1,6,14,18]){const c=growStorm(level);expect(c.dnd5ePluginFeatureIds??[]).toEqual([]);expect(dnd5eCharacterKnownLanguagesV1(c)).toContain('primordial');for(const a of originals)expect(dnd5eCharacterHasPluginFeature(c,a.featureId),a.id+':'+level).toBe(level>=a.level)
   const token={id:c.id+'-token',characterId:c.id,type:'player' as const,dnd5eSide:'player' as const,label:c.name,x:125,y:125,size:1,color:'#abc',emoji:'S',hp:c.currentHp,maxHp:c.maxHp},map={id:'original-seven',name:'Original seven',width:1000,height:800,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]},snapshot=createDnd5eMapCombatSnapshot({map,characters:[c],combatId:'native-seven',initiativeOrder:[{tokenId:token.id,label:c.name,roll:20,color:'',emoji:''}],geometry:null}),actor=snapshot.state.combatants[token.id]!
   if(level>=6)for(const type of['lightning','thunder'])expect(actor.damageResistances).toContain(type);if(level>=18){for(const type of['lightning','thunder'])expect(actor.damageImmunities).toContain(type);expect(dnd5eEffectiveFlySpeed(actor)).toBe(60);expect(dnd5eEffectiveCharacterMovementProfile(c).flySpeed).toBe(60)}
  }
 }finally{dispose()}}
})

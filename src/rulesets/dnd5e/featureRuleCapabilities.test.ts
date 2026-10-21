import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { cloneDnd5eFeatureRuleCapabilities } from './featureRuleCapabilities'
import { exportPdfContentModule } from './pdfContentModule'
import { projectDnd5eStarModRuntime } from './starModAdapter'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eCharacterHasPluginFeature } from './plugins/pluginContentCatalog'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'

it.each([[],[{}],[{id:'curse'}],[{id:'dnd5e:curse',classId:1}],
  [{id:'dnd5e:curse'},{id:'dnd5e:curse'}]].map(value=>[value]))('rejects invalid semantic capability declarations %#',value=>{
  expect(()=>cloneDnd5eFeatureRuleCapabilities(value,'test')).toThrow()
})

it('round trips semantic prerequisites and checks native choices, independent features and compiled subclass ownership',async()=>{
  const base={name:'Synthetic',summary:'Synthetic',description:'Synthetic',automation:'manual'}
  const eligibility={kind:'rule-capability',capabilityId:'dnd5e:curse',classId:'warlock'}
  const draft={schemaVersion:1 as const,assumptions:[],unsupported:[],contentJson:JSON.stringify({name:'Capability test',features:[
    {...base,id:'gate',automation:'full',eligibility},
    {...base,id:'provider',ruleCapabilities:[{id:'dnd5e:curse',classId:'warlock'}],classRequirements:[{classId:'warlock',minimumLevel:6}]},
    {...base,id:'self',eligibility,ruleCapabilities:[{id:'dnd5e:curse',classId:'warlock'}]},
  ],subclasses:[{schemaVersion:1,id:'patron',name:'Patron',summary:'Synthetic',classId:'warlock',abilities:[{
    schemaVersion:1,id:'mark',name:'Mark',description:'Synthetic',level:6,ruleCapabilityIds:['dnd5e:curse'],
    trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'manual',
  }]}],activities:[{schemaVersion:1,id:'use',name:'Use',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'gate'},
    automation:{schemaVersion:1,level:'full',supportedPhases:['effects'],manualPhases:[],limitations:[]},
    outcomes:[{id:'benefit',when:{kind:'always'},operations:[{id:'benefit',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}]}]})}
  const archive=await exportPdfContentModule({id:'local.test.capabilities',name:'Capabilities',version:'1.0.0',inventoryComplete:true,
    entries:[{sourceId:'test',name:'Synthetic',draft}]})
  const pkg=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(archive.bytes))!
  expect(pkg.content.features[0].eligibility).toEqual(eligibility)
  expect(pkg.content.features[1].ruleCapabilities).toEqual([{id:'dnd5e:curse',classId:'warlock'}])
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try{
    for(const mode of ['native','native-low','provider','provider-low','subclass','subclass-low','wrong-subclass','absent','wrong-class','self'] as const){
      const level=mode==='native-low'?4:mode==='subclass-low'||mode==='provider-low'?5:7
      const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:mode==='wrong-class'?'战士':'邪术师',level,maxHp:20,currentHp:20,
        dnd5ePluginFeatureIds:[`${pkg.manifest.id}:gate`,...(mode.startsWith('provider')||mode==='wrong-class'?[`${pkg.manifest.id}:provider`]:[]),
          ...(mode==='self'?[`${pkg.manifest.id}:self`]:[])],
        dnd5eClassChoices:{classes:{warlock:{subclass:mode.startsWith('subclass')?`${pkg.manifest.id}:patron`:'fiend',selections:{
          'eldritch-invocations':mode.startsWith('native')?['sign-of-ill-omen']:[],
        }}}}})
      const eligible=['native','provider','subclass'].includes(mode)
      expect(dnd5eCharacterHasPluginFeature(hero,`${pkg.manifest.id}:gate`),mode).toBe(eligible)
      const actor={...createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:20,position:{x:0,y:0}}),id:'actor'}
      const state=startDnd5eHeadlessCombat('capability',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
      const before=structuredClone(state)
      const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',command:{
        schemaVersion:1,commandId:mode,actorId:'actor',packageId:pkg.manifest.id,packageVersion:pkg.manifest.version,activityId:'use',targetIds:['actor'],expectedRevision:1,
      }})
      expect(result.result.ok,`${mode}: ${JSON.stringify(result.result)}`).toBe(eligible)
      expect(state).toEqual(before)
      if(result.result.ok)expect(result.result.state.combatants.actor.temporaryHp).toBe(3)
    }
  }finally{dispose()}
})

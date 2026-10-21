import { expect, it } from 'vitest'
import { cloneDnd5eFeatureEligibility, dnd5eFeatureEligibilityReferenceIssues, type Dnd5eFeatureEligibility } from './featureEligibility'
import { exportPdfContentModule } from './pdfContentModule'
import { projectDnd5eStarModRuntime } from './starModAdapter'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eCharacterHasPluginFeature } from './plugins/pluginContentCatalog'
import { normalizeCharacter } from '../../store/characters'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'

const eligibility: Dnd5eFeatureEligibility={kind:'all',requirements:[
  {kind:'class-level',classId:'warlock',minimumLevel:5},
  {kind:'any',requirements:[{kind:'known-spell',spellId:'hex'},{kind:'feature',featureId:'curse'}]},
]}
it.each([{},[],{kind:'any',requirements:[]},{kind:'feature',featureId:''},{kind:'class-level',classId:'warlock',minimumLevel:0},
  {kind:'all',requirements:Array(33).fill({kind:'known-spell',spellId:'hex'})}])('rejects invalid eligibility %j',input=>{
  expect(()=>cloneDnd5eFeatureEligibility(input,'test')).toThrow()
})
it('rejects cyclic declarations and clones valid declarations independently',()=>{
  const cycle:{kind:string;requirements:unknown[]}={kind:'all',requirements:[]};cycle.requirements.push(cycle)
  expect(()=>cloneDnd5eFeatureEligibility(cycle,'test')).toThrow()
  const cloned=cloneDnd5eFeatureEligibility(eligibility,'test')!
  expect(cloned).toEqual(eligibility)
  expect(cloned).not.toBe(eligibility)
})

it('reports unresolved feature alternatives even when another branch is a known spell',()=>{
  expect(dnd5eFeatureEligibilityReferenceIssues('test.pack',[{id:'gate',eligibility}])).toEqual([
    expect.stringContaining('test.pack:curse'),
  ])
  expect(dnd5eFeatureEligibilityReferenceIssues('test.pack',[{id:'gate',eligibility},{id:'curse'}])).toEqual([])
  expect(dnd5eFeatureEligibilityReferenceIssues('test.pack',[{id:'gate',eligibility:{kind:'feature',featureId:'other:curse'}},{id:'curse'}]))
    .toEqual([expect.stringContaining('other:curse')])
})

it('exports mixed prerequisites and enforces both alternatives at the Host activity boundary',async()=>{
  const base={name:'Synthetic',summary:'Synthetic',description:'Synthetic',automation:'full'}
  const draft={schemaVersion:1 as const,assumptions:[],unsupported:[],contentJson:JSON.stringify({name:'Mixed eligibility',features:[
    {...base,id:'gate',eligibility},
    {...base,id:'curse',automation:'manual',classRequirements:[{classId:'warlock',minimumLevel:6}]},
  ],activities:[{schemaVersion:1,id:'use',name:'Use',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'gate'},
    automation:{schemaVersion:1,level:'full',supportedPhases:['effects'],manualPhases:[],limitations:[]},
    outcomes:[{id:'guard',when:{kind:'always'},operations:[{id:'guard',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:4}}]}]}]})}
  const archive=await exportPdfContentModule({id:'local.test.eligibility',name:'Mixed eligibility',version:'1.0.0',inventoryComplete:true,
    entries:[{sourceId:'gate',name:'Gate',draft}]})
  const pkg=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(archive.bytes))!
  expect(pkg.content.features[0].eligibility).toEqual(eligibility)
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try{
    for(const mode of ['spell','feature','neither','unowned','ineligible-provider','low-level','wrong-class'] as const){
      const owned=mode==='feature'||mode==='ineligible-provider'
      const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:mode==='wrong-class'?'战士':'邪术师',
        level:mode==='low-level'?4:mode==='ineligible-provider'?5:6,maxHp:20,currentHp:20,
        dnd5ePluginFeatureIds:[`${pkg.manifest.id}:gate`,...(owned?[`${pkg.manifest.id}:curse`]:[])],
        dnd5eClassChoices:{classes:{warlock:{selections:{'spell-known':['spell','low-level','wrong-class'].includes(mode)?['hex']:[]}}}}})
      const eligible=mode==='spell'||mode==='feature'
      expect(dnd5eCharacterHasPluginFeature(hero,`${pkg.manifest.id}:gate`),mode).toBe(eligible)
      const actor={...createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:20,position:{x:0,y:0}}),id:'actor'}
      const state=startDnd5eHeadlessCombat('mixed',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
      const before=structuredClone(state)
      const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',command:{
        schemaVersion:1,commandId:mode,actorId:'actor',packageId:pkg.manifest.id,packageVersion:pkg.manifest.version,
        activityId:'use',targetIds:['actor'],expectedRevision:1,
      }})
      expect(result.result.ok,`${mode}: ${JSON.stringify(result.result)}`).toBe(eligible)
      expect(state).toEqual(before)
      if(result.result.ok)expect(result.result.state.combatants.actor.temporaryHp).toBe(4)
    }
  }finally{dispose()}
})

it('rejects circular feature ownership but accepts an independent alternative',()=>{
  const base={name:'Synthetic',summary:'Synthetic',description:'Synthetic',automation:'full' as const}
  const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.cycle',name:'Cycle',version:'1.0.0',apiVersion:2,
    rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    api.registerFeature({...base,id:'a',eligibility:{kind:'any',requirements:[{kind:'feature',featureId:'b'},{kind:'known-spell',spellId:'hex'}]}})
    api.registerFeature({...base,id:'b',eligibility:{kind:'feature',featureId:'a'}})
  }})
  try{
    const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'邪术师',level:5,dnd5ePluginFeatureIds:['test.cycle:a','test.cycle:b']})
    expect(dnd5eCharacterHasPluginFeature(hero,'test.cycle:a')).toBe(false)
    expect(dnd5eCharacterHasPluginFeature(hero,'test.cycle:b')).toBe(false)
    hero.dnd5eClassChoices={classes:{warlock:{selections:{'spell-known':['hex']}}}}
    expect(dnd5eCharacterHasPluginFeature(hero,'test.cycle:a')).toBe(true)
    expect(dnd5eCharacterHasPluginFeature(hero,'test.cycle:b')).toBe(true)
    hero.dnd5eClassChoices={}
    expect(dnd5eCharacterHasPluginFeature(hero,'test.cycle:a')).toBe(false)
  }finally{dispose()}
})

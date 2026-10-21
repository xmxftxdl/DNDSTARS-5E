import { expect, it } from 'vitest'
import { cloneDnd5eFeatureChoiceRequirements } from './featureChoiceRequirements'
import { exportPdfContentModule } from './pdfContentModule'
import { projectDnd5eStarModRuntime } from './starModAdapter'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eCharacterHasPluginFeature } from './plugins/pluginContentCatalog'
import { normalizeCharacter } from '../../store/characters'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'

const requirements = [{ classId: 'warlock', groupId: 'pact-boon', anyOf: ['chain', 'blade'] }]
it.each([[], [{}], [{...requirements[0],anyOf:[]}], [{...requirements[0],anyOf:['chain','chain']}],
  [{...requirements[0],groupId:42}], [{...requirements[0],classId:'bad class'}]].map(value=>[value]))(
  'rejects malformed choice prerequisites %#', value => {
    expect(()=>cloneDnd5eFeatureChoiceRequirements(value,'test')).toThrow()
  })

it('round trips choice prerequisites and revokes Host activity authority after the selection is removed', async () => {
  const draft = { schemaVersion: 1 as const, assumptions: [], unsupported: [], contentJson: JSON.stringify({
    name: 'Choice prerequisites', features: [{ id:'guard',name:'Guard',summary:'Synthetic',description:'Synthetic',automation:'full',
      classChoiceRequirements:requirements,requiredKnownSpellIds:['eldritch-blast'] }],
    activities:[{schemaVersion:1,id:'guard',name:'Guard',activation:{kind:'free'},target:{kind:'self'},
      legacySource:{kind:'feature',id:'guard'},automation:{schemaVersion:1,level:'full',supportedPhases:['effects'],manualPhases:[],limitations:[]},
      outcomes:[{id:'guard',when:{kind:'always'},operations:[{id:'guard',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:4}}]}]}],
  }) }
  const archive=await exportPdfContentModule({id:'local.test.choice-gate',name:'Choice gate',version:'1.0.0',inventoryComplete:true,
    entries:[{sourceId:'guard',name:'Guard',draft}]})
  const pkg=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(archive.bytes))!
  expect(pkg.content.features[0].classChoiceRequirements).toEqual(requirements)
  expect(pkg.content.features[0].requiredKnownSpellIds).toEqual(['eldritch-blast'])
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const featureId=`${pkg.manifest.id}:guard`
    for(const mode of ['chain','blade','tome','missing','wrong-class','unowned','unknown-spell'] as const){
      const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:mode==='wrong-class'?'战士':'邪术师',level:5,maxHp:20,currentHp:20,
        dnd5ePluginFeatureIds:mode==='unowned'?[]:[featureId],dnd5eClassChoices:{classes:{warlock:{selections:{
          'pact-boon':mode==='missing'?[]:[mode==='wrong-class'||mode==='unowned'||mode==='unknown-spell'?'chain':mode],
          'spell-cantrips':mode==='unknown-spell'?[]:['eldritch-blast'],
        }}}}})
      const eligible=mode==='chain'||mode==='blade'
      expect(dnd5eCharacterHasPluginFeature(hero,featureId),mode).toBe(eligible)
      const actor={...createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:20,position:{x:0,y:0}}),id:'actor'}
      const state=startDnd5eHeadlessCombat('gate',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
      const before=structuredClone(state)
      const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',command:{
        schemaVersion:1,commandId:mode,actorId:'actor',packageId:pkg.manifest.id,packageVersion:pkg.manifest.version,
        activityId:'guard',targetIds:['actor'],expectedRevision:1,
      }})
      expect(result.result.ok,`${mode}: ${JSON.stringify(result.result)}`).toBe(eligible)
      expect(state).toEqual(before)
      if(result.result.ok)expect(result.result.state.combatants.actor.temporaryHp).toBe(4)
      if(eligible){
        const restored=normalizeCharacter(JSON.parse(JSON.stringify(hero)))
        restored.dnd5eClassChoices!.classes!.warlock!.selections!['pact-boon']=[]
        expect(dnd5eCharacterHasPluginFeature(restored,featureId)).toBe(false)
        expect(createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(restored),controller:'player',initiativeD20:20,position:{x:0,y:0}})
          .pluginFeatureIds).not.toContain(featureId)
      }
    }
  }finally{dispose()}
})

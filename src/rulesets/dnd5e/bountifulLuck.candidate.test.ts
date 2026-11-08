import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {it,expect} from 'vitest'
import {prepareDnd5eLocalContentJson} from '../../../src/rulesets/dnd5e/localContentCollection'
import {dnd5eContentPackageAutomationCoverageV2,dnd5eRulesPluginFromContentPackageV2} from '../../../src/rulesets/dnd5e/contentPackageV2'
import {registerDnd5eRulesPlugin,dnd5eCharacterHasPluginFeature} from '../../../src/rulesets/dnd5e/pluginApi'
import {normalizeCharacter} from '../../../src/store/characters'

it('compiles the actual complete candidate and gates the existing feat feature against the race prerequisite',async()=>{
  const content=bountifulLuckTestContent
  const prepared=await prepareDnd5eLocalContentJson(content)
  const pkg=prepared.package
  expect(dnd5eContentPackageAutomationCoverageV2(pkg).entries.find(entry=>entry.category==='feat'&&entry.id==='bountiful-luck')?.status).toBe('full')
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try{
    const featId=pkg.manifest.id+':bountiful-luck',featureId=pkg.manifest.id+':feat-bountiful-luck'
    for(const race of ['halfling','human']){
      const character=normalizeCharacter({id:race,name:race,race,dnd5eRaceId:race,charClass:'战士',level:4,dnd5eClassLevels:{fighter:4},dnd5eFeatIds:[featId]})
      expect(dnd5eCharacterHasPluginFeature(character,featureId)).toBe(race==='halfling')
    }
  }finally{dispose()}
})

import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eCharacterHasPluginFeature } from './plugins/pluginContentCatalog'
import { cloneDnd5eKnownSpellRequirements, dnd5eCharacterLearnedSpellIds } from './featureSpellRequirements'

it.each([[],[''],['a','a'],[42],['bad id']].map(value=>[value]))('rejects malformed learned spell requirements %#',value=>{
  expect(()=>cloneDnd5eKnownSpellRequirements(value,'test')).toThrow()
})

it('reads learned spells from actual class sources, not prepared lists or stale choices from absent classes',()=>{
  const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'邪术师',level:5,
    dnd5eClassChoices:{classes:{warlock:{selections:{'spell-cantrips':['eldritch-blast'],'spell-known':['hex'],'spell-prepared':['fireball']}},
      wizard:{selections:{'spell-cantrips':['fire-bolt'],'wizard-spellbook':['shield']}}}}})
  expect([...dnd5eCharacterLearnedSpellIds(hero)].sort()).toEqual(['eldritch-blast','hex'])
  const wizard=normalizeCharacter({...hero,charClass:'法师',dnd5eClassLevels:{wizard:5}})
  expect([...dnd5eCharacterLearnedSpellIds(wizard)].sort()).toEqual(['fire-bolt','shield'])
  const multiclass=normalizeCharacter({...hero,level:6,dnd5eClassLevels:{warlock:5,wizard:1}})
  expect([...dnd5eCharacterLearnedSpellIds(multiclass)].sort()).toEqual(['eldritch-blast','fire-bolt','hex','shield'])
})

it('permits independently owned cantrip grants and rejects circular or self-granted prerequisites',()=>{
  const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.knowledge',name:'Knowledge',version:'1.0.0',apiVersion:2,
    rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    const base={name:'Synthetic',summary:'Synthetic',description:'Synthetic',automation:'full' as const}
    api.registerFeature({...base,id:'gate',requiredKnownSpellIds:['eldritch-blast']})
    api.registerFeature({...base,id:'teacher',spellGrants:[{kind:'spell',spellId:'eldritch-blast',mode:'cantrip',ability:'cha',castAtLevel:0}]})
    api.registerFeature({...base,id:'self',requiredKnownSpellIds:['eldritch-blast'],spellGrants:[{kind:'spell',spellId:'eldritch-blast',mode:'cantrip',ability:'cha',castAtLevel:0}]})
    api.registerFeature({...base,id:'cycle-a',requiredKnownSpellIds:['fire-bolt'],spellGrants:[{kind:'spell',spellId:'eldritch-blast',mode:'cantrip',ability:'cha',castAtLevel:0}]})
    api.registerFeature({...base,id:'cycle-b',requiredKnownSpellIds:['eldritch-blast'],spellGrants:[{kind:'spell',spellId:'fire-bolt',mode:'cantrip',ability:'cha',castAtLevel:0}]})
  }})
  try{
    const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:5,dnd5ePluginFeatureIds:['test.knowledge:gate']})
    expect(dnd5eCharacterHasPluginFeature(hero,'test.knowledge:gate')).toBe(false)
    hero.dnd5ePluginFeatureIds=['test.knowledge:gate','test.knowledge:teacher']
    expect(dnd5eCharacterHasPluginFeature(hero,'test.knowledge:gate')).toBe(true)
    hero.dnd5ePluginFeatureIds=['test.knowledge:self']
    expect(dnd5eCharacterHasPluginFeature(hero,'test.knowledge:self')).toBe(false)
    hero.dnd5ePluginFeatureIds=['test.knowledge:cycle-a','test.knowledge:cycle-b']
    expect(dnd5eCharacterHasPluginFeature(hero,'test.knowledge:cycle-a')).toBe(false)
    expect(dnd5eCharacterHasPluginFeature(hero,'test.knowledge:cycle-b')).toBe(false)
    hero.dnd5ePluginFeatureIds.push('test.knowledge:teacher')
    expect(dnd5eCharacterHasPluginFeature(hero,'test.knowledge:cycle-a')).toBe(true)
    expect(dnd5eCharacterHasPluginFeature(hero,'test.knowledge:cycle-b')).toBe(true)
  }finally{dispose()}
})

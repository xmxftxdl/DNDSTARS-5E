import { expect, it } from 'vitest'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { normalizeCharacter } from '../../../store/characters'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from '../character'
import { dnd5eCombatantEntitledToActivityV1, dnd5eRegisteredSubclassActivityFeature } from './dnd5eActivityEntitlements'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it('binds subclass Activities to registered ability metadata and checks actual class levels and subclass ownership', () => {
  const packageId = 'test.subclass-entitlement', featureId = `${packageId}:arc-guard.arc-strike`
  const dispose = registerDnd5eRulesPlugin({manifest:{id:packageId,name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){
    api.registerDeclarativeSubclass({schemaVersion:1,id:'arc-guard',classId:'fighter',name:'Arc guard',summary:'Test',resources:[],abilities:[{
      schemaVersion:1,id:'arc-strike',name:'Arc strike',description:'Test',level:3,trigger:{kind:'active-use'},cost:{economy:'none'},
      targeting:{kind:'single-creature',relation:'enemy',rangeFeet:30},rolls:[{id:'damage',kind:'damage',label:'Damage',dice:{count:1,sides:6},damageType:'force'}],
      effects:[{kind:'damage',target:'target',rollId:'damage'}],automation:'full',
    }]})
  }})
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'native-strike',name:'Native strike',activation:{kind:'free'},target:{kind:'self'},outcomes:[],automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'subclass-ability',id:'arc-guard:arc-strike'}}
  try {
    const owner=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:3,dnd5eClassChoices:{fighter:{subclass:`${packageId}:arc-guard`,fightingStyles:[]}}})
    const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:20,position:{x:0,y:0}})
    expect(actor.pluginFeatureIds).toContain(featureId)
    expect(dnd5eRegisteredSubclassActivityFeature(packageId,'arc-guard:arc-strike')?.id).toBe(featureId)
    const input={packageId,activity,combatant:actor,character:owner}
    expect(dnd5eCombatantEntitledToActivityV1(input)).toBe(true)
    expect(dnd5eCombatantEntitledToActivityV1({...input,character:undefined})).toBe(true)
    expect(dnd5eCombatantEntitledToActivityV1({...input,combatant:{...actor,level:20,classLevels:{fighter:2}}})).toBe(false)
    expect(dnd5eCombatantEntitledToActivityV1({...input,combatant:{...actor,classLevels:{fighter:Number.NaN}}})).toBe(false)
    expect(dnd5eCombatantEntitledToActivityV1({...input,combatant:{...actor,subclassIds:{fighter:'champion'}}})).toBe(false)
    expect(dnd5eCombatantEntitledToActivityV1({...input,combatant:{...actor,pluginFeatureIds:[]}})).toBe(false)
    expect(dnd5eCombatantEntitledToActivityV1({...input,character:{...owner,dnd5eClassChoices:{fighter:{subclass:'champion',fightingStyles:[]}}}})).toBe(false)
    expect(dnd5eCombatantEntitledToActivityV1({...input,packageId:'other.package'})).toBe(false)
    expect(dnd5eCombatantEntitledToActivityV1({...input,activity:{...activity,legacySource:{kind:'subclass-ability',id:'arc-guard:missing'}},combatant:{...actor,pluginFeatureIds:[`${packageId}:arc-guard:missing`]}})).toBe(false)
    expect(dnd5eCombatantEntitledToActivityV1({...input,activity:{...activity,legacySource:{kind:'subclass-ability',id:'arc-guard.arc-strike'}}})).toBe(false)
  } finally {dispose()}
  expect(dnd5eRegisteredSubclassActivityFeature(packageId,'arc-guard:arc-strike')).toBeUndefined()
})

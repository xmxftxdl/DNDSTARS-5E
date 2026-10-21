import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { expect, it } from 'vitest'
import { cloneDnd5eIndependentSpellGrants } from './independentSpellGrants'
import { exportPdfContentModule } from './pdfContentModule'
import { projectDnd5eStarModRuntime } from './starModAdapter'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eIndependentSpellRulesForCharacter } from './racialAutomation'
import { normalizeCharacter } from '../../store/characters'
import { syncCharacterClassResources, restoreClassResources } from '../../lib/classResources'
import { preflightPdfSpellDraft } from './pdfSpellHeadlessPreflight'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { applyDnd5eInventoryMutation } from './items'
import type { BattleMap, Token } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { dnd5eEffectiveCharacterMovementProfile } from './characterMovement'
import { dnd5eEffectiveOptionalMovementSpeed } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect, dnd5eActiveEnvironmentalCapabilities } from './activeEffects'

const grant = {kind:'spell' as const,spellId:'pass-without-trace',mode:'once-per-long-rest' as const,ability:'wis' as const,castAtLevel:2,targetRestriction:'self' as const}

it.each([
  [], [grant,grant], [{...grant,ability:undefined}], [{...grant,mode:'known'}],
  [{...grant,targetRestriction:'other'}], [{...grant,mode:'cantrip',castAtLevel:2}],
].map(value => [value]))('rejects invalid fixed feature grants %#', value => {
  expect(()=>cloneDnd5eIndependentSpellGrants(value,'test')).toThrow()
})

it('round trips owned feature grants and enforces current ownership, level, independent cost and self targeting',async()=>{
  const draft={schemaVersion:1 as const,assumptions:[],unsupported:[],contentJson:JSON.stringify({name:'Synthetic grants',features:[{
    id:'test-grant',name:'Synthetic grant',summary:'Synthetic test',description:'Synthetic test',automation:'full',minimumLevel:7,classRequirements:[{classId:'fighter',minimumLevel:7}],spellGrants:[grant],staticModifiers:{swimSpeedEqualsWalking:true,canBreatheWater:true},
  }]})}
  expect(await preflightPdfSpellDraft(draft,'feature')).toMatchObject({status:'ready-for-behavior-tests',executionKinds:expect.arrayContaining(['spell-grant','static-modifiers']),behaviorVerified:false})
  const archive=await exportPdfContentModule({id:'local.test.feature-grants',name:'Synthetic grants',version:'1.0.0',inventoryComplete:true,entries:[{sourceId:'test',name:'Synthetic grant',draft}]})
  const pkg=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(archive.bytes))!
  expect(pkg.content.features[0].spellGrants).toEqual([grant])
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  const key='dnd5e-racial-spell-pass-without-trace'
  const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:7,equipment:{},dnd5eInventory:{schemaVersion:3,revision:0,entries:[]},dnd5ePluginFeatureIds:[`${pkg.manifest.id}:test-grant`]})
  try {
    const combatant=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:10,position:{x:0,y:0}})
    expect(dnd5eActiveEnvironmentalCapabilities(combatant.classState.activeEffects,combatant).canBreatheWater).toBe(true)
    expect(dnd5eEffectiveOptionalMovementSpeed(combatant,'swim')).toBe(30)
    expect(dnd5eEffectiveCharacterMovementProfile(hero).swimSpeed).toBe(30)
    combatant.classState.activeEffects=[createDnd5eMechanicalEffect({id:'slow',definitionId:'test:slow',label:'Slow',targetId:combatant.id,source:{kind:'spell'},duration:{type:'permanent'},modifiers:{speedMultiplier:0.5}})]
    expect(dnd5eEffectiveOptionalMovementSpeed(combatant,'swim')).toBe(15)
    expect(dnd5eEffectiveCharacterMovementProfile({...hero,dnd5ePluginFeatureIds:[]}).swimSpeed).toBeUndefined()
    expect(dnd5eEffectiveCharacterMovementProfile({...hero,dnd5ePluginFeatureIds:[]}).canBreatheWater).toBe(false)
    expect(dnd5eIndependentSpellRulesForCharacter(hero).innateSpells).toEqual([expect.objectContaining({spellId:grant.spellId,targetRestriction:'self',requiresComponents:true})])
    expect(dnd5eIndependentSpellRulesForCharacter({...hero,level:6}).innateSpells).toEqual([])
    expect(dnd5eIndependentSpellRulesForCharacter({...hero,level:15,dnd5eClassLevels:{fighter:6,cleric:9}}).innateSpells).toEqual([])
    expect(dnd5eIndependentSpellRulesForCharacter({...hero,dnd5ePluginFeatureIds:[]}).innateSpells).toEqual([])
    const supplied=applyDnd5eInventoryMutation([syncCharacterClassResources(hero)],{type:'grant',characterId:hero.id,templateId:'srd-5.1:item:component-pouch',quantity:1})
    expect(supplied.ok).toBe(true);if(!supplied.ok)return
    const restored=normalizeCharacter(JSON.parse(JSON.stringify(supplied.characters[0])))
    expect(restored.classResources?.[key].current).toBe(1)
    const caster:Token={id:'caster',type:'player',characterId:hero.id,label:'Hero',x:25,y:25,size:1,color:'',emoji:''}
    const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[caster]}
    const action:SharedPlayerActionState={id:'cast',mapId:'map',type:'dnd5e-spell-cast',sourceMode:'player',status:'pending',actorTokenId:caster.id,characterId:hero.id,round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:grant.spellId,slotLevel:2,racialInnate:true,targetTokenId:caster.id}}
    const input={action,map,characters:[restored],initiativeOrder:[{tokenId:caster.id,label:'Hero',emoji:'',color:'',roll:20}]}
    const prepared=prepareDnd5ePluginSpellCast(input)
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)return
    const result=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{}}).result
    expect(result.ok,JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.caster.classResources[key].current).toBe(0)
    expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-2']).toBeUndefined()
    const spent={...restored,classResources:result.state.combatants.caster.classResources}
    expect(restoreClassResources(spent,'short-rest').classResources?.[key].current).toBe(0)
    expect(restoreClassResources(spent,'long-rest').classResources?.[key].current).toBe(1)
    expect(prepareDnd5ePluginSpellCast({...input,characters:[{...restored,dnd5ePluginFeatureIds:[]}]})).toMatchObject({ok:false,reason:'spell-not-known-or-prepared'})
    action.dnd5eSpellCast!.targetTokenId='foreign'
    expect(prepareDnd5ePluginSpellCast(input)).toMatchObject({ok:false,reason:'invalid-target'})
  }finally{dispose()}
  expect(dnd5eIndependentSpellRulesForCharacter(hero).innateSpells).toEqual([])
})


it('round trips independent feature resources and enforces ownership and rest cadence',async()=>{
 const draft={schemaVersion:1 as const,assumptions:[],unsupported:[],contentJson:JSON.stringify({name:'Feature uses',features:[{
  id:'ward',name:'Ward',summary:'Test',description:'Test',automation:'full',classRequirements:[{classId:'fighter',minimumLevel:5}],spellGrants:[grant],
  resources:[{id:'ward-use',label:'Ward uses',maximum:1,resetOn:'short-rest'}],
 }],activities:[{schemaVersion:1,id:'use-ward',name:'Use ward',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'ward'},consumption:[{kind:'resource',resourceId:'ward-use',amount:{kind:'constant',value:1},consumeOn:'resolve'}],outcomes:[{id:'ward',when:{kind:'always'},operations:[{id:'ward',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:4}}]}],automation:{schemaVersion:1,level:'full',supportedPhases:['effects'],manualPhases:[],limitations:[]}}]})}
 const archive=await exportPdfContentModule({id:'local.test.feature-uses',name:'Feature uses',version:'1.0.0',inventoryComplete:true,entries:[{sourceId:'ward',name:'Ward',draft}]})
 const pkg=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(archive.bytes))!
 expect(pkg.content.features[0].resources).toEqual([{id:'ward-use',label:'Ward uses',maximum:1,resetOn:'short-rest'}])
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try {
  const key='local.test.feature-uses:ward-use'
  const seed={id:'resource-hero',name:'Hero',charClass:'战士',level:5,maxHp:20,currentHp:20,dnd5ePluginFeatureIds:['local.test.feature-uses:ward']}
  const hero=syncCharacterClassResources(normalizeCharacter(seed))
  expect(hero.classResources?.[key]).toMatchObject({current:1,max:1})
  expect(pkg.content.activities?.[0].consumption?.[0]).toMatchObject({resourceId:'ward-use'})
  const activity=getRegisteredDnd5eActivity(pkg.manifest.id,'use-ward')!
  expect(activity.consumption?.[0]).toMatchObject({resourceId:key})
  const combatant={...createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:20,position:{x:0,y:0}}),id:'actor'}
  const enemy={...structuredClone(combatant),id:'enemy',controller:'dm' as const,initiative:10}
  const state=startDnd5eHeadlessCombat('resource-audit',[combatant,enemy])
  const command={schemaVersion:1 as const,commandId:'use',actorId:'actor',packageId:pkg.manifest.id,packageVersion:'1.0.0',activityId:'use-ward',targetIds:['actor'],expectedRevision:1}
  const resolved=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command,authoritativeRolls:{},confirmedBy:'actor'})
  expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
  if(resolved.phase!=='commit'||!resolved.result.ok)throw Error('resource activity failed')
  expect(resolved.result.state.combatants.actor.classResources[key].current).toBe(0)
  expect(resolved.result.state.combatants.actor.temporaryHp).toBe(4)
  resolved.result.state.combatants.actor.classResources['other-package:ward-use']={current:99,max:99}
  const again=resolveRegisteredDnd5eActivityInCombatV1({state:resolved.result.state,combatRevision:1,command:{...command,commandId:'again'},authoritativeRolls:{},confirmedBy:'actor'})
  expect(again.result.ok).toBe(false)

  const spent={...hero,classResources:{...hero.classResources,[key]:{current:0,max:1}}}
  expect(syncCharacterClassResources(spent).classResources?.[key].current).toBe(0)
  expect(syncCharacterClassResources(normalizeCharacter(JSON.parse(JSON.stringify(spent)))).classResources?.[key].current).toBe(0)
  expect(restoreClassResources(spent,'short-rest').classResources?.[key].current).toBe(1)
  expect(restoreClassResources(spent,'long-rest').classResources?.[key].current).toBe(1)
  expect(syncCharacterClassResources(normalizeCharacter({...seed,level:4})).classResources?.[key]).toBeUndefined()
  expect(syncCharacterClassResources({...hero,dnd5ePluginFeatureIds:[]}).classResources?.[key]).toBeUndefined()
 }finally{dispose()}
 expect(normalizeCharacter({id:'removed',name:'Removed',charClass:'战士',level:5,dnd5ePluginFeatureIds:['local.test.feature-uses:ward']}).classResources?.['local.test.feature-uses:ward-use']).toBeUndefined()
})

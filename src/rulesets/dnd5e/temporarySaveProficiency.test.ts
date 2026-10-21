import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {migrateCharacterToDnd5e,createCombatantFromDnd5eCharacter} from './character'
import {startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from './headlessCombatEngine'
import {dnd5eCombatantSavingThrowEffectBonus} from './concentrationDefense'
import {createDnd5eMechanicalEffect,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {compileDnd5eActivityPatternV1} from './activities/dnd5eActivityPatterns'
import {getRegisteredDnd5eActivity} from './activities/dnd5eActivityRegistry'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {dnd5eActivityPerTargetRollDeclarationsV1} from './activities/dnd5eActivityPerTargetRolls'
import {resolveRegisteredDnd5eActivityInCombatV1} from './activities/dnd5eActivityCombatAuthority'

it('imports temporary save training and resolves duplicate sources once using current proficiency',async()=>{
  const namespace='test.temporary-save-proficiency'
  const training=compileDnd5eActivityPatternV1({schemaVersion:1,id:'training',name:'Training',source:{kind:'feature',id:'training'},activation:{kind:'free'},target:{kind:'self'},pattern:'timed-effect',recipient:'actor',effect:{schemaVersion:1,id:'training',name:'Training',duration:{kind:'rounds',rounds:2,expiresAt:'source-turn-end'},stacking:'replace',modifiers:[{kind:'saving-throw-proficiency',ability:'str'},{kind:'saving-throw-proficiency',ability:'con'},{kind:'saving-throw-proficiency',ability:'con'}]}})
  const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:namespace,name:'Synthetic save proficiency',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only'},definitions:['training','probe'].map(id=>({schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id,name:id,automation:automationCapabilityFromLegacyStatus('full'),payload:{id,name:id,summary:'Synthetic',description:'Synthetic',automation:'full'},activities:id==='training'?[training]:[{schemaVersion:1,id:'probe',name:'Probe',activation:{kind:'free'},automation:automationCapabilityFromLegacyStatus('full'),legacySource:{kind:'feature',id:'probe'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},checks:[{id:'con',kind:'saving-throw',ability:'con',dc:{kind:'constant',value:10},rollId:'con',scope:'per-target',rollMode:'normal'}],outcomes:[{id:'probe',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'target',amount:{kind:'constant',value:1}}]}]}]}))}
  const decoded=await readDnd5eStarMod(await exportDnd5eStarMod((await readDnd5eStarMod(await exportDnd5eStarMod(bundle))).bundle))
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try{
    const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'法师',level:5,maxHp:30,currentHp:30,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},savingThrows:[],dnd5ePluginFeatureIds:[`${namespace}:training`,`${namespace}:probe`]})
    const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:20,position:{x:0,y:0}})
    const state=startDnd5eHeadlessCombat('training',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:1}])
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('hero','enemy')]:5}
    const grant=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,confirmedBy:'actor',authoritativeRolls:{},command:{schemaVersion:1,commandId:'grant',actorId:'hero',packageId:namespace,packageVersion:'1.0.0',activityId:'training',targetIds:['hero'],expectedRevision:1}})
    expect(grant.result.ok,JSON.stringify(grant.result)).toBe(true)
    if(!grant.result.ok)throw Error('Training failed')
    const loaded=JSON.parse(JSON.stringify(grant.result.state)) as typeof state
    const target=loaded.combatants.hero
    const original=target.classState.activeEffects?.find(effect=>effect.modifiers?.savingThrowProficiencies)
    expect(original?.modifiers?.savingThrowProficiencies).toEqual(['str','con'])
    if(!original)throw Error('Training modifier missing')
    expect(original.modifiers?.savingThrowBonusByAbility).toBeUndefined()
    const second=createDnd5eMechanicalEffect({definitionId:'second-source',label:'Second',targetId:target.id,source:{kind:'spell'},modifiers:{savingThrowProficiencies:['con']}})
    target.classState.activeEffects=[original,second]
    const probe=getRegisteredDnd5eActivity(namespace,'probe')!
    const compiled=compileDnd5eActivityHeadlessAction(probe)
    const declarations=dnd5eActivityPerTargetRollDeclarationsV1({activity:probe,actor:{id:'enemy',controller:'dm'},targets:[{id:'hero',controller:'players'}],declarations:compiled.perTargetRolls??[],hostAttackRollMode:()=> 'normal',hostSavingThrowMode:()=> 'normal'})
    expect(declarations).toHaveLength(1)
    const rolls=Object.fromEntries(declarations.map(roll=>[roll.id,{values:[7],modifier:0,total:7}]))
    for(const [proficiencyBonus,inherent,paused,expected] of [[3,false,false,3],[4,false,false,4],[4,true,false,0],[4,false,true,0]] as const){
      const current=structuredClone(loaded)
      current.initiativeIndex=current.initiativeOrder.indexOf('enemy')
      Object.assign(current.combatants.hero,{proficiencyBonus,savingThrowProficiencies:inherent?['con']:[]})
      current.combatants.hero.savingThrowBonuses.con=inherent?proficiencyBonus:0
      current.combatants.hero.baseSavingThrowBonuses.con=inherent?proficiencyBonus:0
      current.combatants.hero.classState.activeEffects=[original,second].map(effect=>({...effect,suspendedBy:paused?['antimagic']:undefined}))
      expect(dnd5eCombatantSavingThrowEffectBonus(current.combatants.hero,'con')).toBe(expected)
      const inputBefore=structuredClone(current)
      const direct=resolveDnd5eHeadlessAction(current,{type:'plugin',pluginId:namespace,actionId:probe.id,featureId:`${namespace}:probe`,actorId:'enemy',targetId:'hero',distanceFeet:5,rolls})
      expect(direct.ok,direct.ok?undefined:direct.reason).toBe(true)
      if(!direct.ok)throw Error('Direct probe failed')
      expect(direct.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',total:7+expected+(inherent?proficiencyBonus:0)}))
      const authority=resolveRegisteredDnd5eActivityInCombatV1({state:current,combatRevision:1,confirmedBy:'actor',authoritativeRolls:rolls,command:{schemaVersion:1,commandId:`probe-${proficiencyBonus}-${inherent}-${paused}`,actorId:'enemy',packageId:namespace,packageVersion:'1.0.0',activityId:'probe',targetIds:['hero'],expectedRevision:1}})
      expect(authority.result.ok,JSON.stringify(authority.result)).toBe(true)
      if(!authority.result.ok)throw Error('Authority probe failed')
      expect(authority.result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',total:7+expected+(inherent?proficiencyBonus:0)}))
      expect(current).toEqual(inputBefore)
    }
    const focusing=structuredClone(loaded)
    focusing.combatants.hero.concentrating=true
    focusing.combatants.hero.classState.concentrationSpellId='web'
    const concentration=resolveDnd5eHeadlessAction(focusing,{type:'concentration-save',actorId:'hero',d20:7,dc:10})
    expect(concentration.ok).toBe(true)
    if(!concentration.ok)throw Error('Concentration probe failed')
    expect(concentration.events).toContainEqual(expect.objectContaining({type:'concentration-resolved',total:10,success:true}))
    let expiring=structuredClone(loaded)
    expiring.combatants.hero.classState.activeEffects=[original]
    for(let turn=0;turn<6;turn++){
      const ended=resolveDnd5eHeadlessAction(expiring,{type:'end-turn',actorId:expiring.initiativeOrder[expiring.initiativeIndex]})
      expect(ended.ok).toBe(true)
      if(!ended.ok)throw Error('Turn advancement failed')
      expiring=ended.state
    }
    expect(dnd5eCombatantSavingThrowEffectBonus(expiring.combatants.hero,'con')).toBe(0)
    target.classState.activeEffects=[second]
    expect(dnd5eCombatantSavingThrowEffectBonus(target,'str')).toBe(0)
    expect(dnd5eCombatantSavingThrowEffectBonus(target,'con')).toBe(target.proficiencyBonus)
    target.classState.activeEffects=[]
    expect(dnd5eCombatantSavingThrowEffectBonus(target,'con')).toBe(0)
    expect(validateDnd5eActiveEffectsStrict([{...second,modifiers:{savingThrowProficiencies:['invalid']}}]).ok).toBe(false)
  }finally{dispose()}
})

import { describe, expect, it } from 'vitest'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {migrateCharacterToDnd5e,createCombatantFromDnd5eCharacter} from './character'
import {dnd5eEffectiveDarkvisionRangeFeet,startDnd5eHeadlessCombat,commitDnd5eActivityExecution,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {compileDnd5eActivityPatternV1} from './activities/dnd5eActivityPatterns'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './activities/dnd5eActivityCombatAuthority'
import {createDnd5eMechanicalEffect,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {validateDnd5eEffectDefinitionV1} from './activities/dnd5eActivityValidation'
import type {Dnd5eEffectDefinitionV1} from './activities/dnd5eEffectContracts'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {dnd5eCombatantCanSee,dnd5eAttackerIsUnseenForAttack,dnd5eTargetIsUnseenForAttack,dnd5eDirectedCombatantPairKey,dnd5eCombatantPairKey} from './headlessCombatEngine'
import type {BattleMap} from '../../store/maps'
import {
  compileDnd5eEffectiveVisionProfile,
  applyDnd5eEffectiveVisionProfile,
  dnd5eCharacterDarkvisionRangeFeet,
  dnd5eCharacterHasDevilsSight,
  dnd5eHasDarkvisionConcealment,
} from '../../../shared/dnd5e-vision-profile.mjs'

describe('D&D 5e effective vision profile', () => {
  it.each(['racial', 'existing'] as const)('installs legacy %s conditional sight as native permanent effects', async source => {
    const {package:pkg}=await prepareDnd5eLocalContentJson(JSON.stringify({name:'Legacy sight',version:'1.0.0',features:[{
      id:'sight',name:'Sight',summary:'Synthetic',description:'Synthetic',automation:'full',
      staticModifiers:source==='racial'
        ? {darkvisionRacialFallbackFeet:60,darkvisionRacialBonusFeet:30,invisibleToDarkvision:true}
        : {darkvisionRangeFeet:60,darkvisionIfAbsentFeet:30,darkvisionExistingBonusFeet:20,invisibleToDarkvision:true},
    }]}))
    const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try{
      for(const race of ['', '矮人']){
        const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'游侠',level:3,race,maxHp:20,currentHp:20,
          dnd5ePluginFeatureIds:[`${pkg.manifest.id}:sight`]})
        const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:10,position:{x:0,y:0}})
        expect(dnd5eEffectiveDarkvisionRangeFeet(actor)).toBe(source==='racial'?(race?90:60):80)
        expect(dnd5eHasDarkvisionConcealment({token:actor})).toBe(true)
      }
    }finally{dispose()}
  })

  it('commits a declared visual cap through Activity execution and restores sight at expiry',()=>{
    const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'法师',level:3,maxHp:20,currentHp:20})
    const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:15,position:{x:0,y:0}})
    const state=startDnd5eHeadlessCombat('sight-cap',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:1}])
    const activity=compileDnd5eActivityPatternV1({schemaVersion:1,id:'sight-cap',name:'Sight cap',source:{kind:'feature',id:'cap'},activation:{kind:'free'},target:{kind:'self'},pattern:'timed-effect',recipient:'actor',effect:{schemaVersion:1,id:'short-sight',name:'Short sight',magical:true,duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-start'},stacking:'replace',modifiers:[{kind:'sight-range-limit',rangeFeet:5}]}})
    const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(actor)
    const resolution=resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{}})
    const committed=commitDnd5eActivityExecution(state,{actorId:actor.id,activityId:activity.id,targetIds:[actor.id],resolution,source:{kind:'feature',id:'cap'}})
    expect(committed.ok,JSON.stringify(committed)).toBe(true)
    let restored=JSON.parse(JSON.stringify(committed.state))
    expect(compileDnd5eEffectiveVisionProfile({token:restored.combatants.hero}).sightRangeLimitFeet).toBe(5)
    restored=resolveDnd5eHeadlessAction(restored,{type:'end-turn',actorId:'hero'}).state
    restored=resolveDnd5eHeadlessAction(restored,{type:'end-turn',actorId:'enemy'}).state
    expect(compileDnd5eEffectiveVisionProfile({token:restored.combatants.hero}).sightRangeLimitFeet).toBeUndefined()
  })
  it('resolves concealment separately for each observer and illumination, without granting global invisible',()=>{
    const hero=normalizeCharacter({id:'hidden',name:'Hidden',charClass:'法师',level:3,maxHp:20,currentHp:20})
    const hidden=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:15,position:{x:0,y:0}})
    hidden.invisibleToDarkvision=true
    const viewer={...structuredClone(hidden),id:'viewer',invisibleToDarkvision:false,darkvisionRangeFeet:60,position:{x:1,y:0}}
    const state=startDnd5eHeadlessCombat('concealment',[hidden,viewer])
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey(viewer.id,hidden.id)]:5}
    const key=dnd5eDirectedCombatantPairKey(viewer.id,hidden.id)
    expect(dnd5eCombatantCanSee(state,viewer.id,hidden.id)).toBe(true)
    state.ordinaryDarknessByCombatantPair={[key]:true}
    expect(dnd5eCombatantCanSee(state,viewer.id,hidden.id)).toBe(false)
    expect(dnd5eAttackerIsUnseenForAttack(state,hidden.id,viewer.id)).toBe(true)
    expect(dnd5eTargetIsUnseenForAttack(state,viewer.id,hidden.id)).toBe(true)
    expect(state.combatants.hidden.conditions).not.toContain('invisible')
    for(const modifiers of [{seeInvisible:true},{truesightRangeFeet:60}]){
      state.combatants.viewer.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'sight',label:'Sight',targetId:'viewer',source:{kind:'spell'},modifiers})]
      expect(dnd5eCombatantCanSee(state,viewer.id,hidden.id),JSON.stringify({modifiers,effects:state.combatants.viewer.classState.activeEffects,range:dnd5eEffectiveDarkvisionRangeFeet(state.combatants.viewer)})).toBe(true)
    }
    state.combatants.viewer.classState.activeEffects=[]
    state.combatants.viewer.darknessSightRangeFeet=60
    expect(dnd5eCombatantCanSee(state,viewer.id,hidden.id)).toBe(true)
    state.combatants.viewer.darknessSightRangeFeet=0
    state.combatants.hidden.invisibleToDarkvision=false
    const conceal=createDnd5eMechanicalEffect({definitionId:'conceal',label:'Conceal',targetId:'hidden',source:{kind:'feature'},modifiers:{invisibleToDarkvision:true}})
    state.combatants.hidden.classState.activeEffects=[conceal]
    expect(dnd5eCombatantCanSee(state,viewer.id,hidden.id)).toBe(false)
    state.combatants.hidden.classState.activeEffects=[{...conceal,suspendedBy:['test']}]
    expect(dnd5eCombatantCanSee(state,viewer.id,hidden.id)).toBe(true)
    state.combatants.hidden.classState.activeEffects=[]
    expect(dnd5eCombatantCanSee(state,viewer.id,hidden.id)).toBe(true)
  })
  it.each([[0,120],[60,120],[120,150]])('commits racial conditional vision with racial base %s and temporary 120', (racial,expected)=>{
    const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'法师',level:3,maxHp:20,currentHp:20})
    const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:15,position:{x:0,y:0}})
    actor.racialDarkvisionRangeFeet=racial
    actor.darkvisionRangeFeet=racial
    actor.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'temporary',label:'Temporary',source:{kind:'spell'},targetId:actor.id,modifiers:{darkvisionRangeFeet:120}})]
    const state=startDnd5eHeadlessCombat('racial-sense',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:1}])
    const activity=compileDnd5eActivityPatternV1({schemaVersion:1,id:'racial-sense',name:'Sense',source:{kind:'feature',id:'sense'},activation:{kind:'free'},target:{kind:'self'},pattern:'timed-effect',recipient:'actor',effect:{schemaVersion:1,id:'racial-sight',name:'Sight',duration:{kind:'rounds',rounds:2,expiresAt:'source-turn-end'},stacking:'replace',modifiers:[{kind:'darkvision',rangeFeet:60,ifAbsent:true,existingBonusFeet:30,existingRangeSource:'race'},{kind:'darkvision-concealment'}]}})
    const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(actor)
    const resolution=resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{}})
    const result=commitDnd5eActivityExecution(state,{actorId:actor.id,activityId:activity.id,targetIds:[actor.id],resolution,source:{kind:'feature',id:'sense'}})
    expect(result.ok).toBe(true)
    if(!result.ok)throw new Error(JSON.stringify(result))
    const loaded=JSON.parse(JSON.stringify(result.state.combatants[actor.id]))
    expect(dnd5eEffectiveDarkvisionRangeFeet(loaded)).toBe(expected)
    expect(dnd5eHasDarkvisionConcealment({token:loaded})).toBe(true)
    loaded.classState.activeEffects=loaded.classState.activeEffects.filter((effect:{definitionId:string})=>effect.definitionId==='temporary')
    expect(dnd5eEffectiveDarkvisionRangeFeet(loaded)).toBe(120)
    expect(dnd5eHasDarkvisionConcealment({token:loaded})).toBe(false)
  })
  it.each([[0,30],[15,35],[60,80]])('commits a temporary conditional native Effect against base %s', (base,expected)=>{
    const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'法师',level:3,maxHp:20,currentHp:20})
    const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:15,position:{x:0,y:0}})
    actor.darkvisionRangeFeet=base
    const state=startDnd5eHeadlessCombat('conditional-sense',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:1}])
    const activity=compileDnd5eActivityPatternV1({schemaVersion:1,id:'sense',name:'Sense',source:{kind:'feature',id:'sense'},activation:{kind:'free'},target:{kind:'self'},pattern:'timed-effect',recipient:'actor',effect:{schemaVersion:1,id:'sight',name:'Sight',duration:{kind:'rounds',rounds:2,expiresAt:'source-turn-end'},stacking:'replace',modifiers:[{kind:'darkvision',rangeFeet:30,ifAbsent:true,existingBonusFeet:20}]}})
    const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(actor)
    const resolution=resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{}})
    expect(resolution.ok).toBe(true)
    const committed=commitDnd5eActivityExecution(state,{actorId:actor.id,activityId:activity.id,targetIds:[actor.id],resolution,source:{kind:'feature',id:'sense'}})
    expect(committed.ok).toBe(true)
    if(!committed.ok)throw new Error(JSON.stringify(committed))
    const loaded=JSON.parse(JSON.stringify(committed.state.combatants[actor.id])) as typeof actor
    expect(loaded.classState.activeEffects).toEqual(expect.arrayContaining([expect.objectContaining({modifiers:expect.objectContaining({darkvisionIfAbsentFeet:30,darkvisionExistingBonusFeet:20})})]))
    expect(dnd5eEffectiveDarkvisionRangeFeet(loaded)).toBe(expected)
    expect(dnd5eEffectiveDarkvisionRangeFeet(state.combatants[actor.id])).toBe(base)
  })
  it.each([
    [{darkvisionIfAbsentFeet:30},30],
    [{darkvisionRangeFeet:60,darkvisionIfAbsentFeet:60,darkvisionExistingBonusFeet:30},90],
    [{classState:{activeEffects:[{id:'sense',source:{actorId:'hero'},modifiers:{darkvisionIfAbsentFeet:30}}]}},30],
  ] as const)('preserves character-only sense projection and clears it with fresh character data', (character,expected)=>{
    const first=compileDnd5eEffectiveVisionProfile({token:{},character})
    expect(first.darkvisionRangeFeet).toBe(expected)
    const projected=JSON.parse(JSON.stringify(applyDnd5eEffectiveVisionProfile({},first)))
    expect(compileDnd5eEffectiveVisionProfile({token:projected}).darkvisionRangeFeet).toBe(expected)
    const second=applyDnd5eEffectiveVisionProfile(projected,compileDnd5eEffectiveVisionProfile({token:projected}))
    expect(compileDnd5eEffectiveVisionProfile({token:second}).darkvisionRangeFeet).toBe(expected)
    const cleared=applyDnd5eEffectiveVisionProfile(second,compileDnd5eEffectiveVisionProfile({token:second,character:{}}))
    expect(compileDnd5eEffectiveVisionProfile({token:cleared}).darkvisionRangeFeet).toBe(0)
  })

  it('uses fresh token effects instead of cached temporary character senses',()=>{
    const character={classState:{activeEffects:[{id:'conditional',modifiers:{darkvisionIfAbsentFeet:30}},{id:'temporary',modifiers:{darkvisionRangeFeet:60}}]}}
    const token=applyDnd5eEffectiveVisionProfile({},compileDnd5eEffectiveVisionProfile({token:{},character}))
    expect(compileDnd5eEffectiveVisionProfile({token}).darkvisionRangeFeet).toBe(60)
    expect(compileDnd5eEffectiveVisionProfile({token:{...token,dnd5eCombatState:{activeEffects:[]}}}).darkvisionRangeFeet).toBe(0)
  })

  it('treats an edited projected range as a new base instead of restoring stale input',()=>{
    const character={darkvisionIfAbsentFeet:60,darkvisionExistingBonusFeet:30}
    const token=applyDnd5eEffectiveVisionProfile({},compileDnd5eEffectiveVisionProfile({token:{},character}))
    const edited={...token,darkvisionRangeFeet:15}
    const profile=compileDnd5eEffectiveVisionProfile({token:edited})
    expect(profile.darkvisionRangeFeet).toBe(45)
    const refreshed=applyDnd5eEffectiveVisionProfile(edited,profile)
    expect(compileDnd5eEffectiveVisionProfile({token:JSON.parse(JSON.stringify(refreshed))}).darkvisionRangeFeet).toBe(45)
  })

  it('validates and reloads conditional effect modifiers without accepting malformed branches',()=>{
    const definition:Dnd5eEffectDefinitionV1={schemaVersion:1,id:'sense',name:'Sense',duration:{kind:'permanent'},stacking:'replace',modifiers:[{kind:'darkvision',rangeFeet:30,ifAbsent:true,existingBonusFeet:20}]}
    expect(validateDnd5eEffectDefinitionV1(definition)).toEqual([])
    for(const modifier of [{kind:'darkvision',rangeFeet:30,ifAbsent:false},{kind:'darkvision',rangeFeet:30,existingBonusFeet:20},{kind:'darkvision',rangeFeet:30,ifAbsent:true,existingBonusFeet:-1}]){
      expect(validateDnd5eEffectDefinitionV1({...definition,modifiers:[modifier]} as Dnd5eEffectDefinitionV1).length).toBeGreaterThan(0)
    }
    const effect=createDnd5eMechanicalEffect({definitionId:'sense',label:'Sense',source:{kind:'feature'},targetId:'actor',modifiers:{darkvisionIfAbsentFeet:30,darkvisionExistingBonusFeet:20}})
    expect(effect.modifiers).toMatchObject({darkvisionIfAbsentFeet:30,darkvisionExistingBonusFeet:20})
    expect(validateDnd5eActiveEffectsStrict(JSON.parse(JSON.stringify([effect])))).toMatchObject({ok:true})
    expect(validateDnd5eActiveEffectsStrict([{...effect,modifiers:{darkvisionIfAbsentFeet:-1}}])).toMatchObject({ok:false})
  })
  it('imports conditional permanent senses and agrees with Host after selection and temporary changes',async()=>{
    const namespace='test.conditional-senses'
    const entries:Array<[string,NonNullable<Dnd5eEffectDefinitionV1['modifiers']>[number]]>=[
      ['fallback',{kind:'darkvision',rangeFeet:30,ifAbsent:true}],
      ['branch',{kind:'darkvision',rangeFeet:60,ifAbsent:true,existingBonusFeet:30}],
      ['racial',{kind:'darkvision',rangeFeet:60,ifAbsent:true,existingBonusFeet:30,existingRangeSource:'race'}],
      ['concealment',{kind:'darkvision-concealment'}],
      ['short',{kind:'darkvision',rangeFeet:15}],['long',{kind:'darkvision',rangeFeet:60}]]
    const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:namespace,name:'Synthetic senses',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only'},definitions:entries.map(([id,modifier])=>({schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id,name:id,automation:automationCapabilityFromLegacyStatus('full'),payload:{id,name:id,summary:'Synthetic',description:'Synthetic',automation:'full'},effects:[{schemaVersion:1,id:`${id}-effect`,name:id,duration:{kind:'permanent'},stacking:'unique-by-source',modifiers:[modifier]}]}))}
    const first=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
    const second=await readDnd5eStarMod(await exportDnd5eStarMod(first.bundle))
    const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(second.bundle))
    try{
      for(const race of ['', '矮人']){
        const hero=normalizeCharacter({id:'racial-hero',name:'Hero',charClass:'法师',level:3,maxHp:20,currentHp:20,race,dnd5ePluginFeatureIds:[`${namespace}:racial`,`${namespace}:concealment`]})
        const projected=migrateCharacterToDnd5e(hero)
        const actor=createCombatantFromDnd5eCharacter({character:projected,controller:'player',initiativeD20:10,position:{x:0,y:0}})
        expect(actor.racialDarkvisionRangeFeet ?? 0).toBe(race ? 60 : 0)
        expect(actor.invisibleToDarkvision).toBe(true)
        expect(dnd5eEffectiveDarkvisionRangeFeet(actor)).toBe(race ? 90 : 60)
        const temporary=createDnd5eMechanicalEffect({definitionId:'temporary',label:'Temporary',targetId:actor.id,source:{kind:'spell'},modifiers:{darkvisionRangeFeet:120}})
        actor.classState.activeEffects=[temporary]
        expect(dnd5eEffectiveDarkvisionRangeFeet(actor)).toBe(120)
        const token=applyDnd5eEffectiveVisionProfile({},compileDnd5eEffectiveVisionProfile({character:{...projected,classState:actor.classState}}))
        expect(compileDnd5eEffectiveVisionProfile({token:JSON.parse(JSON.stringify(token))}).darkvisionRangeFeet).toBe(120)
        actor.classState.activeEffects=[]
        expect(dnd5eEffectiveDarkvisionRangeFeet(actor)).toBe(race ? 90 : 60)
      }
      for(const [ids,expected] of [[[],0],[['fallback'],30],[['short','fallback'],15],[['branch'],60],[['long','branch'],90],[['long','branch','fallback'],90]] as Array<[string[],number]>){
        const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'法师',level:3,maxHp:20,currentHp:20,race:'',dnd5ePluginFeatureIds:ids.map(id=>`${namespace}:${id}`)})
        const before=structuredClone(hero)
        const projected=migrateCharacterToDnd5e(JSON.parse(JSON.stringify(hero)))
        const actor=createCombatantFromDnd5eCharacter({character:projected,controller:'player',initiativeD20:10,position:{x:0,y:0}})
        expect(dnd5eEffectiveDarkvisionRangeFeet(actor)).toBe(expected)
        const token={dnd5eCharacterDarkvisionRangeFeet:projected.darkvisionRangeFeet,dnd5eCharacterDarkvisionIfAbsentFeet:projected.darkvisionIfAbsentFeet,dnd5eCharacterDarkvisionExistingBonusFeet:projected.darkvisionExistingBonusFeet}
        expect(compileDnd5eEffectiveVisionProfile({token,character:projected}).darkvisionRangeFeet).toBe(expected)
        const map:BattleMap={id:'sense-map',name:'Map',width:100,height:100,gridSize:10,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{...token,id:'hero-token',characterId:hero.id,label:'Hero',x:0,y:0,color:'',emoji:'',size:1,type:'player',hp:20,maxHp:20}]}
        const mapped=createDnd5eMapCombatSnapshot({combatId:'sense-combat',map,characters:[hero],initiativeOrder:[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:10}]})
        expect(dnd5eEffectiveDarkvisionRangeFeet(mapped.state.combatants['hero-token'])).toBe(expected)
        if(ids.length===2&&ids.includes('long')&&ids.includes('branch')){
          for(const mode of ['wild-shape','shapechange','polymorph','true-polymorph'] as const)for(const form of ['srd-5.1:giant-eagle','srd-5.1:giant-spider']){
            const transformed={...hero,charClass:'德鲁伊',level:8,dnd5eClassLevels:{druid:8},dnd5eClassChoices:{classes:{druid:{selections:{'wild-shape-known-forms':[form]}}}},dnd5eCombatState:{wildShapeFormId:form,wildShapeMode:mode,wildShapeCurrentHp:20,wildShapeRoundsRemaining:10,wildShapeMaximumChallengeRating:1,wildShapeOriginalCurrentHp:20,wildShapeOriginalMaxHp:20,wildShapeOriginalArmorClass:10,wildShapeOriginalSpeed:30,wildShapeOriginalAbilities:{...hero.abilities},wildShapeOriginalSavingThrowBonuses:{str:0,dex:0,con:0,int:0,wis:0,cha:0}}}
            const projectedForm=migrateCharacterToDnd5e(transformed)
            const formActor=createCombatantFromDnd5eCharacter({character:projectedForm,controller:'player',initiativeD20:15,position:{x:0,y:0}})
            const wanted=form.endsWith('giant-eagle')?0:mode==='polymorph'||mode==='true-polymorph'?60:90
            expect(dnd5eEffectiveDarkvisionRangeFeet(formActor),`${mode}/${form}`).toBe(wanted)
            expect(compileDnd5eEffectiveVisionProfile({token,character:projectedForm}).darkvisionRangeFeet).toBe(wanted)
            const formMap=createDnd5eMapCombatSnapshot({combatId:'form-vision',map,characters:[transformed],initiativeOrder:[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:10}]})
            expect(dnd5eEffectiveDarkvisionRangeFeet(formMap.state.combatants['hero-token'])).toBe(wanted)
            if(mode==='wild-shape'){
              const combat=startDnd5eHeadlessCombat('vision-restore',[formActor,{...structuredClone(formActor),id:'enemy',controller:'dm',initiative:1}])
              const restored=resolveDnd5eHeadlessAction(combat,{type:'druid-end-wild-shape',actorId:formActor.id})
              expect(restored.ok).toBe(true)
              if(!restored.ok)throw new Error(JSON.stringify(restored))
              expect(dnd5eEffectiveDarkvisionRangeFeet(restored.state.combatants[formActor.id])).toBe(90)
            }
          }
        }
        if(ids.includes('branch')){
          const temporary=createDnd5eMechanicalEffect({definitionId:'test:temporary-sight',label:'Sight',targetId:actor.id,source:{kind:'spell'},modifiers:{darkvisionRangeFeet:120}})
          actor.classState.activeEffects=[temporary]
          expect(dnd5eEffectiveDarkvisionRangeFeet(actor)).toBe(150)
          expect(compileDnd5eEffectiveVisionProfile({token:{...token,dnd5eCombatState:{activeEffects:[temporary]}},character:projected}).darkvisionRangeFeet).toBe(150)
          actor.classState.activeEffects=[{...temporary,suspendedBy:['antimagic']}]
          expect(dnd5eEffectiveDarkvisionRangeFeet(actor)).toBe(expected)
        }
        expect(hero).toEqual(before)
      }
    }finally{dispose()}
  })
  it.each([[0,30],[15,25],[60,70]])('resolves conditional senses after existing range %s', (range,expected)=>{
    const effect={id:'sense',source:{actorId:'owner'},modifiers:{darkvisionIfAbsentFeet:30,darkvisionExistingBonusFeet:10}}
    const token={darkvisionRangeFeet:range,dnd5eCombatState:{activeEffects:[effect]}}
    const character={dnd5eCombatState:{activeEffects:[structuredClone(effect)]}}
    const profile=compileDnd5eEffectiveVisionProfile({token,character})
    expect(profile.darkvisionRangeFeet).toBe(expected)
    expect(profile.magicalDarknessSightRangeFeet).toBe(0)
    const projected=JSON.parse(JSON.stringify(applyDnd5eEffectiveVisionProfile(token,profile)))
    expect(compileDnd5eEffectiveVisionProfile({token:projected,character}).darkvisionRangeFeet).toBe(expected)
    expect(compileDnd5eEffectiveVisionProfile({token:{...projected,dnd5eCombatState:{activeEffects:[]}}}).darkvisionRangeFeet).toBe(range)
  })

  it('recomputes branches when temporary vision or suppression changes',()=>{
    const conditional={id:'conditional',modifiers:{darkvisionIfAbsentFeet:30,darkvisionExistingBonusFeet:20}}
    const temporary={id:'temporary',modifiers:{darkvisionRangeFeet:60}}
    const evaluate=(effects:unknown[])=>compileDnd5eEffectiveVisionProfile({token:{dnd5eCombatState:{activeEffects:effects}}}).darkvisionRangeFeet
    expect(evaluate([conditional])).toBe(30)
    expect(evaluate([conditional,temporary])).toBe(80)
    expect(evaluate([{...conditional,suspendedBy:['antimagic']},temporary])).toBe(60)
    expect(evaluate([conditional,{...temporary,suspendedBy:['antimagic']}])).toBe(30)
    expect(evaluate([{id:'only-if-absent',modifiers:{darkvisionIfAbsentFeet:30}},{id:'short',modifiers:{darkvisionRangeFeet:15}}])).toBe(15)
  })

  it('does not double permanent projections and bounds conditional ranges',()=>{
    expect(compileDnd5eEffectiveVisionProfile({token:{darkvisionRangeFeet:60,dnd5eCharacterDarkvisionExistingBonusFeet:30},character:{darkvisionExistingBonusFeet:30}}).darkvisionRangeFeet).toBe(90)
    expect(compileDnd5eEffectiveVisionProfile({token:{darkvisionRangeFeet:9990,darkvisionExistingBonusFeet:30}}).darkvisionRangeFeet).toBe(10000)
    expect(compileDnd5eEffectiveVisionProfile({token:{darkvisionIfAbsentFeet:NaN,darkvisionExistingBonusFeet:-20}}).darkvisionRangeFeet).toBe(0)
  })

  it('uses the host-resolved character Darkvision without inspecting content ids', () => {
    expect(dnd5eCharacterDarkvisionRangeFeet({ darkvisionRangeFeet: 60 })).toBe(60)
    expect(dnd5eCharacterDarkvisionRangeFeet({ darkvisionRangeFeet: 120 })).toBe(120)
    expect(dnd5eCharacterDarkvisionRangeFeet({ darkvisionRangeFeet: 99_999 })).toBe(10_000)
    expect(dnd5eCharacterDarkvisionRangeFeet({ race: 'private-room-race' })).toBe(0)
  })

  it('merges a room-token character projection with explicit token vision', () => {
    expect(compileDnd5eEffectiveVisionProfile({
      token: { darkvisionRangeFeet: 30, dnd5eCharacterDarkvisionRangeFeet: 120 },
    }).darkvisionRangeFeet).toBe(120)
  })

  it('merges temporary effects and clamps untrusted ranges', () => {
    const profile = compileDnd5eEffectiveVisionProfile({
      token: {
        darkvisionRangeFeet: -30,
        dnd5eCombatState: {
          activeEffects: [{ modifiers: { darkvisionRangeFeet: 60, truesightRangeFeet: 120 } }],
        },
        truesightRangeFeet: 99_999,
      },
      fallbackRangeFeet: 30,
    })
    expect(profile).toMatchObject({
      schemaVersion: 1,
      normalRangeFeet: 30,
      darkvisionRangeFeet: 60,
      truesightRangeFeet: 10_000,
    })
  })

  it('projects temporary spell truesight from either the token or linked character', () => {
    expect(compileDnd5eEffectiveVisionProfile({
      token: {
        dnd5eCombatState: {
          activeEffects: [{ modifiers: { truesightRangeFeet: 90 } }],
        },
      },
      character: {
        dnd5eCombatState: {
          activeEffects: [{ modifiers: { truesightRangeFeet: 120 } }],
        },
      },
    }).truesightRangeFeet).toBe(120)
  })

  it('turns Devil\'s Sight into normal sight through both kinds of darkness', () => {
    const character = {
      dnd5eClassChoices: {
        classes: {
          warlock: {
            selections: { 'eldritch-invocations': ['devils-sight'] },
          },
        },
      },
    }
    expect(dnd5eCharacterHasDevilsSight(character)).toBe(true)
    expect(compileDnd5eEffectiveVisionProfile({ token: {}, character })).toMatchObject({
      darknessSightRangeFeet: 120,
      magicalDarknessSightRangeFeet: 120,
    })
  })

  it('derives monster senses and Devil\'s Sight from the stat block', () => {
    expect(compileDnd5eEffectiveVisionProfile({
      token: {},
      monster: {
        senses: [{ name: 'Darkvision', distanceFeet: 60 }],
        traits: [{ name: "Devil's Sight" }],
      },
    })).toMatchObject({
      darkvisionRangeFeet: 60,
      darknessSightRangeFeet: 120,
      magicalDarknessSightRangeFeet: 120,
    })
  })
})

it.each([
  ['token', 'dnd5eCombatState'], ['token', 'classState'],
  ['character', 'dnd5eCombatState'], ['character', 'classState'],
] as const)('ignores suspended sense effects in %s.%s without removing natural senses', (owner, stateField) => {
  const effect = { modifiers: { darkvisionRangeFeet: 60, truesightRangeFeet: 60 } }
  const profile = (suspendedBy?: string[]) => compileDnd5eEffectiveVisionProfile({
    token: { darkvisionRangeFeet: 30 },
    [owner]: { ...(owner === 'token' ? { darkvisionRangeFeet: 30 } : {}), [stateField]: { activeEffects: [{ ...effect, suspendedBy }] } },
  })
  expect(profile()).toMatchObject({ darkvisionRangeFeet: 60, truesightRangeFeet: 60 })
  expect(profile(['antimagic'])).toMatchObject({ darkvisionRangeFeet: 30, truesightRangeFeet: 0 })
  expect(profile([])).toMatchObject({ darkvisionRangeFeet: 60, truesightRangeFeet: 60 })
})

import {expect,it} from 'vitest'
import {createDnd5eConditionEffect,createDnd5eMechanicalEffect,normalizeDnd5eActiveEffects,reconcileDnd5eEffectCompletionRequirements,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {applyDnd5eStandardConditionEffect,createDnd5eCombatant,replaceDnd5eCombatantActiveEffects} from './headlessCombatEngine'
import {planDnd5eExpiredRestCompletions} from './restCompletion'

const sleep=()=>createDnd5eConditionEffect({id:'sleep',condition:'unconscious',source:{kind:'spell',rulesId:'synthetic-rest'},targetId:'target',
  duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},completionRequirement:{condition:'unconscious',interrupted:false}})
const blocker=()=>createDnd5eMechanicalEffect({id:'blocker',definitionId:'blocker',label:'Blocker',source:{kind:'dm'},targetId:'target',duration:{type:'permanent'},modifiers:{}})

it('persists valid completion history and rejects malformed completion snapshots',()=>{
  const effect=sleep()
  expect(normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))[0].completionRequirement).toEqual(effect.completionRequirement)
  for(const value of [{condition:'unknown',interrupted:false},{condition:'unconscious'},{condition:'unconscious',interrupted:'false'}]){
    expect(validateDnd5eActiveEffectsStrict([{...effect,completionRequirement:value}]).ok).toBe(false)
  }
})

it('rejects rewards without a supported kind, timed duration and explicit uninterrupted requirement',()=>{
  const effect={...sleep(),completionReward:{kind:'short-rest' as const}}
  expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(true)
  for(const invalid of [{...effect,completionReward:{kind:'long-rest'}},{...effect,completionRequirement:undefined},{...effect,duration:{type:'permanent'}}]){
    expect(validateDnd5eActiveEffectsStrict([invalid]).ok).toBe(false)
  }
})

it('records suppression permanently without mutating the original effects',()=>{
  const original=sleep()
  expect(reconcileDnd5eEffectCompletionRequirements([original])[0].completionRequirement?.interrupted).toBe(false)
  const interrupted=reconcileDnd5eEffectCompletionRequirements([{...original,suspendedBy:['blocker']},blocker()])[0]
  expect(interrupted.completionRequirement?.interrupted).toBe(true)
  const resumed=reconcileDnd5eEffectCompletionRequirements([{...interrupted,suspendedBy:undefined}])[0]
  expect(resumed.completionRequirement?.interrupted).toBe(true)
  expect(original.completionRequirement?.interrupted).toBe(false)
})

it('records loss of the required condition even while the tracking effect remains effective',()=>{
  const tracker=createDnd5eMechanicalEffect({id:'tracker',definitionId:'tracker',label:'Tracker',source:{kind:'spell'},targetId:'target',duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},completionRequirement:{condition:'unconscious',interrupted:false},modifiers:{}})
  const valid=reconcileDnd5eEffectCompletionRequirements([tracker,sleep()])[0]
  expect(valid.completionRequirement?.interrupted).toBe(false)
  const interrupted=reconcileDnd5eEffectCompletionRequirements([valid])[0]
  expect(reconcileDnd5eEffectCompletionRequirements([interrupted,sleep()])[0].completionRequirement?.interrupted).toBe(true)
})

it('records interruption through the actual Headless effect replacement path',()=>{
  const target=createDnd5eCombatant({id:'target',name:'Target',controller:'player',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  replaceDnd5eCombatantActiveEffects(target,[sleep()])
  expect(target.classState.activeEffects?.[0].completionRequirement?.interrupted).toBe(false)
  replaceDnd5eCombatantActiveEffects(target,[{...target.classState.activeEffects![0],suspendedBy:['blocker']},blocker()])
  expect(target.classState.activeEffects?.find(effect=>effect.id==='sleep')?.completionRequirement?.interrupted).toBe(true)
  replaceDnd5eCombatantActiveEffects(target,target.classState.activeEffects!.filter(effect=>effect.id==='sleep').map(effect=>({...effect,suspendedBy:undefined})))
  expect(target.classState.activeEffects?.[0].completionRequirement?.interrupted).toBe(true)
  replaceDnd5eCombatantActiveEffects(target,target.classState.activeEffects!.map(effect=>({...effect,completionRequirement:{condition:'unconscious',interrupted:false}})))
  expect(target.classState.activeEffects?.[0].completionRequirement?.interrupted).toBe(true)
})

it('prevents reapplying a completed rest reward but permits ordinary conditions and reuse after receipt removal',()=>{
  const effect={...sleep(),completionReward:{kind:'short-rest' as const}}
  const receipt=planDnd5eExpiredRestCompletions({targetId:'target',effects:[effect],expiredEffectIds:['sleep']}).lockouts
  const target=createDnd5eCombatant({id:'target',name:'Target',controller:'player',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,classState:{activeEffects:receipt}})
  const input={rulesId:'synthetic-rest',condition:'unconscious' as const,duration:{type:'rounds' as const,remainingRounds:100,tickOn:'target-turn-end' as const},completionReward:{kind:'short-rest' as const},completionRequirement:{condition:'unconscious' as const,interrupted:false}}
  const events:Parameters<typeof applyDnd5eStandardConditionEffect>[3]=[]
  expect(applyDnd5eStandardConditionEffect(target,undefined,input,events)).toBe(false)
  expect(events).toContainEqual(expect.objectContaining({type:'condition-attempted',prevented:true}))
  expect(target.conditions).not.toContain('unconscious')
  expect(applyDnd5eStandardConditionEffect(target,undefined,{...input,rulesId:'ordinary-sleep',completionReward:undefined,completionRequirement:undefined},[])).toBe(true)
  replaceDnd5eCombatantActiveEffects(target,[])
  expect(applyDnd5eStandardConditionEffect(target,undefined,input,[])).toBe(true)
  expect(target.classState.activeEffects?.find(entry=>entry.standardCondition==='unconscious')?.completionReward).toEqual({kind:'short-rest'})
})

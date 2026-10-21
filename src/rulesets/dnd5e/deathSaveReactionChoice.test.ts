import {expect,it} from 'vitest'
import {chooseDnd5eDeathSaveReaction,type Dnd5eDeathSaveChoicePrompt} from './deathSaveReactionChoice'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from './headlessCombatEngine'
import {dnd5eCombatantPairKey} from './headlessCombatPrimitives'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'

function fixture(){
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',initiative:20,controller:'player',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
    proficiencyBonus:2,armorClass:10,currentHp:0,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('choice',[actor,{...structuredClone(actor),id:'near',name:'Nearby creature',currentHp:20,controller:'dm',initiative:10},
    {...structuredClone(actor),id:'far',name:'Far creature',currentHp:20,controller:'dm',initiative:5}])
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','near')]:15,[dnd5eCombatantPairKey('actor','far')]:35}
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'recover',name:'Recovery',activation:{kind:'free'},
    target:{kind:'creature',relation:'any',count:2,minimumCount:0,rangeFeet:30},automation:automationCapabilityFromLegacyStatus('full'),
    choices:[{id:'posture',label:'Stand up?',options:[{id:'stand',label:'Stand'},{id:'remain',label:'Remain prone'}]}],
    outcomes:[{id:'stand',when:{kind:'choice',choiceId:'posture',optionId:'stand'},operations:[{id:'stand',kind:'remove-standard-condition',target:'actor',condition:'prone'}]}]}
  return {actorId:'actor',eventId:'choice',state,candidates:[{packageId:'test.choice',packageVersion:'1.0.0',activity}]}
}

it.each([
  ['decline',['decline']],['cancel',['cancel']],['choice-cancel',['ability-0','cancel']],
  ['empty',['ability-0','option-remain','done']],['one',['ability-0','option-stand','target-0','done']],
  ['deselect',['ability-0','option-stand','target-0','target-0','done']],
] as const)('presents %s selection without losing actor choice',async(mode,answers)=>{
  const request=fixture(),before=structuredClone(request),prompts:Dnd5eDeathSaveChoicePrompt[]=[]
  let index=0
  const result=await chooseDnd5eDeathSaveReaction(request,async prompt=>{
    prompts.push(structuredClone(prompt))
    const answer=answers[index++]
    expect(prompt.options.some(option=>option.id===answer)).toBe(true)
    return answer
  })
  expect(index).toBe(answers.length)
  expect(request).toEqual(before)
  if(mode==='decline')expect(result).toEqual({kind:'decline'})
  else if(mode==='cancel'||mode==='choice-cancel')expect(result).toEqual({kind:'cancel'})
  else{
    expect(result).toMatchObject({kind:'replace',packageId:'test.choice',activityId:'recover',targetIds:mode==='one'?['near']:[],choices:{posture:mode==='empty'?'remain':'stand'}})
    const targetPrompts=prompts.filter(prompt=>prompt.id.startsWith('targets'))
    expect(targetPrompts.every(prompt=>!prompt.options.some(option=>option.label.includes('Far creature')))).toBe(true)
    expect(targetPrompts[0].options.some(option=>option.label==='Nearby creature')).toBe(true)
    if(mode==='one'||mode==='deselect')expect(targetPrompts[1].options.some(option=>option.label==='✓ Nearby creature')).toBe(true)
  }
})

it('does not offer completion below the declared minimum or accept a forged option',async()=>{
  const request=fixture()
  request.candidates[0].activity.target={kind:'creature',relation:'any',count:1,rangeFeet:30}
  let step=0
  const result=await chooseDnd5eDeathSaveReaction(request,async prompt=>{
    step++
    if(step===1)return 'ability-0'
    if(step===2)return 'option-stand'
    expect(prompt.options.some(option=>option.id==='done')).toBe(false)
    return 'done'
  })
  expect(result).toEqual({kind:'cancel'})
})

it('uses the actor directly for a self-target recovery',async()=>{
  const request=fixture();request.candidates[0].activity.target={kind:'self'}
  let step=0
  const result=await chooseDnd5eDeathSaveReaction(request,async()=>++step===1?'ability-0':'option-remain')
  expect(result).toMatchObject({kind:'replace',targetIds:['actor']})
  expect(step).toBe(2)
})

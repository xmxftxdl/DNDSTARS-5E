import {expect,it} from 'vitest'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {promptDnd5eActivityChoice} from '../../../pages/maps/dnd5eActivityChoicePager'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {countDnd5eActivityTextWords} from './dnd5eActivityTextInput'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'inscribe',name:'Inscribe',activation:{kind:'action'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),choices:[{id:'text',label:'文字',textInput:{maximumLength:12},options:[]}],outcomes:[{id:'create',when:{kind:'always'},operations:[{id:'mark',kind:'create-persistent-area',label:'Mark',labelTextChoiceId:'text',durationRounds:600,concentration:false}]}]}
const actor={id:'caster',controller:'players' as const,level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20}
it.each(['向北走','<b>text</b>','','x'.repeat(13),'bad\u0000text'])('Host validates bounded plain text: %j',text=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const result=resolveDnd5eActivity({activity,actor,targets:[actor],rolls:{},choices:{text}})
 expect(result.ok).toBe(text.length>0&&text.length<=12&&!text.includes('\u0000'))
 if(result.ok)expect(result.proposals[0]).toMatchObject({kind:'create-persistent-area',label:text})
})
it('rejects undeclared text references and oversized input schemas',()=>{
 const bad=structuredClone(activity);bad.choices![0].textInput!.maximumLength=10000
 expect(validateDnd5eActivityDefinitionV1(bad).some(e=>e.includes('textInput'))).toBe(true)
 bad.choices=[]
 expect(validateDnd5eActivityDefinitionV1(bad).some(e=>e.includes('labelTextChoiceId'))).toBe(true)
})
it('uses the text prompt without opening an empty option list',async()=>{
 const unexpected=async()=>{throw Error('closed choice called')}
 const result=await promptDnd5eActivityChoice({ownerLabel:'Spell',choiceLabel:'文字',options:[],textInput:{maximumLength:12},prompt:async()=> '向北走',directionStepper:unexpected,choiceGroups:unexpected,actionChoice:unexpected,notifyInvalid:unexpected})
 expect(result).toEqual({id:'向北走',label:'向北走'})
})
it('enforces word limits at Host resolution without reducing words to characters',()=>{
 const bounded=structuredClone(activity)
 bounded.choices![0].textInput={maximumLength:160,maximumWords:10}
 expect(validateDnd5eActivityDefinitionV1(bounded)).toEqual([])
 for(const [text,allowed] of [
  ['Meet us outside the northern gate before the sunrise tomorrow',true],
  ['Meet us outside the northern gate before the sunrise tomorrow please',false],
  ['请于明日清晨北门集合',true],['请于明日清晨北门外集合',false],
  ["Don't stop",true],['!!!',false],['东门 meet us',true],
 ] as const){
  const result=resolveDnd5eActivity({activity:bounded,actor,targets:[actor],rolls:{},choices:{text}})
  expect(result.ok,text).toBe(allowed)
  if(result.ok)expect(result.proposals[0]).toMatchObject({label:text})
 }
 expect(countDnd5eActivityTextWords('东门 meet us')).toBe(4)
 expect(countDnd5eActivityTextWords("Don't stop")).toBe(2)
 bounded.choices![0].textInput.maximumWords=0
 expect(validateDnd5eActivityDefinitionV1(bounded).some(e=>e.includes('textInput'))).toBe(true)
})
it('rejects over-budget words in the player input before returning a choice',async()=>{
 let warned=false,message=''
 const unexpected=async()=>{throw Error('closed choice called')}
 const result=await promptDnd5eActivityChoice({ownerLabel:'Spell',choiceLabel:'文字',options:[],textInput:{maximumLength:160,maximumWords:2},
  prompt:async label=>{message=label;return 'one two three'},directionStepper:unexpected,choiceGroups:unexpected,actionChoice:unexpected,
  notifyInvalid:async()=>{warned=true}})
 expect(result).toBeNull();expect(warned).toBe(true);expect(message).toContain('最多 2 词')
})

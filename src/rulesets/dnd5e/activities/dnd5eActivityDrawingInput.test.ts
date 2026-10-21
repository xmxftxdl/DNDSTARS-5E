import {expect,it} from 'vitest'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {dnd5eActivityChoiceIsRelevantV1} from './dnd5eActivityChoices'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'draw',name:'Draw',activation:{kind:'action'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),choices:[{id:'drawing',label:'图案',textInput:{maximumLength:65536,format:'surface-drawing'},options:[]}],outcomes:[{id:'create',when:{kind:'always'},operations:[{id:'mark',kind:'create-persistent-area',label:'图案',drawingTextChoiceId:'drawing',durationRounds:600,concentration:false}]}]}
const actor={id:'caster',controller:'players' as const,level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20}
const drawing={version:1,strokes:[{points:[0.1,0.2,0.8,0.9],color:'#112233',width:0.02}]}
it('resolves validated player strokes into the persistent area visual',()=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(dnd5eActivityChoiceIsRelevantV1(activity,{id:'drawing'},{})).toBe(true)
 const result=resolveDnd5eActivity({activity,actor,targets:[actor],rolls:{},choices:{drawing:JSON.stringify(drawing)}})
 expect(result.ok).toBe(true)
 if(result.ok)expect(result.proposals[0]).toMatchObject({kind:'create-persistent-area',visual:{preset:'surface-drawing',drawing}})
})
it.each(['','{}','not-json',JSON.stringify({...drawing,strokes:[]})])('rejects invalid drawing without proposals: %s',drawing=>{
 expect(resolveDnd5eActivity({activity,actor,targets:[actor],rolls:{},choices:{drawing}}).ok).toBe(false)
})
it('rejects a drawing reference to ordinary text input',()=>{
 const bad=structuredClone(activity);bad.choices![0].textInput={maximumLength:80}
 expect(validateDnd5eActivityDefinitionV1(bad).some(e=>e.includes('drawingTextChoiceId'))).toBe(true)
})
it('retains elevated surface material validation in the Host proposal',()=>{
 const elevated=structuredClone(activity)
 const operation=elevated.outcomes[0].operations[0]
 if(operation.kind!=='create-persistent-area')throw Error('fixture')
 Object.assign(operation,{anchorMode:'fixed',surfaceMaterials:['stone','earth'],requireAllSurfaceMaterials:true,surfaceAtPlacementElevation:true})
 expect(validateDnd5eActivityDefinitionV1(elevated)).toEqual([])
 const result=resolveDnd5eActivity({activity:elevated,actor,targets:[actor],rolls:{},choices:{drawing:JSON.stringify(drawing)}})
 expect(result.ok).toBe(true)
 if(result.ok)expect(result.proposals[0]).toMatchObject({surfaceAtPlacementElevation:true,requireAllSurfaceMaterials:true,surfaceMaterials:['stone','earth']})
 operation.groundOnly=true
 expect(validateDnd5eActivityDefinitionV1(elevated).some(e=>e.includes('surfaceAtPlacementElevation'))).toBe(true)
})

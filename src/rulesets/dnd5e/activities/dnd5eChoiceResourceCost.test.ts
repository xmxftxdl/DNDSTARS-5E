import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'pulse',name:'Pulse',activation:{kind:'action'},
 automation:automationCapabilityFromLegacyStatus('full'),
 target:{kind:'area',origin:'point',shape:'sphere',placeRangeFeet:30,radiusFeet:10,relation:'any'},
 choices:[{id:'power',label:'Power',options:[0,1,2].map(n=>({id:'power-'+n,label:String(n)}))}],
 consumption:[1,2].map(n=>({kind:'resource',resourceId:'test:energy',amount:{kind:'constant',value:n},consumeOn:'resolve',whenChoice:{choiceId:'power',optionIds:['power-'+n]}})),
 outcomes:[{id:'pulse',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'radiant',amount:{kind:'constant',value:1}}]}]}
const actor={id:'actor',controller:'players' as const,level:1,proficiencyBonus:2,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:10,conditions:[],currentHp:10,maxHp:10,resources:{'test:energy':{current:2,maximum:2}}}

it.each([0,1,2])('emits selected resource cost once for tier %s, including empty and multi-target areas',tier=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 for(const count of [0,1,3]){
  const result=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(activity)),actor,
   targets:Array.from({length:count},(_,i)=>({...actor,id:'target-'+i,controller:'dm' as const})),
   choices:{power:'power-'+tier},rolls:{},areaPlacement:{x:5,y:5},areaPlacementDistanceFeet:10})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(!result.ok)throw Error('resolution failed')
  expect(result.consumptions).toEqual(tier?[{kind:'resource',resourceId:'test:energy',amount:tier,consumeOn:'resolve',whenChoice:{choiceId:'power',optionIds:['power-'+tier]}} ]:[])
  expect(result.proposals.filter(p=>p.kind==='deal-damage')).toHaveLength(count)
 }
})

it('rejects unknown, empty, and duplicate cost option references',()=>{
 for(const whenChoice of [{choiceId:'missing',optionIds:['power-1']},{choiceId:'power',optionIds:[]},
  {choiceId:'power',optionIds:['missing']},{choiceId:'power',optionIds:['power-1','power-1']}]){
  const invalid=structuredClone(activity)
  Object.assign(invalid.consumption![0],{whenChoice})
  expect(validateDnd5eActivityDefinitionV1(invalid).some(e=>e.includes('whenChoice'))).toBe(true)
 }
})

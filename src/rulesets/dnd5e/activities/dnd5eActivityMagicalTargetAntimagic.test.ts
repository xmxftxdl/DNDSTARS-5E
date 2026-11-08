import {expect,it} from 'vitest'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {resolveDnd5eActivity,type Dnd5eActivityExecutionInput} from './dnd5eActivityExecutor'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'

it.each(['magical-feature','ordinary-feature','explicit-nonmagical-feature','spell','feature-in-spell-ward'])('keeps target antimagic separate from nonmagical features and spell-level wards: %s',mode=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'target-antimagic',name:'Target antimagic',legacySource:{kind:mode==='spell'?'spell':'feature',id:'target-antimagic',...(mode==='magical-feature'||mode==='feature-in-spell-ward'?{magical:true}:mode==='explicit-nonmagical-feature'?{magical:false}:{})},activation:{kind:'action'},target:{kind:'creature',relation:'any',count:2},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'psychic',magical:mode==='magical-feature'||mode==='feature-in-spell-ward',amount:{kind:'constant',value:4}}]}]}
 const actor={id:'actor',controller:'players' as const,level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:18},armorClass:15,currentHp:100,maxHp:100,conditions:[]}
 const input:Dnd5eActivityExecutionInput={activity,actor,targets:[{...actor,id:'outside'},{...actor,id:'inside',...(mode==='feature-in-spell-ward'?{spellSuppressionAreas:[{areaId:'ward',maximumSpellLevel:9}]}:{magicSuppressed:true})}],rolls:{}}
 const result=resolveDnd5eActivity(input)
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
 expect(result.proposals.filter(proposal=>proposal.kind==='deal-damage').map(proposal=>proposal.targetId)).toEqual(mode==='magical-feature'||mode==='spell'?['outside']:['outside','inside'])
})

import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { dnd5eActivitySubmittedAttackCheckSuccessKeysV1 } from './dnd5eActivityRollRecipe'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
const actor:Dnd5eActivityActorSnapshot={id:'actor',controller:'player',level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:10,currentHp:20,maxHp:20,conditions:[]}
it.each([
 ['feature','spell',true],['feature','weapon',false],['feature',undefined,false],['spell',undefined,true],['spell','weapon',false],
] as const)('granted %s attack declared %s uses the matching cover defense', (source,attackType,hit)=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'rock',name:'Rock',legacySource:{kind:source,id:'source'},activation:{kind:'free'},
  automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'creature',relation:'any',count:1},
  checks:[{id:'attack',kind:'attack-roll',attackType,rollId:'attack',scope:'per-target',attackBonus:{kind:'constant',value:0},rollMode:'normal',delivery:'ranged'}],
  outcomes:[{id:'hit',when:{kind:'check',checkId:'attack',result:'success'},operations:[{id:'mark',kind:'temporary-hit-points',target:'target',amount:{kind:'constant',value:1}}]}]}
 const target={...actor,id:'target',controller:'dm' as const,attackArmorClasses:{spell:10,ranged:15,melee:15,default:15}}
 const rolls={'attack:target':{values:[10],modifier:0,total:10}}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const restored=JSON.parse(JSON.stringify(activity))
 const result=resolveDnd5eActivity({activity:restored,actor,targets:[target],rolls})
 expect(result.ok).toBe(true)
 if(result.ok)expect(result.checks[0].success).toBe(hit)
 expect(dnd5eActivitySubmittedAttackCheckSuccessKeysV1(restored,{actor,targets:[target],rolls,hostRollMode:()=> 'normal'}).has('attack:target')).toBe(hit)
 const malformed=structuredClone(restored);malformed.checks[0].attackType='physical'
 expect(validateDnd5eActivityDefinitionV1(malformed).some(error=>error.includes('attackType'))).toBe(true)
})

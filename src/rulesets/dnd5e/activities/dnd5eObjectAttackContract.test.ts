import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'object-attack',name:'Attack',activation:{kind:'action'},
 automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'creature',relation:'any',count:1,allowObjectAttack:true,rangeFeet:120},
 checks:[{id:'attack',kind:'attack-roll',rollId:'attack',scope:'per-target',rollMode:'normal',attackBonus:{kind:'constant',value:5}}],
 outcomes:[{id:'hit',when:{kind:'check',checkId:'attack',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'radiant',amount:{kind:'constant',value:14}}]}]}
it('projects explicit object targeting and refuses creature effects in that attack declaration',()=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(dnd5ePluginFeatureActionFromActivityV1(activity)?.targeting).toMatchObject({allowObjectAttack:true})
 for(const patch of [{allowObjectAttack:false},{count:2},{relation:'enemy'},{requiresWilling:true}]){
  const invalid=structuredClone(activity);Object.assign(invalid.target,patch)
  expect(validateDnd5eActivityDefinitionV1(invalid).some(e=>e.includes('allowObjectAttack'))).toBe(true)
 }
 const invalid=structuredClone(activity)
 invalid.outcomes[0].operations=[{id:'heal',kind:'healing',target:'target',amount:{kind:'constant',value:1}}]
 expect(validateDnd5eActivityDefinitionV1(invalid).some(e=>e.includes('allowObjectAttack'))).toBe(true)
})
it('does not let an ordinary creature attack use an object snapshot',()=>{
 const actor={id:'caster',controller:'player',level:1,proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,conditions:[],abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10}}
 const object={...actor,id:'object',controller:'dm',objectDamageThreshold:0}
 const plain=structuredClone(activity);if(plain.target.kind==='creature')delete plain.target.allowObjectAttack
 const input={actor,targets:[object],rolls:{'attack:object':{values:[15]}},distanceFeetByTargetId:{object:30}}
 expect(resolveDnd5eActivity({...input,activity:plain})).toMatchObject({ok:false,reason:'invalid-target'})
 expect(resolveDnd5eActivity({...input,activity}).ok).toBe(true)
})

import fs from 'node:fs'
import {expect,it} from 'vitest'
import {explicitSummonedMonsterConstitutionsFromPackage} from '../../../shared/explicit-water-breathing-policy.mjs'
import {planCampaignSubmergedBreathing} from '../../../shared/campaign-submerged-breathing.mjs'
const packageValue=JSON.parse(fs.readFileSync('.codex-temp/xge-next-feature/root-merge-preparation/prospective155-package-r305-r1/canonical-round2.json','utf8'))
const profiles=()=>explicitSummonedMonsterConstitutionsFromPackage(packageValue)
const capacity=(pluginId:string|undefined,poolId='room-monster:peryton')=>{
 const token={id:'scope-token',type:'npc',poolId,dnd5eSummon:pluginId?{pluginId}:undefined,dnd5eCombatState:{activeEffects:[{id:'water',duration:{type:'permanent'},modifiers:{submerged:true}}]}}
 return planCampaignSubmergedBreathing({maps:[{id:'scope-map',tokens:[token]}],characters:[],explicitSummonedMonsterConstitutions:profiles(),previousClock:{worldMinute:0},nextClock:{worldMinute:0,worldSecondRemainder:6}}).updates[0].state?.breathCapacitySeconds
}
it('projects only the declared base Constitution of the exact installed custom monster without granting water breathing',()=>{
 const found=profiles().find(p=>p.monsterId==='room-monster:peryton')
 expect(found).toEqual({pluginId:packageValue.manifest.id,monsterId:'room-monster:peryton',constitutionScore:13})
 expect(capacity(packageValue.manifest.id)).toBe(120)
})
it('does not apply installed monster Constitution to an unissued token or another source and preserves SRD precedence',()=>{
 expect(capacity(undefined)).toBe(60);expect(capacity('local.foreign')).toBe(60)
 expect(capacity(packageValue.manifest.id,'srd-5.1:commoner')).toBe(60)
})
it('refuses invalid Constitution or incompatible package identity without changing existing data',()=>{
 const input=structuredClone(packageValue),monster=input.content.monsters.find((m:{id:string})=>m.id==='room-monster:peryton');monster.abilities.con=31
 expect(explicitSummonedMonsterConstitutionsFromPackage(input).some(p=>p.monsterId===monster.id)).toBe(false)
 input.manifest.apiVersion=1;expect(explicitSummonedMonsterConstitutionsFromPackage(input)).toEqual([])
 expect(packageValue.content.monsters.find((m:{id:string})=>m.id==='room-monster:peryton').abilities.con).toBe(13)
})

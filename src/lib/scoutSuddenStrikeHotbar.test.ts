import {expect,it} from 'vitest'
import {buildDnd5eCombatActionDescriptors} from './dnd5eCombatActionDescriptors'
import {dnd5eClassFeatureActionIcon} from './dnd5eActionIcons'
import {normalizeCharacter} from '../store/characters'
import {applyDnd5eInventoryMutation,normalizeDnd5eInventory,dnd5eWeaponAttackProfile,dnd5eWeaponPropertyIds} from '../rulesets/dnd5e'
import {dnd5eActivityWeaponAttackGrantMatchesV1} from '../rulesets/dnd5e/activities/dnd5eActivityWeaponAttackGrant'

// Exact persisted XAGFYC grant contract. Inventory uses the real two-slot grant
// plans; descriptor IDs and commands come from the production public builder.
const grant:NonNullable<Parameters<typeof dnd5eActivityWeaponAttackGrantMatchesV1>[0]>&{logTrigger:unknown}={schemaVersion:1,grantId:'scout-sudden-strike',sourceActivityId:'scout-sudden-strike',label:'瞬息打击',economy:'bonus-action',weaponModes:['melee','ranged'],allowUnarmedStrikes:true,additionalSneakAttackDifferentTarget:true,appliedTurnKey:'scout-real-attacks:combat-1792822155022-gq9qsgidk0m:1:scout-token:normal',remainingAttacks:1,logTrigger:{activityName:'瞬息打击',outcomeId:'grant',operationId:'grant',conditions:[]}}
function realSources(){
 let actors=[normalizeCharacter({id:'scout',name:'Scout',charClass:'游荡者',level:17,dnd5eClassLevels:{rogue:17},abilities:{str:10,dex:20,con:12,int:10,wis:10,cha:10},equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}})]
 for(const slot of ['mainWeapon','offHand'] as const){
  const before=new Set(normalizeDnd5eInventory(actors[0]).entries.map(row=>row.instanceId)),added=applyDnd5eInventoryMutation(actors,{type:'grant',characterId:'scout',templateId:slot==='mainWeapon'?'srd-5.1:equipment:dnd5e-shortsword':'srd-5.1:equipment:dnd5e-shortsword-offhand',quantity:1});if(!added.ok)throw Error(added.reason);actors=added.characters
  const entry=normalizeDnd5eInventory(actors[0]).entries.find(row=>!before.has(row.instanceId))!,equipped=applyDnd5eInventoryMutation(actors,{type:'equip',characterId:'scout',slot,instanceId:entry.instanceId});if(!equipped.ok)throw Error(equipped.reason);actors=equipped.characters
 }
 return (['main-hand','off-hand'] as const).map(slot=>{
  const profile=dnd5eWeaponAttackProfile(actors[0],{weaponSlot:slot==='main-hand'?'mainWeapon':'offHand'})!;expect(profile).toBeTruthy()
  expect(dnd5eActivityWeaponAttackGrantMatchesV1(grant,grant.appliedTurnKey,{weaponId:profile.weaponId,baseWeaponId:profile.baseWeaponId,mode:profile.mode,weaponProperties:dnd5eWeaponPropertyIds(profile.properties),proficient:profile.proficient},slot)).toBe(true)
  return{id:`activity-weapon-attack:${grant.grantId}:${slot}`,label:`${grant.label} · ${profile.weaponName}`,description:'实际追加攻击',icon:dnd5eClassFeatureActionIcon({id:grant.sourceActivityId,name:grant.label,classId:'rogue'}),economy:grant.economy,targeting:'creature' as const,command:{kind:'select-weapon-target' as const,options:{activityWeaponAttackGrantId:grant.grantId,activityWeaponAttackWeaponSlot:slot}}}
 })
}
for(const slot of ['main-hand','off-hand'] as const)it(`exposes the actual ${slot} grant through the feature-prefixed public hotbar ID and original target command`,()=>{
 const actions=buildDnd5eCombatActionDescriptors({canAct:true,pending:false,actionRemaining:0,bonusActionRemaining:1,movementRemaining:40,features:realSources()}),id=`feature:activity-weapon-attack:scout-sudden-strike:${slot}`
 expect(actions.find(row=>row.id===id)).toMatchObject({sourceKind:'feature',enabled:true,economy:'bonus-action',command:{kind:'select-weapon-target',options:{activityWeaponAttackGrantId:'scout-sudden-strike',activityWeaponAttackWeaponSlot:slot}}})
 expect(actions.some(row=>row.id===id.slice('feature:'.length))).toBe(false)
})
it('keeps both persisted grant descriptors disabled when the actual bonus action is spent',()=>{
 const actions=buildDnd5eCombatActionDescriptors({canAct:true,pending:false,actionRemaining:0,bonusActionRemaining:0,movementRemaining:40,features:realSources()}).filter(row=>row.id.startsWith('feature:activity-weapon-attack:'))
 expect(actions).toHaveLength(2);expect(actions.every(row=>!row.enabled)).toBe(true)
})

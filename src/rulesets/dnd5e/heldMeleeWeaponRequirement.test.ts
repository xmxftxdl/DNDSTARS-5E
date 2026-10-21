import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, reconcileDnd5eContinuousSourceLinks } from './headlessCombatEngine'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

const ids=['dnd5e-longsword']
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'guard',name:'Guard',activation:{kind:'free'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),
  effects:[{schemaVersion:1,id:'guard',name:'Guard',duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-start'},stacking:'replace',sourceLink:{sourceRequiresHeldMeleeWeaponBaseIds:ids}}],
  outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'apply',kind:'apply-effect',target:'actor',effectId:'guard'}]}]}
const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
it.each(['main','off','inventory','ranged','wrong','unknown','none'] as const)('maintains a defensive effect only with qualifying held melee equipment: %s',mode=>{
  const source=make('source'),target=make('target')
  const item={itemId:'instance',weaponBaseId:mode==='wrong'?'dnd5e-dagger':mode==='unknown'?undefined:'dnd5e-longsword',roles:['weapon' as const],weaponMode:mode==='ranged'?'ranged' as const:'melee' as const}
  source.activityEquipment={armorCategory:'none',armorProficient:true,armorProficiencies:[],freeHands:1,
    ...(mode==='off'?{offHand:item}:mode!=='none'&&mode!=='inventory'?{mainHand:item}:{}),
    inventory:{revision:0,items:[{...item,kind:'weapon',inventoryInstanceId:'instance'}]}}
  const state=startDnd5eHeadlessCombat('guard',[source,target])
  state.combatants.target.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'guard',label:'Guard',targetId:'target',source:{kind:'feature',actorId:'source'},modifiers:{armorClassBonus:2},removal:{sourceLink:{sourceRequiresHeldMeleeWeaponBaseIds:ids}}})]
  const saved=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(state.combatants.target.classState.activeEffects)))
  expect(saved[0].removal?.sourceLink?.sourceRequiresHeldMeleeWeaponBaseIds).toEqual(ids)
  expect(validateDnd5eActiveEffectsStrict(saved).ok).toBe(true)
  state.combatants.target.classState.activeEffects=saved
  reconcileDnd5eContinuousSourceLinks(state,[])
  expect(state.combatants.target.classState.activeEffects?.length??0).toBe(mode==='main'||mode==='off'?1:0)
  state.combatants.source.activityEquipment!.mainHand=undefined
  state.combatants.source.activityEquipment!.offHand=undefined
  reconcileDnd5eContinuousSourceLinks(state,[])
  expect(state.combatants.target.classState.activeEffects?.length??0).toBe(0)
})
it('accepts equipment-only source links and rejects malformed lists',()=>{
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for(const bad of [[],[''],['a','a'],['x'.repeat(161)],'dnd5e-longsword',[1]]){
    const malformed=structuredClone(activity)
    ;(malformed.effects![0].sourceLink as any).sourceRequiresHeldMeleeWeaponBaseIds=bad
    expect(validateDnd5eActivityDefinitionV1(malformed).join(' ')).toContain('sourceRequiresHeldMeleeWeaponBaseIds is invalid')
    const effect=createDnd5eMechanicalEffect({definitionId:'guard',label:'Guard',targetId:'target',source:{kind:'feature',actorId:'source'},removal:{sourceLink:{sourceRequiresHeldMeleeWeaponBaseIds:ids}}})
    ;(effect.removal!.sourceLink as any).sourceRequiresHeldMeleeWeaponBaseIds=bad
    expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(false)
  }
})

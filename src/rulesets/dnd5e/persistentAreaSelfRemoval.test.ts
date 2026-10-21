import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5ePersistentAreaTrigger,resolveDnd5eHeadlessAction,dnd5eActiveEffectRemovalAllowed,dnd5eCombatantPairKey} from './headlessCombatEngine'
import {normalizeDnd5eActiveEffects} from './activeEffects'
import {normalizeDnd5ePersistentAreaTriggerDeclaration,resolveDnd5ePersistentAreaTriggerSourceDc} from './persistentAreaTypes'

const declaration={id:'mud-entry',label:'Mud',timing:'on-enter' as const,oncePerTurn:true,requiresTargetGrounded:true as const,
 savingThrow:{ability:'str' as const,dc:'source-save-dc' as const,onSuccess:'none' as const},
 condition:{condition:'restrained' as const,endsWithArea:true,duration:{expiresAt:'permanent' as const},
 removalAction:{label:'Pull free',economy:'action' as const,maxDistanceFeet:0,selfOnly:true as const}}}

it.each([1,20])('settles mud STR save %s and permits a no-roll self release only',d20=>{
 const state=startDnd5eHeadlessCombat('mud',['target','caster','helper'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:20-i,
 abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:25,y:25},elevationFeet:0,groundElevationFeet:0,concentrating:false})))
 state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('helper','target')]:0}
 const before=structuredClone(state)
 const trigger=resolveDnd5ePersistentAreaTriggerSourceDc(JSON.parse(JSON.stringify(declaration)),15)!
 expect(trigger).toBeDefined()
 const result=resolveDnd5ePersistentAreaTrigger(state,{areaId:'mud',sourceId:'caster',targetId:'target',trigger,d20})
 expect(result.ok,result.ok?undefined:result.reason).toBe(true)
 expect(state).toEqual(before)
 expect(result.state.combatants.target.conditions.includes('restrained')).toBe(d20===1)
 if(d20===20)return
 const target=result.state.combatants.target
 target.classState.activeEffects=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(target.classState.activeEffects)))
 const effect=target.classState.activeEffects!.find(e=>e.standardCondition==='restrained')!
 expect(effect.removal?.action).toMatchObject({selfOnly:true,maxDistanceFeet:0})
 expect(effect.removal?.action?.abilityCheck).toBeUndefined()
 expect(dnd5eActiveEffectRemovalAllowed(result.state,'helper','target',effect.id)).toBe(false)
 expect(dnd5eActiveEffectRemovalAllowed(result.state,'target','target',effect.id)).toBe(true)
 const released=resolveDnd5eHeadlessAction(result.state,{type:'remove-active-effect',actorId:'target',targetId:'target',effectId:effect.id})
 expect(released.ok,released.ok?undefined:released.reason).toBe(true)
 expect(released.state.combatants.target.conditions).not.toContain('restrained')
 expect(released.state.combatants.target.turn.actionAvailable).toBe(false)
 expect(released.events.some(e=>e.type==='ability-check-resolved')).toBe(false)
 expect(resolveDnd5eHeadlessAction(released.state,{type:'remove-active-effect',actorId:'target',targetId:'target',effectId:effect.id}).ok).toBe(false)
})

it.each([false,'true',1])('rejects malformed self-only restrictions: %s',selfOnly=>{
 expect(normalizeDnd5ePersistentAreaTriggerDeclaration({...declaration,condition:{...declaration.condition,removalAction:{...declaration.condition.removalAction,selfOnly}}})).toBeUndefined()
})

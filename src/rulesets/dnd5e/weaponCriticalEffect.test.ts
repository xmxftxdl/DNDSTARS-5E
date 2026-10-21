import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, dnd5eActiveAttackProfileRewrite } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { validateDnd5eEffectDefinitionV1 } from './activities/dnd5eActivityValidation'

it.each(['melee','ranged','spell','suspended','removed','natural-one','natural-twenty'] as const)('applies a saved melee critical profile only to qualifying attacks: %s', mode => {
 const effect=createDnd5eMechanicalEffect({id:'profile',definitionId:'test:profile',label:'Profile',targetId:'actor',source:{kind:'feature'},duration:{type:'permanent'},modifiers:{attackProfiles:[{attackModes:['melee'],criticalThreshold:19}]}})
 const effects=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
 expect(effects[0].modifiers?.attackProfiles?.[0].criticalThreshold).toBe(19)
 if(mode==='suspended')effects[0].suspendedBy=['antimagic']
 if(mode==='removed')effects.length=0
 const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:id==='actor'?'player':'dm',initiative:id==='actor'?20:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:40,maxHp:40,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const actor=make('actor');actor.classState.activeEffects=effects
 const state=startDnd5eHeadlessCombat('critical',[actor,make('target')])
 const d20=mode==='natural-one'?1:mode==='natural-twenty'?20:19
 const critical=mode==='melee'||mode==='natural-twenty'
 const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'actor',targetId:'target',attackModifier:0,d20,
  classDamageContext:{mode:mode==='ranged'?'ranged':'melee',spellAttack:mode==='spell',finesse:false,strengthBased:true,weaponDamageSides:6,damageType:'slashing',adjacentEnemyOfTarget:false,weaponId:'test-blade'},
  damage:{count:1,sides:6,bonus:0,rolls:critical?[2,2]:[2],type:'slashing'}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 const resolved=result.events.find(e=>e.type==='attack-resolved')
 expect(resolved).toMatchObject({critical,hit:mode!=='natural-one'})
 expect(result.state.combatants.target.currentHp).toBe(mode==='natural-one'?40:critical?36:38)
 expect(dnd5eActiveAttackProfileRewrite(effects,'ranged').criticalThreshold).toBeUndefined()
})

it.each([1,21,19.5,'19'])('rejects malformed profile thresholds %s', criticalThreshold=>{
 const effect:any={schemaVersion:1,id:'profile',name:'Profile',duration:{kind:'permanent'},modifiers:[{kind:'attack-profile',attackModes:['melee'],criticalThreshold}]}
 expect(validateDnd5eEffectDefinitionV1(effect).length).toBeGreaterThan(0)
})


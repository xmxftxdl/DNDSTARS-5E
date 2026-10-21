import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {expect,it} from 'vitest'
import {createDnd5eMechanicalEffect,normalizeDnd5eActiveEffects,removeDnd5eActiveEffectsByIds,retainDnd5eEndedEffectAwareness,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {normalizeCharacter} from '../../store/characters'
import {advanceDnd5eCampaignTimedActiveEffects} from './campaignTimeRules'
function effect(id='transformation'){return createDnd5eMechanicalEffect({id,definitionId:'transformation',label:'Transformation',targetId:'hero',source:{kind:'spell',actorId:'hero'},duration:{type:'rounds',remainingRounds:1,tickOn:'target-turn-end'},endSavingThrow:{ability:'con',dc:15,exhaustionOnFailure:1},modifiers:{savingThrowProficiencies:['con']}})}
it('queues one nonmagical save after removal, survives reload, and never retains original bonuses',()=>{
 const before=effect(),ended=removeDnd5eActiveEffectsByIds({effects:[before],ids:[before.id]}).effects
 expect(ended).toHaveLength(1);expect(ended[0].pendingEndSavingThrow).toEqual({ability:'con',dc:15,exhaustionOnFailure:1})
 expect(ended[0].modifiers).toBeUndefined();expect(ended[0].source.magical).toBe(false)
 const saved=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(ended)))
 expect(validateDnd5eActiveEffectsStrict(saved)).toMatchObject({ok:true})
 expect(saved[0].pendingEndSavingThrow).toEqual(ended[0].pendingEndSavingThrow)
 expect(retainDnd5eEndedEffectAwareness([before],saved)).toEqual(saved)
 expect(retainDnd5eEndedEffectAwareness(saved,[])).toEqual([])
})
it('does not queue on suppression; independent applications retain independent obligations',()=>{
 const before=effect();expect(retainDnd5eEndedEffectAwareness([before],[{...before,suspendedBy:['antimagic']}])).toHaveLength(1)
 expect(retainDnd5eEndedEffectAwareness([before],[before])[0].pendingEndSavingThrow).toBeUndefined()
 expect(removeDnd5eActiveEffectsByIds({effects:[before,effect('second')],ids:[before.id,'second']}).effects).toHaveLength(2)
})
it('campaign expiry persists the pending save after removing proficiency',()=>{
 const hero=normalizeCharacter({id:'hero',name:'Hero',dnd5eCombatState:{activeEffects:[effect()]}})
 const ended=advanceDnd5eCampaignTimedActiveEffects(hero,1)
 expect(ended.dnd5eCombatState?.activeEffects).toHaveLength(1)
 expect(ended.dnd5eCombatState?.activeEffects?.[0].pendingEndSavingThrow?.dc).toBe(15)
 expect(ended.dnd5eCombatState?.activeEffects?.[0].modifiers).toBeUndefined()
})
it.each([{ability:'invalid',dc:15,exhaustionOnFailure:1},{ability:'con',dc:0,exhaustionOnFailure:1},{ability:'con',dc:15,exhaustionOnFailure:7}])('rejects malformed end-save %j',endSavingThrow=>{
 expect(validateDnd5eActiveEffectsStrict([{...effect(),endSavingThrow}]).ok).toBe(false)
})

it.each([['fail',12,1],['success',13,0],['invalid',0,0]] as const)('settles an ending obligation once without spending an action (%s)',(scenario,d20,levels)=>{
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:10,dex:10,con:14,int:10,wis:10,cha:10},proficiencyBonus:4,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const hero=make('hero',1),other=make('other',20)
 hero.classState.activeEffects=removeDnd5eActiveEffectsByIds({effects:[effect()],ids:['transformation']}).effects
 const state=startDnd5eHeadlessCombat('end-save',[other,hero]),original=JSON.parse(JSON.stringify(state))
 const id=hero.classState.activeEffects[0].id
 const action={type:'active-effect-end-save' as const,actorId:'hero',effectId:id,d20}
 const result=resolveDnd5eHeadlessAction(state,action)
 expect(result.ok).toBe(scenario!=='invalid')
 expect(JSON.parse(JSON.stringify(state))).toEqual(original)
 expect(result.state.combatants.hero.exhaustionLevel).toBe(levels)
 expect(result.state.combatants.hero.turn.actionAvailable).toBe(state.combatants.hero.turn.actionAvailable)
 if(scenario==='invalid')expect(result.state.combatants.hero.classState.activeEffects?.some(e=>e.id===id)).toBe(true)
 else{
  expect(result.events).toContainEqual(expect.objectContaining({type:'active-effect-save-resolved',total:d20+2,success:scenario==='success'}))
  const reload=JSON.parse(JSON.stringify(result.state)),again=resolveDnd5eHeadlessAction(reload,action)
  expect(again.ok).toBe(false);expect(again.state.combatants.hero.exhaustionLevel).toBe(levels)
  const exploration=resolveDnd5eHeadlessAction({...state,active:false},action)
  expect(exploration.ok).toBe(true)
 }
})

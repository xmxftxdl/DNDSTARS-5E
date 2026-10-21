import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {dnd5eActivityTriggerContextsFromCombatEventV1} from './dnd5eActivityTriggerWindows'

it('routes committed attack damage to distinct observers without reclassifying unrelated damage',()=>{
 const actor=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='attacker'?'dm':'player',initiative,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const initial=startDnd5eHeadlessCombat('observe',[actor('attacker',30),actor('victim',20),actor('observer-a',10),actor('observer-b',5)])
 const hit=resolveDnd5eHeadlessAction(initial,{type:'attack',actorId:'attacker',targetId:'victim',attackModifier:5,d20:18,damage:{count:1,sides:6,bonus:0,rolls:[5],type:'slashing'}})
 expect(hit.ok).toBe(true)
 const index=hit.events.findIndex(e=>e.type==='damage-applied'),damage=hit.events[index]
 if(damage.type!=='damage-applied')throw Error('No committed damage')
 const contexts=(event=damage,batch=hit.events,state=hit.state)=>dnd5eActivityTriggerContextsFromCombatEventV1(state,event,index,'batch',batch).filter(c=>c.event==='other-creature-took-attack-damage')
 const found=contexts()
 expect(found.map(c=>c.eligibleActorIds)).toEqual([['observer-a'],['observer-b']])
 expect(new Set(found.map(c=>c.eventId)).size).toBe(2)
 for(const entry of found){expect(entry.eligibleTargetIds).toEqual(['attacker']);expect(entry.source).toMatchObject({kind:'attack',targetId:'victim',damage:{amount:5}})}
 expect(contexts({...damage,amount:0})).toEqual([])
 expect(contexts(damage,[damage])).toEqual([])
 expect(contexts({...damage,origin:{kind:'feature',id:'unrelated'}})).toEqual([])
 const incapacitated=structuredClone(hit.state);incapacitated.combatants['observer-a'].conditions=['incapacitated']
 expect(contexts(damage,hit.events,incapacitated).map(c=>c.eligibleActorIds)).toEqual([['observer-b']])
 const object=structuredClone(hit.state);object.combatants.victim.objectInteractionOnly=true
 expect(contexts(damage,hit.events,object)).toEqual([])
 expect(initial.combatants.victim.currentHp).toBe(30)
})

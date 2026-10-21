import { expect,it } from 'vitest'
import { dnd5eCarriedLoadCapacityPounds,dnd5eCarriedLoadPreventsMovement } from './carryingCapacity'
import { createDnd5eMechanicalEffect } from './activeEffects'
it.each([[0,75],[1,150],[2,150],[3,300],[4,600],[5,1200]])('uses body size %s for carrying capacity', (sizeRank,capacity)=>{
  const owner={sizeRank,abilities:{str:10},carriedWeightLb:capacity}
  expect(dnd5eCarriedLoadCapacityPounds(owner)).toBe(capacity)
  expect(dnd5eCarriedLoadPreventsMovement(owner)).toBe(false)
  expect(dnd5eCarriedLoadPreventsMovement({...owner,carriedWeightLb:capacity+1})).toBe(true)
})
it('recomputes temporary size and capacity effects rather than saving a stale limit',()=>{
  const effect=createDnd5eMechanicalEffect({id:'capacity',definitionId:'test:capacity',label:'Capacity',targetId:'undead',
    source:{kind:'feature',actorId:'owner'},duration:{type:'permanent'},modifiers:{sizeRankDelta:1,carryingCapacityMultiplier:2}})
  const owner={sizeRank:2,abilities:{str:10},carriedWeightLb:450,classState:{activeEffects:[effect]}}
  expect(dnd5eCarriedLoadCapacityPounds(owner)).toBe(600)
  expect(dnd5eCarriedLoadPreventsMovement(owner)).toBe(false)
  expect(dnd5eCarriedLoadPreventsMovement({...owner,classState:{activeEffects:[]}})).toBe(true)
})

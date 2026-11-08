import { describe, expect, it } from 'vitest'
import { beginMultipartTurn, consumeMultipartHeadAction, consumeMultipartOpportunityReaction, createMultipartCreature,
  endMultipartTurn, livingMultipartHeads, moveMultipartBody, moveMultipartHead, recordMultipartDamage,
  regrowMultipartHead, severMultipartHead } from './multipartCreature'

describe('shared creature head state',()=>{
  it('accumulates damage across turns without counting healing or resetting the remainder',()=>{
    const state=createMultipartCreature({x:0,y:0,z:0})
    recordMultipartDamage(state,49,false)
    beginMultipartTurn(state)
    recordMultipartDamage(state,52,false)
    expect(state.pendingHeadDeaths).toBe(2)
    expect(state.damageRemainder).toBe(1)
    expect(()=>consumeMultipartHeadAction(state,'head-1')).toThrow()
    severMultipartHead(state,'head-3'); severMultipartHead(state,'head-1')
    expect(livingMultipartHeads(state).map(h=>h.id)).toEqual(['head-2','head-4'])
  })
  it('releases only the selected head and stops its song',()=>{
    const state=createMultipartCreature({x:0,y:0,z:0})
    state.heads[0].swallowedTargetIds=['inside'];state.heads[0].grappledTargetId='outside';state.heads[0].singingThroughTurn=2
    state.heads[1].swallowedTargetIds=['other']
    recordMultipartDamage(state,50,false)
    expect(severMultipartHead(state,'head-1').released).toEqual(['inside','outside'])
    expect(state.heads[0].singingThroughTurn).toBeUndefined()
    expect(state.heads[1].swallowedTargetIds).toEqual(['other'])
  })
  it('enforces per-head three-dimensional movement and translates heads with the body',()=>{
    const state=createMultipartCreature({x:0,y:0,z:0})
    moveMultipartHead(state,'head-1',{x:0,y:0,z:30},30)
    expect(()=>moveMultipartHead(state,'head-1',{x:0,y:0,z:31},1)).toThrow()
    moveMultipartHead(state,'head-2',{x:30,y:0,z:0},30)
    moveMultipartBody(state,{x:40,y:0,z:0})
    expect(state.heads[0].position).toEqual({x:40,y:0,z:30})
    expect(state.heads[1].position).toEqual({x:70,y:0,z:0})
    state.heads[0].position={x:40,y:0,z:300};beginMultipartTurn(state)
    expect(()=>moveMultipartHead(state,'head-1',{x:40,y:0,z:301},1)).toThrow()
  })
  it('limits distinct-head actions and extra opportunity reactions',()=>{
    const state=createMultipartCreature({x:0,y:0,z:0})
    consumeMultipartHeadAction(state,'head-1')
    expect(()=>consumeMultipartHeadAction(state,'head-1')).toThrow()
    for(let i=0;i<3;i++)consumeMultipartOpportunityReaction(state)
    expect(()=>consumeMultipartOpportunityReaction(state)).toThrow()
    beginMultipartTurn(state)
    consumeMultipartHeadAction(state,'head-1');consumeMultipartOpportunityReaction(state)
  })
  it('keeps a song through the end of the next turn, including JSON persistence',()=>{
    const state=createMultipartCreature({x:0,y:0,z:0})
    state.heads[0].singingThroughTurn=state.turn+1
    endMultipartTurn(state)
    const restored=JSON.parse(JSON.stringify(state))
    expect(restored.heads[0].singingThroughTurn).toBe(1)
    beginMultipartTurn(restored);endMultipartTurn(restored)
    expect(restored.heads[0].singingThroughTurn).toBeUndefined()
  })
  it('regrows one head per completed rest only after recent feeding and never revives a corpse',()=>{
    const state=createMultipartCreature({x:0,y:0,z:0})
    expect(regrowMultipartHead(state,'rest-1',100)).toBe(false)
    state.lastHumanoidConsumedMinute=100
    expect(regrowMultipartHead(state,'rest-2',200)).toBe(true)
    expect(regrowMultipartHead(state,'rest-2',200)).toBe(false)
    expect(regrowMultipartHead(state,'rest-3',1541)).toBe(false)
    recordMultipartDamage(state,184,true)
    for(const head of livingMultipartHeads(state))severMultipartHead(state,head.id)
    expect(regrowMultipartHead(state,'rest-4',300)).toBe(false)
  })
})

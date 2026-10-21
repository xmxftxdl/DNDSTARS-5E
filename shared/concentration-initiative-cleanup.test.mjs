import { test } from 'node:test'
import assert from 'node:assert/strict'
import { concentrationInitiativeCleanup } from './concentration-initiative-cleanup.mjs'

const maps = tokens => ({ maps: [{ id: 'map', tokens }] })
const before = maps([{id:'hero'}, {id:'body',dnd5eSummon:{}}, {id:'hostile',dnd5eSummon:{}}])
const after = maps([{id:'hero'}, {id:'body',hp:0}, {id:'hostile',dnd5eSummon:{controlEnded:true}}])
const combat = {active:true,mapId:'map',round:2,initiativeIndex:1,
  initiativeOrder:[{tokenId:'hero',slotId:'h'}, {tokenId:'body',slotId:'b1'}, {tokenId:'body',slotId:'b2'}, {tokenId:'hostile',slotId:'d'}],
  dnd5eTurnEconomyByToken:{hero:{action:1},body:{action:0},hostile:{action:1}}}
test('restored corpse loses all slots and economy; hostile surviving summon keeps its turn',()=>{
  const next=concentrationInitiativeCleanup(combat,before,after)
  assert.deepEqual(next.initiativeOrder.map(e=>e.slotId),['h','d'])
  assert.equal(next.initiativeIndex,1)
  assert.equal(next.round,2)
  assert.equal(next.dnd5eTurnEconomyByToken.body,undefined)
  assert.deepEqual(combat.dnd5eTurnEconomyByToken.body,{action:0})
  assert.equal(concentrationInitiativeCleanup(next,after,after),next)
})
test('preserves the active slot identity when earlier slots disappear',()=>{
  assert.equal(concentrationInitiativeCleanup({...combat,initiativeIndex:3},before,after).initiativeIndex,1)
})
test('wraps the round once when the last creature disappears',()=>{
  const next=concentrationInitiativeCleanup({...combat,initiativeIndex:3},before,maps([{id:'hero'},{id:'body',hp:0}]))
  assert.equal(next.initiativeIndex,0)
  assert.equal(next.round,3)
})
test('empty roster remains valid; other maps and inactive combat are untouched',()=>{
  const next=concentrationInitiativeCleanup(combat,before,maps([]))
  assert.deepEqual(next.initiativeOrder,[])
  assert.equal(next.initiativeIndex,0)
  assert.equal(next.round,2)
  const inactive={...combat,active:false},other={...combat,mapId:'other'}
  assert.equal(concentrationInitiativeCleanup(inactive,before,after),inactive)
  assert.equal(concentrationInitiativeCleanup(other,before,after),other)
})

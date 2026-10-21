import {expect,it,vi} from 'vitest'
import {prepareCombatQueueReset} from './prepareCombatQueueReset'
const combat={value:{mapId:'map',combatId:'ending',active:true},revision:10}
const writes=[{name:'player-action-requests',data:{mapId:'map',combatId:'ending',requests:[],updatedAt:2}},{name:'player-action-ack',data:{updatedAt:2}}]
it('freezes freshly read queue revisions and the ending combat in the reset transaction',async()=>{
 const read=vi.fn(async(name:string)=>name==='combat'?combat:{value:{mapId:'map',combatId:'ending'},revision:name==='player-action-requests'?7:4})
 const plan=await prepareCombatQueueReset({mapId:'map',expectedActiveCombatId:'ending',writes,read})
 expect(plan).toEqual({writes:[{...writes[0],expectedRevision:7},{...writes[1],expectedRevision:4}],readRevisions:{combat:10}})
 // A subsequent client watermark change must not silently authorize this reset.
 combat.revision=11
 expect(plan.readRevisions).toEqual({combat:10});combat.revision=10
 expect(read).toHaveBeenCalledTimes(3)
})
it.each([null,{mapId:'other',combatId:'ending',active:true},{mapId:'map',combatId:'new',active:true},{mapId:'map',combatId:'ending',active:false}])('refuses a missing or changed active combat: %j',async value=>{
 const read=vi.fn(async()=>({value,revision:11}))
 await expect(prepareCombatQueueReset({mapId:'map',expectedActiveCombatId:'ending',writes,read})).rejects.toThrow('combat-queue-reset-combat-changed')
 expect(read).toHaveBeenCalledTimes(1)
})
it.each([{mapId:'other',combatId:'ending'},{mapId:'map',combatId:'new'}])('does not erase a queue belonging to another scope: %j',async value=>{
 await expect(prepareCombatQueueReset({mapId:'map',expectedActiveCombatId:'ending',writes,read:async name=>name==='combat'?combat:{value,revision:20}})).rejects.toThrow('combat-queue-reset-scope-changed')
})
it('propagates a failed read and never invents a revision',async()=>{
 await expect(prepareCombatQueueReset({mapId:'map',writes,read:async()=>{throw Error('offline')}})).rejects.toThrow('offline')
 await expect(prepareCombatQueueReset({mapId:'map',writes,read:async()=>({value:null,revision:NaN})})).rejects.toThrow('invalid-revision')
})
it('allows missing queues and a new-combat reset without pretending it is the old active combat',async()=>{
 const plan=await prepareCombatQueueReset({mapId:'map',writes,read:async()=>({value:null,revision:0})})
 expect(plan.readRevisions).toBeUndefined();expect(plan.writes.map(w=>w.expectedRevision)).toEqual([0,0])
})

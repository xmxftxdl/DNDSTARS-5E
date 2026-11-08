import {it,expect} from 'vitest'
import {createD20RollConfirmationInterrupt,currentD20RollConfirmations,findCurrentD20RollConfirmation} from '../../lib/rollConfirmation'
import {bountifulDeferredD20RequestId} from './bountifulLuckDeferredD20'
function prompt(parentId:string,dieIndex:number,now:number,rawRollId='raw'){
 return createD20RollConfirmationInterrupt({mapId:'map',combatId:'combat',rollId:bountifulDeferredD20RequestId(parentId,rawRollId,0,dieIndex),bountifulParent:{parentId,sourceOccurrence:0,dieIndex,rawRollId},label:'Same attack',targetName:'Same target',originalValue:1,rollerCharacterId:'same-player',now})
}
it('keeps distinct exact parents and independent original dice in separate real confirmation generations',()=>{
 const rows=[prompt('first',0,10),prompt('first',1,20),prompt('second',0,30),prompt('second',1,40)]
 expect(currentD20RollConfirmations({interrupts:rows})).toHaveLength(4)
 for(const row of rows)expect(findCurrentD20RollConfirmation({interrupts:rows},row)?.id).toBe(row.id)
})
it('does not recover a later parent when the first exact raw-die window resumes after reload',()=>{
 const first=prompt('first',0,10),later=prompt('later',0,20)
 expect(findCurrentD20RollConfirmation({interrupts:[first,later]},prompt('first',0,30))?.id).toBe(first.id)
})
it('preserves a bounded full parent identity rather than silently truncating it to a different ID',()=>{
 const parent='p'.repeat(500),raw='r'.repeat(1000),actual=prompt(parent,1,10,raw)
 expect(actual.payload.rollId).toBe(bountifulDeferredD20RequestId(parent,raw,0,1))
 expect(actual.transactionId).toBe('d20-confirmation:'+actual.payload.rollId)
})
it('rejects a parent payload whose explicit request ID names a different original die',()=>{
 expect(()=>createD20RollConfirmationInterrupt({mapId:'map',rollId:bountifulDeferredD20RequestId('parent','raw',0,0),bountifulParent:{parentId:'parent',sourceOccurrence:0,dieIndex:1,rawRollId:'raw'},label:'Same attack',originalValue:1})).toThrow('invalid-bountiful-d20-parent-followup')
})
it('retains the old generation recovery for ordinary non-Bountiful windows',()=>{
 const input={mapId:'map',combatId:'combat',label:'Same normal check',originalValue:1,rollerCharacterId:'same-player'}
 const first=createD20RollConfirmationInterrupt({...input,rollId:'old',now:10}),later=createD20RollConfirmationInterrupt({...input,rollId:'new',now:20})
 expect(currentD20RollConfirmations({interrupts:[first,later]})).toHaveLength(1)
 expect(findCurrentD20RollConfirmation({interrupts:[first,later]},first)?.id).toBe(later.id)
})

import {expect,it} from 'vitest'
import {requestCompanionAttackSelections,companionAttackTargetOptions} from './companionAttackSelection'
import {normalizeCharacter} from '../../store/characters'
it('allows a living unconscious character but excludes confirmed dead or commanded creatures',()=>{
 const hero=normalizeCharacter({id:'hero',name:'Hero',currentHp:0,maxHp:20,deathSaveFailures:0})
 const tokens:any=[{id:'fallen',type:'player',characterId:'hero',hp:0},{id:'companion',type:'enemy',hp:10},{id:'corpse',type:'enemy',hp:0}]
 expect(companionAttackTargetOptions(tokens,['companion'],[hero]).map(t=>t.id)).toEqual(['fallen'])
 hero.deathSaveFailures=3
 expect(companionAttackTargetOptions(tokens,['companion'],[hero])).toEqual([])
})
it('retains the chosen creature and cancels without submitting a replacement',async()=>{
 const options=[{id:'a',label:'A'},{id:'b',label:'B'}]
 expect(await requestCompanionAttackSelections({operationIds:['order'],options,choose:async()=> 'b'})).toEqual({order:'b'})
 for(const value of [null,'missing'])expect(await requestCompanionAttackSelections({operationIds:['order'],options,choose:async()=>value})).toBeNull()
})

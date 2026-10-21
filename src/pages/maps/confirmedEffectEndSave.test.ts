import {expect,it} from 'vitest'
import {mergeConfirmedEffectEndSave as merge} from './confirmedEffectEndSave'
const before={characters:[{id:'hero',hp:20,exhaustion:0,effects:[{id:'pending',dc:15}]}],updatedAt:1}
const after={characters:[{id:'hero',hp:20,exhaustion:1,effects:[]}],updatedAt:1}
it('preserves unrelated concurrent damage, roster changes and metadata without rerolling',()=>{
 const current={characters:[{...before.characters[0],hp:13},{id:'other',hp:10,exhaustion:0,effects:[]}],updatedAt:2}
 const result=merge(before,after,current)
 expect(result).toEqual({characters:[{id:'hero',hp:13,exhaustion:1,effects:[]},current.characters[1]],updatedAt:2})
 expect(current.characters[0].effects).toHaveLength(1)
 expect(merge(before,after,result)).toEqual(result)
})
it('retains independently added effects and refuses a changed pending save',()=>{
 const current={...before,characters:[{...before.characters[0],effects:[...before.characters[0].effects,{id:'bless',dc:12}]}]}
 expect(merge(before,after,current).characters[0].effects).toEqual([{id:'bless',dc:12}])
 expect(()=>merge(before,after,{...before,characters:[{...before.characters[0],effects:[{id:'pending',dc:20}]}]})).toThrow('confirmed-effect-end-save-conflict')
})
it('refuses a conflicting exhaustion change or a deleted affected actor',()=>{
 expect(()=>merge(before,after,{...before,characters:[{...before.characters[0],exhaustion:2}]})).toThrow('confirmed-effect-end-save-conflict')
 expect(()=>merge(before,after,{...before,characters:[]})).toThrow('confirmed-effect-end-save-conflict')
})

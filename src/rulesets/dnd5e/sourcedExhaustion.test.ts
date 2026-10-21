import {expect,it} from 'vitest'
import {adjustDnd5eOrdinaryExhaustion, dnd5eExhaustionState} from './sourcedExhaustion'
import {changeDnd5eSourcedExhaustion as change,removeDnd5eSourcedExhaustion as remove,normalizeDnd5eSourcedExhaustion as normalize,dnd5eSourcedExhaustionLevel as level,type Dnd5eSourcedExhaustion} from './sourcedExhaustion'
const base=():Dnd5eSourcedExhaustion=>({schemaVersion:1,baseLevel:2,sources:[]})
it('general recovery reduces ordinary fatigue then sources without resurrecting recovered levels',()=>{
 const before=change(change(base(),'a',2),'b',1)
 const rested=adjustDnd5eOrdinaryExhaustion(before,-3)
 expect(rested).toEqual({schemaVersion:1,baseLevel:0,sources:[{sourceId:'a',levels:1},{sourceId:'b',levels:1}]})
 expect(level(remove(rested,'a'))).toBe(1)
 expect(before.baseLevel).toBe(2)
 expect(adjustDnd5eOrdinaryExhaustion(rested,1).sources).toEqual(rested.sources)
})
it('migrates scalar saves and ignores stale scalar projections when a ledger exists',()=>{
 expect(dnd5eExhaustionState(undefined,3)).toEqual({schemaVersion:1,baseLevel:3,sources:[]})
 expect(dnd5eExhaustionState(base(),0)).toEqual(base())
 expect(dnd5eExhaustionState(undefined,NaN).baseLevel).toBe(0)
})
it('repeated application keeps the original source recovery order',()=>{
 const state=change(change(change({...base(),baseLevel:0},'a',1),'b',1),'a',1)
 expect(adjustDnd5eOrdinaryExhaustion(state,-1).sources).toEqual([{sourceId:'a',levels:1},{sourceId:'b',levels:1}])
})
it('ends only one cast instance, preserving ordinary fatigue and a second caster',()=>{
 const before=base(),a=change(change(before,'cast-a',1),'cast-a',1),b=change(a,'cast-b',1)
 expect(level(b)).toBe(5)
 const ended=remove(b,'cast-a')
 expect(ended).toEqual({schemaVersion:1,baseLevel:2,sources:[{sourceId:'cast-b',levels:1}]})
 expect(level(ended)).toBe(3)
 expect(before).toEqual(base())
 expect(remove(ended,'cast-a')).toEqual(ended)
})
it('preserves contributions above the display cap across save/reload and independent cleanup',()=>{
 const state=change(change(base(),'cast-a',4),'cast-b',3)
 expect(level(state)).toBe(6)
 const restored=normalize(JSON.parse(JSON.stringify(state)))!
 expect(level(remove(restored,'cast-a'))).toBe(5)
 expect(level(remove(remove(restored,'cast-a'),'cast-b'))).toBe(2)
 expect(restored).toEqual(state)
})
it('bounded source reduction cannot erase another source or ordinary fatigue',()=>{
 const state=change(change(base(),'a',2),'b',1)
 expect(change(state,'a',-6)).toEqual({schemaVersion:1,baseLevel:2,sources:[{sourceId:'b',levels:1}]})
 expect(change(state,'absent',-1)).toEqual(state)
})
it.each([
 {schemaVersion:1,baseLevel:7,sources:[]},
 {schemaVersion:1,baseLevel:0,sources:[{sourceId:'a',levels:1},{sourceId:'a',levels:2}]},
 {schemaVersion:1,baseLevel:0,sources:[{sourceId:'a',levels:0}]},
 {schemaVersion:1,baseLevel:0,sources:[{sourceId:'a',levels:1.5}]},
 {schemaVersion:1,baseLevel:0,sources:[{sourceId:'a',levels:1,script:'ignored'}]},
])('rejects malformed source records %#',value=>expect(normalize(value)).toBeUndefined())

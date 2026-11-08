import {expect,it} from 'vitest'
import {createDnd5eParentEffectClock,createDnd5eConditionEffect} from './activeEffects'

const effect=(appliedAt?:number)=>createDnd5eConditionEffect({condition:'prone',source:{kind:'system'},targetId:'actual-target',...(appliedAt===undefined?{}:{appliedAt})})
it('isolates nested actual effect creation and preserves existing explicit timestamps',()=>{
 const a=createDnd5eParentEffectClock({parentId:'parent-A',sourceKey:'source-A',timestamp:1234})
 const b=createDnd5eParentEffectClock({parentId:'parent-B',sourceKey:'source-B',timestamp:5678})
 const before=Date.now()
 a.run(()=>{
  expect(effect().appliedAt).toBe(1234)
  b.run(()=>expect(effect().appliedAt).toBe(5678))
  expect(effect().appliedAt).toBe(1234)
  expect(effect(99).appliedAt).toBe(99)
 })
 expect(effect().appliedAt).toBeGreaterThanOrEqual(before)
})
it('restores the enclosing parent after an exception and prevents async scope escape',async()=>{
 const a=createDnd5eParentEffectClock({parentId:'parent-A',sourceKey:'source-A',timestamp:1234})
 const b=createDnd5eParentEffectClock({parentId:'parent-B',sourceKey:'source-B',timestamp:5678})
 a.run(()=>{
  expect(()=>b.run(()=>{expect(effect().appliedAt).toBe(5678);throw Error('real-abort')})).toThrow('real-abort')
  expect(effect().appliedAt).toBe(1234)
 })
 let ran=false
 expect(()=>a.run(async()=>{ran=true;return effect()})).toThrow('parent-effect-clock-sync-only')
 expect(ran).toBe(false)
 expect(()=>a.run(()=>Promise.resolve('not-a-sync-parent'))).toThrow('parent-effect-clock-sync-only')
 const before=Date.now()
 const values=await Promise.all([Promise.resolve().then(()=>a.run(()=>effect().appliedAt)),Promise.resolve().then(()=>b.run(()=>effect().appliedAt))])
 expect(values).toEqual([1234,5678])
 expect(effect().appliedAt).toBeGreaterThanOrEqual(before)
})
it('rejects malformed Host clock contexts without changing the ambient wall clock',()=>{
 for(const timestamp of [0,-1,NaN,Infinity,1.5])expect(()=>createDnd5eParentEffectClock({parentId:'A',sourceKey:'S',timestamp})).toThrow('parent-effect-clock-invalid')
 expect(()=>createDnd5eParentEffectClock({parentId:'',sourceKey:'S',timestamp:123})).toThrow('parent-effect-clock-invalid')
 const before=Date.now();expect(effect().appliedAt).toBeGreaterThanOrEqual(before)
})

import {expect,it} from 'vitest'
import {dnd5eGroveCastIdentity} from './druidGroveCastIdentity'

it('preserves existing short identities including the storage boundary',()=>{
 for(const size of [1,140]) {
  const actionId='a'.repeat(size)
  expect(dnd5eGroveCastIdentity(actionId,'grove')).toBe(`activity-area:${actionId}:grove`)
 }
})
it('compacts long authority IDs while retaining retry, suffix and operation distinctions',()=>{
 const prefix='a'.repeat(400)
 const first=dnd5eGroveCastIdentity(prefix+':100','grove')
 expect(first.length).toBeLessThanOrEqual(160)
 expect(dnd5eGroveCastIdentity(prefix+':100','grove')).toBe(first)
 expect(dnd5eGroveCastIdentity(prefix+':101','grove')).not.toBe(first)
 expect(dnd5eGroveCastIdentity(prefix+':100','other')).not.toBe(first)
 expect(dnd5eGroveCastIdentity(prefix+':100','Grove')).not.toBe(first)
})

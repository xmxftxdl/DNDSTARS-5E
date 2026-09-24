import { expect, it } from 'vitest'
import { persistentAreaNeedsDmApproval } from './persistentAreaApproval'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'

it('settles new and already placed Sleet Storm triggers without DM approval', () => {
  const storm = getDnd5eCoreSpellAreaDeclaration('sleet-storm')!
  expect(storm.triggers).toHaveLength(3)
  for (const trigger of storm.triggers!) {
    expect(trigger.dmAdjustable).toBe(false)
    expect(trigger.savingThrow).toBeDefined()
    expect(persistentAreaNeedsDmApproval('sleet-storm', trigger.dmAdjustable)).toBe(false)
  }
  expect(persistentAreaNeedsDmApproval('sleet-storm', true)).toBe(false)
  expect(persistentAreaNeedsDmApproval('stinking-cloud', true)).toBe(false)
  expect(persistentAreaNeedsDmApproval(undefined, true)).toBe(true)
})

it('settles new and already placed Stinking Cloud triggers without DM approval', () => {
  const cloud = getDnd5eCoreSpellAreaDeclaration('stinking-cloud')!
  const trigger = cloud.triggers![0]
  expect(trigger.dmAdjustable).toBe(false)
  expect(trigger.savingThrow?.ability).toBe('con')
  expect(trigger.consumeActionOnFailedSave).toBe(true)
  expect(persistentAreaNeedsDmApproval('stinking-cloud', trigger.dmAdjustable)).toBe(false)
  expect(persistentAreaNeedsDmApproval('stinking-cloud', true)).toBe(false)
  expect(persistentAreaNeedsDmApproval('web', true)).toBe(false)
})

it('settles new and saved Web restraint and burning triggers without approval', () => {
  for (const trigger of getDnd5eCoreSpellAreaDeclaration('web')!.triggers!) {
    expect(trigger.dmAdjustable).toBe(false)
    expect(persistentAreaNeedsDmApproval('web', trigger.dmAdjustable)).toBe(false)
  }
  expect(persistentAreaNeedsDmApproval('web', true)).toBe(false)
})

it('settles Ice Wall damage after the save without a second adjudication/resume gate, including saved areas',()=>{
 const trigger=getDnd5eCoreSpellAreaDeclaration('wall-of-ice')!.triggers[0]
 expect(trigger.savingThrow).toMatchObject({ability:'dex',onSuccess:'half'})
 expect(trigger.damage).toMatchObject({count:10,sides:6,type:'cold'})
 expect(trigger.dmAdjustable).toBe(false)
 expect(persistentAreaNeedsDmApproval('wall-of-ice',trigger.dmAdjustable)).toBe(false)
 expect(persistentAreaNeedsDmApproval('wall-of-ice',true)).toBe(false)
 expect(persistentAreaNeedsDmApproval('wall-of-ice',undefined)).toBe(false)
 expect(persistentAreaNeedsDmApproval('wall-of-thorns',true)).toBe(true)
})

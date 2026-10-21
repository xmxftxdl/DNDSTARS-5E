import {describe,expect,it} from 'vitest'
import {validateDnd5eEffectDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eEffectDefinitionV1,Dnd5eEffectModifierV1} from './dnd5eEffectContracts'
const effect = (modifier:unknown) => ({schemaVersion:1,id:'module-effect',name:'Module effect',duration:{kind:'permanent'},stacking:'replace',modifiers:[modifier]}) as Dnd5eEffectDefinitionV1

describe('module Effect modifier modes',()=>{
 it.each([
  {sides:20,appliesTo:['saving-throw'],consumeOnUse:true},
  {sides:4,appliesTo:[],consumeOnUse:true},
  {sides:4,appliesTo:['attack'],consumeOnUse:true},
  {sides:4,appliesTo:['saving-throw','saving-throw'],consumeOnUse:true},
  {sides:4,appliesTo:['saving-throw'],consumeOnUse:'false'},
 ])('rejects unsupported deferred bonus die declarations %j',declaration=>{
  expect(validateDnd5eEffectDefinitionV1(effect({kind:'optional-bonus-die',...declaration}))).toEqual(expect.arrayContaining([expect.stringContaining('optional-bonus-die is invalid')]))
 })
 it('rejects two deferred dice in one effect instead of silently overwriting one',()=>{
  const value=effect({kind:'optional-bonus-die',sides:4,appliesTo:['saving-throw'],consumeOnUse:true})
  value.modifiers=[...value.modifiers!,...value.modifiers!]
  expect(validateDnd5eEffectDefinitionV1(value)).toEqual(expect.arrayContaining([expect.stringContaining('only one optional-bonus-die')]))
 })
 it('rejects an unknown healing prevention scope',()=>{
  expect(validateDnd5eEffectDefinitionV1(effect({kind:'healing-prevention',scope:'sometimes'}))).toEqual(expect.arrayContaining([expect.stringContaining('.scope is invalid')]))
 })
 it.each(['speed','armor-class','saving-throw','attack-roll','weapon-damage-roll','hit-point-maximum'])('rejects unknown %s modes rather than silently changing their meaning',kind=>{
  expect(validateDnd5eEffectDefinitionV1(effect({kind,mode:'bonus',value:{kind:'constant',value:5}}))).toEqual(expect.arrayContaining([expect.stringContaining('.mode is invalid')]))
 })
 it.each(['attack-roll','saving-throw'])('requires a formula for an additive %s',kind=>{
  expect(validateDnd5eEffectDefinitionV1(effect({kind,mode:'add'}))).toEqual(expect.arrayContaining([expect.stringContaining('value is required')]))
 })
 it('accepts a signed speed adjustment and checks with explicit advantage',()=>{
  for(const modifier of [{kind:'speed',mode:'add',value:{kind:'constant',value:-5}},{kind:'saving-throw',mode:'advantage',ability:'wis'}] satisfies Dnd5eEffectModifierV1[]) {
   expect(validateDnd5eEffectDefinitionV1(effect(modifier))).toEqual([])
  }
 })
})

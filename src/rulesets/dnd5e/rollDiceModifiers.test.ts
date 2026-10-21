import {expect, it} from 'vitest'
import {createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict} from './activeEffects'
import {dnd5eRollDiceRecipes, normalizeDnd5eRollDiceModifiers, resolveDnd5eRollDiceModifiers, type Dnd5eRollDiceModifier} from './rollDiceModifiers'

const penalty:Dnd5eRollDiceModifier={count:1,sides:6,direction:'subtract',appliesTo:['attack','ability-check','concentration-save']}
const effect=()=>createDnd5eMechanicalEffect({id:'effect:1',definitionId:'test.penalty',label:'Penalty',source:{kind:'plugin',rulesId:'test.penalty'},
  targetId:'creature',modifiers:{rollDiceModifiers:[penalty]}})
const context=()=>({effects:[effect()],actorId:'creature',eventId:'host-roll:1',kind:'attack' as const})

it('persists the unresolved dice declaration and clones it independently',()=>{
  const original=effect()
  expect(original.modifiers?.rollDiceModifiers).toEqual([penalty])
  expect(original.modifiers?.rollDiceModifiers?.[0]).not.toBe(penalty)
  expect(validateDnd5eActiveEffectsStrict([original]).ok).toBe(true)
  const restored=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([original])))
  expect(restored[0].modifiers?.rollDiceModifiers).toEqual([penalty])
})

it('requests a fresh event-bound die for every roll and does not consume its effect',()=>{
  const input=context(), before=structuredClone(input)
  const first=dnd5eRollDiceRecipes(input)[0]
  expect(resolveDnd5eRollDiceModifiers(input,{[first.id]:[6]})).toMatchObject({modifier:-6})
  const next={...input,eventId:'host-roll:2'}
  const second=dnd5eRollDiceRecipes(next)[0]
  expect(second.id).not.toBe(first.id)
  expect(()=>resolveDnd5eRollDiceModifiers(next,{[first.id]:[6]})).toThrow('roll-dice-unexpected')
  expect(resolveDnd5eRollDiceModifiers(next,{[second.id]:[1]}).modifier).toBe(-1)
  expect(input).toEqual(before)
})

it('distinguishes ordinary saves from concentration, without double counting overlapping scopes',()=>{
  const input=context()
  expect(dnd5eRollDiceRecipes({...input,kind:'saving-throw'})).toEqual([])
  expect(dnd5eRollDiceRecipes({...input,kind:'concentration-save'})).toHaveLength(1)
  input.effects[0].modifiers!.rollDiceModifiers=[{...penalty,appliesTo:['saving-throw','concentration-save']}]
  expect(dnd5eRollDiceRecipes({...input,kind:'concentration-save'})).toHaveLength(1)
  expect(dnd5eRollDiceRecipes({...input,kind:'saving-throw'})).toHaveLength(1)
})

it('combines independent bonuses and penalties using Host declarations',()=>{
  const input=context()
  input.effects.push({...effect(),id:'bonus',modifiers:{rollDiceModifiers:[{count:2,sides:4,direction:'add',appliesTo:['attack']}]}})
  const recipes=dnd5eRollDiceRecipes(input)
  expect(resolveDnd5eRollDiceModifiers(input,{[recipes[0].id]:[5],[recipes[1].id]:[2,4]}).modifier).toBe(1)
})

it('rechecks suspended, removed, duplicated and changed effects before accepting submitted dice',()=>{
  const input=context(), id=dnd5eRollDiceRecipes(input)[0].id
  input.effects[0].suspendedBy=['antimagic']
  expect(dnd5eRollDiceRecipes(input)).toEqual([])
  expect(()=>resolveDnd5eRollDiceModifiers(input,{[id]:[5]})).toThrow('roll-dice-unexpected')
  input.effects=[]
  expect(()=>resolveDnd5eRollDiceModifiers(input,{[id]:[5]})).toThrow('roll-dice-unexpected')
  input.effects=[effect(),effect()]
  expect(()=>dnd5eRollDiceRecipes(input)).toThrow('roll-dice-effect-id-invalid')
  input.effects=[effect()]
  input.effects[0].modifiers!.rollDiceModifiers=[{...penalty,sides:4}]
  expect(()=>resolveDnd5eRollDiceModifiers(input,{[id]:[5]})).toThrow('roll-dice-unexpected')
})

it.each([undefined,[],[0],[7],[1.5],[Number.NaN],[1,2]].map(values=>({values})))('rejects missing or malformed mandatory dice $values',({values})=>{
  const input=context(), id=dnd5eRollDiceRecipes(input)[0].id
  expect(()=>resolveDnd5eRollDiceModifiers(input,values ? {[id]:values} : undefined)).toThrow('roll-dice-missing-or-invalid')
})

it.each([[],[{...penalty,count:0}],[{...penalty,sides:3}],[{...penalty,direction:'ignore'}],
  [{...penalty,appliesTo:[]}],[{...penalty,appliesTo:['attack','attack']}],[{...penalty,extra:'ignored?'}]].map(value=>({value})))('rejects malformed persisted declarations $value',({value})=>{
  expect(normalizeDnd5eRollDiceModifiers(value)).toBeUndefined()
  const raw=effect() as unknown as {modifiers:Record<string,unknown>}
  raw.modifiers.rollDiceModifiers=value
  expect(validateDnd5eActiveEffectsStrict([raw]).ok).toBe(false)
})

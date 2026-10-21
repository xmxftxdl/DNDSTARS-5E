import {dnd5eRollDiceRecipes} from './rollDiceModifiers'
import {expect,it} from 'vitest'
import {captureDnd5eRollDiceOccurrences,consumeDnd5eRollDiceModifier,withDnd5eRollDicePreview,withDnd5eRollDiceTransaction,withDnd5eChildRollDiceTransaction,dnd5eRollDiceOccurrenceId} from './rollDiceTransaction'

it('captures only committed occurrences, including no-effect rolls and separate check slots',()=>{
  const captured=captureDnd5eRollDiceOccurrences(()=>withDnd5eRollDiceTransaction({eventId:'root'},()=>{
    consumeDnd5eRollDiceModifier('target',[],'saving-throw')
    withDnd5eRollDicePreview(()=>consumeDnd5eRollDiceModifier('target',[],'saving-throw'))
    withDnd5eRollDiceTransaction({eventId:'nested'},()=>{
      consumeDnd5eRollDiceModifier('target',[],'saving-throw')
      consumeDnd5eRollDiceModifier('target',[],'saving-throw','named-check')
      return {ok:true}
    })
    return {ok:true}
  }))
  expect(captured.occurrences).toEqual([{actorId:'target',kind:'saving-throw',count:2},{actorId:'target',kind:'saving-throw',checkSlot:'named-check',count:1}])
  const failed=captureDnd5eRollDiceOccurrences(()=>withDnd5eRollDiceTransaction({eventId:'failed'},()=>{
    consumeDnd5eRollDiceModifier('target',[],'saving-throw');return {ok:false}
  }))
  expect(failed.occurrences).toEqual([])
  expect(captureDnd5eRollDiceOccurrences(()=>withDnd5eRollDiceTransaction({eventId:'fresh'},()=>({ok:true}))).occurrences).toEqual([])
})

it('isolates reaction dice, forwards audit and restores parent occurrences after child failure',()=>{
 const effects: Parameters<typeof dnd5eRollDiceRecipes>[0]['effects']=[{id:'bonus',modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'add' as const,appliesTo:['attack' as const]}]}}]
 const recipe=dnd5eRollDiceRecipes({effects,actorId:'reactor',kind:'attack',eventId:dnd5eRollDiceOccurrenceId('child','reactor','attack',0)})[0]
 const audit:string[]=[]
 const captured=captureDnd5eRollDiceOccurrences(()=>withDnd5eRollDiceTransaction({eventId:'parent',onAudit:entry=>audit.push(entry.recipe.id)},()=>{
  consumeDnd5eRollDiceModifier('target',[],'saving-throw')
  expect(()=>withDnd5eChildRollDiceTransaction({eventId:'child',rolls:{}},()=>{
   consumeDnd5eRollDiceModifier('reactor',effects,'attack');return {ok:true}
  })).toThrow()
  const child=withDnd5eChildRollDiceTransaction({eventId:'child',rolls:{[recipe.id]:[4]}},()=>{
   expect(consumeDnd5eRollDiceModifier('reactor',effects,'attack')).toBe(4);return {ok:true}
  })
  expect(child.ok).toBe(true)
  consumeDnd5eRollDiceModifier('target',[],'saving-throw')
  return {ok:true}
 }))
 expect(audit).toEqual([recipe.id])
 expect(captured.occurrences).toEqual([{actorId:'target',kind:'saving-throw',count:2}])
 expect(captureDnd5eRollDiceOccurrences(()=>withDnd5eRollDiceTransaction({eventId:'fresh'},()=>({ok:true}))).occurrences).toEqual([])
})


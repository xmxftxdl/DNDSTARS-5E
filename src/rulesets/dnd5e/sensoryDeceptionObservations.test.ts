import { expect, it } from 'vitest'
import { dnd5eCombatantSensoryDeceptionObservation as observe } from './sensoryDeceptionObservations'
import { dnd5eSensoryDeceptionPresence as detect } from './sensoryDeceptionPresence'
import { createDnd5eCombatant } from './headlessCombatEngine'

const make = () => createDnd5eCombatant({id:'target',name:'Not an illusion',initiative:1,controller:'dm',
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:10,proficiencyBonus:2,
  currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
it('uses the actual changed shapechanger form without disclosing the original form', () => {
  const target = make()
  target.shapechanger = true
  target.classState.monsterShapechangeFormId = 'human'
  target.classState.monsterShapechangeOriginalStatBlockId = 'secret-form'
  const observation = observe({target,distanceFeet:30,samePlane:true,spellSchool:()=>undefined})
  expect(observation.shapechangerOutsideOriginalForm).toBe(true)
  expect(detect({conditions:[],observations:[observation],sceneComplete:false})).toEqual({status:'resolved',present:true})
  expect(JSON.stringify(observation)).not.toContain('secret-form')
  target.classState.monsterShapechangeFormId = 'secret-form'
  expect(observe({target,spellSchool:()=>undefined}).shapechangerOutsideOriginalForm).toBe(false)
  target.shapechanger = false
  target.classState.monsterShapechangeFormId = 'human'
  expect(observe({target,spellSchool:()=>undefined}).shapechangerOutsideOriginalForm).toBe(false)
})
it('reads absence of modelled effects without inferring an illusion from a name', () => {
  const observation = observe({target:make(),distanceFeet:5,samePlane:true,spellSchool:()=>undefined})
  expect(observation.illusion).toBe(false)
  expect(detect({conditions:[],observations:[observation],sceneComplete:true})).toEqual({status:'resolved',present:false})
})

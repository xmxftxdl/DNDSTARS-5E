import { expect, it } from 'vitest'
import { dnd5eSensoryDeceptionPresence as detect, type Dnd5eSensoryDeceptionObservation } from './sensoryDeceptionPresence'

const clear: Dnd5eSensoryDeceptionObservation = {
  distanceFeet: 30, samePlane: true, illusion: false,
  shapechangerOutsideOriginalForm: false, sensoryDeceivingMagic: false,
}
it.each(['illusion','shapechangerOutsideOriginalForm','sensoryDeceivingMagic'] as const)(
  'reports only presence for %s at the inclusive boundary', kind => {
    const observation = {...clear,[kind]:true, secretName:'Hidden identity',originalForm:'Dragon'}
    const input = {conditions:[],observations:[observation],sceneComplete:false}
    const before = structuredClone(input)
    const result = detect(input)
    expect(result).toEqual({status:'resolved',present:true})
    expect(JSON.stringify(result)).not.toMatch(/identity|Dragon|30/)
    expect(input).toEqual(before)
  })
it.each(['blinded','deafened'] as const)('cannot be used while %s', condition => {
  expect(detect({conditions:[condition],observations:[{...clear,illusion:true}],sceneComplete:true}))
    .toEqual({status:'blocked',reason:'blinded-or-deafened'})
})
it('distinguishes absence, incomplete scene and unknown facts', () => {
  expect(detect({conditions:[],observations:[clear],sceneComplete:true})).toEqual({status:'resolved',present:false})
  expect(detect({conditions:[],observations:[],sceneComplete:true})).toEqual({status:'resolved',present:false})
  expect(detect({conditions:[],observations:[],sceneComplete:false})).toEqual({status:'unavailable'})
  for (const patch of [{illusion:undefined},{distanceFeet:undefined},{samePlane:undefined},{distanceFeet:NaN},{distanceFeet:-1}]) {
    expect(detect({conditions:[],observations:[{...clear,...patch}],sceneComplete:true})).toEqual({status:'unavailable'})
  }
})
it('does not detect outside range or on another plane, and preserves a known positive among unknown facts', () => {
  for (const patch of [{distanceFeet:30.01},{samePlane:false}]) {
    expect(detect({conditions:[],observations:[{...clear,illusion:true,...patch}],sceneComplete:true}))
      .toEqual({status:'resolved',present:false})
  }
  expect(detect({conditions:[],observations:[{}, {...clear,sensoryDeceivingMagic:true}],sceneComplete:false}))
    .toEqual({status:'resolved',present:true})
})

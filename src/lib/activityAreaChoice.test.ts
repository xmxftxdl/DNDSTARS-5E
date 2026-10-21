import {expect,it} from 'vitest'
import {readActivityAreaChoice,readActivityAreaAim} from './activityAreaChoice'

it('accepts a bounded definition reference and discards supplied rules and affected targets',()=>{
  const reference={packageId:'local.sun-soul',activityId:'arc-cast-2',actorTokenId:'monk-token'}
  expect(readActivityAreaChoice({...reference,activity:{target:{rangeFeet:99999}},targetIds:['victim']})).toEqual(reference)
  for(const key of Object.keys(reference))for(const invalid of ['',42,null,' bad','x'.repeat(161)]){
    expect(readActivityAreaChoice({...reference,[key]:invalid})).toBeUndefined()
  }
  expect(readActivityAreaChoice(null)).toBeUndefined()
  expect(readActivityAreaChoice([])).toBeUndefined()
})

it('accepts placement intent only and rejects malformed coordinates and rotation',()=>{
  expect(readActivityAreaAim({anchorCell:{col:2,row:3},rectAngleDegrees:45,targetIds:['victim']}))
    .toEqual({anchorCell:{col:2,row:3},rectAngleDegrees:45})
  for(const value of [null,{}, {anchorCell:{col:1.5,row:2}},
    {anchorCell:{col:2,row:3},rectAngleDegrees:Infinity},
    {anchorCell:{col:2,row:3},rectAngleDegrees:'90'},
    {anchorCell:{col:2,row:3},rectAngleDegrees:361}]) expect(readActivityAreaAim(value)).toBeUndefined()
})

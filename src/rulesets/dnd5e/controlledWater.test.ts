import {expect,it} from 'vitest'
import {changeDnd5eControlledWater,dismissDnd5eWaterAlteration,projectDnd5eControlledWater,type Dnd5eControlledWater} from './controlledWater'
const water=(id='pool'):Dnd5eControlledWater=>({id,positionFeet:{x:0,y:0,z:0},dimensionsFeet:{x:5,y:5,z:5},color:'#3388cc',opacity:0.5,alterations:[],appliedActionIds:[]})
const request=()=>({waters:[water()],waterId:'pool',casterId:'wizard',actionId:'cast',worldMinute:100,distanceFeet:30,visible:true})
it('uses a five-foot cube rather than five cubic feet and measures movement in 3D',()=>{
  const input={...request(),change:{kind:'move' as const,displacementFeet:{x:3,y:0,z:4}},movementPathClear:true}
  const before=structuredClone(input),result=changeDnd5eControlledWater(input)
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(result.waters[0].positionFeet).toEqual({x:3,y:0,z:4})
  expect(result.waters[0].dimensionsFeet).toEqual({x:5,y:5,z:5})
  expect(result.waters[0].alterations).toEqual([])
  expect(input).toEqual(before)
  expect(changeDnd5eControlledWater({...input,waters:result.waters})).toMatchObject({ok:false,reason:'water-action-already-applied'})
  expect(changeDnd5eControlledWater({...input,change:{kind:'move',displacementFeet:{x:5,y:0,z:5}}})).toMatchObject({ok:false})
  expect(changeDnd5eControlledWater({...input,movementPathClear:undefined})).toMatchObject({ok:false})
  expect(changeDnd5eControlledWater({...input,waters:[{...water(),dimensionsFeet:{x:6,y:1,z:1}}]})).toMatchObject({ok:false})
})
it('limits non-instantaneous effects across water bodies by caster and releases slots at expiry',()=>{
  let waters=[water('a'),water('b'),water('c')]
  for(const [id,actionId] of [['a','one'],['b','two']]){
    const r=changeDnd5eControlledWater({...request(),waters,waterId:id,actionId,change:{kind:'shape',description:'旋转圆环'}})
    expect(r.ok).toBe(true);if(r.ok)waters=r.waters
  }
  const input={...request(),waters,waterId:'c',actionId:'three',change:{kind:'appearance' as const,color:'#ff0000',opacity:1}}
  expect(changeDnd5eControlledWater(input)).toMatchObject({ok:false,reason:'water-effect-limit'})
  expect(changeDnd5eControlledWater({...input,casterId:'other'}).ok).toBe(true)
  expect(changeDnd5eControlledWater({...input,worldMinute:160}).ok).toBe(true)
  expect(changeDnd5eControlledWater({...input,change:{kind:'move',displacementFeet:{x:5,y:0,z:0}},movementPathClear:true}).ok).toBe(true)
  expect(dismissDnd5eWaterAlteration(waters,'other','one',101)).toMatchObject({ok:false})
  const removed=dismissDnd5eWaterAlteration(waters,'wizard','one',101)
  expect(removed.ok).toBe(true);if(!removed.ok)throw Error(removed.reason)
  expect(removed.waters.flatMap(w=>w.alterations).map(e=>e.id)).toEqual(['two'])
})
it('requires known empty water to freeze, thaws after one hour and restores original appearance',()=>{
  const appearance=changeDnd5eControlledWater({...request(),change:{kind:'appearance',color:'#ff0000',opacity:1}})
  if(!appearance.ok)throw Error(appearance.reason)
  const input={...request(),waters:appearance.waters,actionId:'ice',worldMinute:110,change:{kind:'freeze' as const}}
  for(const containsCreatures of [undefined,true])expect(changeDnd5eControlledWater({...input,containsCreatures})).toMatchObject({ok:false})
  const freeze=changeDnd5eControlledWater({...input,containsCreatures:false})
  if(!freeze.ok)throw Error(freeze.reason)
  const saved=JSON.parse(JSON.stringify(freeze.waters)) as Dnd5eControlledWater[]
  expect(projectDnd5eControlledWater(saved[0],159)).toMatchObject({color:'#ff0000',opacity:1,frozen:true})
  expect(projectDnd5eControlledWater(saved[0],160)).toMatchObject({color:'#3388cc',opacity:0.5,frozen:true})
  expect(projectDnd5eControlledWater(saved[0],170).frozen).toBe(false)
  expect(changeDnd5eControlledWater({...input,waters:saved,actionId:'again',containsCreatures:false})).toMatchObject({ok:false,reason:'water-is-frozen'})
})
it('rejects unseen, distant and malformed requests without modifying state',()=>{
  const input={...request(),change:{kind:'appearance' as const,color:'#123456',opacity:0.5}}
  const before=structuredClone(input)
  for(const patch of [{visible:false},{distanceFeet:30.01},{distanceFeet:NaN},{worldMinute:-1},{actionId:''}])expect(changeDnd5eControlledWater({...input,...patch}).ok).toBe(false)
  expect(changeDnd5eControlledWater({...input,change:{kind:'appearance',color:'bad',opacity:2}}).ok).toBe(false)
  expect(input).toEqual(before)
})

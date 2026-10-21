import {expect,it} from 'vitest'
import {changeDnd5eControlledWater,projectDnd5eControlledWater,type Dnd5eControlledWater} from './controlledWater'
import {normalizeControlledWaterState} from '../../../shared/controlled-water-state.mjs'
it('freezes touch-range empty cubes for one minute without sharing the shape-water cap',()=>{
 const rules={rangeFeet:5,durationMinutes:1,maximumActiveEffects:null,limitGroup:'test:touch-freeze'}
 let waters:Dnd5eControlledWater[]=Array.from({length:5},(_,i)=>({id:'pool'+i,positionFeet:{x:0,y:0,z:0},dimensionsFeet:{x:5,y:5,z:5},color:'#3388cc',opacity:0.5,alterations:[],appliedActionIds:[]}))
 const base={casterId:'owner',worldMinute:10,distanceFeet:5,visible:true,change:{kind:'freeze' as const},containsCreatures:false,rules}
 for(const i of [0,1,2]){
  const input={...base,waters,waterId:'pool'+i,actionId:'ice'+i},before=JSON.stringify(waters)
  expect(changeDnd5eControlledWater({...input,distanceFeet:5.01}).ok).toBe(false)
  expect(changeDnd5eControlledWater({...input,containsCreatures:true}).ok).toBe(false)
  const r=changeDnd5eControlledWater(input);expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason)
  expect(JSON.stringify(waters)).toBe(before);waters=r.waters
  const saved=normalizeControlledWaterState(JSON.parse(JSON.stringify(waters[i])))!;expect(saved).toBeTruthy()
  expect(projectDnd5eControlledWater(saved,10.99).frozen).toBe(true);expect(projectDnd5eControlledWater(saved,11).frozen).toBe(false)
 }
 for(const i of [3,4]){const r=changeDnd5eControlledWater({...base,rules:undefined,waters,waterId:'pool'+i,actionId:'shape'+i,change:{kind:'shape',description:'Wave'}});expect(r.ok).toBe(true);if(r.ok)waters=r.waters}
 expect(changeDnd5eControlledWater({...base,rules:undefined,waters,waterId:'pool0',actionId:'third-shape',change:{kind:'shape',description:'Wave'},worldMinute:11})).toMatchObject({ok:false,reason:'water-effect-limit'})
 expect(normalizeControlledWaterState({...waters[0],alterations:waters[0].alterations.map(e=>({...e,expiresAtWorldMinute:99}))})).toBeUndefined()
})

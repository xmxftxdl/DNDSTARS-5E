import { expect, it } from 'vitest'
import { normalizeDnd5ePersistentAreaVisual } from './persistentAreaTypes'
import { normalizeVerticalSurfaceProjection } from './verticalSurfaceProjection'
import { migrateMapsState } from '../../store/maps'

const surface = {entityId:'stone',edgeIndex:1,a:{x:50,y:0},b:{x:50,y:50},outward:{x:1,y:0},baseElevationFeet:5,heightFeet:5,material:'stone'}

it.each(['surface-inscription','surface-color','surface-drawing'])('preserves %s wall placement through JSON and map migration', preset => {
  const drawing = preset === 'surface-drawing' ? {version:1,strokes:[{points:[0,0,1,1],color:'#aa3300',width:0.02}]} : undefined
  const visual = normalizeDnd5ePersistentAreaVisual({preset,verticalSurface:surface,...(drawing?{drawing}:{})})!
  expect(visual.verticalSurface).toEqual(surface)
  expect(visual.verticalSurface?.a).not.toBe(surface.a)
  const area={id:'wall-art',pluginId:'local.test',featureId:'draw',label:'图案',color:'#aa3300',sourceTokenId:'caster',anchorMode:'fixed',cells:[{col:1,row:0}],createdRound:1,expiresAfterRound:601,visual}
  const state={maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,tokens:[],dnd5ePluginAreas:[area]}],selectedId:'map'}
  expect(migrateMapsState(JSON.parse(JSON.stringify(state))).maps[0].dnd5ePluginAreas?.[0].visual?.verticalSurface).toEqual(surface)
})

it.each([
  {entityId:''}, {edgeIndex:-1}, {edgeIndex:0.5}, {heightFeet:0}, {baseElevationFeet:NaN},
  {b:surface.a}, {outward:{x:2,y:0}}, {outward:{x:0,y:1}}, {material:'unknown'},
  {a:{x:Infinity,y:0}}, {a:{x:50,y:0,script:'run'}}, {script:'run'},
  {attachment:{centerFraction:2,widthFeet:5,baseOffsetFeet:0}},
  {attachment:{centerFraction:0.5,widthFeet:0,baseOffsetFeet:0}},
  {attachment:{centerFraction:0.5,widthFeet:5,baseOffsetFeet:-1}},
  {attachment:{centerFraction:0.5,widthFeet:5,baseOffsetFeet:NaN}},
  {attachment:{centerFraction:0.5,widthFeet:5,baseOffsetFeet:0,script:'run'}},
])('rejects malformed wall projection %j', patch => {
  const value={...surface,...patch}
  expect(normalizeVerticalSurfaceProjection(value)).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaVisual({preset:'surface-color',verticalSurface:value})).toBeUndefined()
})

it('rejects incompatible visual presets instead of silently discarding the surface', () => {
  expect(normalizeDnd5ePersistentAreaVisual({preset:'arcane',verticalSurface:surface})).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaVisual({preset:'surface-color'})).toEqual({preset:'surface-color',intensity:'normal'})
})

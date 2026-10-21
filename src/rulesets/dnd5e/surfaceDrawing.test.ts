import { expect, it } from 'vitest'
import { normalizeSurfaceDrawing } from './surfaceDrawing'
import { normalizeDnd5ePersistentAreaVisual } from './persistentAreaTypes'
import { migrateMapsState } from '../../store/maps'
const drawing={version:1 as const,strokes:[{points:[0.1,0.2,0.8,0.9],color:'#AA3300',width:0.02}]}
it('preserves normalized brush strokes through map save/reload without retaining mutable input',()=>{
  const normalized=normalizeDnd5ePersistentAreaVisual({preset:'surface-drawing',drawing})!
  expect(normalized.drawing?.strokes[0].color).toBe('#aa3300')
  expect(normalized.drawing?.strokes[0].points).not.toBe(drawing.strokes[0].points)
  const area={id:'drawing',pluginId:'local.test',featureId:'draw',label:'图案',color:'#aa3300',sourceTokenId:'caster',anchorMode:'fixed',cells:[{col:1,row:1}],createdRound:1,expiresAfterRound:601,visual:normalized}
  const state={maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,tokens:[],dnd5ePluginAreas:[area]}],selectedId:'map'}
  const restored=migrateMapsState(JSON.parse(JSON.stringify(state)))
  expect(restored.maps[0].dnd5ePluginAreas?.[0].visual?.drawing).toEqual(normalized.drawing)
})
it.each(['coordinate','nan','width','color','script','points','strokes','empty'] as const)('rejects malformed or excessive drawing payload: %s',kind=>{
  const value:any=structuredClone(drawing)
  if(kind==='coordinate')value.strokes[0].points[0]=1.1
  if(kind==='nan')value.strokes[0].points[0]=NaN
  if(kind==='width')value.strokes[0].width=0
  if(kind==='color')value.strokes[0].color='url(https://example.com)'
  if(kind==='script')value.strokes[0].onDraw='alert(1)'
  if(kind==='points')value.strokes[0].points=Array(4098).fill(0.5)
  if(kind==='strokes')value.strokes=Array(65).fill(value.strokes[0])
  if(kind==='empty')value.strokes=[]
  expect(normalizeSurfaceDrawing(value)).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaVisual({preset:'surface-drawing',drawing:value})).toBeUndefined()
})
it('does not silently drop drawings attached to incompatible presets',()=>{
  expect(normalizeDnd5ePersistentAreaVisual({preset:'arcane',drawing})).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaVisual({preset:'surface-drawing'})).toBeUndefined()
})

import { expect, it, vi } from 'vitest'
vi.mock('react-konva',()=>({Group:'Group',Text:'Text'}))
import { CloudTextArea, cloudTextLayout } from './CloudTextArea'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { normalizeDnd5ePersistentAreaVisual } from '../../rulesets/dnd5e/persistentAreaTypes'

const area={id:'cloud',label:'Meet at the northern gate',cells:[{col:2,row:3},{col:3,row:3}],visual:{preset:'cloud-text'}} as Dnd5ePluginArea
const map={gridSize:50,gridOffsetX:10,gridOffsetY:20,tokens:[]} as unknown as BattleMap
it('keeps lettering at saved cells with map offsets, independently of caster position',()=>{
 const before=cloudTextLayout(area,map)
 expect(before).toMatchObject({x:110,y:170,width:100,height:50,text:area.label})
 expect(cloudTextLayout(area,{...map,tokens:[{id:'caster',x:999,y:999} as any]})).toEqual(before)
 expect(cloudTextLayout({...area,cells:[]},map)).toBeUndefined()
 expect(cloudTextLayout({...area,label:'长'.repeat(120)},map)!.fontSize).toBeLessThan(before!.fontSize)
})
it('renders literal player text and retains the declared preset through normalization',()=>{
 const saved=JSON.parse(JSON.stringify({...area,label:'<b>北门</b>'}))
 expect(normalizeDnd5ePersistentAreaVisual(saved.visual)).toEqual({preset:'cloud-text',intensity:'normal'})
 const output=CloudTextArea({area:saved,map})!
 expect(output.props.name).toBe('persistent-cloud-text')
 expect(output.props.children.every((child:any)=>child.props.text==='<b>北门</b>')).toBe(true)
 expect(CloudTextArea({area:{...area,cells:[]},map})).toBeNull()
})

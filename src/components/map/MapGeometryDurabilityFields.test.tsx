import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapGeometryDurabilityFields } from './MapGeometryDurabilityFields'

it('shows unknown durability as an empty field rather than zero HP', () => {
  const html=renderToStaticMarkup(<MapGeometryDurabilityFields entity={{blocksMovement:true,blocksVision:true,blocksLineOfEffect:true}} onChange={()=>{}} />)
  expect(html).toContain('placeholder="未记录"')
  expect(html).toContain('value=""')
  expect(html).not.toContain('已摧毁')
  expect(html).not.toContain('几何当前耐久')
})
it('shows authored destroyed durability and threshold separately', () => {
  const html=renderToStaticMarkup(<MapGeometryDurabilityFields entity={{blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,
    dnd5eDurability:{hitPoints:0,maxHitPoints:20,damageThreshold:5}}} onChange={()=>{}} />)
  expect(html).toContain('几何当前耐久')
  expect(html).toContain('value="0"')
  expect(html).toContain('value="20"')
  expect(html).toContain('value="5"')
  expect(html).toContain('已摧毁')
})

it('retains the wall defenses when the DM edits maximum durability',()=>{
 const durability={hitPoints:300,maxHitPoints:360,damageThreshold:0,armorClass:15,damageImmunities:['poison','psychic'] as const}
 let patch:import('../../lib/mapGeometry').MapGeometryEntityPatch|undefined
 const tree=MapGeometryDurabilityFields({entity:{blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,dnd5eDurability:{...durability,damageImmunities:[...durability.damageImmunities]}},onChange:value=>{patch=value}})
 const firstLabel=tree.props.children[0]
 const input=firstLabel.props.children.find((child:unknown)=>typeof child==='object'&&child!==null&&'props' in child)
 input.props.onChange({target:{value:'180'}})
 expect(patch?.dnd5eDurability).toEqual({...durability,maxHitPoints:180,hitPoints:180})
})

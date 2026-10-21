import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import {MapObjectSurfaceEditor} from './MapObjectSurfaceEditor'
it('requires explicit dimensions before saving an unrecorded surface',()=>{
 const html=renderToStaticMarkup(createElement(MapObjectSurfaceEditor,{value:undefined,onChange:()=>{}}))
 expect(html).toContain('未记录')
 expect(html).toMatch(/<button[^>]*disabled=""[^>]*>保存材质与尺寸/)
 for(const label of ['物件表面材质','物件实际宽度（尺）','物件实际长度（尺）','物件实际高度（尺）'])expect(html).toContain(label)
})
it('shows saved material and fractional dimensions',()=>{
 const html=renderToStaticMarkup(createElement(MapObjectSurfaceEditor,{value:{material:'stone',widthFeet:0.5,lengthFeet:1,heightFeet:0.25,rotationDegrees:45},onChange:()=>{}}))
 expect(html).toContain('value="stone" selected=""')
 expect(html).toContain('value="0.25"')
 expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>保存材质与尺寸/)
})

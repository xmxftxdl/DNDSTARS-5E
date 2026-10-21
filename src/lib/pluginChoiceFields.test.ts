import { expect, it } from 'vitest'
import { readPluginChoiceFields, type PluginChoiceField } from './pluginChoiceFields'
const fields: PluginChoiceField[] = [ { id: 'shape', label: '影像', kind: 'text', required: true },
  { id: 'color', label: '颜色', kind: 'color', defaultValue: '#ffaa00' } ]
it('accepts only declared unique multi-select IDs, including an explicit empty selection',()=>{
 const field:PluginChoiceField={id:'delegates',label:'授权生物',kind:'multi-select',options:[{id:'hero',label:'Hero'},{id:'monster',label:'Monster'}]}
 expect(readPluginChoiceFields([field],{})).toEqual({delegates:'[]'})
 expect(readPluginChoiceFields([field],{delegates:'["monster","hero"]'})).toEqual({delegates:'["monster","hero"]'})
 for(const delegates of ['["outsider"]','["hero","hero"]','{}','[3]','not-json','x'.repeat(65537)])expect(readPluginChoiceFields([field],{delegates})).toBeUndefined()
 expect(readPluginChoiceFields([{...field,required:true}],{})).toBeUndefined()
 expect(readPluginChoiceFields([{...field,options:[field.options![0],field.options![0]]}],{})).toBeUndefined()
})
it('accepts literal description text and an explicit color without interpreting content', () => {
  expect(readPluginChoiceFields(fields, { shape: ' <script>image</script> ', color: '#123aBC' }))
    .toEqual({ shape: '<script>image</script>', color: '#123aBC' })
})
it('uses only declared defaults', () => {
  expect(readPluginChoiceFields(fields, { shape: '城堡' })).toEqual({ shape: '城堡', color: '#ffaa00' })
})
it.each([null, [], { shape: '' }, { shape: 'x'.repeat(501) }, { shape: 3 },
  { shape: '城堡', color: 'red' }, { shape: '城堡', casterId: 'another' }])('rejects invalid appearance values %j', raw => {
  expect(readPluginChoiceFields(fields, raw)).toBeUndefined()
})
it('rejects duplicate and unsafe field IDs', () => {
  expect(readPluginChoiceFields([fields[0], fields[0]], { shape: 'x' })).toBeUndefined()
  expect(readPluginChoiceFields([{ ...fields[0], id: '__proto__' }], {})).toBeUndefined()
})
it('accepts bounded drawing payloads and rejects malformed vector data',()=>{
 const field:PluginChoiceField={id:'drawing',label:'形状',kind:'surface-drawing',required:true}
 const valid=JSON.stringify({version:1,strokes:[{points:[0,0,1,1],color:'#0088ff',width:0.02}]})
 expect(readPluginChoiceFields([field],{drawing:valid})).toEqual({drawing:valid})
 expect(readPluginChoiceFields([field],{drawing:'{"version":1,"strokes":[]}'})).toBeUndefined()
 expect(readPluginChoiceFields([field],{drawing:'x'.repeat(65537)})).toBeUndefined()
})

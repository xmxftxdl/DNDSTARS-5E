import { expect, it } from 'vitest'
import { adoptedD20Index, diceCheckModeLabel, diceCheckResultLabel } from './diceCheckPresentation'
for (const [mode, values, selected] of [
 ['advantage',[1,20],1],['disadvantage',[1,20],0],
 ['advantage',[18,3],0],['disadvantage',[18,3],1],
 ['advantage',[12,12],0],['disadvantage',[12,12],0],
] as const) it(`${mode} ${values} adopts exactly one die`,()=>{
 expect(adoptedD20Index(values,{mode})).toBe(selected)
})
it('does not highlight free dice and does not announce an unknown outcome',()=>{
 expect(adoptedD20Index([15,2])).toBeUndefined()
 expect(adoptedD20Index([15],{mode:'normal',kind:'attack',success:true})).toBeUndefined()
 expect(adoptedD20Index([15,2],{mode:'normal',kind:'check'})).toBeUndefined()
 expect(adoptedD20Index([],{mode:'advantage'})).toBeUndefined()
 expect(diceCheckResultLabel({mode:'advantage',kind:'save'})).toBeUndefined()
})
it('labels attack and saving throws distinctly',()=>{
 expect(diceCheckModeLabel({mode:'disadvantage'})).toContain('取低')
 expect(diceCheckModeLabel({mode:'advantage'})).toContain('取高')
 expect(diceCheckResultLabel({mode:'normal',kind:'attack',success:false})).toBe('未命中')
 expect(diceCheckResultLabel({mode:'advantage',kind:'save',success:true})).toBe('豁免成功')
})

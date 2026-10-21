import {expect,it} from 'vitest'
import {recordDailyStructureCasting,type StructureCastingHistory} from '../../../shared/structure-casting-history.mjs'
import type {StructureLifetime} from '../../../shared/structure-lifetime.mjs'
const record=(day:number,patch:Partial<StructureLifetime>={}):StructureLifetime=>({id:`temple:${day}`,casterId:'caster',replacementGroup:'temple-of-the-gods',siteKey:'site',createdWorldMinute:day*1440+60,expiresWorldMinute:(day+1)*1440+60,entityIds:[`wall:${day}`],...patch})
it('requires 365 consecutive campaign days and survives history serialization',()=>{
 let history:StructureCastingHistory[]=[]
 for(let day=0;day<365;day++){
  const entry=record(day),result=recordDailyStructureCasting(JSON.parse(JSON.stringify(history)),entry,entry.createdWorldMinute)
  expect(result.permanent).toBe(day===364)
  history=result.history
 }
 expect(()=>recordDailyStructureCasting(history,record(364),record(364).createdWorldMinute)).toThrow('replay')
})
it('does not count repeated same-day casts and resets a missed day or changed site',()=>{
 let history:StructureCastingHistory[]=[]
 for(let index=0;index<400;index++){
  const entry=record(0,{id:`repeat:${index}`,createdWorldMinute:60+index})
  const result=recordDailyStructureCasting(history,entry,entry.createdWorldMinute)
  expect(result.permanent).toBe(false);history=result.history
 }
 const skipped=record(2),gap=recordDailyStructureCasting(history,skipped,skipped.createdWorldMinute)
 expect(gap.history[0].firstWorldMinute).toBe(skipped.createdWorldMinute)
 const changed=record(3,{siteKey:'new-site'})
 const result=recordDailyStructureCasting(gap.history,changed,changed.createdWorldMinute)
 expect(result.history.find(h=>h.siteKey==='new-site')!.firstWorldMinute).toBe(changed.createdWorldMinute)
 expect(result.permanent).toBe(false)
})

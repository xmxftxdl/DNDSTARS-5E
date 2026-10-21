import {expect,it} from 'vitest'
import {dnd5eBenefitHistoryRecordId,dnd5eMatchingBenefitHistoryRecords,dnd5eStoreBenefitHistoryRecord,type Dnd5eBenefitHistoryAuthorityRecordV1} from './spellAuthorityState'
const record=(pkg:string,key='wedding',scope?:'package'|'ruleset'):Dnd5eBenefitHistoryAuthorityRecordV1=>({schemaVersion:1,id:dnd5eBenefitHistoryRecordId(pkg,key,scope),kind:'benefit-history',sourceActorId:'caster',subjectActorId:'recipient',sourceActivityId:'rite',createdWorldMinute:0,sourcePackageId:pkg,benefitKey:key,benefitScope:scope})
it('recognizes all legacy packages only when sharing is explicitly declared',()=>{
 const a=record('a'),b=record('b'),other=record('a','dedication'),records={[a.id]:a,[b.id]:b,[other.id]:other}
 expect(dnd5eMatchingBenefitHistoryRecords(records,'c','wedding')).toEqual([])
 expect(dnd5eMatchingBenefitHistoryRecords(records,'c','wedding','ruleset')).toEqual([a,b])
 expect(dnd5eMatchingBenefitHistoryRecords(records,'a','wedding')).toEqual([a])
})
it('coalesces legacy histories on authorized renewal without deleting different benefits',()=>{
 const a=record('a'),b=record('b'),other=record('a','dedication'),records={[a.id]:a,[b.id]:b,[other.id]:other}
 const updated=dnd5eStoreBenefitHistoryRecord(records,{...record('c','wedding','ruleset'),createdWorldMinute:100})
 expect(Object.keys(updated)).toHaveLength(2);expect(updated[other.id]).toEqual(other)
 expect(updated[dnd5eBenefitHistoryRecordId('c','wedding','ruleset')].createdWorldMinute).toBe(100)
 expect(Object.keys(records)).toHaveLength(3)
})
it('cannot downgrade an existing shared record by omitting scope on renewal',()=>{
 const a=record('a','wedding','ruleset'),updated=dnd5eStoreBenefitHistoryRecord({[a.id]:a},record('b'))
 expect(Object.values(updated)).toEqual([{...record('b','wedding','ruleset')}])
 expect(dnd5eMatchingBenefitHistoryRecords(updated,'c','wedding')).toHaveLength(1)
})

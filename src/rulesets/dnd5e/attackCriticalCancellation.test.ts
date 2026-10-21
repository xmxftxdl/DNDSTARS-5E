import {expect,it} from 'vitest'
import {resolveDnd5eAttackOutcome,resolveDnd5eAttackRollOutcome,DND5E_TOTAL_COVER_ARMOR_CLASS} from './attackResolution'

it.each([
 {d20:20,total:20,ac:99,threshold:20,automatic:false,hit:true,critical:true},
 {d20:19,total:19,ac:99,threshold:19,automatic:false,hit:true,critical:true},
 {d20:18,total:18,ac:99,threshold:18,automatic:false,hit:true,critical:true},
 {d20:12,total:22,ac:20,threshold:20,automatic:true,hit:true,critical:true},
 {d20:12,total:12,ac:20,threshold:20,automatic:true,hit:false,critical:false},
 {d20:1,total:101,ac:10,threshold:20,automatic:true,hit:false,critical:false},
 {d20:20,total:120,ac:DND5E_TOTAL_COVER_ARMOR_CLASS,threshold:20,automatic:true,hit:false,critical:false},
 {d20:12,total:22,ac:20,threshold:20,automatic:false,hit:true,critical:false},
])('cancels only critical status at d20=$d20 AC=$ac threshold=$threshold', c=>{
 const roll={d20:c.d20,total:c.total,modifier:c.total-c.d20,mode:'normal' as const,naturalOne:c.d20===1,naturalTwenty:c.d20===20}
 const input={roll,targetArmorClass:c.ac,criticalThreshold:c.threshold,automaticCritical:c.automatic}
 expect(resolveDnd5eAttackRollOutcome(input)).toEqual({hit:c.hit,critical:c.critical})
 expect(resolveDnd5eAttackRollOutcome({...input,cancelCritical:true})).toEqual({hit:c.hit,critical:false})
 const attack={roll,targetAc:c.ac,hit:c.hit,critical:c.critical}
 const before=structuredClone(attack)
 const final=resolveDnd5eAttackOutcome({attack,criticalThreshold:c.threshold,automaticCritical:c.automatic,cancelCritical:true})
 expect(final).toMatchObject({hit:c.hit,critical:false,roll})
 expect(attack).toEqual(before)
})

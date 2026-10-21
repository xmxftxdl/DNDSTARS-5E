import {expect,it} from 'vitest'
import {endingSaveChoiceId,restoreEndingSaveChoice} from './endingSaveChoiceRecovery'
import {createCombatInterrupt} from '../../lib/combatInterruptQueue'
const transaction=JSON.stringify(['effect-end-save','map','actor','effect',123])
const expected={id:endingSaveChoiceId(transaction,'map','bardic-inspiration','hero')!,mapId:'map',kind:'bardic-inspiration',targetId:'hero',responseKey:'useBardicInspiration'}
const request=()=>createCombatInterrupt({id:expected.id,mapId:'map',kind:'bardic-inspiration',targetCharId:'hero',transactionId:transaction,payload:{}})
it('uses the same identity after reload and separates instances, choices and targets',()=>{
 expect(endingSaveChoiceId(JSON.parse(JSON.stringify(transaction)),'map','bardic-inspiration','hero')).toBe(expected.id)
 for(const [tx,kind,target] of [[transaction+' ','bardic-inspiration','hero'],[transaction,'dark-ones-own-luck','hero'],[transaction,'bardic-inspiration','other']]) expect(endingSaveChoiceId(tx,'map',kind,target)).not.toBe(expected.id)
 expect(endingSaveChoiceId('ordinary-attack','map','bardic-inspiration','hero')).toBeUndefined()
})
it.each([true,false])('restores confirmed use=%s without a new prompt',value=>{
 for(const status of ['answered','done'] as const) expect(restoreEndingSaveChoice({...request(),status,response:{useBardicInspiration:value}},expected)).toEqual({type:'resolve',value})
})
it('waits for pending and publishes only absent choices',()=>{
 expect(restoreEndingSaveChoice(request(),expected)).toEqual({type:'wait'})
 expect(restoreEndingSaveChoice(undefined,expected)).toEqual({type:'publish'})
})
it('rejects rollback, invalid responses and mismatched owners',()=>{
 expect(()=>restoreEndingSaveChoice({...request(),status:'rolled-back'},expected)).toThrow('rolled-back')
 expect(()=>restoreEndingSaveChoice({...request(),status:'done',response:{}},expected)).toThrow('response-invalid')
 expect(()=>restoreEndingSaveChoice({...request(),targetCharId:'other'},expected)).toThrow('mismatch')
})

import {expect,it} from 'vitest'
import {mutateCampaignTimeState} from '../../scripts/shared-server-core.mjs'
import {normalizeSharedCampaignTime,validateSharedCampaignTime,advanceCampaignTimeSnapshot} from './campaignTime'

const host={role:'dm',memberId:'host'}
const start={operation:'start-rest-session',id:'rest-1',kind:'short-rest',characterIds:['hero'],expectedWorldMinute:480}
const run=(state:unknown,mutation:Record<string,unknown>,context={restCharacterIds:['hero','ally']})=>mutateCampaignTimeState(state,mutation,10,host,{host,...context})
function success(state:unknown,mutation:Record<string,unknown>){
  const result=run(state,mutation)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(!result.ok)throw Error(result.error)
  expect(validateSharedCampaignTime(result.next)).toBe(true)
  return normalizeSharedCampaignTime(result.next)
}

it('authenticates starts, checks the server roster and derives authority fields',()=>{
  expect(mutateCampaignTimeState(null,start,10,{role:'player',memberId:'player'},{host,restCharacterIds:['hero']})).toMatchObject({ok:false,error:'dm-authority-required'})
  expect(run(null,start,{restCharacterIds:[]})).toMatchObject({ok:false,error:'rest-participant-unavailable'})
  const result=success(null,{...start,status:'completed',startedAtWorldMinute:0,startedByMemberId:'forged'})
  expect(result.restSessions?.[0]).toMatchObject({status:'active',startedAtWorldMinute:480,startedByMemberId:'host'})
  expect(result.worldMinute).toBe(480)
  expect(result.advances).toEqual([])
  expect(normalizeSharedCampaignTime(JSON.parse(JSON.stringify(result))).restSessions).toEqual(result.restSessions)
})

it('preserves terminal identity and rejects conflicts, overlapping participants and stale clocks',()=>{
  const first=success(null,start)
  expect(success(first,start)).toEqual(first)
  expect(run(first,{...start,kind:'long-rest'})).toMatchObject({ok:false,error:'rest-session-id-conflict'})
  expect(run(first,{...start,id:'another'})).toMatchObject({ok:false,error:'rest-participant-already-resting'})
  expect(run(first,{...start,id:'another',characterIds:['ally'],expectedWorldMinute:479})).toMatchObject({ok:false,error:'stale-rest-session-clock'})
  const ended=success(first,{operation:'interrupt-rest-session',id:start.id,expectedWorldMinute:480})
  expect(ended.restSessions?.[0].status).toBe('interrupted')
  expect(success(ended,start)).toEqual(ended)
  expect(first.restSessions?.[0].status).toBe('active')
})

it.each(['advance','short-rest','long-rest','set-time'])('ordinary %s cannot certify an active rest',operation=>{
  const first=success(null,start)
  const mutation=operation==='set-time'?{operation,displayMode:'campaign-day',day:1,hour:8,minute:1}:{operation,minutes:1}
  const next=success(first,mutation)
  expect(next.restSessions?.[0]).toMatchObject({status:'interrupted',interruptionReason:'unverified-time-advance',interruptedAtWorldMinute:next.worldMinute})
  if(operation==='advance')expect(advanceCampaignTimeSnapshot({state:first,minutes:1,reason:'Test',now:10})?.restSessions).toEqual(next.restSessions)
})

it('rejects malformed saved sessions without clearing the clock or replay guard',()=>{
  const first=success(null,start)
  for(const patch of [{status:'completed'},{characterIds:[]},{characterIds:['hero','hero']},{startedAtWorldMinute:481}]){
    const corrupt={...first,restSessions:[{...first.restSessions![0],...patch}]}
    expect(validateSharedCampaignTime(corrupt)).toBe(false)
    expect(run(corrupt,{operation:'advance',minutes:1})).toMatchObject({ok:false,error:'invalid-rest-session-state'})
  }
})

it.each(['short-rest','long-rest'])('completes %s exactly once with persisted participant and advance evidence',kind=>{
  const first=success(null,{...start,kind})
  const request={operation:'complete-rest-session',id:start.id,expectedWorldMinute:480,beneficiaryCharacterIds:['forged'],minutes:1}
  const completed=success(first,request)
  expect(completed.worldMinute).toBe(kind==='long-rest'?960:540)
  expect(completed.advances).toHaveLength(1)
  expect(completed.advances[0]).toMatchObject({kind,beneficiaryCharacterIds:['hero'],fromWorldMinute:480})
  expect(completed.restSessions?.[0]).toMatchObject({status:'completed',completionAdvanceId:completed.advances[0].id,completedAtWorldMinute:completed.worldMinute})
  const restored=normalizeSharedCampaignTime(JSON.parse(JSON.stringify(completed)))
  expect(success(restored,request)).toEqual(restored)
  expect(success(restored,{...start,kind})).toEqual(restored)
  const forged={...completed,restSessions:[{...completed.restSessions![0],completionAdvanceId:'missing'}]}
  expect(validateSharedCampaignTime(forged)).toBe(false)
})

it('rejects interrupted, missing-participant and stale completions without advancing time',()=>{
  const first=success(null,start)
  const request={operation:'complete-rest-session',id:start.id,expectedWorldMinute:480}
  expect(run(first,{...request,expectedWorldMinute:479})).toMatchObject({ok:false,error:'stale-rest-session-clock'})
  expect(run(first,request,{restCharacterIds:[]})).toMatchObject({ok:false,error:'rest-participant-unavailable'})
  const interrupted=success(first,{operation:'interrupt-rest-session',id:start.id,expectedWorldMinute:480})
  expect(run(interrupted,request)).toMatchObject({ok:false,error:'rest-session-not-active'})
  expect(first.worldMinute).toBe(480)
  expect(first.advances).toEqual([])
})

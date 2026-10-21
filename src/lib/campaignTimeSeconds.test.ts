import {expect,it} from 'vitest'
import {mutateCampaignTimeState,validateSharedStateShape} from '../../scripts/shared-server-core.mjs'
import {formatCampaignTime,normalizeSharedCampaignTime,validateSharedCampaignTime} from './campaignTime'
const dm={memberId:'dm',role:'dm'}
it('advances six-second exploration ticks without rounding them up to minutes',()=>{
 let state=normalizeSharedCampaignTime({worldMinute:100,updatedAt:1})
 for(let index=1;index<=10;index++){
  const result=mutateCampaignTimeState(state,{operation:'advance-seconds',seconds:6},index+1,dm)
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error)
  state=normalizeSharedCampaignTime(JSON.parse(JSON.stringify(result.next)))
  expect(state.worldMinute).toBe(index===10?101:100)
  expect(state.worldSecondRemainder).toBe(index===10?0:index*6)
  expect(validateSharedCampaignTime(state)).toBe(true)
  expect(validateSharedStateShape('campaign-time',state).ok).toBe(true)
 }
 expect(state.advances).toHaveLength(1)
 expect(formatCampaignTime({...state,worldSecondRemainder:6})).toBe('第 1 日 01:41:06')
 expect(state.advances[0]).toMatchObject({fromWorldMinute:100,toWorldMinute:101,minutes:1})
 const minute=mutateCampaignTimeState({...state,worldSecondRemainder:6},{operation:'advance',minutes:1},20,dm)
 expect(minute.ok&&minute.next).toMatchObject({worldMinute:102,worldSecondRemainder:6})
})
it('rejects player clock changes and malformed seconds while preserving legacy clocks',()=>{
 const state=normalizeSharedCampaignTime(null)
 expect(state.worldSecondRemainder).toBeUndefined()
 expect(mutateCampaignTimeState(state,{operation:'advance-seconds',seconds:6},2,{memberId:'player',role:'player'})).toMatchObject({ok:false,status:403})
 for(const seconds of [0,-1,.1,Infinity,3601,'6'])expect(mutateCampaignTimeState(state,{operation:'advance-seconds',seconds},2,dm).ok).toBe(false)
 for(const worldSecondRemainder of [-1,60,.1,'6']){
  expect(validateSharedCampaignTime({...state,worldSecondRemainder})).toBe(false)
  expect(validateSharedStateShape('campaign-time',{...state,worldSecondRemainder}).ok).toBe(false)
 }
})

import { expect, it } from 'vitest'
import { mutateCampaignTimeState } from '../../scripts/shared-server-core.mjs'
import { recordCampaignLongRestLocations, validCampaignRestLocations } from '../../shared/campaign-rest-locations.mjs'
import { normalizeSharedCampaignTime, validateSharedCampaignTime } from './campaignTime'

const host={role:'dm',memberId:'host'}
const map={id:'camp',dnd5ePlane:'material',width:1000,height:1000,tokens:[{id:'token',type:'player',characterId:'hero',x:325,y:325}]}
const context={host,restCharacterIds:['hero'],restMaps:[map]}

it('records a completed long rest from Host positions, survives reload, and ignores submitted destinations',()=>{
  const initial=normalizeSharedCampaignTime(null)
  const started=mutateCampaignTimeState(initial,{operation:'start-rest-session',id:'rest',kind:'long-rest',characterIds:['hero'],expectedWorldMinute:480},1,host,context)
  expect(started.ok).toBe(true)
  if(!started.ok)throw Error(started.error)
  const finished=mutateCampaignTimeState(started.next,{operation:'complete-rest-session',id:'rest',expectedWorldMinute:480,restLocations:[{mapId:'forged',x:999,y:999}]},2,host,context)
  expect(finished.ok).toBe(true)
  if(!finished.ok)throw Error(finished.error)
  expect(finished.next.restLocations).toEqual([{characterId:'hero',plane:'material',mapId:'camp',x:325,y:325,elevationFeet:0,completedAtWorldMinute:960}])
  expect(started.next.restLocations).toBeUndefined()
  const saved=JSON.parse(JSON.stringify(finished.next))
  expect(validateSharedCampaignTime(saved)).toBe(true)
  expect(normalizeSharedCampaignTime(saved).restLocations).toEqual(finished.next.restLocations)
  const replay=mutateCampaignTimeState(saved,{operation:'complete-rest-session',id:'rest',expectedWorldMinute:480},3,host,{...context,restMaps:[{...map,tokens:[{...map.tokens[0],x:500}]}]})
  expect(replay.ok&&replay.changed).toBe(false)
  if(!replay.ok)throw Error(replay.error)
  expect(replay.next.restLocations).toEqual(saved.restLocations)
  const short=mutateCampaignTimeState(saved,{operation:'short-rest'},4,host,context)
  expect(short.ok&&short.next.restLocations).toEqual(saved.restLocations)
})

it('keeps the last destination per plane and skips unknown or ambiguous locations',()=>{
  const first=recordCampaignLongRestLocations(undefined,[map],['hero'],960)
  const other=recordCampaignLongRestLocations(first,[{...map,id:'fey-camp',dnd5ePlane:'feywild'}],['hero'],2400)
  expect(other).toHaveLength(2)
  const latest=recordCampaignLongRestLocations(other,[{...map,tokens:[{...map.tokens[0],x:600}]}],['hero'],4000)
  expect(latest.find(row=>row.plane==='material')?.x).toBe(600)
  expect(latest.find(row=>row.plane==='feywild')?.completedAtWorldMinute).toBe(2400)
  for(const maps of [[],[{...map,dnd5ePlane:undefined}]]){
    expect(recordCampaignLongRestLocations(latest,maps,['hero'],5000)).toEqual([])
  }
  for(const maps of [[map,{...map,id:'duplicate'}],[{...map,tokens:[{...map.tokens[0],x:-1}]}]]){
    expect(recordCampaignLongRestLocations(latest,maps,['hero'],5000)).toEqual(latest.filter(row=>row.plane==='feywild'))
  }
  expect(recordCampaignLongRestLocations(latest,[map],['other'],5000)).toEqual(latest)
  expect(first[0].x).toBe(325)
})

it('rejects malformed records in both server and client validation',()=>{
  const valid=recordCampaignLongRestLocations(undefined,[map],['hero'],480)
  for(const records of [[{...valid[0],x:NaN}],[{...valid[0],completedAtWorldMinute:481}],[valid[0],valid[0]],[{...valid[0],plane:''}]]){
    expect(validCampaignRestLocations(records,480)).toBe(false)
    const state={...normalizeSharedCampaignTime(null),restLocations:records}
    expect(validateSharedCampaignTime(state)).toBe(false)
    expect(mutateCampaignTimeState(state,{operation:'long-rest'},1,host,context)).toMatchObject({ok:false,error:'invalid-rest-locations'})
  }
  expect(mutateCampaignTimeState(null,{operation:'long-rest'},1,{role:'player',memberId:'player'},context).ok).toBe(false)
})

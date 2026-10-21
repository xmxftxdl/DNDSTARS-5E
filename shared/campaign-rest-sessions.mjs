const id = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 160
const minute = value => Number.isSafeInteger(value) && value >= 0
const participants = value => Array.isArray(value) && value.length > 0 && value.length <= 64 && value.every(id) && new Set(value).size === value.length

/** Keep terminal identities: replaying a start must never reopen a rest. */
export function validCampaignRestSessions(value, worldMinute, advances) {
  if (value == null) return true
  return Array.isArray(value) && value.length <= 128 && new Set(value.map(row=>row?.id)).size===value.length && value.every(row=>
    row && id(row.id) && ['short-rest','long-rest'].includes(row.kind) && participants(row.characterIds) &&
    minute(row.startedAtWorldMinute) && row.startedAtWorldMinute <= worldMinute && id(row.startedByMemberId) && minute(row.createdAt) &&
    (row.status==='completed' ? minute(row.completedAtWorldMinute) && row.completedAtWorldMinute===row.startedAtWorldMinute+(row.kind==='long-rest'?480:60) && row.completedAtWorldMinute<=worldMinute &&
      id(row.completionAdvanceId) && row.interruptedAtWorldMinute==null && row.interruptionReason==null && Array.isArray(advances) &&
      (advances.some(advance=>advance?.id===row.completionAdvanceId && advance.kind===row.kind && advance.fromWorldMinute===row.startedAtWorldMinute && advance.toWorldMinute===row.completedAtWorldMinute && Array.isArray(advance.beneficiaryCharacterIds) && JSON.stringify([...advance.beneficiaryCharacterIds].sort())===JSON.stringify([...row.characterIds].sort())) ||
        (advances.length>0 && minute(advances[0]?.fromWorldMinute) && row.completedAtWorldMinute<=advances[0].fromWorldMinute)) :
    row.completedAtWorldMinute==null && row.completionAdvanceId==null && (row.status==='active' ? row.interruptedAtWorldMinute==null && row.interruptionReason==null :
      row.status==='interrupted' && minute(row.interruptedAtWorldMinute) && row.interruptedAtWorldMinute>=row.startedAtWorldMinute &&
      row.interruptedAtWorldMinute<=worldMinute && ['host-interrupted','unverified-time-advance'].includes(row.interruptionReason))))
}

/** Server authenticates the Host and supplies the current character roster. No recovery benefits here. */
export function mutateCampaignRestSession(base, mutation, now, memberId, characterIds) {
  const fail=error=>({ok:false,status:409,error})
  if(!id(memberId)||!minute(now)||!validCampaignRestSessions(base.restSessions,base.worldMinute,base.advances))return fail('invalid-rest-session-state')
  const rows=base.restSessions??[]
  if(!id(mutation.id))return fail('invalid-rest-session-id')
  const existing=rows.find(row=>row.id===mutation.id)
  if(mutation.operation==='start-rest-session'){
    if(!['short-rest','long-rest'].includes(mutation.kind)||!participants(mutation.characterIds))return fail('invalid-rest-session-start')
    const requested=[...mutation.characterIds].sort()
    if(existing)return existing.kind===mutation.kind&&JSON.stringify([...existing.characterIds].sort())===JSON.stringify(requested)
      ? {ok:true,changed:false,next:base}:fail('rest-session-id-conflict')
    if(mutation.expectedWorldMinute!==base.worldMinute)return fail('stale-rest-session-clock')
    if(!Array.isArray(characterIds)||requested.some(id=>characterIds.filter(value=>value===id).length!==1))return fail('rest-participant-unavailable')
    if(rows.some(row=>row.status==='active'&&row.characterIds.some(id=>requested.includes(id))))return fail('rest-participant-already-resting')
    if(rows.length>=128)return fail('rest-session-record-limit')
    const row={id:mutation.id,kind:mutation.kind,characterIds:requested,status:'active',startedAtWorldMinute:base.worldMinute,startedByMemberId:memberId,createdAt:now}
    return {ok:true,changed:true,next:{...base,restSessions:[...rows,row],updatedAt:now}}
  }
  if(mutation.operation==='interrupt-rest-session'){
    if(!existing)return fail('rest-session-not-found')
    if(existing.status!=='active')return {ok:true,changed:false,next:base}
    if(mutation.expectedWorldMinute!==base.worldMinute)return fail('stale-rest-session-clock')
    return {ok:true,changed:true,next:{...base,restSessions:rows.map(row=>row.id===mutation.id?{...row,status:'interrupted',interruptedAtWorldMinute:base.worldMinute,interruptionReason:'host-interrupted'}:row),updatedAt:now}}
  }
  return fail('invalid-rest-session-operation')
}

export function interruptCampaignRestSessionsForTimeAdvance(rows, worldMinute) {
  return rows?.map(row=>row.status==='active'?{...row,status:'interrupted',interruptedAtWorldMinute:worldMinute,interruptionReason:'unverified-time-advance'}:row)
}

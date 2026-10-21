export function normalizeStructureCastingHistory(value){
 if(!Array.isArray(value)||value.length>1024)return undefined
 const keys=new Set(),result=[]
 for(const entry of value){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>!['casterId','replacementGroup','siteKey','firstWorldMinute','lastWorldMinute','lastCastId'].includes(key))||
   !['casterId','replacementGroup','siteKey','lastCastId'].every(key=>typeof entry[key]==='string'&&entry[key].length>0&&entry[key].length<=160)||
   ![entry.firstWorldMinute,entry.lastWorldMinute].every(minute=>Number.isSafeInteger(minute)&&minute>=0)||entry.firstWorldMinute>entry.lastWorldMinute)return undefined
  const key=JSON.stringify([entry.casterId,entry.replacementGroup,entry.siteKey])
  if(keys.has(key))return undefined
  keys.add(key);result.push({...entry})
 }
 return result
}

/** The caller supplies authoritative time; repeated deliveries cannot build a streak. */
export function recordStructureCasting(history,record,worldMinute,intervalMinutes,requiredMinutes){
 const entries=normalizeStructureCastingHistory(history??[])
 if(!entries||![worldMinute,intervalMinutes,requiredMinutes].every(Number.isSafeInteger)||worldMinute<0||intervalMinutes<=0||requiredMinutes<=0||
   record.createdWorldMinute!==worldMinute)throw new Error('structure-casting-history-invalid')
 const same=entry=>entry.casterId===record.casterId&&entry.replacementGroup===record.replacementGroup&&entry.siteKey===record.siteKey
 const prior=entries.find(same)
 if(prior&&(prior.lastWorldMinute>worldMinute||prior.lastCastId===record.id))throw new Error('structure-casting-history-replay')
 const first=prior&&worldMinute-prior.lastWorldMinute<=intervalMinutes?prior.firstWorldMinute:worldMinute
 const entry={casterId:record.casterId,replacementGroup:record.replacementGroup,siteKey:record.siteKey,
   firstWorldMinute:first,lastWorldMinute:worldMinute,lastCastId:record.id}
 const next=normalizeStructureCastingHistory([...entries.filter(value=>!same(value)),entry])
 if(!next)throw new Error('structure-casting-history-invalid')
 return {history:next,permanent:worldMinute-first>=requiredMinutes}
}

/** One casting on each campaign calendar day; additional same-day casts cannot shorten a year. */
export function recordDailyStructureCasting(history,record,worldMinute,requiredDays=365){
 if(!Number.isSafeInteger(requiredDays)||requiredDays<1)throw new Error('structure-casting-history-invalid')
 const checked=recordStructureCasting(history,record,worldMinute,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER)
 const same=entry=>entry.casterId===record.casterId&&entry.replacementGroup===record.replacementGroup&&entry.siteKey===record.siteKey
 const prior=(history??[]).find(same)
 const day=Math.floor(worldMinute/1440)
 const first=prior&&day-Math.floor(prior.lastWorldMinute/1440)<=1?prior.firstWorldMinute:worldMinute
 const next=checked.history.map(entry=>same(entry)?{...entry,firstWorldMinute:first}:entry)
 return {history:next,permanent:day-Math.floor(first/1440)+1>=requiredDays}
}

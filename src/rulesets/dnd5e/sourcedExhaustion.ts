/** Ordinary fatigue and independently removable spell-instance contributions. */
export interface Dnd5eSourcedExhaustion {
  schemaVersion:1
  baseLevel:number
  sources:{sourceId:string;levels:number;areaLifetime?:Dnd5eExhaustionAreaLifetime}[]
}
export interface Dnd5eExhaustionAreaLifetime { mapId:string; areaId:string; sourceActorId:string }
const validLevel=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=6
const validId=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=2048&&!/[\u0000-\u001f]/.test(value)

export function normalizeDnd5eSourcedExhaustion(value:unknown):Dnd5eSourcedExhaustion|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined
  const raw=value as Record<string,unknown>
  if(Object.keys(raw).some(k=>!['schemaVersion','baseLevel','sources'].includes(k))||raw.schemaVersion!==1||!validLevel(raw.baseLevel)||!Array.isArray(raw.sources)||raw.sources.length>256)return undefined
  const sources:Dnd5eSourcedExhaustion['sources']=[],ids=new Set<string>()
  for(const entry of raw.sources){
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(k=>!['sourceId','levels','areaLifetime'].includes(k))||
      !validId(entry.sourceId)||!validLevel(entry.levels)||entry.levels===0||ids.has(entry.sourceId))return undefined
    const areaLifetime=entry.areaLifetime==null?undefined:normalizeDnd5eExhaustionAreaLifetime(entry.areaLifetime)
    if(entry.areaLifetime!=null&&!areaLifetime)return undefined
    ids.add(entry.sourceId);sources.push({sourceId:entry.sourceId,levels:entry.levels,...(areaLifetime?{areaLifetime}:{})})
  }
  return {schemaVersion:1,baseLevel:raw.baseLevel,sources}
}

export function normalizeDnd5eExhaustionAreaLifetime(value:unknown):Dnd5eExhaustionAreaLifetime|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined
  const raw=value as Record<string,unknown>
  if(Object.keys(raw).some(key=>!['mapId','areaId','sourceActorId'].includes(key))||
    !validId(raw.mapId)||!validId(raw.areaId)||!validId(raw.sourceActorId)||
    [raw.mapId,raw.areaId,raw.sourceActorId].some(id=>id.length>256))return undefined
  return {mapId:raw.mapId,areaId:raw.areaId,sourceActorId:raw.sourceActorId}
}

export function addDnd5eAreaExhaustion(state:Dnd5eSourcedExhaustion,origin:Dnd5eExhaustionAreaLifetime,levels:number):Dnd5eSourcedExhaustion{
  const areaLifetime=normalizeDnd5eExhaustionAreaLifetime(origin)
  if(!areaLifetime)throw new Error('invalid-exhaustion-area-origin')
  const sourceId=`area:${JSON.stringify([areaLifetime.mapId,areaLifetime.areaId,areaLifetime.sourceActorId])}`
  const next=changeDnd5eSourcedExhaustion(state,sourceId,levels)
  return {...next,sources:next.sources.map(source=>source.sourceId===sourceId?{...source,areaLifetime}:source)}
}

/** Display/rules cap; never truncate the stored contributions to fit this cap. */
export function dnd5eSourcedExhaustionLevel(state:Dnd5eSourcedExhaustion):number{
  return Math.min(6,state.baseLevel+state.sources.reduce((sum,source)=>sum+source.levels,0))
}

export function changeDnd5eSourcedExhaustion(state:Dnd5eSourcedExhaustion,sourceId:string,amount:number):Dnd5eSourcedExhaustion{
  const normalized=normalizeDnd5eSourcedExhaustion(state)
  if(!normalized||!validId(sourceId)||!Number.isInteger(amount)||Math.abs(amount)>6)throw new Error('invalid-sourced-exhaustion')
  const previous=normalized.sources.find(source=>source.sourceId===sourceId)
  const levels=Math.max(0,Math.min(6,(previous?.levels??0)+amount))
  const sources=normalized.sources.flatMap(source=>source.sourceId===sourceId
    ? levels>0?[{...source,levels}]:[] : [source])
  if(!previous&&levels>0)sources.push({sourceId,levels})
  if(sources.length>256)throw new Error('sourced-exhaustion-capacity')
  return {...normalized,sources}
}

export function removeDnd5eSourcedExhaustion(state:Dnd5eSourcedExhaustion,sourceId:string):Dnd5eSourcedExhaustion{
  const normalized=normalizeDnd5eSourcedExhaustion(state)
  if(!normalized||!validId(sourceId))throw new Error('invalid-sourced-exhaustion')
  return {...normalized,sources:normalized.sources.filter(source=>source.sourceId!==sourceId)}
}

/** Legacy scalar saves have no removable sources. Valid ledgers are authoritative. */
export function dnd5eExhaustionState(value: unknown, legacyLevel = 0): Dnd5eSourcedExhaustion {
  return normalizeDnd5eSourcedExhaustion(value) ?? {
    schemaVersion: 1,
    baseLevel: Number.isFinite(legacyLevel) ? Math.min(6, Math.max(0, Math.floor(legacyLevel))) : 0,
    sources: [],
  }
}

/**
 * Unattributed gains belong to ordinary fatigue. General recovery removes ordinary
 * fatigue first, then source contributions in acquisition order. This deterministic
 * allocation preserves unrelated sources and prevents recovered levels reappearing.
 */
export function adjustDnd5eOrdinaryExhaustion(state: Dnd5eSourcedExhaustion, amount: number): Dnd5eSourcedExhaustion {
  const next = normalizeDnd5eSourcedExhaustion(state)
  if (!next || !Number.isInteger(amount) || Math.abs(amount) > 6) throw new Error('invalid-sourced-exhaustion')
  if (amount >= 0) return { ...next, baseLevel: Math.min(6, next.baseLevel + amount) }
  let remaining = -amount
  const baseRemoved = Math.min(next.baseLevel, remaining)
  next.baseLevel -= baseRemoved
  remaining -= baseRemoved
  next.sources = next.sources.flatMap(source => {
    const removed = Math.min(source.levels, remaining)
    remaining -= removed
    return source.levels > removed ? [{ ...source, levels: source.levels - removed }] : []
  })
  return next
}
